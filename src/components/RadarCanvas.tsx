import { useEffect, useRef } from 'react';
import { copy } from '../i18n/en';
import { getMapConfig, worldToMap } from '../maps';
import type { MapConfigV1, MapLevelV1, MapPosition } from '../maps';
import type { PlaybackClock } from '../playback/PlaybackClock';
import { findActiveBombEvent } from '../replay/bomb';
import { interpolatePlayerFrame } from '../replay/interpolation';
import { TEAMS, type ReplayV1 } from '../replay/types';
import { mapPlayerStatesByLevel, type MappedPlayerState } from './radarLevels';

interface RadarCanvasProps {
  readonly replay: ReplayV1;
  readonly clock: PlaybackClock;
  readonly roundNumber: number | undefined;
}

interface LevelCanvas {
  readonly level: MapLevelV1;
  readonly panel: HTMLDivElement;
  readonly canvas: HTMLCanvasElement;
  readonly context: CanvasRenderingContext2D;
  cssSize: number;
}

const CT_COLOR = '#58a6ff';
const T_COLOR = '#f6bd4b';
const NO_LEVELS: readonly MapLevelV1[] = [];

function drawPlayer(
  context: CanvasRenderingContext2D,
  name: string,
  x: number,
  y: number,
  yaw: number,
  health: number,
  team: number | undefined,
  scale: number,
): void {
  const color = team === TEAMS.COUNTER_TERRORIST ? CT_COLOR : T_COLOR;
  const radius = Math.max(9, 13 * scale);
  const angle = (-yaw * Math.PI) / 180;

  context.save();
  context.translate(x, y);
  context.rotate(angle);
  context.beginPath();
  context.moveTo(radius * 1.75, 0);
  context.lineTo(radius * 0.65, -radius * 0.45);
  context.lineTo(radius * 0.65, radius * 0.45);
  context.closePath();
  context.fillStyle = color;
  context.globalAlpha = 0.72;
  context.fill();
  context.restore();

  context.save();
  context.shadowBlur = 14 * scale;
  context.shadowColor = color;
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.fillStyle = '#090d12';
  context.fill();
  context.lineWidth = Math.max(2, 2.5 * scale);
  context.strokeStyle = color;
  context.stroke();
  context.shadowBlur = 0;

  context.beginPath();
  context.arc(x, y, radius - 3 * scale, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (health / 100));
  context.lineWidth = Math.max(2, 2.5 * scale);
  context.strokeStyle = health <= 30 ? '#ff5d6c' : '#dcf3ff';
  context.stroke();

  const initial = name.trim().charAt(0).toUpperCase() || '?';
  context.fillStyle = '#f8fbff';
  context.font = `700 ${Math.max(9, 10 * scale)}px ui-sans-serif, system-ui`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(initial, x, y + 0.5 * scale);

  context.font = `600 ${Math.max(9, 11 * scale)}px ui-sans-serif, system-ui`;
  context.textBaseline = 'alphabetic';
  context.shadowBlur = 4;
  context.shadowColor = '#000';
  context.fillText(name, x, y - radius - 6 * scale);
  context.restore();
}

function levelLabel(level: MapLevelV1): string {
  return level.id === 'main' ? copy.mainLevel : `${level.id.toUpperCase()} LEVEL`;
}

function radarAriaLabel(mapConfig: MapConfigV1, level: MapLevelV1): string {
  if (mapConfig.levels.length === 1) return `${mapConfig.displayName} replay radar`;
  return `${mapConfig.displayName} ${level.id} level replay radar`;
}

function drawRadarBackground(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement | undefined,
  cssSize: number,
): void {
  context.clearRect(0, 0, cssSize, cssSize);
  context.fillStyle = '#0a0e13';
  context.fillRect(0, 0, cssSize, cssSize);
  if (image?.complete && image.naturalWidth > 0) {
    context.globalAlpha = 0.9;
    context.drawImage(image, 0, 0, cssSize, cssSize);
    context.globalAlpha = 1;
  }

  const gradient = context.createRadialGradient(
    cssSize / 2,
    cssSize / 2,
    cssSize * 0.15,
    cssSize / 2,
    cssSize / 2,
    cssSize * 0.72,
  );
  gradient.addColorStop(0, 'rgba(4, 8, 12, 0)');
  gradient.addColorStop(1, 'rgba(4, 8, 12, 0.42)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, cssSize, cssSize);
}

function drawBombMarker(
  context: CanvasRenderingContext2D,
  point: MapPosition,
  mapScale: number,
): void {
  const x = point.x * mapScale;
  const y = point.y * mapScale;
  const pulse = 11 + Math.sin(performance.now() / 160) * 3;
  context.beginPath();
  context.arc(x, y, pulse * mapScale, 0, Math.PI * 2);
  context.fillStyle = 'rgba(255, 87, 93, 0.35)';
  context.fill();
  context.fillStyle = '#ff5d65';
  context.font = `800 ${Math.max(10, 12 * mapScale)}px ui-sans-serif, system-ui`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText('B', x, y);
}

function drawDeathMarker(
  context: CanvasRenderingContext2D,
  point: MapPosition,
  mapScale: number,
): void {
  const x = point.x * mapScale;
  const y = point.y * mapScale;
  context.fillStyle = '#ff5d6c';
  context.font = `700 ${Math.max(13, 20 * mapScale)}px "Segoe UI Symbol", sans-serif`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText('\u2620', x, y);
}

function drawLevel(
  levelCanvas: LevelCanvas,
  image: HTMLImageElement | undefined,
  states: readonly MappedPlayerState[],
  players: ReplayV1['players'],
  bombPoint: MapPosition | undefined,
  deathPoints: readonly MapPosition[],
  mapConfig: MapConfigV1,
): void {
  const { context, level, cssSize } = levelCanvas;
  const mapScale = cssSize / mapConfig.resolution.width;

  drawRadarBackground(context, image, cssSize);

  if (bombPoint?.level.id === level.id) drawBombMarker(context, bombPoint, mapScale);

  for (const { playerIndex, state, point } of states) {
    const player = players[playerIndex];
    if (!player || !state.alive || !point.inside) continue;
    drawPlayer(
      context,
      player.name,
      point.x * mapScale,
      point.y * mapScale,
      state.yaw,
      state.health,
      state.team,
      mapScale,
    );
  }

  for (const point of deathPoints) {
    if (point.level.id === level.id && point.inside) drawDeathMarker(context, point, mapScale);
  }
}

export function RadarCanvas({ replay, clock, roundNumber }: RadarCanvasProps) {
  const panelRefs = useRef(new Map<string, HTMLDivElement>());
  const canvasRefs = useRef(new Map<string, HTMLCanvasElement>());
  const mapConfig = getMapConfig(replay.meta.mapName);
  const levels = mapConfig?.levels ?? NO_LEVELS;
  const isMultiLevel = levels.length > 1;

  useEffect(() => {
    if (mapConfig === undefined || levels.length === 0) return undefined;

    const levelCanvases: LevelCanvas[] = [];
    for (const level of levels) {
      const panel = panelRefs.current.get(level.id);
      const canvas = canvasRefs.current.get(level.id);
      const context = canvas?.getContext('2d');
      if (!panel || !canvas || !context) return undefined;
      levelCanvases.push({ level, panel, canvas, context, cssSize: 1 });
    }

    let frame = 0;
    let disposed = false;
    const images = new Map<string, HTMLImageElement>();
    for (const level of levels) {
      const image = new Image();
      image.decoding = 'async';
      image.src = level.image;
      images.set(level.id, image);
    }

    const resize = () => {
      const ratio = Math.min(2, window.devicePixelRatio || 1);
      for (const levelCanvas of levelCanvases) {
        const rect = levelCanvas.panel.getBoundingClientRect();
        levelCanvas.cssSize = Math.max(
          280,
          Math.floor(Math.min(rect.width, rect.height || rect.width)),
        );
        levelCanvas.canvas.width = Math.floor(levelCanvas.cssSize * ratio);
        levelCanvas.canvas.height = Math.floor(levelCanvas.cssSize * ratio);
        levelCanvas.canvas.style.width = `${levelCanvas.cssSize}px`;
        levelCanvas.canvas.style.height = `${levelCanvas.cssSize}px`;
        levelCanvas.context.setTransform(ratio, 0, 0, ratio, 0, 0);
      }
    };

    const observer = new ResizeObserver(resize);
    for (const levelCanvas of levelCanvases) observer.observe(levelCanvas.panel);
    resize();

    const draw = () => {
      if (disposed) return;
      const tick = clock.getTick();
      const playerStates = replay.players.map((_, playerIndex) =>
        interpolatePlayerFrame(replay.frames, playerIndex, tick),
      );
      const statesByLevel = mapPlayerStatesByLevel(mapConfig, playerStates);

      let bombPoint: MapPosition | undefined;
      const bomb = findActiveBombEvent(replay.events, tick, roundNumber);
      if (bomb?.playerId !== undefined) {
        const playerIndex = replay.players.findIndex((player) => player.id === bomb.playerId);
        const state =
          playerIndex >= 0
            ? interpolatePlayerFrame(replay.frames, playerIndex, bomb.tick, { maxGapTicks: 16 })
            : undefined;
        if (state) bombPoint = worldToMap(mapConfig, state);
      }

      const deathPoints: MapPosition[] = [];
      for (const event of replay.events) {
        if (event.type !== 'kill' || event.tick > tick || event.tick < tick - replay.meta.tickRate)
          continue;
        const playerIndex = replay.players.findIndex((player) => player.id === event.victimId);
        const state =
          playerIndex >= 0
            ? interpolatePlayerFrame(replay.frames, playerIndex, event.tick, { maxGapTicks: 16 })
            : undefined;
        if (state) deathPoints.push(worldToMap(mapConfig, state));
      }

      for (const levelCanvas of levelCanvases) {
        drawLevel(
          levelCanvas,
          images.get(levelCanvas.level.id),
          statesByLevel.get(levelCanvas.level.id) ?? [],
          replay.players,
          bombPoint,
          deathPoints,
          mapConfig,
        );
      }

      frame = requestAnimationFrame(draw);
    };

    frame = requestAnimationFrame(draw);
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      for (const image of images.values()) image.src = '';
    };
  }, [clock, levels, mapConfig, replay, roundNumber]);

  if (mapConfig === undefined) {
    return (
      <div className="radar-grid radar-grid--single">
        <div className="radar">
          <canvas aria-label={`${copy.map} replay radar`} role="img" />
        </div>
      </div>
    );
  }

  return (
    <div className={`radar-grid${isMultiLevel ? ' radar-grid--multi' : ' radar-grid--single'}`}>
      {levels.map((level) => (
        <div
          className="radar"
          data-level={level.id}
          key={level.id}
          ref={(node) => {
            if (node) panelRefs.current.set(level.id, node);
            else panelRefs.current.delete(level.id);
          }}
        >
          <canvas
            aria-label={radarAriaLabel(mapConfig, level)}
            ref={(node) => {
              if (node) canvasRefs.current.set(level.id, node);
              else canvasRefs.current.delete(level.id);
            }}
            role="img"
          />
          <div className="radar__label">
            <span>{mapConfig.id.toUpperCase()}</span>
            <small>{levelLabel(level)}</small>
          </div>
          <div className="radar__legend" aria-hidden="true">
            <span>
              <i className="dot dot--ct" /> {copy.counterTerroristAbbreviation}
            </span>
            <span>
              <i className="dot dot--t" /> {copy.terroristAbbreviation}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

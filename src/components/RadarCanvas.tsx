import { useEffect, useRef } from 'react';
import { copy } from '../i18n/en';
import { getMapConfig, worldToMap } from '../maps';
import type { MapConfigV1, MapLevelV1 } from '../maps';
import type { PlaybackClock } from '../playback/PlaybackClock';
import { findActiveBombEvent } from '../replay/bomb';
import { interpolatePlayerFrame, type PlayerFrameState } from '../replay/interpolation';
import { TEAMS, type ReplayV1 } from '../replay/types';

interface RadarCanvasProps {
  readonly replay: ReplayV1;
  readonly clock: PlaybackClock;
  readonly roundNumber: number | undefined;
}

const CT_COLOR = '#58a6ff';
const T_COLOR = '#f6bd4b';

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

function selectVisibleLevel(
  mapConfig: MapConfigV1,
  states: readonly (PlayerFrameState | undefined)[],
  previousLevelId: string | undefined,
): MapLevelV1 {
  const counts = new Map<string, number>();
  for (const state of states) {
    if (!state?.alive) continue;
    const level = worldToMap(mapConfig, state).level;
    counts.set(level.id, (counts.get(level.id) ?? 0) + 1);
  }

  const firstLevel = mapConfig.levels[0];
  if (firstLevel === undefined) {
    throw new RangeError('Map configuration must contain at least one level.');
  }

  let selected = firstLevel;
  let selectedCount = counts.get(selected.id) ?? 0;
  for (const level of mapConfig.levels.slice(1)) {
    const count = counts.get(level.id) ?? 0;
    if (count > selectedCount || (count === selectedCount && level.id === previousLevelId)) {
      selected = level;
      selectedCount = count;
    }
  }
  return selected;
}

function initialLevelLabel(mapConfig: MapConfigV1 | undefined): string {
  const level = mapConfig?.levels[0];
  return level === undefined ? copy.mainLevel : levelLabel(level);
}

export function RadarCanvas({ replay, clock, roundNumber }: RadarCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const levelLabelRef = useRef<HTMLElement>(null);
  const mapConfig = getMapConfig(replay.meta.mapName);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || mapConfig === undefined) return undefined;

    const context = canvas.getContext('2d');
    if (!context) return undefined;

    let frame = 0;
    let cssSize = 1;
    let disposed = false;
    let activeLevelId = mapConfig.levels[0]?.id;
    const images = new Map<string, HTMLImageElement>();
    for (const level of mapConfig.levels) {
      const image = new Image();
      image.decoding = 'async';
      image.src = level.image;
      images.set(level.id, image);
    }

    const resize = () => {
      const rect = container.getBoundingClientRect();
      cssSize = Math.max(280, Math.floor(Math.min(rect.width, rect.height || rect.width)));
      const ratio = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.floor(cssSize * ratio);
      canvas.height = Math.floor(cssSize * ratio);
      canvas.style.width = `${cssSize}px`;
      canvas.style.height = `${cssSize}px`;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    };

    const observer = new ResizeObserver(resize);
    observer.observe(container);
    resize();

    const draw = () => {
      if (disposed) return;
      const tick = clock.getTick();
      const playerStates = replay.players.map((_, playerIndex) =>
        interpolatePlayerFrame(replay.frames, playerIndex, tick),
      );
      const activeLevel = selectVisibleLevel(mapConfig, playerStates, activeLevelId);
      activeLevelId = activeLevel.id;
      if (levelLabelRef.current) levelLabelRef.current.textContent = levelLabel(activeLevel);
      const mapScale = cssSize / mapConfig.resolution.width;

      context.clearRect(0, 0, cssSize, cssSize);
      context.fillStyle = '#0a0e13';
      context.fillRect(0, 0, cssSize, cssSize);
      const image = images.get(activeLevel.id);
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

      const bomb = findActiveBombEvent(replay.events, tick, roundNumber);
      if (bomb?.playerId !== undefined) {
        const playerIndex = replay.players.findIndex((player) => player.id === bomb.playerId);
        const state =
          playerIndex >= 0
            ? interpolatePlayerFrame(replay.frames, playerIndex, bomb.tick, { maxGapTicks: 16 })
            : undefined;
        if (state) {
          const point = worldToMap(mapConfig, state);
          if (point.level.id === activeLevel.id) {
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
        }
      }

      replay.players.forEach((player, playerIndex) => {
        const state = playerStates[playerIndex];
        if (!state?.alive) return;
        const point = worldToMap(mapConfig, state);
        if (point.level.id !== activeLevel.id || !point.inside) return;
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
      });

      const recentDeaths = replay.events.filter(
        (event) =>
          event.type === 'kill' && event.tick <= tick && event.tick >= tick - replay.meta.tickRate,
      );
      for (const death of recentDeaths) {
        if (death.type !== 'kill') continue;
        const playerIndex = replay.players.findIndex((player) => player.id === death.victimId);
        const state =
          playerIndex >= 0
            ? interpolatePlayerFrame(replay.frames, playerIndex, death.tick, { maxGapTicks: 16 })
            : undefined;
        if (!state) continue;
        const point = worldToMap(mapConfig, state);
        if (point.level.id !== activeLevel.id || !point.inside) continue;
        const x = point.x * mapScale;
        const y = point.y * mapScale;
        context.fillStyle = '#ff5d6c';
        context.font = `700 ${Math.max(13, 20 * mapScale)}px "Segoe UI Symbol", sans-serif`;
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText('\u2620', x, y);
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
  }, [clock, mapConfig, replay, roundNumber]);

  return (
    <div className="radar" ref={containerRef}>
      <canvas
        aria-label={`${mapConfig?.displayName ?? copy.map} replay radar`}
        ref={canvasRef}
        role="img"
      />
      <div className="radar__label">
        <span>{mapConfig?.id.toUpperCase() ?? copy.mapIdentifier}</span>
        <small ref={levelLabelRef}>{initialLevelLabel(mapConfig)}</small>
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
  );
}

import { useEffect, useRef } from 'react';
import { copy } from '../i18n/en';
import { MIRAGE_MAP_CONFIG, worldToMap } from '../maps';
import type { PlaybackClock } from '../playback/PlaybackClock';
import { findActiveBombEvent } from '../replay/bomb';
import { interpolatePlayerFrame } from '../replay/interpolation';
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

export function RadarCanvas({ replay, clock, roundNumber }: RadarCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return undefined;

    const context = canvas.getContext('2d');
    if (!context) return undefined;

    let frame = 0;
    let cssSize = 1;
    let disposed = false;
    const image = new Image();
    image.decoding = 'async';
    image.src = MIRAGE_MAP_CONFIG.image;

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
      const mapScale = cssSize / MIRAGE_MAP_CONFIG.resolution.width;

      context.clearRect(0, 0, cssSize, cssSize);
      context.fillStyle = '#0a0e13';
      context.fillRect(0, 0, cssSize, cssSize);
      if (image.complete && image.naturalWidth > 0) {
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
          const point = worldToMap(MIRAGE_MAP_CONFIG, state);
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

      replay.players.forEach((player, playerIndex) => {
        const state = interpolatePlayerFrame(replay.frames, playerIndex, tick);
        if (!state?.alive) return;
        const point = worldToMap(MIRAGE_MAP_CONFIG, state);
        if (!point.inside) return;
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
        const point = worldToMap(MIRAGE_MAP_CONFIG, state);
        if (!point.inside) continue;
        const x = point.x * mapScale;
        const y = point.y * mapScale;
        context.fillStyle = '#ff5d6c';
        context.font = `700 ${Math.max(13, 20 * mapScale)}px "Segoe UI Symbol", sans-serif`;
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText('☠', x, y);
      }

      frame = requestAnimationFrame(draw);
    };

    frame = requestAnimationFrame(draw);
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      image.src = '';
    };
  }, [clock, replay, roundNumber]);

  return (
    <div className="radar" ref={containerRef}>
      <canvas aria-label={copy.radarAria} ref={canvasRef} role="img" />
      <div className="radar__label">
        <span>{copy.mapIdentifier}</span>
        <small>{copy.mainLevel}</small>
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

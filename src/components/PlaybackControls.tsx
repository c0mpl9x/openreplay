import type { ReplayEvent, ReplayRound } from '../replay/types';
import type { PlaybackClock } from '../playback/PlaybackClock';
import { usePlaybackClock } from '../playback/usePlaybackClock';
import { copy } from '../i18n/en';
import { NextIcon, PauseIcon, PlayIcon, PreviousIcon } from './Icons';

interface PlaybackControlsProps {
  readonly clock: PlaybackClock;
  readonly tickRate: number;
  readonly rounds: readonly ReplayRound[];
  readonly events: readonly ReplayEvent[];
  readonly roundIndex: number;
  readonly onRoundChange: (index: number) => void;
}

function formatClock(ticks: number, tickRate: number): string {
  const seconds = Math.max(0, Math.floor(ticks / tickRate));
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

export function PlaybackControls({
  clock,
  tickRate,
  rounds,
  events,
  roundIndex,
  onRoundChange,
}: PlaybackControlsProps) {
  const playback = usePlaybackClock(clock);
  const round = rounds[roundIndex];
  const duration = Math.max(1, playback.maxTick - playback.minTick);

  return (
    <section className="playback" aria-label={copy.replayControls}>
      <div className="timeline-wrap">
        <div className="timeline-markers" aria-hidden="true">
          {events
            .filter((event) => event.tick >= playback.minTick && event.tick <= playback.maxTick)
            .map((event, index) => (
              <span
                className={`timeline-marker timeline-marker--${event.type}`}
                key={`${event.type}-${event.tick}-${String(index)}`}
                style={{ left: `${((event.tick - playback.minTick) / duration) * 100}%` }}
              />
            ))}
        </div>
        <input
          aria-label={copy.replayTimeline}
          className="timeline"
          max={playback.maxTick}
          min={playback.minTick}
          onChange={(event) => clock.seek(Number(event.currentTarget.value))}
          step="1"
          type="range"
          value={playback.tick}
        />
      </div>

      <div className="playback__row">
        <div className="transport">
          <button
            aria-label={copy.previousRound}
            className="icon-button"
            disabled={roundIndex <= 0}
            onClick={() => onRoundChange(roundIndex - 1)}
            type="button"
          >
            <PreviousIcon />
          </button>
          <button
            aria-label={playback.playing ? copy.pause : copy.play}
            className="play-button"
            onClick={() => clock.toggle()}
            type="button"
          >
            {playback.playing ? <PauseIcon /> : <PlayIcon />}
          </button>
          <button
            aria-label={copy.nextRound}
            className="icon-button"
            disabled={roundIndex >= rounds.length - 1}
            onClick={() => onRoundChange(roundIndex + 1)}
            type="button"
          >
            <NextIcon />
          </button>
        </div>

        <div className="timecode" aria-label={copy.currentReplayTime}>
          <strong>{formatClock(playback.tick - playback.minTick, tickRate)}</strong>
          <span>/ {formatClock(playback.maxTick - playback.minTick, tickRate)}</span>
        </div>

        <label className="round-select">
          <span>{copy.round}</span>
          <select
            onChange={(event) => onRoundChange(Number(event.currentTarget.value))}
            value={roundIndex}
          >
            {rounds.map((item, index) => (
              <option key={`${item.number}-${item.startTick}`} value={index}>
                {copy.round} {item.number}
              </option>
            ))}
          </select>
        </label>

        <label className="speed-select">
          <span className="visually-hidden">{copy.speed}</span>
          <select
            aria-label={copy.speed}
            onChange={(event) => clock.setSpeed(Number(event.currentTarget.value))}
            value={playback.speed}
          >
            {[0.5, 1, 2, 4].map((speed) => (
              <option key={speed} value={speed}>
                {speed}×
              </option>
            ))}
          </select>
        </label>

        {round ? (
          <span className="round-ticks">
            {copy.tick} {Math.floor(playback.tick).toLocaleString()}
          </span>
        ) : null}
      </div>
    </section>
  );
}

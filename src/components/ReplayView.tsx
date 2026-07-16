import { useEffect, useMemo, useState } from 'react';
import { copy } from '../i18n/en';
import { PlaybackClock } from '../playback/PlaybackClock';
import { usePlaybackClock } from '../playback/usePlaybackClock';
import { TEAMS, type ReplayV1 } from '../replay/types';
import { AppHeader } from './AppHeader';
import { KillFeed } from './KillFeed';
import { PlaybackControls } from './PlaybackControls';
import { RadarCanvas } from './RadarCanvas';
import { TeamPanel } from './TeamPanel';

interface ReplayViewProps {
  readonly replay: ReplayV1;
  readonly onReset: () => void;
}

export function ReplayView({ replay, onReset }: ReplayViewProps) {
  const [roundIndex, setRoundIndex] = useState(0);
  const firstRound = replay.rounds[0];
  const clock = useMemo(
    () =>
      new PlaybackClock(
        replay.meta.tickRate,
        firstRound?.freezeEndTick ?? replay.frames.ticks[0] ?? 0,
        firstRound?.endTick ?? replay.frames.ticks.at(-1) ?? 0,
      ),
    [firstRound?.endTick, firstRound?.freezeEndTick, replay.frames.ticks, replay.meta.tickRate],
  );
  const playback = usePlaybackClock(clock);
  const currentRound = replay.rounds[roundIndex];

  useEffect(() => () => clock.dispose(), [clock]);

  useEffect(() => {
    const round = replay.rounds[roundIndex];
    if (round) clock.setRange(round.freezeEndTick, round.endTick);
  }, [clock, replay.rounds, roundIndex]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement)
        return;
      if (event.code === 'Space') {
        event.preventDefault();
        clock.toggle();
      }
      if (event.code === 'ArrowLeft') clock.seek(clock.getTick() - replay.meta.tickRate * 5);
      if (event.code === 'ArrowRight') clock.seek(clock.getTick() + replay.meta.tickRate * 5);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [clock, replay.meta.tickRate]);

  const ctScore = replay.rounds.filter(
    (round) => round.endTick <= playback.tick && round.winner === TEAMS.COUNTER_TERRORIST,
  ).length;
  const tScore = replay.rounds.filter(
    (round) => round.endTick <= playback.tick && round.winner === TEAMS.TERRORIST,
  ).length;
  const roundEvents = currentRound
    ? replay.events.filter(
        (event) => event.tick >= currentRound.freezeEndTick && event.tick <= currentRound.endTick,
      )
    : [];
  const bombEvent = roundEvents
    .filter(
      (event) =>
        event.tick <= playback.tick &&
        (event.type === 'bomb_planted' ||
          event.type === 'bomb_defused' ||
          event.type === 'bomb_exploded'),
    )
    .at(-1);
  const bombStatus =
    bombEvent?.type === 'bomb_planted'
      ? copy.bombPlanted
      : bombEvent?.type === 'bomb_defused'
        ? copy.bombDefused
        : bombEvent?.type === 'bomb_exploded'
          ? copy.bombExploded
          : copy.bombIdle;

  return (
    <div className="viewer-page">
      <AppHeader compact onReset={onReset} />
      <main className="viewer">
        <header className="match-bar">
          <div className="match-bar__file">
            <span className="status-dot" />
            <div>
              <strong>{replay.meta.fileName}</strong>
              <small>{replay.meta.serverName ?? copy.localServer}</small>
            </div>
          </div>
          <div className="scoreboard">
            <span className="scoreboard__team scoreboard__team--ct">
              {copy.counterTerroristAbbreviation} <strong>{ctScore}</strong>
            </span>
            <span className="scoreboard__round">
              {copy.roundUpper} {currentRound?.number ?? '—'}
            </span>
            <span className="scoreboard__team scoreboard__team--t">
              <strong>{tScore}</strong> {copy.terroristAbbreviation}
            </span>
          </div>
          <button className="button button--small button--ghost" onClick={onReset} type="button">
            {copy.newDemo}
          </button>
        </header>

        <div className="viewer-grid">
          <aside className="viewer-sidebar viewer-sidebar--left">
            <TeamPanel replay={replay} team={TEAMS.COUNTER_TERRORIST} tick={playback.tick} />
            <TeamPanel replay={replay} team={TEAMS.TERRORIST} tick={playback.tick} />
          </aside>
          <RadarCanvas clock={clock} replay={replay} roundNumber={currentRound?.number} />
          <aside className="viewer-sidebar viewer-sidebar--right">
            <KillFeed replay={replay} tick={playback.tick} />
            <section className="match-info">
              <div className="panel-heading">
                <span>{copy.match}</span>
                <small>{copy.local}</small>
              </div>
              <div
                aria-live="polite"
                className={`bomb-status${bombEvent ? ` bomb-status--${bombEvent.type}` : ''}`}
              >
                <span aria-hidden="true" />
                {bombStatus}
                {bombEvent && 'site' in bombEvent && bombEvent.site ? ` · ${bombEvent.site}` : ''}
              </div>
              <dl>
                <div>
                  <dt>{copy.map}</dt>
                  <dd>{copy.mirage}</dd>
                </div>
                <div>
                  <dt>{copy.tickRate}</dt>
                  <dd>{replay.meta.tickRate}</dd>
                </div>
                <div>
                  <dt>{copy.players}</dt>
                  <dd>{replay.players.length}</dd>
                </div>
                <div>
                  <dt>{copy.rounds}</dt>
                  <dd>{replay.rounds.length}</dd>
                </div>
              </dl>
            </section>
          </aside>
        </div>

        <PlaybackControls
          clock={clock}
          events={roundEvents}
          onRoundChange={(index) => {
            if (index >= 0 && index < replay.rounds.length) setRoundIndex(index);
          }}
          roundIndex={roundIndex}
          rounds={replay.rounds}
          tickRate={replay.meta.tickRate}
        />
      </main>
      <footer className="legal-footer">{copy.legal}</footer>
    </div>
  );
}

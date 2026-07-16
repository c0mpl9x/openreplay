import { copy } from '../i18n/en';
import type { ReplayV1 } from '../replay/types';
import { SkullIcon } from './Icons';

interface KillFeedProps {
  readonly replay: ReplayV1;
  readonly tick: number;
}

export function KillFeed({ replay, tick }: KillFeedProps) {
  const recentKills = replay.events
    .filter(
      (event) =>
        event.type === 'kill' &&
        event.tick <= tick &&
        event.tick >= tick - replay.meta.tickRate * 7,
    )
    .slice(-5)
    .reverse();

  const playerName = (id: number | undefined, fallback: string) =>
    id === undefined
      ? fallback
      : (replay.players.find((player) => player.id === id)?.name ?? fallback);

  return (
    <section className="kill-feed" aria-label={copy.killFeed}>
      <div className="panel-heading">
        <span>{copy.killFeed}</span>
        <small>{copy.live}</small>
      </div>
      {recentKills.length === 0 ? (
        <p className="kill-feed__empty">{copy.noKills}</p>
      ) : (
        <ol>
          {recentKills.map((event) => {
            if (event.type !== 'kill') return null;
            return (
              <li key={`${event.tick}-${event.victimId}`}>
                <span className="kill-feed__killer">{playerName(event.killerId, copy.world)}</span>
                <span className="kill-feed__weapon">
                  {event.headshot ? '◎ ' : ''}
                  {event.weapon ?? copy.unknownWeapon}
                </span>
                <SkullIcon />
                <span className="kill-feed__victim">
                  {playerName(event.victimId, copy.unknownPlayer)}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

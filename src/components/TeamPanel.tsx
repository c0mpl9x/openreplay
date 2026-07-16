import { interpolatePlayerFrame } from '../replay/interpolation';
import { TEAMS, type ReplayV1, type TeamNumber } from '../replay/types';
import { copy } from '../i18n/en';

interface TeamPanelProps {
  readonly replay: ReplayV1;
  readonly tick: number;
  readonly team: TeamNumber;
}

export function TeamPanel({ replay, tick, team }: TeamPanelProps) {
  const entries = replay.players
    .map((player, playerIndex) => ({
      player,
      state: interpolatePlayerFrame(replay.frames, playerIndex, tick),
    }))
    .filter(({ state }) => state?.team === team);

  const isCt = team === TEAMS.COUNTER_TERRORIST;
  return (
    <section className={`team-panel team-panel--${isCt ? 'ct' : 't'}`}>
      <div className="panel-heading">
        <span>{isCt ? copy.counterTerrorists : copy.terrorists}</span>
        <small>
          {entries.filter(({ state }) => state?.alive).length} {copy.alive}
        </small>
      </div>
      <ol>
        {entries.map(({ player, state }) => (
          <li className={state?.alive ? '' : 'is-dead'} key={player.id}>
            <span className="player-avatar">{player.name.charAt(0).toUpperCase()}</span>
            <span className="player-name" title={player.name}>
              {player.name}
            </span>
            <span className="player-armor">
              {state?.armor ?? 0} {copy.armorAbbreviation}
            </span>
            <strong>{state?.health ?? 0}</strong>
            <span className="health-track">
              <i style={{ width: `${state?.health ?? 0}%` }} />
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

import { copy } from '../i18n/en';
import { ShieldIcon } from './Icons';

interface AppHeaderProps {
  readonly compact?: boolean;
  readonly onReset?: () => void;
}

export function AppHeader({ compact = false, onReset }: AppHeaderProps) {
  return (
    <header className={`app-header${compact ? ' app-header--compact' : ''}`}>
      <button className="brand" onClick={onReset} type="button">
        <span className="brand__mark" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
        <span className="brand__copy">
          <strong>{copy.appName}</strong>
          <small>{copy.appDescriptor}</small>
        </span>
      </button>
      <div className="app-header__status">
        <span className="privacy-pill">
          <ShieldIcon /> {copy.localOnly}
        </span>
        <span className="version-pill">{copy.version}</span>
      </div>
    </header>
  );
}

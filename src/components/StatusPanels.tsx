import { copy, type ParseStage } from '../i18n/en';
import type { ReplayErrorCode } from '../replay/types';
import { CloseIcon } from './Icons';

interface LoadingPanelProps {
  readonly fileName: string;
  readonly stage: ParseStage;
  readonly onCancel: () => void;
}

const stages: readonly ParseStage[] = [
  'validating',
  'metadata',
  'events',
  'positions',
  'normalizing',
];

export function LoadingPanel({ fileName, stage, onCancel }: LoadingPanelProps) {
  const currentIndex = stages.indexOf(stage);

  return (
    <main className="status-page">
      <section className="status-card" aria-live="polite">
        <div className="parser-orbit" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <p className="eyebrow">{copy.parsingLocally}</p>
        <h1>{copy.parsing[stage]}</h1>
        <p className="status-card__file" title={fileName}>
          {fileName}
        </p>
        <ol className="parse-stages">
          {stages.map((item, index) => (
            <li
              className={
                index < currentIndex ? 'is-complete' : index === currentIndex ? 'is-current' : ''
              }
              key={item}
            >
              <span>{index < currentIndex ? '✓' : index + 1}</span>
              {copy.parsing[item]}
            </li>
          ))}
        </ol>
        <button className="button button--ghost" onClick={onCancel} type="button">
          <CloseIcon /> {copy.cancel}
        </button>
      </section>
    </main>
  );
}

interface ErrorPanelProps {
  readonly code: ReplayErrorCode;
  readonly message: string;
  readonly onRetry: () => void;
}

export function ErrorPanel({ code, message, onRetry }: ErrorPanelProps) {
  return (
    <main className="status-page">
      <section className="status-card status-card--error" role="alert">
        <span className="error-code">{code}</span>
        <div className="error-mark" aria-hidden="true">
          !
        </div>
        <h1>{copy.errorTitles[code]}</h1>
        <p>{message}</p>
        <button className="button button--primary" onClick={onRetry} type="button">
          {copy.tryAgain}
        </button>
      </section>
    </main>
  );
}

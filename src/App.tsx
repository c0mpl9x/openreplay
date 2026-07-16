import { AppHeader } from './components/AppHeader';
import { DropZone } from './components/DropZone';
import { ReplayView } from './components/ReplayView';
import { ErrorPanel, LoadingPanel } from './components/StatusPanels';
import { useDemoParser } from './hooks/useDemoParser';
import { copy } from './i18n/en';

export function App() {
  const { state, openFile, openPreview, reset } = useDemoParser();

  if (state.status === 'parsing') {
    return (
      <div className="app-shell">
        <AppHeader onReset={reset} />
        <LoadingPanel fileName={state.fileName} onCancel={reset} stage={state.stage} />
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="app-shell">
        <AppHeader onReset={reset} />
        <ErrorPanel code={state.code} message={state.message} onRetry={reset} />
      </div>
    );
  }

  if (state.status === 'ready') {
    return <ReplayView onReset={reset} replay={state.replay} />;
  }

  return (
    <div className="app-shell">
      <AppHeader />
      <DropZone onFile={(file) => void openFile(file)} onPreview={openPreview} />
      <footer className="landing-footer">
        <span>{copy.legal}</span>
        <a href="https://github.com/c0mpl9x/openreplay" rel="noreferrer" target="_blank">
          {copy.openSource}
        </a>
      </footer>
    </div>
  );
}

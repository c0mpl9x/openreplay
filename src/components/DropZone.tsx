import { useRef, useState, type DragEvent } from 'react';
import { copy } from '../i18n/en';
import { ShieldIcon, UploadIcon } from './Icons';

interface DropZoneProps {
  readonly onFile: (file: File) => void;
  readonly onPreview: () => void;
}

export function DropZone({ onFile, onPreview }: DropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const acceptFiles = (files: FileList | null) => {
    const file = files?.item(0);
    if (file) onFile(file);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    acceptFiles(event.dataTransfer.files);
  };

  return (
    <section className="landing" aria-labelledby="landing-title">
      <div className="landing__glow landing__glow--one" />
      <div className="landing__glow landing__glow--two" />
      <div className="landing__intro">
        <p className="eyebrow">{copy.eyebrow}</p>
        <h1 id="landing-title">{copy.heroTitle}</h1>
        <p className="landing__lead">{copy.heroBody}</p>
      </div>

      <div
        className={`drop-zone${dragging ? ' drop-zone--active' : ''}`}
        onDragEnter={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDrop={handleDrop}
      >
        <div className="drop-zone__icon">
          <UploadIcon />
        </div>
        <h2>{copy.dropTitle}</h2>
        <p>{copy.dropBody}</p>
        <div className="drop-zone__actions">
          <button
            className="button button--primary"
            onClick={() => inputRef.current?.click()}
            type="button"
          >
            <UploadIcon /> {copy.chooseFile}
          </button>
          <button className="button button--ghost" onClick={onPreview} type="button">
            {copy.sample}
          </button>
        </div>
        <input
          ref={inputRef}
          accept=".dem,application/octet-stream"
          aria-label={copy.chooseFileAria}
          className="visually-hidden"
          onChange={(event) => {
            acceptFiles(event.currentTarget.files);
            event.currentTarget.value = '';
          }}
          type="file"
        />
        <span className="scope-pill">{copy.supported}</span>
      </div>

      <div className="privacy-note">
        <ShieldIcon />
        <div>
          <strong>{copy.privacy}</strong>
          <span>{copy.privacyDetail}</span>
        </div>
      </div>
    </section>
  );
}

import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PlaybackClock } from '../playback/PlaybackClock';
import type { ReplayV1 } from '../replay/types';
import { RadarCanvas } from './RadarCanvas';

function emptyNukeReplay(): ReplayV1 {
  return {
    schemaVersion: 1,
    meta: {
      fileName: 'nuke.dem',
      mapName: 'de_nuke',
      tickRate: 64,
      durationTicks: 64,
    },
    players: [],
    rounds: [],
    events: [],
    frames: {
      ticks: new Uint32Array([0]),
      playerCount: 0,
      x: new Float32Array(),
      y: new Float32Array(),
      z: new Float32Array(),
      yaw: new Float32Array(),
      health: new Uint8Array(),
      armor: new Uint8Array(),
      team: new Uint8Array(),
      flags: new Uint8Array(),
    },
  };
}

describe('RadarCanvas multi-level layout', () => {
  const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext');

  afterEach(() => {
    getContext.mockReset();
  });

  it('renders Nuke upper before lower and keeps both panels present when empty', () => {
    getContext.mockReturnValue(null);
    const clock = new PlaybackClock(64, 0, 64);
    const { container } = render(
      <RadarCanvas clock={clock} replay={emptyNukeReplay()} roundNumber={undefined} />,
    );

    const grid = container.querySelector('.radar-grid');
    expect(grid).toHaveClass('radar-grid--multi');
    expect(
      [...container.querySelectorAll<HTMLElement>('.radar')].map((panel) => panel.dataset.level),
    ).toEqual(['upper', 'lower']);
    expect(
      [...container.querySelectorAll<HTMLCanvasElement>('canvas')].map((canvas) =>
        canvas.getAttribute('aria-label'),
      ),
    ).toEqual(['Nuke upper level replay radar', 'Nuke lower level replay radar']);

    clock.dispose();
  });
});

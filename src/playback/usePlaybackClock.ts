import { useSyncExternalStore } from 'react';
import type { PlaybackClock, PlaybackSnapshot } from './PlaybackClock';

export function usePlaybackClock(clock: PlaybackClock): PlaybackSnapshot {
  return useSyncExternalStore(clock.subscribe, clock.getSnapshot, clock.getSnapshot);
}

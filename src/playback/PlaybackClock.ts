export interface PlaybackSnapshot {
  readonly tick: number;
  readonly minTick: number;
  readonly maxTick: number;
  readonly speed: number;
  readonly playing: boolean;
}

type Listener = () => void;

const UI_NOTIFICATION_INTERVAL_MS = 80;

export class PlaybackClock {
  readonly #listeners = new Set<Listener>();
  readonly #tickRate: number;
  #snapshot: PlaybackSnapshot;
  #animationFrame: number | undefined;
  #lastFrameTime: number | undefined;
  #lastNotificationTime = 0;

  public constructor(tickRate: number, minTick = 0, maxTick = 0) {
    this.#tickRate = tickRate;
    this.#snapshot = { tick: minTick, minTick, maxTick, speed: 1, playing: false };
  }

  public getTick = (): number => this.#snapshot.tick;

  public getSnapshot = (): PlaybackSnapshot => this.#snapshot;

  public subscribe = (listener: Listener): (() => void) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };

  public setRange(minTick: number, maxTick: number, reset = true): void {
    if (!Number.isFinite(minTick) || !Number.isFinite(maxTick) || maxTick < minTick) {
      throw new RangeError('Playback range is invalid.');
    }
    const tick = reset ? minTick : Math.min(maxTick, Math.max(minTick, this.#snapshot.tick));
    this.#snapshot = { ...this.#snapshot, minTick, maxTick, tick, playing: false };
    this.#lastFrameTime = undefined;
    this.#stopLoop();
    this.#notify();
  }

  public seek(tick: number): void {
    const nextTick = Math.min(this.#snapshot.maxTick, Math.max(this.#snapshot.minTick, tick));
    this.#snapshot = { ...this.#snapshot, tick: nextTick };
    this.#lastFrameTime = undefined;
    this.#notify();
  }

  public setSpeed(speed: number): void {
    if (![0.5, 1, 2, 4].includes(speed)) {
      throw new RangeError('Unsupported playback speed.');
    }
    this.#snapshot = { ...this.#snapshot, speed };
    this.#notify();
  }

  public play(): void {
    if (this.#snapshot.playing || this.#snapshot.maxTick <= this.#snapshot.minTick) return;
    const tick =
      this.#snapshot.tick >= this.#snapshot.maxTick ? this.#snapshot.minTick : this.#snapshot.tick;
    this.#snapshot = { ...this.#snapshot, tick, playing: true };
    this.#lastFrameTime = undefined;
    this.#notify();
    this.#startLoop();
  }

  public pause(): void {
    if (!this.#snapshot.playing) return;
    this.#snapshot = { ...this.#snapshot, playing: false };
    this.#lastFrameTime = undefined;
    this.#stopLoop();
    this.#notify();
  }

  public toggle(): void {
    if (this.#snapshot.playing) this.pause();
    else this.play();
  }

  public dispose(): void {
    this.#stopLoop();
    this.#listeners.clear();
  }

  #startLoop(): void {
    if (this.#animationFrame !== undefined) return;
    this.#animationFrame = requestAnimationFrame(this.#advance);
  }

  #stopLoop(): void {
    if (this.#animationFrame === undefined) return;
    cancelAnimationFrame(this.#animationFrame);
    this.#animationFrame = undefined;
  }

  #advance = (time: number): void => {
    this.#animationFrame = undefined;
    if (!this.#snapshot.playing) return;

    if (this.#lastFrameTime !== undefined) {
      const elapsedMs = Math.min(250, Math.max(0, time - this.#lastFrameTime));
      const elapsedTicks = (elapsedMs / 1000) * this.#tickRate * this.#snapshot.speed;
      const nextTick = Math.min(this.#snapshot.maxTick, this.#snapshot.tick + elapsedTicks);
      const atEnd = nextTick >= this.#snapshot.maxTick;
      this.#snapshot = { ...this.#snapshot, tick: nextTick, playing: !atEnd };

      if (atEnd || time - this.#lastNotificationTime >= UI_NOTIFICATION_INTERVAL_MS) {
        this.#lastNotificationTime = time;
        this.#notify();
      }
    }

    this.#lastFrameTime = time;
    if (this.#snapshot.playing) this.#startLoop();
  };

  #notify(): void {
    for (const listener of this.#listeners) listener();
  }
}

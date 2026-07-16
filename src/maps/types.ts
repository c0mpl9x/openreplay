export interface MapResolutionV1 {
  readonly width: number;
  readonly height: number;
}

export interface MapLevelV1 {
  readonly id: string;
  readonly image: string;
  /** Inclusive world-space lower Z bound. */
  readonly minZ?: number;
  /** Exclusive world-space upper Z bound. */
  readonly maxZ?: number;
}

export interface MapConfigV1 {
  readonly schemaVersion: 1;
  readonly id: string;
  readonly displayName: string;
  /** Default/only radar image; level-specific renderers can use levels instead. */
  readonly image: string;
  readonly resolution: MapResolutionV1;
  /** World X represented by the radar's left edge. */
  readonly posX: number;
  /** World Y represented by the radar's top edge. */
  readonly posY: number;
  readonly scale: number;
  readonly levels: readonly MapLevelV1[];
}

export interface WorldPosition {
  readonly x: number;
  readonly y: number;
  readonly z?: number;
}

export interface MapPosition {
  readonly x: number;
  readonly y: number;
  readonly inside: boolean;
  readonly level: MapLevelV1;
}

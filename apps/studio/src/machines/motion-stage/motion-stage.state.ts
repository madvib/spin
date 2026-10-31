export interface MotionLane {
  readonly id: string;
  readonly path: string;
  readonly utility: string;
  readonly value: string;
  readonly durationMs: number;
  readonly variable: string;
  readonly durationVar: string;
  readonly easingVar: string;
  readonly sharePct: number;
}

export interface MotionStageContext {
  readonly lanes: readonly MotionLane[];
  readonly speed: MotionSpeed;
  readonly loop: boolean;
  readonly elapsedMs: number;
  readonly longestMs: number;
}

export type MotionStageState = "idle" | "reset" | "running" | "paused";

export type MotionSpeed = 0.25 | 0.5 | 1 | 2;

export function longestOf(lanes: readonly { readonly durationMs: number }[]): number {
  return Math.max(1, ...lanes.map((lane) => lane.durationMs));
}

export function withShares(
  lanes: readonly Omit<MotionLane, "sharePct">[],
): MotionLane[] {
  const longest = longestOf(lanes);
  return lanes.map((lane) => ({
    ...lane,
    sharePct: (lane.durationMs / longest) * 100,
  }));
}

export function initial(): MotionStageContext {
  return { lanes: [], speed: 1, loop: false, elapsedMs: 0, longestMs: 1 };
}

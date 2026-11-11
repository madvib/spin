import {
  type ApiOf,
  type ComponentDef,
  defineComponent,
  type ViewFor,
  type SlotViewFor,
} from "@spinjs/components/runtime";
import { motionStage as motionStageMachine } from "./motion-stage.machine.ts";
import type { MotionStageEvents } from "./motion-stage.events.ts";
import type {
  MotionLane,
  MotionStageContext,
  MotionStageState,
  MotionSpeed,
} from "./motion-stage.state.ts";

export type { MotionLane, MotionStageContext, MotionStageState, MotionSpeed };

type Ctx = MotionStageContext;
type ScopeLike = ViewFor<MotionStageContext, MotionStageEvents, MotionStageState>;
type SlotLike<R> = SlotViewFor<R, MotionStageContext, MotionStageEvents, MotionStageState>;

const SPEEDS: readonly MotionSpeed[] = [1, 0.5, 0.25, 2];

/** One cycle timer per mounted stage, so a new send cancels the last. */
const cycleTimers = new WeakMap<Element, ReturnType<typeof setTimeout>>();

/** The bar's width: reset paints zero, running paints full, rest is share. */
function laneWidth(
  state: MotionStageState,
  lane: MotionLane,
): string {
  if (state === "reset") return "0%";
  if (state === "running") return "100%";
  return `${lane.sharePct}%`;
}

export const def = {
  name: "motion-stage",
  machine: (args: Partial<MotionStageContext>, _authored) =>
    motionStageMachine(args),
  start: "idle",
  parts: {
    root: {
      attrs: (scope: ScopeLike) => ({
        "data-state": scope.state,
        "data-running": scope.attr(scope.state === "running" || scope.state === "reset"),
      }),
    },
    toolbar: {
      attrs: () => ({}),
    },
    playTrigger: {
      attrs: (scope: ScopeLike) => ({
        type: "button",
        "data-state": scope.state,
        "aria-pressed": scope.attr(scope.state === "running" || scope.state === "reset"),
        onClick: (): void => {
          if (scope.state === "idle") scope.send({ type: "PLAY" });
          else scope.send({ type: "STOP" });
        },
      }),
    },
    loopTrigger: {
      attrs: (scope: ScopeLike) => ({
        type: "button",
        "aria-pressed": scope.attr(scope.context.loop),
        "data-loop": scope.attr(scope.context.loop),
        onClick: (): void => {
          scope.send({ type: "LOOP.TOGGLE" });
        },
      }),
    },
    speedTrigger: {
      attrs: (scope: ScopeLike) => ({
        type: "button",
        "data-speed": String(scope.context.speed),
        onClick: (): void => {
          const at = SPEEDS.indexOf(scope.context.speed);
          const next: MotionSpeed = SPEEDS[(at + 1) % SPEEDS.length] ?? 1;
          scope.send({ type: "SPEED.SET", speed: next });
        },
      }),
    },
    trackList: {
      attrs: () => ({
        role: "list",
      }),
    },
  },
  slots: {
    lane: {
      indexes: (context: Ctx) => context.lanes,
      attrs: (scope: SlotLike<MotionLane>) => ({
        role: "listitem",
        "data-lane": scope.slot.id,
      }),
    },
    laneBar: {
      indexes: (context: Ctx) => context.lanes,
      attrs: (scope: SlotLike<MotionLane>) => {
        const lane = scope.slot;
        const running = scope.state === "running";
        return {
          "data-lane": lane.id,
          "data-state": scope.state,
          style: {
            width: laneWidth(scope.state, lane),
            ...(running
              ? {
                "transition-property": "width",
                "transition-duration": `calc(var(${lane.durationVar}) / ${scope.context.speed})`,
                "transition-timing-function": `var(${lane.easingVar})`,
              }
              : {}),
          },
        };
      },
    },
  },
  commands: {
    play: {
      event: () => ({ type: "PLAY" }),
    },
    stop: {
      event: () => ({ type: "STOP" }),
    },
    toggleLoop: {
      event: () => ({ type: "LOOP.TOGGLE" }),
    },
    cycleSpeed: {
      event: ([speed]: [speed: MotionSpeed]) => ({
        type: "SPEED.SET",
        speed,
      }),
    },
    setLanes: {
      event: ([lanes]: [lanes: readonly MotionLane[]]) => ({
        type: "LANES.SET",
        lanes,
      }),
    },
  },
  readers: {
    state: { read: (_context: Ctx, state: MotionStageState) => state },
    running: {
      read: (_context: Ctx, state: MotionStageState) =>
        state === "running" || state === "reset",
    },
    loop: { read: (context: Ctx) => context.loop },
    speed: { read: (context: Ctx) => context.speed },
    longestMs: { read: (context: Ctx) => context.longestMs },
    lanes: { read: (context: Ctx) => context.lanes },
  },
  methods: {
    getLanes: {
      call: (context: Ctx) => context.lanes,
    },
  },
  events: {},
  settled: ({ after, root, send }) => {
    const node = root();
    const pending = cycleTimers.get(node);
    if (pending !== undefined) {
      clearTimeout(pending);
      cycleTimers.delete(node);
    }
    if (after.state === "reset") {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          send({ type: "STEP.RUN" });
        });
      });
      return;
    }
    if (after.state === "running") {
      const wait = after.context.longestMs / after.context.speed + 700;
      cycleTimers.set(
        node,
        setTimeout(() => {
          cycleTimers.delete(node);
          send({ type: "CYCLE.END" });
        }, wait),
      );
    }
  },
} satisfies ComponentDef<
  MotionStageContext,
  MotionStageEvents,
  Record<string, unknown>,
  Partial<MotionStageContext>,
  MotionStageState
>;

export type MotionStageApi = ApiOf<typeof def>;
export const motionStage = defineComponent<
  MotionStageContext,
  MotionStageEvents,
  MotionStageApi,
  Partial<MotionStageContext>,
  MotionStageState
>(def);

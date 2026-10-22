import {
  createEffect,
  createMemo,
  createSignal,
  For,
  onCleanup,
  Show,
  untrack,
} from "solid-js";
import ValueInput from "../components/demos/ValueInput.tsx";
import LinkToggle from "../components/demos/LinkToggle.tsx";
import { ConcernPage, Frame, Section } from "../components/Concern.tsx";
import {
  bezierY,
  durationMs,
  easingControlPoints,
  easingUtility,
  easingValue,
} from "../lib/motion.ts";
import { durationUtility } from "../lib/overview.ts";
import { analyzeTheme } from "../lib/theme.ts";
import { groupTokens } from "../lib/tokens.ts";
import type { TokenRow } from "../lib/tokens.ts";
import { activeMode, themeText } from "../lib/store.ts";
import { editToken } from "../lib/editing.ts";
import { createLockstep } from "../lib/lockstep.ts";
import { paintPreview } from "../lib/preview.ts";

/**
 * Motion — the values that move things, raced against each other.
 *
 * Neither number a transition is made of reads as a number: `400ms` beside
 * `150ms` says nothing until two things take that long side by side, and
 * `cubic-bezier(0.2, 0, 0, 1)` is a shape. So each section is one stage
 * under one loop control, with a lane per token. At rest a duration's bar
 * is its share of the longest, so the ramp reads without a click; looping
 * runs the race over and over, because 150ms played once is gone before the
 * eye has it — the arrival order only lands the third time you watch it.
 * Lanes hold one thing still so the comparison means something: durations
 * share an easing, easings share a time.
 *
 * The chart is not a picture of an easing, it IS the easing: the curve is
 * the token, the handles are its control points, and dragging one writes
 * `cubic-bezier(…)` on release. Looping runs a playhead along every curve
 * at the shared duration, so the shape shows up as speed.
 *
 * The page holds two kinds of token and they do not look alike: a duration
 * is a length of time and a curve is a shape, so the durations wear the
 * acting colour and the easings wear the accent — and the curve under the
 * pointer is the one in the accent, so the reader can see which shape is
 * about to be written.
 */

/** The side a curve is drawn on, and the dash that identifies it in the overlay. */
const CHART = 128;
/**
 * Room drawn around the unit square, so a control point ON the edge — y=0
 * and x=0 are the common case, not the exception — keeps its whole handle
 * inside the SVG's clip instead of being cut in half.
 */
const MARGIN = 12;

/** How each easing is told apart in the shared chart, by dash rather than hue. */
const DASH = ["", "4 3", "1 3", "6 3 1 3"];

/** Clamped to the unit square: x is time, y is progress, both 0…1. */
function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

/** One lane of a race: its token path, the utility it runs, and its editor. */
interface Lane {
  path: string;
  utility: string;
  value: string;
  type: string;
  /** The token's custom property, painted on the preview surface while dragging. */
  variable: string;
  points?: [number, number, number, number];
}

function lanesFor(
  rows: readonly TokenRow[],
  utility: (path: string) => string,
  withCurve: boolean,
): Lane[] {
  return rows.map((row) => ({
    path: row.path,
    utility: utility(row.path),
    value: row.value,
    type: row.type,
    variable: row.variable,
    points: withCurve ? easingControlPoints(row.value) : undefined,
  }));
}

/** The longest run on a stage, so shares and holds are measured against it. */
function longestOf(lanes: Lane[]): number {
  return Math.max(1, ...lanes.map((lane) => durationMs(lane.value) ?? 0));
}

/**
 * A stage: a lane per token, running under a loop the section owns.
 *
 * The cycle is reset → run → hold. Reset paints every bar at zero, the two
 * frames are the pause that makes the browser see two states rather than
 * coalesce them into none, run races each bar to the far edge under its own
 * duration, and the hold outlasts the longest so the last arrival is seen
 * rather than assumed before it starts again.
 *
 * The clock a lane runs on is the token's OWN property, not a utility name:
 * a utility is a name the scanner has to see written down, and a theme may
 * name its durations and its curves anything at all — the property is the
 * value, so the race is the theme's race.
 */
function RaceStage(props: {
  lanes: Lane[];
  /** The lane's own time, as the custom property that carries it. */
  durationOf: (lane: Lane) => string | undefined;
  /** The lane's own curve, as the custom property that carries it. */
  easingOf: (lane: Lane) => string | undefined;
  /** The colour this family's bars wear. */
  paint: string;
  onEdit: (path: string, value: string) => boolean;
  /** Reports a value a lane's control proposes while dragged. */
  onPreview?: (path: string, value: string) => void;
  /** Reports a drag abandoned before it committed. */
  onCancel?: () => void;
  /** Under the section's loop control; stopped, the stage rests at its shares. */
  running: boolean;
}) {
  const [phase, setPhase] = createSignal<"idle" | "reset" | "run">("idle");
  const preview = props.onPreview;

  createEffect(() => {
    if (!props.running) {
      setPhase("idle");
      return;
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    let frame = 0;
    const cycle = () => {
      setPhase("reset");
      frame = requestAnimationFrame(() => {
        frame = requestAnimationFrame(() => {
          setPhase("run");
          timer = setTimeout(() => {
            cycle();
          }, untrack(() => longestOf(props.lanes)) + 700);
        });
      });
    };
    cycle();
    onCleanup(() => {
      if (timer !== undefined) clearTimeout(timer);
      cancelAnimationFrame(frame);
    });
  });

  // A bar's width at rest is its share of the longest duration, so the scale
  // is legible before anything is pressed.
  const share = (lane: Lane) => {
    if (phase() === "run") return 100;
    if (phase() === "reset") return 0;
    const longest = longestOf(props.lanes);
    return ((durationMs(lane.value) ?? longest) / longest) * 100;
  };

  /**
   * The bar's own clock.
   *
   * The transition is written out rather than named by a utility, for the
   * reason the specimen is: a utility is a name the sheet has to have been
   * told about, and the theme's own durations and curves are the values the
   * race is supposed to be running at.
   */
  const clock = (lane: Lane) => {
    const duration = props.durationOf(lane);
    const easing = props.easingOf(lane);
    if (duration === undefined || easing === undefined) return {};
    return {
      "transition-property": "all",
      "transition-duration": `var(${duration})`,
      "transition-timing-function": `var(${easing})`,
    };
  };

  return (
    <ul class="flow-list">
      <For each={props.lanes}>
        {(lane) => (
          <li class="stack-sm">
            <div class="row-sm flex-wrap justify-between gap-3">
              <code class="text-xs text-text-muted">{lane.path}</code>
              <div class="row-sm flex-wrap gap-2">
                <code class="text-xs whitespace-nowrap">{lane.utility}</code>
                <ValueInput
                  value={lane.value}
                  type={lane.type}
                  onCommit={(value) => props.onEdit(lane.path, value)}
                  group={props.lanes.map((other) => other.value)}
                  variable={lane.variable}
                  label={lane.path}
                  onPreview={preview === undefined
                    ? undefined
                    : (value) => preview(lane.path, value)}
                  onCancel={props.onCancel}
                />
              </div>
            </div>
            {
              /* The lane's own clock on the bar, so the specimen is the
                token and not a stand-in for it. */
            }
            <div
              class="spin-preview h-5 overflow-hidden rounded-sm bg-surface-sunken"
              aria-hidden="true"
            >
              <div
                class={`h-full rounded-sm ${props.paint}`}
                style={{
                  width: `${share(lane)}%`,
                  ...(phase() === "run" ? clock(lane) : {}),
                }}
              />
            </div>
          </li>
        )}
      </For>
    </ul>
  );
}

/**
 * Every easing drawn on one chart, and editable where it is drawn.
 *
 * Overlaying is the comparison: four separate thumbnails cannot show how
 * standard differs from decelerate, because the eye has to hold three shapes
 * in memory. Each curve is told apart by its dash, so the chart needs no
 * colour to say which is which — but the curve the reader has picked is in
 * the accent, because that one is the shape about to be written, and a
 * reader who cannot see which curve is live will drag the wrong one.
 *
 * The legend picks a curve; the picked curve grows its two handles, and a
 * handle drags the control point it belongs to — x clamped to time, y to
 * progress — writing the token on release. The drag paints the easing's own
 * custom property on the preview surface first, so the race below wobbles
 * to the shape under the finger before the document commits to it.
 */
function EasingChart(props: {
  lanes: Lane[];
  /** The colour the picked curve wears, and the playhead wears. */
  ink: string;
  onEdit: (path: string, value: string) => boolean;
  /** Playheads run the shared duration while the section loops. */
  running: boolean;
  /** The shared duration, in ms — how long a playhead takes to cross. */
  periodMs: number;
}) {
  const [selected, setSelected] = createSignal<string | undefined>(undefined);
  const active = () => {
    const chosen = props.lanes.find((lane) => lane.path === selected());
    // At rest the theme's default easing is selected, not whichever curve
    // sorts first: linear puts both handles on the diagonal and shows nothing.
    return chosen ??
      props.lanes.find((lane) => lane.utility.endsWith("standard")) ??
      props.lanes.find((lane) => lane.points !== undefined);
  };
  const [drag, setDrag] = createSignal<
    { path: string; points: [number, number, number, number] } | undefined
  >(undefined);
  const [grabbed, setGrabbed] = createSignal<1 | 2 | undefined>(undefined);
  /** A lane's points as they stand: mid-drag, the dragged curve's proposal. */
  const pointsOf = (
    lane: Lane,
  ): [number, number, number, number] | undefined => {
    const current = drag();
    return current?.path === lane.path ? current.points : lane.points;
  };
  const activePoints = () => {
    const lane = active();
    return lane === undefined ? undefined : pointsOf(lane);
  };

  let svg: SVGSVGElement | undefined;
  let clear: (() => void) | undefined;

  const moveHandle = (event: PointerEvent) => {
    const which = grabbed();
    const lane = active();
    if (
      which === undefined || lane === undefined || lane.points === undefined
    ) {
      return;
    }
    const rect = svg?.getBoundingClientRect();
    if (rect === undefined || rect.width <= 0 || rect.height <= 0) return;
    // Local pixels → viewBox units (the margin is in the box too) → 0…1.
    const span = CHART + 2 * MARGIN;
    const vx = ((event.clientX - rect.left) / rect.width) * span - MARGIN;
    const vy = ((event.clientY - rect.top) / rect.height) * span - MARGIN;
    const x = clamp01(vx / CHART);
    const y = clamp01((CHART - vy) / CHART);
    const next: [number, number, number, number] = [...lane.points];
    if (which === 1) {
      next[0] = x;
      next[1] = y;
    } else {
      next[2] = x;
      next[3] = y;
    }
    setDrag({ path: lane.path, points: next });
    clear?.();
    clear = paintPreview({ [lane.variable]: easingValue(next) });
  };

  const releaseHandle = (event: PointerEvent) => {
    (event.currentTarget as Element).releasePointerCapture?.(event.pointerId);
    const moved = drag();
    setGrabbed(undefined);
    setDrag(undefined);
    clear?.();
    clear = undefined;
    if (moved !== undefined) {
      props.onEdit(moved.path, easingValue(moved.points));
    }
  };

  // A dot slides along each curve with linear TIME; the height it holds is
  // the progress, so an ease-out dot sprints and settles while linear walks.
  const [t, setT] = createSignal(0);
  createEffect(() => {
    if (!props.running) {
      setT(0);
      return;
    }
    const period = Math.max(50, props.periodMs);
    const hold = 500;
    const start = performance.now();
    let raf = 0;
    const frame = (now: number) => {
      const within = (now - start) % (period + hold);
      setT(Math.min(1, within / period));
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    onCleanup(() => cancelAnimationFrame(raf));
  });

  const at = (x: number, y: number) => `${x * CHART} ${CHART - y * CHART}`;
  const handleAt = (x: number, y: number) => ({
    cx: x * CHART,
    cy: CHART - y * CHART,
  });

  return (
    <div class="stack-sm">
      <div class="flex flex-wrap items-start gap-4">
        <svg
          ref={svg}
          viewBox={`${-MARGIN} ${-MARGIN} ${CHART + 2 * MARGIN} ${
            CHART + 2 * MARGIN
          }`}
          // The chart frame is studio demo geometry, not a theme decision:
          // the largest spacing token is 6rem, too small to drag a control
          // point on. Capped to the panel so the drawer never overflows.
          style={{
            width: "20rem",
            "max-width": "100%",
            "aspect-ratio": "1",
          }}
          class="shrink-0 touch-none rounded-md border border-border bg-surface-sunken"
          role="img"
          aria-label="every easing this theme declares, drawn on one chart; the selected curve carries draggable control points"
        >
          {
            /* The time and progress axes, so the corner each curve starts
              from and ends at has a line to be a corner of. */
          }
          <line
            x1="0"
            y1={CHART}
            x2={CHART}
            y2={CHART}
            style={{ stroke: "var(--color-border)" }}
            stroke-width="1"
          />
          <line
            x1="0"
            y1="0"
            x2="0"
            y2={CHART}
            style={{ stroke: "var(--color-border)" }}
            stroke-width="1"
          />
          <For each={props.lanes}>
            {(lane, index) => (
              <Show when={pointsOf(lane)}>
                {(points) => (
                  <path
                    d={`M ${at(0, 0)} C ${at(points()[0], points()[1])} ${
                      at(points()[2], points()[3])
                    } ${at(1, 1)}`}
                    // The preset ships no stroke- utility, so the curve takes
                    // the theme's own ink custom property — and the picked
                    // curve takes the accent, which is the colour the
                    // easings family wears.
                    style={{
                      stroke: active()?.path === lane.path
                        ? props.ink
                        : "var(--color-text)",
                    }}
                    stroke-dasharray={DASH[index() % DASH.length]}
                    stroke-width={active()?.path === lane.path ? 3 : 2}
                    fill="none"
                  />
                )}
              </Show>
            )}
          </For>
          <Show when={activePoints()}>
            {(points) => (
              <>
                <line
                  x1="0"
                  y1={CHART}
                  x2={handleAt(points()[0], points()[1]).cx}
                  y2={handleAt(points()[0], points()[1]).cy}
                  style={{ stroke: "var(--color-border-strong)" }}
                  stroke-dasharray="3 3"
                  stroke-width="1"
                />
                <line
                  x1={CHART}
                  y1="0"
                  x2={handleAt(points()[2], points()[3]).cx}
                  y2={handleAt(points()[2], points()[3]).cy}
                  style={{ stroke: "var(--color-border-strong)" }}
                  stroke-dasharray="3 3"
                  stroke-width="1"
                />
                <circle
                  {...handleAt(points()[0], points()[1])}
                  r="6"
                  class="cursor-grab"
                  style={{
                    fill: "var(--color-surface)",
                    stroke: props.ink,
                  }}
                  stroke-width="2"
                  onPointerDown={(event) => {
                    event.preventDefault();
                    setGrabbed(1);
                    (event.currentTarget as Element).setPointerCapture?.(
                      event.pointerId,
                    );
                  }}
                  onPointerMove={moveHandle}
                  onPointerUp={releaseHandle}
                  onPointerCancel={releaseHandle}
                />
                <circle
                  {...handleAt(points()[2], points()[3])}
                  r="6"
                  class="cursor-grab"
                  style={{
                    fill: "var(--color-surface)",
                    stroke: props.ink,
                  }}
                  stroke-width="2"
                  onPointerDown={(event) => {
                    event.preventDefault();
                    setGrabbed(2);
                    (event.currentTarget as Element).setPointerCapture?.(
                      event.pointerId,
                    );
                  }}
                  onPointerMove={moveHandle}
                  onPointerUp={releaseHandle}
                  onPointerCancel={releaseHandle}
                />
              </>
            )}
          </Show>
          <Show when={props.running}>
            <For each={props.lanes}>
              {(lane) => (
                <Show when={pointsOf(lane)}>
                  {(points) => (
                    <circle
                      cx={t() * CHART}
                      cy={CHART - bezierY(points(), t()) * CHART}
                      r="4"
                      style={{ fill: props.ink }}
                    />
                  )}
                </Show>
              )}
            </For>
          </Show>
        </svg>
        <ul class="flow-list stack-sm text-xs">
          <For each={props.lanes}>
            {(lane, index) => (
              <li>
                <button
                  type="button"
                  class="bare text-text"
                  classList={{
                    "font-semibold underline": active()?.path === lane.path,
                    "text-accent": active()?.path === lane.path,
                  }}
                  aria-pressed={active()?.path === lane.path}
                  onClick={() => setSelected(lane.path)}
                >
                  <span class="row-sm gap-2">
                    <svg width="20" height="8" aria-hidden="true">
                      <line
                        x1="0"
                        y1="4"
                        x2="20"
                        y2="4"
                        style={{
                          stroke: active()?.path === lane.path
                            ? props.ink
                            : "var(--color-text)",
                        }}
                        stroke-dasharray={DASH[index() % DASH.length]}
                        stroke-width="2"
                      />
                    </svg>
                    <code>{lane.utility}</code>
                    <Show when={lane.points}>
                      {(points) => (
                        <span class="text-text-muted">
                          {Math.round(bezierY(points(), 0.5) * 100)}% at half
                          time
                        </span>
                      )}
                    </Show>
                  </span>
                </button>
              </li>
            )}
          </For>
        </ul>
      </div>
      <p class="text-xs text-text-muted">
        The legend picks a curve; drag its handles and the curve writes the
        easing, on release. The bars below run it.
      </p>
    </div>
  );
}

/**
 * The section's loop control: run it until you say stop.
 *
 * The control is quiet while the race is at rest and loud while it runs —
 * in the colour of the family it runs — because "stop" is only worth
 * reading when there is something to stop.
 */
function LoopButton(props: {
  running: boolean;
  onToggle: () => void;
  label: string;
  /** The fill and the ink on it, while the race runs. */
  paint: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={props.running}
      class={`rounded-md border px-2 py-1 text-xs ${
        props.running
          ? `border-transparent ${props.paint}`
          : "border-border text-text-muted hover:text-text"
      }`}
      onClick={props.onToggle}
    >
      {props.running ? "stop" : props.label}
    </button>
  );
}

export default function MotionPage() {
  const tree = createMemo(() => analyzeTheme(themeText()).tree);
  const durations = createLockstep(() => {
    const current = tree();
    return current
      ? groupTokens(current, [["motion", "duration"]], activeMode())
      : [];
  }, "motion.duration");
  const easings = createMemo(() => {
    const current = tree();
    return current
      ? groupTokens(current, [["motion", "easing"]], activeMode())
      : [];
  });
  const edit = (path: string, value: string) =>
    editToken(path.split("."), value);

  const [durationLoop, setDurationLoop] = createSignal(false);
  const [easingLoop, setEasingLoop] = createSignal(false);

  // Every duration races under one shared easing, and every easing over one
  // shared duration: a lane that set both would compare nothing.
  const preferredDuration = () => {
    const rows = durations.rows();
    return rows.find((row) => row.path.endsWith(".base")) ?? rows[0];
  };
  /**
   * The curve every duration shares.
   *
   * The theme's standard curve when it declares one, and its first curve
   * when it does not — a race in which every lane curves differently is a
   * race about two things at once, and the reader learns nothing about
   * either.
   */
  const sharedEasing = () => {
    const rows = easings();
    return rows.find((row) => row.path.endsWith(".standard")) ?? rows[0];
  };
  /** The shared duration in ms: the race's unit, and the playhead's period. */
  const anchorMs = () => {
    const preferred = preferredDuration();
    return (preferred === undefined
      ? undefined
      : durationMs(preferred.value)) ??
      400;
  };

  return (
    <ConcernPage
      title="Motion"
      note="A duration is only legible against another duration, and a curve only against another curve, so each stage runs every token at once."
    >
      <Section
        title="Durations"
        fact={`${durations.rows().length} steps`}
        note="Every duration, raced under one shared easing, so the ranking is the specimen. Loop it: 150ms played once is gone before you have seen it."
        aside={
          <div class="row-sm gap-2">
            <LinkToggle group="motion.duration" />
            <LoopButton
              running={durationLoop()}
              onToggle={() => setDurationLoop(!durationLoop())}
              label="loop all"
              paint="bg-primary text-on-primary"
            />
          </div>
        }
      >
        <Show
          when={durations.rows().length > 0}
          fallback={
            <p class="text-sm text-text-muted">
              This theme declares no durations yet.
            </p>
          }
        >
          <Frame>
            <RaceStage
              lanes={lanesFor(durations.rows(), durationUtility, false)}
              durationOf={(lane) => lane.variable}
              easingOf={() => sharedEasing()?.variable}
              paint="bg-primary"
              onEdit={(path, value) => durations.commit(path, value)}
              onPreview={(path, value) => durations.preview(path, value)}
              onCancel={durations.abandon}
              running={durationLoop()}
            />
          </Frame>
        </Show>
      </Section>

      <Section
        title="Easings"
        fact={`${easings().length} curves`}
        tone="accent"
        note="Every curve, drawn on one chart and raced over one shared duration, so the shape shows up as speed."
        aside={
          <LoopButton
            running={easingLoop()}
            onToggle={() => setEasingLoop(!easingLoop())}
            label="loop all"
            paint="bg-accent text-on-accent"
          />
        }
      >
        <Show
          when={easings().length > 0}
          fallback={
            <p class="text-sm text-text-muted">
              This theme declares no easings yet.
            </p>
          }
        >
          <Frame>
            <EasingChart
              lanes={lanesFor(easings(), easingUtility, true)}
              ink="var(--color-accent)"
              onEdit={edit}
              running={easingLoop()}
              periodMs={anchorMs()}
            />
          </Frame>
          <div class="stack-sm">
            <Frame>
              <RaceStage
                lanes={lanesFor(easings(), easingUtility, false)}
                durationOf={() => preferredDuration()?.variable}
                easingOf={(lane) => lane.variable}
                paint="bg-accent"
                onEdit={edit}
                running={easingLoop()}
              />
            </Frame>
          </div>
        </Show>
      </Section>
    </ConcernPage>
  );
}

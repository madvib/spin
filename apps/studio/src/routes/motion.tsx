import {
  createEffect,
  createMemo,
  createSignal,
  For,
  onCleanup,
  Show,
} from "solid-js";
import { createSpinComponent } from "@spinjs/components/solid";
import { motionStage } from "../machines/motion-stage/motion-stage.presentation.ts";
import { withShares } from "../machines/motion-stage/motion-stage.state.ts";
import type { MotionLane } from "../machines/motion-stage/motion-stage.state.ts";
import ValueInput from "../components/demos/ValueInput.tsx";
import LinkToggle from "../components/demos/LinkToggle.tsx";
import { ConcernPage, Frame, Section, TokenLine } from "../components/Concern.tsx";
import {
  bezierY,
  durationMs,
  easingControlPoints,
  easingUtility,
  easingValue,
} from "../lib/motion.ts";
import { durationUtility, tokenValue } from "../lib/overview.ts";
import { groupTokens } from "../lib/tokens.ts";
import type { TokenRow } from "../lib/tokens.ts";
import { activeMode, activeTree } from "../lib/store.ts";
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

/**
 * A stage: a lane per token, run by the motion-stage machine.
 *
 * The machine owns the cycle — reset → run → hold — and the play, loop
 * and speed the toolbar drives. The page owns the lanes: the token path,
 * its variable, and the ValueInput editor that writes it, passed as the
 * lane's light-DOM child.
 *
 * The clock a lane runs on is the token's OWN property, not a utility name:
 * a utility is a name the scanner has to see written down, and a theme may
 * name its durations and its curves anything at all — the property is the
 * value, so the race is the theme's race.
 */
function Stage(props: {
  id: string;
  lanes: Lane[];
  /** The lane's own time, as the custom property that carries it. */
  durationOf: (lane: Lane) => string | undefined;
  /** The lane's own curve, as the custom property that carries it. */
  easingOf: (lane: Lane) => string | undefined;
  onEdit: (path: string, value: string) => boolean;
  /** Reports a value a lane's control proposes while dragged. */
  onPreview?: (path: string, value: string) => void;
  /** Reports a drag abandoned before it committed. */
  onCancel?: () => void;
  /** Returns the live proposed value for a path while the group is dragged. */
  shown?: (path: string, committed: string) => string;
}) {
  const [element, setElement] = createSignal<HTMLElement>();
  const stage = createSpinComponent(element, motionStage);
  const bare = (name: string | undefined): string =>
    (name ?? "").replace(/^var\(/, "").replace(/\)$/, "");
  // Projected rows are moved out from under Solid's For by the element's
  // slot projection, so the For must never rebuild a row whose lane did
  // not change: a fresh object identity reads as a new row, and replacing
  // projected nodes breaks the reconciliation the next render depends on.
  // The cache keys rows by token path and reuses the prior object while
  // every field matches; a commit mints exactly one new object.
  const rowCache = new Map<string, Lane>();
  const stableLanes = (lanes: readonly Lane[]): readonly Lane[] => {
    const next: Lane[] = [];
    const seen = new Set<string>();
    for (const lane of lanes) {
      seen.add(lane.path);
      const prev = rowCache.get(lane.path);
      const same = prev !== undefined &&
        prev.utility === lane.utility && prev.value === lane.value &&
        prev.type === lane.type && prev.variable === lane.variable &&
        ((prev.points === undefined && lane.points === undefined) ||
          (prev.points !== undefined && lane.points !== undefined &&
            prev.points.every((n, i) => n === lane.points?.[i])));
      if (same) {
        next.push(prev);
      } else {
        rowCache.set(lane.path, lane);
        next.push(lane);
      }
    }
    for (const key of [...rowCache.keys()]) {
      if (!seen.has(key)) rowCache.delete(key);
    }
    return next;
  };
  const motionLanes = (): MotionLane[] =>
    withShares(
      stableLanes(props.lanes).map((lane, index) => ({
        id: `${props.id}-${index}`,
        path: lane.path,
        utility: lane.utility,
        value: lane.value,
        durationMs: durationMs(lane.value) ?? 1,
        variable: lane.variable,
        durationVar: bare(props.durationOf(lane) ?? lane.variable),
        easingVar: bare(props.easingOf(lane) ?? lane.variable),
      })),
    );
  createEffect(() =>
    stage.bind({
      lanes: motionLanes(),
    })
  );
  return (
    <studio-motion-stage ref={(el: HTMLElement) => setElement(el)} prop:lanes={motionLanes()}>
      {/*
        Keyed by path, not by lane object: the element projects these rows
        out of Solid's tree, so a fresh object identity per commit would
        read as a new row and replace nodes the projection already moved.
        Path strings compare by value, so an edit updates the row's
        bindings in place and the projected nodes never move.
      */}
      <For each={props.lanes.map((lane) => lane.path)}>
        {(path, index) => {
          const lane = () => props.lanes.find((row) => row.path === path) ?? props.lanes[index()]!;
          return (
            <div slot={`${props.id}-${index()}`}>
              <ValueInput
                value={lane().value}
                type={lane().type}
                onCommit={(value) => props.onEdit(lane().path, value)}
                group={props.lanes.map((other) => other.value)}
                variable={lane().variable}
                label={lane().path}
                onPreview={props.onPreview === undefined
                  ? undefined
                  : (value) => props.onPreview?.(lane().path, value)}
                onCancel={props.onCancel}
                proposed={props.shown?.(lane().path, lane().value)}
              />
            </div>
          );
        }}
      </For>
    </studio-motion-stage>
  );
}
/* RaceStage removed: Stage above runs the motion-stage machine. */

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
  /** The chart's own axes: the theme's hairline. */
  axis: string | undefined;
  /** The guide that carries the picked curve's handles. */
  guide: string | undefined;
  /** The ink the curves that are not picked wear. */
  curve: string | undefined;
  /** The page the handles are drawn on. */
  surface: string | undefined;
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
            style={{ stroke: props.axis }}
            stroke-width="1"
          />
          <line
            x1="0"
            y1="0"
            x2="0"
            y2={CHART}
            style={{ stroke: props.axis }}
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
                        : props.curve,
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
                  style={{ stroke: props.guide }}
                  stroke-dasharray="3 3"
                  stroke-width="1"
                />
                <line
                  x1={CHART}
                  y1="0"
                  x2={handleAt(points()[2], points()[3]).cx}
                  y2={handleAt(points()[2], points()[3]).cy}
                  style={{ stroke: props.guide }}
                  stroke-dasharray="3 3"
                  stroke-width="1"
                />
                <circle
                  {...handleAt(points()[0], points()[1])}
                  r="6"
                  class="cursor-grab"
                  style={{
                    fill: props.surface,
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
                    fill: props.surface,
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
        <ul
          class="stack-xs flex-1"
          style={{ "min-width": "14rem" }}
        >
          <For each={props.lanes}>
            {(lane, index) => (
              <li class="min-w-0">
                <button
                  type="button"
                  class="bare w-full min-w-0 text-left"
                  aria-pressed={active()?.path === lane.path}
                  onClick={() => setSelected(lane.path)}
                >
                  <span
                    class="flex w-full min-w-0 flex-wrap items-center justify-between gap-2 rounded-md border px-2 py-2"
                    classList={{
                      "border-accent bg-surface": active()?.path === lane.path,
                      "border-transparent": active()?.path !== lane.path,
                    }}
                  >
                    <span class="row-sm min-w-0 flex-wrap items-center gap-2">
                      <svg width="20" height="8" aria-hidden="true">
                        <line
                          x1="0"
                          y1="4"
                          x2="20"
                          y2="4"
                          style={{
                            stroke: active()?.path === lane.path
                              ? props.ink
                              : props.curve,
                          }}
                          stroke-dasharray={DASH[index() % DASH.length]}
                          stroke-width="2"
                        />
                      </svg>
                      <span class="type-code">
                        {lane.path.split(".").pop()}
                      </span>
                      <code class="text-text-muted">{lane.utility}</code>
                    </span>
                    <Show when={lane.points}>
                      {(points) => (
                        <span class="type-code text-text-muted tabular-nums">
                          {Math.round(bezierY(points(), 0.5) * 100)}% at t=0.5
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
    </div>
  );
}

/**
 * The section's loop control: run it until you say stop.
 *
 * The control is quiet while the race is at rest and loud while it runs —
 * in the colour of the family it runs — because "stop" is only worth
 * reading when there is something to stop. Quiet means the theme's own
 * paint-free button: a plain button is the theme's loudest control, and a
 * control that shouts before anything has happened is a control the reader
 * learns to ignore.
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
      class={`bare rounded-md border px-2 py-1 type-caption ${
        props.running
          ? `border-transparent ${props.paint}`
          : "ghost border-border text-text-muted"
      }`}
      onClick={props.onToggle}
    >
      {props.running ? "stop" : props.label}
    </button>
  );
}

export default function MotionPage() {
  const durations = createLockstep(() => groupTokens(activeTree(), [["motion", "duration"]], activeMode()), "motion.duration");
  const easings = createMemo(() => groupTokens(activeTree(), [["motion", "easing"]], activeMode()));
  /**
   * The transitions the theme spells in one token.
   *
   * A transition token carries a duration and an easing at once, so it is
   * neither a duration nor a curve on the stages above: it is the pair,
   * written as one value, and it gets a row of its own.
   */
  const transitions = createMemo(() =>
    groupTokens(activeTree(), [["motion"]], activeMode()).filter((row) =>
      row.type === "transition"
    )
  );
  const edit = (path: string, value: string) =>
    editToken(path.split("."), value);
  /**
   * The theme's own value for a colour, in the mode being shown.
   *
   * The chart is drawn with the theme's colours, read as values: a custom
   * property is generated output, and a chart that names one is a chart that
   * has to be re-read every time the theme is edited.
   */
  const colour = (path: string): string | undefined =>
    tokenValue(activeTree(), activeMode(), path);

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
    <ConcernPage title="Motion">
      <Section
        title="Durations"
        fact={`${durations.rows().length} steps`}
        info="Every duration raced under a shared easing curve; linked steps scale proportionally."
        aside={
          <div class="row-sm gap-2">
            <LinkToggle
              group="motion.duration"
              ratio={durations.activeRatio()}
            />
          </div>
        }
      >
        <Show
          when={durations.rows().length > 0}
          fallback={
            <p class="text-text-muted">
              This theme declares no durations yet.
            </p>
          }
        >
          <Frame>
            <Stage
              id="durations"
              lanes={lanesFor(durations.rows(), durationUtility, false)}
              durationOf={(lane) => lane.variable}
              easingOf={() => sharedEasing()?.variable}
              onEdit={(path, value) => durations.commit(path, value)}
              onPreview={(path, value) => durations.preview(path, value)}
              onCancel={durations.abandon}
              shown={durations.shown}
            />
          </Frame>
        </Show>
      </Section>

      <Section
        title="Easings"
        fact={`${easings().length} curves`}
        tone="accent"
        info="Select a curve to drag its cubic-bezier control points on the chart, or race all curves over a shared duration."
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
            <p class="text-text-muted">
              This theme declares no easings yet.
            </p>
          }
        >
          <Frame class="stack min-w-0">
            <div class="min-w-0 rounded-md border border-border bg-surface-sunken p-3">
              <EasingChart
                lanes={lanesFor(easings(), easingUtility, true)}
                ink={colour("color.accent") ?? "currentColor"}
                axis={colour("color.border")}
                guide={colour("color.border-strong")}
                curve={colour("color.text")}
                surface={colour("color.surface")}
                onEdit={edit}
                running={easingLoop()}
                periodMs={anchorMs()}
              />
            </div>
            <Stage
              id="easings"
              lanes={lanesFor(easings(), easingUtility, false)}
              durationOf={() => preferredDuration()?.variable}
              easingOf={(lane) => lane.variable}
              onEdit={edit}
            />
          </Frame>
        </Show>
      </Section>

      <Section
        title="Transitions"
        fact={`${transitions().length} pairs`}
        info="Composite transition tokens combining a duration, an easing curve, and a CSS property."
      >
        <Show
          when={transitions().length > 0}
          fallback={
            <p class="text-text-muted">
              This theme declares no transitions yet.
            </p>
          }
        >
          <Frame class="p-3">
            <ul>
              <For each={transitions()}>
                {(row) => (
                  <TokenLine
                    path={row.path}
                    editor={
                      <ValueInput
                        value={row.value}
                        type={row.type}
                        onCommit={(value) => edit(row.path, value)}
                        variable={row.variable}
                        label={row.path}
                      />
                    }
                  />
                )}
              </For>
            </ul>
          </Frame>
        </Show>
      </Section>
    </ConcernPage>
  );
}

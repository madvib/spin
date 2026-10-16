import { createMemo, createSignal, For, Show } from "solid-js";
import ValueInput from "../components/demos/ValueInput";
import {
  bezierY,
  durationMs,
  easingControlPoints,
  easingUtility,
} from "../lib/motion";
import { durationUtility } from "../lib/overview";
import { analyzeTheme } from "../lib/theme";
import { groupTokens } from "../lib/tokens";
import type { TokenRow } from "../lib/tokens";
import { activeMode, themeText } from "../lib/store";
import { editToken } from "../lib/editing";
import { inDrawer } from "../app";

/**
 * Motion — the values that move things, raced against each other.
 *
 * Neither number a transition is made of reads as a number: `400ms` beside
 * `150ms` says nothing until two things take that long side by side, and
 * `cubic-bezier(0.2, 0, 0, 1)` is a shape. So each section is one stage with
 * one play control and a lane per token. At rest a duration's bar is its
 * share of the longest, so the ramp reads without a click; on play the bars
 * race to the far edge and the arrival order is the same ramp, felt. Lanes
 * hold one thing still so the comparison means something: durations share an
 * easing, easings share a time.
 */

/** The side a curve is drawn on, and the dash that identifies it in the overlay. */
const CHART = 128;

/** How each easing is told apart in the shared chart, by dash rather than hue. */
const DASH = ["", "4 3", "1 3", "6 3 1 3"];

/**
 * A stage: one play control, a lane per token. At rest each bar shows the
 * lane's share of the longest run; on play they race to the far edge.
 */
function RaceStage(props: {
  lanes: Lane[];
  /** The one thing held still across every lane, so the rest can be compared. */
  anchor: string;
  onEdit: (path: string, value: string) => boolean;
}) {
  const [phase, setPhase] = createSignal<"idle" | "reset" | "run">("idle");
  const play = () => {
    setPhase("reset");
    // Two frames: the reset has to paint before the run starts, or the
    // browser coalesces them and nothing transitions.
    requestAnimationFrame(() => requestAnimationFrame(() => setPhase("run")));
  };

  // A bar's width at rest is its share of the longest duration, so the scale
  // is legible before anything is pressed.
  const longest = () => {
    const ms = props.lanes.map((lane) => durationMs(lane.value) ?? 0);
    return Math.max(1, ...ms);
  };
  const share = (lane: Lane) => {
    if (phase() === "run") return 100;
    if (phase() === "reset") return 0;
    return ((durationMs(lane.value) ?? longest()) / longest()) * 100;
  };

  return (
    <div class="stack-sm">
      <button type="button" onClick={play} class="self-start">
        play all
      </button>
      <div class="panel stack-sm">
        <ul class="stack-sm flow-list">
          <For each={props.lanes}>
            {(lane) => (
              <li class="stack-xs">
                <div class="row-sm flex-wrap justify-between gap-3">
                  <code class="text-xs text-text-muted">{lane.path}</code>
                  <div class="row-sm shrink-0">
                    <code class="text-xs whitespace-nowrap">
                      {lane.utility}
                    </code>
                    <ValueInput
                      value={lane.value}
                      type={lane.type}
                      onCommit={(value) => props.onEdit(lane.path, value)}
                    />
                  </div>
                </div>
                {
                  /* The lane's own utility on the bar, so the specimen is the
                    token and not a stand-in for it. */
                }
                <div
                  class="spin-preview h-5 overflow-hidden rounded-sm bg-surface-sunken"
                  aria-hidden="true"
                >
                  <div
                    class={`h-full rounded-sm bg-primary ${
                      phase() === "run"
                        ? `transition-all ${props.anchor} ${lane.utility}`
                        : "transition-none"
                    }`}
                    style={{ width: `${share(lane)}%` }}
                  />
                </div>
              </li>
            )}
          </For>
        </ul>
      </div>
    </div>
  );
}

/**
 * Every easing drawn on one chart.
 *
 * Overlaying is the comparison: four separate thumbnails cannot show how
 * standard differs from decelerate, because the eye has to hold three shapes
 * in memory. Each curve is told apart by its dash, so the chart needs no
 * colour the theme did not ask for.
 */
function EasingChart(props: { lanes: Lane[] }) {
  const at = (x: number, y: number) => `${x * CHART} ${CHART - y * CHART}`;
  return (
    <div class="panel row-sm flex-wrap items-start gap-4">
      <svg
        width={CHART}
        height={CHART}
        viewBox={`0 0 ${CHART} ${CHART}`}
        class="shrink-0 rounded-md border border-border bg-surface-sunken"
        role="img"
        aria-label="every easing this theme declares, drawn on one chart"
      >
        <For each={props.lanes}>
          {(lane, index) => (
            <Show when={lane.points}>
              {(points) => {
                const [x1, y1, x2, y2] = points();
                return (
                  <path
                    d={`M ${at(0, 0)} C ${at(x1, y1)} ${at(x2, y2)} ${
                      at(1, 1)
                    }`}
                    // The preset ships no stroke- utility, so the curve takes
                    // the theme's own ink custom property.
                    style={{ stroke: "var(--color-text)" }}
                    stroke-dasharray={DASH[index() % DASH.length]}
                    stroke-width="2"
                    fill="none"
                  />
                );
              }}
            </Show>
          )}
        </For>
      </svg>
      <ul class="stack-xs text-xs">
        <For each={props.lanes}>
          {(lane, index) => (
            <li class="row-sm gap-2">
              <svg width="20" height="8" aria-hidden="true">
                <line
                  x1="0"
                  y1="4"
                  x2="20"
                  y2="4"
                  style={{ stroke: "var(--color-text)" }}
                  stroke-dasharray={DASH[index() % DASH.length]}
                  stroke-width="2"
                />
              </svg>
              <code>{lane.utility}</code>
              <Show when={lane.points}>
                {(points) => (
                  <span class="text-text-muted">
                    {Math.round(bezierY(points(), 0.5) * 100)}% at half time
                  </span>
                )}
              </Show>
            </li>
          )}
        </For>
      </ul>
    </div>
  );
}

/** One lane of a race: its token path, the utility it runs, and its editor. */
interface Lane {
  path: string;
  utility: string;
  value: string;
  type: string;
  points?: [number, number, number, number];
}

function lanesFor(
  rows: TokenRow[],
  utility: (path: string) => string,
  withCurve: boolean,
): Lane[] {
  return rows.map((row) => ({
    path: row.path,
    utility: utility(row.path),
    value: row.value,
    type: row.type,
    points: withCurve ? easingControlPoints(row.value) : undefined,
  }));
}

export default function MotionPage() {
  const tree = createMemo(() => analyzeTheme(themeText()).tree);
  const durations = createMemo(() => {
    const current = tree();
    return current
      ? groupTokens(current, [["motion", "duration"]], activeMode())
      : [];
  });
  const easings = createMemo(() => {
    const current = tree();
    return current
      ? groupTokens(current, [["motion", "easing"]], activeMode())
      : [];
  });
  const edit = (path: string, value: string) =>
    editToken(path.split("."), value);

  // Every duration races under one shared easing, and every easing over one
  // shared duration: a lane that set both would compare nothing.
  const anchor = (prefix: string) => {
    const rows = durations();
    const preferred = rows.find((row) => row.path.endsWith(".base")) ??
      rows[0];
    if (preferred === undefined) return "transition-all";
    const name = preferred.path.split(".").slice(2).join("-");
    return `transition-all ${prefix}-${name}`;
  };

  return (
    <section
      class="stack mb-6"
      classList={{ "max-w-screen-md": !inDrawer() }}
    >
      <header class="stack-sm">
        <h1 class="text-xl font-semibold">Motion</h1>
        <p class="text-sm text-text-muted">
          A duration is only legible against another duration, an easing only
          against another curve. Each stage runs every token at once, so the
          ranking is the specimen. Durations hold the curve still; easings hold
          the time still.
        </p>
      </header>

      <section class="stack-sm" aria-label="Durations">
        <h2 class="font-medium">Durations</h2>
        <Show
          when={durations().length > 0}
          fallback={
            <p class="text-sm text-text-muted">
              This theme declares no durations yet.
            </p>
          }
        >
          <RaceStage
            lanes={lanesFor(durations(), durationUtility, false)}
            anchor={anchor("ease")}
            onEdit={edit}
          />
        </Show>
      </section>

      <section class="stack-sm" aria-label="Easings">
        <h2 class="font-medium">Easings</h2>
        <Show
          when={easings().length > 0}
          fallback={
            <p class="text-sm text-text-muted">
              This theme declares no easings yet.
            </p>
          }
        >
          <div class="stack-sm">
            <EasingChart lanes={lanesFor(easings(), easingUtility, true)} />
            <RaceStage
              lanes={lanesFor(easings(), easingUtility, false)}
              anchor={anchor("duration")}
              onEdit={edit}
            />
          </div>
        </Show>
      </section>
    </section>
  );
}

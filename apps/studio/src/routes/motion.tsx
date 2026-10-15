import { createMemo, For, Show } from "solid-js";
import PlayRig from "../components/demos/PlayRig";
import ValueInput from "../components/demos/ValueInput";
import { analyzeTheme } from "../lib/theme";
import { groupTokens } from "../lib/tokens";
import type { TokenRow } from "../lib/tokens";
import { activeMode, themeText } from "../lib/store";
import { editToken } from "../lib/editing";

/** The stage a curve is drawn on: a small square, inset so a curve can overshoot. */
const BOX = 64;
const INSET = 6;
const SPAN = BOX - INSET * 2;

/**
 * Motion — the values that move things, playing beside their control.
 *
 * A duration and an easing are the two numbers a transition is made of, and
 * neither reads as a number: `400ms` beside `150ms` says nothing until you
 * watch something take that long, and `cubic-bezier(0.2, 0, 0, 1)` is a
 * shape. So each row keeps its play rig as the specimen with the control
 * beside it — press play and the duration runs, and an easing reads as the
 * curve it draws. The raw token list that used to sit under the rigs was the
 * same values a second time; a row is now the one place a value lives.
 */
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

  return (
    <div class="flex-1 overflow-y-auto p-4 min-h-0 min-w-0 stack">
      <div>
        <h1 class="text-2xl">Motion</h1>
        <p>
          How long a change takes, and how it eases. Each row plays the value
          beside the control that sets it: press play to watch a duration run,
          and read an easing as the curve it draws.
        </p>
      </div>

      <section class="stack-sm">
        <h2 class="text-xl">Duration</h2>
        <div class="stack-sm">
          <For each={durations()}>
            {(row) => <DurationRow row={row} />}
          </For>
        </div>
      </section>

      <section class="stack-sm">
        <h2 class="text-xl">Easing</h2>
        <div class="stack-sm">
          <For each={easings()}>
            {(row) => <EasingRow row={row} />}
          </For>
        </div>
      </section>
    </div>
  );
}

/** One duration: the rig is the specimen, the control sits beside it. */
function DurationRow(props: { row: TokenRow }) {
  return (
    <div class="split panel">
      <code class="font-mono text-sm">{props.row.path}</code>
      <div class="min-w-0 flex-1">
        <PlayRig
          utility={`duration-${props.row.path.split(".").slice(2).join("-")}`}
        />
      </div>
      <div class="shrink-0 w-24">
        <ValueInput
          value={props.row.value}
          type={props.row.type}
          onCommit={(value) => editToken(props.row.path.split("."), value)}
        />
      </div>
    </div>
  );
}

/** One easing: the curve is the specimen, the control sits beside it. */
function EasingRow(props: { row: TokenRow }) {
  return (
    <div class="split panel">
      <div class="row-sm">
        <code class="font-mono text-sm">{props.row.path}</code>
        <EasingCurve value={props.row.value} />
      </div>
      <div class="shrink-0 w-56">
        <ValueInput
          value={props.row.value}
          type={props.row.type}
          onCommit={(value) => editToken(props.row.path.split("."), value)}
        />
      </div>
    </div>
  );
}

/**
 * The curve an easing draws, read from the value itself.
 *
 * `linear` is control points (0,0) and (1,1) — the diagonal — so the dashed
 * reference is the specimen rather than a second line, and any other easing
 * bends away from it. The box stays small: what an easing is worth is the
 * shape, not the resolution.
 */
function EasingCurve(props: { value: string }) {
  const text = props.value.trim();
  const numbers = text === "linear"
    ? [0, 0, 1, 1]
    : /^cubic-bezier\(([^)]+)\)$/.exec(text)?.[1].split(",").map((n) =>
      Number(n.trim())
    );
  const drawn = numbers !== undefined && numbers.length === 4 &&
      numbers.every((n) => Number.isFinite(n))
    ? numbers
    : undefined;
  // y is flipped: the curve runs bottom-left to top-right, an eased value's
  // progress being height on the page.
  const x = (n: number) => INSET + n * SPAN;
  const y = (n: number) => INSET + (1 - n) * SPAN;
  return (
    <svg
      class="shrink-0"
      width={BOX}
      height={BOX}
      viewBox={`0 0 ${BOX} ${BOX}`}
      style={{ overflow: "visible" }}
      aria-hidden="true"
    >
      <rect
        x={INSET}
        y={INSET}
        width={SPAN}
        height={SPAN}
        rx="4"
        fill="none"
        style={{ stroke: "var(--border, currentColor)" }}
      />
      <line
        x1={INSET}
        y1={INSET + SPAN}
        x2={INSET + SPAN}
        y2={INSET}
        stroke-dasharray="3 3"
        style={{ stroke: "var(--border, currentColor)" }}
      />
      <Show when={drawn}>
        {(points) => {
          const [x1, y1, x2, y2] = points();
          return (
            <path
              d={`M ${x(0)} ${y(0)} C ${x(x1)} ${y(y1)} ${x(x2)} ${y(y2)} ${
                x(1)
              } ${y(1)}`}
              fill="none"
              stroke-width="2"
              stroke-linecap="round"
              style={{ stroke: "var(--color-primary, currentColor)" }}
            />
          );
        }}
      </Show>
    </svg>
  );
}

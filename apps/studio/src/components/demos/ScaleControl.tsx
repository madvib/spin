import { createSignal, Show } from "solid-js";
import type { TokenRow } from "../../lib/tokens.ts";
import { scaleValue } from "../../lib/scale.ts";
import { paintPreview } from "../../lib/preview.ts";
import type { TokenEdit } from "../../lib/editing.ts";

/**
 * One factor for a group that scales together.
 *
 * A spacing scale, a set of glyph sizes, a ramp of durations, a family of
 * radii — these are ratios before they are values, and authors change them
 * TOGETHER. Six sliders moved one at a time is how a scale stops being a
 * scale. The track proposes a multiplier, centred on neutral: every step's
 * custom property is painted on the preview surface as it moves, so the
 * whole group travels together under the finger, and release writes the
 * group as ONE edit — one snapshot of undo, one refusal if the document
 * says no.
 *
 * `0.25 × 16^t` over a thousand positions puts ×1.00 exactly in the
 * middle: drag right to grow the scale, left to shrink it, and let go to
 * keep it. The track returns to neutral, because the factor it just
 * applied is now simply what the values ARE.
 */
export default function ScaleControl(props: {
  rows: readonly TokenRow[];
  /** What the track does to this group, in words. */
  label: string;
  /** Applies every scaled value as a single edit. */
  onScale: (edits: readonly TokenEdit[]) => boolean;
}) {
  const NEUTRAL = 500;
  const factorAt = (t: number) => 0.25 * 16 ** (t / 1000);

  const [drag, setDrag] = createSignal<number | undefined>(undefined);
  const factor = () => {
    const t = drag();
    return t === undefined ? 1 : factorAt(t);
  };

  // A group with nothing numeric in it has no factor to apply, and a
  // control that would do nothing is a control that lies.
  const entries = () =>
    props.rows.flatMap((row) => {
      const next = scaleValue(row.value, factor());
      return next === undefined
        ? []
        : [{ row, next, edit: { path: row.path.split("."), value: next } }];
    });

  let clear: (() => void) | undefined;
  const release = () => {
    clear?.();
    clear = undefined;
  };
  const paint = (t: number) => {
    release();
    const f = factorAt(t);
    const vars: Record<string, string> = {};
    for (const row of props.rows) {
      const next = scaleValue(row.value, f);
      if (next !== undefined) vars[row.variable] = next;
    }
    clear = paintPreview(vars);
  };

  return (
    <Show when={entries().length > 0}>
      <div class="row-sm flex-wrap gap-3">
        <span class="text-sm text-text-muted">{props.label}</span>
        <input
          type="range"
          aria-label={props.label}
          min={0}
          max={1000}
          step={1}
          value={drag() ?? NEUTRAL}
          class="min-w-24 flex-1"
          aria-valuetext={`×${factor().toFixed(2)}`}
          onInput={(event) => {
            const t = Number(event.currentTarget.value);
            setDrag(t);
            paint(t);
          }}
          onChange={() => {
            const edits = entries().map((entry) => entry.edit);
            release();
            setDrag(undefined);
            if (edits.length > 0) props.onScale(edits);
          }}
          onPointerCancel={() => {
            release();
            setDrag(undefined);
          }}
        />
        <code class="text-sm">×{factor().toFixed(2)}</code>
      </div>
    </Show>
  );
}

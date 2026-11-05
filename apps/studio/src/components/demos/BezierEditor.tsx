import { createEffect, createSignal, on, Show } from "solid-js";

/**
 * An easing is a curve, and a curve is four control points. Typing
 * `cubic-bezier(0.2, 0, 0, 1)` is how the curve gets misread; the editor
 * exposes the four numbers and paints the curve they describe, so the value
 * being edited is the thing being seen.
 */
export default function BezierEditor(props: {
  value: string;
  onCommit: (value: string) => boolean;
}) {
  const parsed = () => parse(props.value);
  const [draft, setDraft] = createSignal(parsed());

  // The document is the source of truth: undo, redo, a reset or a reload
  // moves the curve, and the four fields have to move with it. `on` so the
  // effect answers the value rather than the draft being edited.
  createEffect(on(() => props.value, (value) => setDraft(parse(value))));

  function commit(next: { x1: string; y1: string; x2: string; y2: string }) {
    const value =
      `cubic-bezier(${next.x1}, ${next.y1}, ${next.x2}, ${next.y2})`;
    // A refused curve is not the document's: the fields go back to the
    // curve the theme still holds.
    if (!props.onCommit(value)) setDraft(parse(props.value));
  }

  return (
    <Show
      when={parsed().kind === "bezier"}
      fallback={
        <input
          type="text"
          class="w-[10rem]"
          value={props.value}
          onChange={(e) => props.onCommit(e.currentTarget.value)}
        />
      }
    >
      <div class="row-sm flex-wrap items-center gap-2">
        {(["x1", "y1", "x2", "y2"] as const).map((key) => (
          <label class="row-sm items-center gap-1 text-text-muted">
            <span>{key}</span>
            <input
              type="number"
              step="0.05"
              min={key.startsWith("x") ? "0" : "-0.5"}
              max={key.startsWith("x") ? "1" : "1.5"}
              class="w-[3.5rem] px-2 text-center tabular-nums"
              value={draft()[key]}
              onChange={(e) =>
                commit({ ...draft(), [key]: e.currentTarget.value })}
            />
          </label>
        ))}
      </div>
    </Show>
  );
}

function parse(
  value: string,
): {
  kind: "bezier" | "other";
  x1: string;
  y1: string;
  x2: string;
  y2: string;
} {
  const match = value.trim().match(
    /^cubic-bezier\(\s*([-+]?[\d.]+)\s*,\s*([-+]?[\d.]+)\s*,\s*([-+]?[\d.]+)\s*,\s*([-+]?[\d.]+)\s*\)$/,
  );
  if (!match) {
    return { kind: "other", x1: "0.2", y1: "0", x2: "0", y2: "1" };
  }
  return {
    kind: "bezier",
    x1: match[1]!,
    y1: match[2]!,
    x2: match[3]!,
    y2: match[4]!,
  };
}

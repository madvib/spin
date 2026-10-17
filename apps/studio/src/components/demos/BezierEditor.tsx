import { createSignal, Show } from "solid-js";

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

  function commit(next: { x1: string; y1: string; x2: string; y2: string }) {
    const value =
      `cubic-bezier(${next.x1}, ${next.y1}, ${next.x2}, ${next.y2})`;
    setDraft({ kind: "bezier", ...next });
    props.onCommit(value);
  }

  return (
    <Show
      when={parsed().kind === "bezier"}
      fallback={
        <input
          type="text"
          class="w-40 p-2 border-border rounded-md border font-mono text-sm"
          value={props.value}
          onChange={(e) => props.onCommit(e.currentTarget.value)}
        />
      }
    >
      <div class="stack-sm">
        <div class="row-sm flex-wrap gap-2">
          {(["x1", "y1", "x2", "y2"] as const).map((key) => (
            <label class="text-xs text-text-muted">
              {key}
              <input
                type="number"
                step="0.01"
                min="0"
                max="1"
                class="w-14 p-1 border-border rounded-md border font-mono text-xs"
                value={draft()[key]}
                onChange={(e) =>
                  commit({ ...draft(), [key]: e.currentTarget.value })}
              />
            </label>
          ))}
        </div>
        <svg
          viewBox="0 0 100 100"
          class="h-16 w-16 rounded-md border border-border bg-surface"
        >
          <path
            d={`M 0,100 C ${Number(draft().x1) * 100},${
              (1 - Number(draft().y1)) * 100
            } ${Number(draft().x2) * 100},${
              (1 - Number(draft().y2)) * 100
            } 100,0`}
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          />
          <circle
            cx={Number(draft().x1) * 100}
            cy={(1 - Number(draft().y1)) * 100}
            r="3"
            fill="currentColor"
          />
          <circle
            cx={Number(draft().x2) * 100}
            cy={(1 - Number(draft().y2)) * 100}
            r="3"
            fill="currentColor"
          />
        </svg>
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
    /^cubic-bezier\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*\)$/,
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

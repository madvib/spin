import { createSignal } from "solid-js";

/**
 * A shadow is four lengths and a colour, and typing the string by hand is
 * how every one of them gets wrong. The editor splits the value into the
 * parts a hand actually adjusts and paints the result on a raised box, so
 * the value being edited is the thing being seen.
 */
export default function ShadowEditor(props: {
  value: string;
  onCommit: (value: string) => boolean;
}) {
  const parsed = () => parse(props.value);
  const [draft, setDraft] = createSignal(parsed());

  // Re-parse when the committed value changes externally.
  // (The component is re-created per row, so this is a one-shot init.)

  function commit(next: ShadowParts) {
    const value =
      `${next.x} ${next.y} ${next.blur} ${next.spread} ${next.color}`;
    setDraft(next);
    props.onCommit(value);
  }

  return (
    <div class="stack-sm">
      <div class="row-sm flex-wrap gap-2">
        <label class="text-xs text-text-muted">
          x
          <input
            type="text"
            class="w-12 p-1 border-border rounded-md border font-mono text-xs"
            value={draft().x}
            onChange={(e) => commit({ ...draft(), x: e.currentTarget.value })}
          />
        </label>
        <label class="text-xs text-text-muted">
          y
          <input
            type="text"
            class="w-12 p-1 border-border rounded-md border font-mono text-xs"
            value={draft().y}
            onChange={(e) => commit({ ...draft(), y: e.currentTarget.value })}
          />
        </label>
        <label class="text-xs text-text-muted">
          blur
          <input
            type="text"
            class="w-12 p-1 border-border rounded-md border font-mono text-xs"
            value={draft().blur}
            onChange={(e) =>
              commit({ ...draft(), blur: e.currentTarget.value })}
          />
        </label>
        <label class="text-xs text-text-muted">
          spread
          <input
            type="text"
            class="w-12 p-1 border-border rounded-md border font-mono text-xs"
            value={draft().spread}
            onChange={(e) =>
              commit({ ...draft(), spread: e.currentTarget.value })}
          />
        </label>
        <label class="text-xs text-text-muted">
          colour
          <input
            type="text"
            class="w-28 p-1 border-border rounded-md border font-mono text-xs"
            value={draft().color}
            onChange={(e) =>
              commit({ ...draft(), color: e.currentTarget.value })}
          />
        </label>
      </div>
      <div
        class="h-8 w-16 rounded-md bg-surface-raised"
        style={{
          "box-shadow":
            `${draft().x} ${draft().y} ${draft().blur} ${draft().spread} ${draft().color}`,
        }}
      />
    </div>
  );
}

interface ShadowParts {
  x: string;
  y: string;
  blur: string;
  spread: string;
  color: string;
}

function parse(value: string): ShadowParts {
  const match = value.trim().match(
    /^(-?\d+(?:\.\d+)?(?:px|rem|em|%)?)\s+(-?\d+(?:\.\d+)?(?:px|rem|em|%)?)\s+(\d+(?:\.\d+)?(?:px|rem|em|%)?)\s+(-?\d+(?:\.\d+)?(?:px|rem|em|%)?)\s+(.+)$/,
  );
  if (!match) {
    return {
      x: "0",
      y: "4px",
      blur: "8px",
      spread: "0",
      color: "rgba(0,0,0,0.1)",
    };
  }
  return {
    x: match[1]!,
    y: match[2]!,
    blur: match[3]!,
    spread: match[4]!,
    color: match[5]!.trim(),
  };
}

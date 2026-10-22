import { createEffect, createSignal, on } from "solid-js";

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

  // Re-parse when the value changes externally: undo, redo, a reset and a
  // reload all move the shadow, and five fields holding the old parts are
  // five fields lying about the document. `on` so typing is not undone by
  // the effect's own read.
  createEffect(on(() => props.value, (value) => setDraft(parse(value))));

  function commit(next: ShadowParts) {
    const value =
      `${next.x} ${next.y} ${next.blur} ${next.spread} ${next.color}`;
    if (!props.onCommit(value)) setDraft(parse(props.value));
  }

  return (
    <div class="row-sm flex-wrap gap-2">
      <label class="text-xs text-text-muted">
        x
        <input
          type="text"
          class="w-12"
          value={draft().x}
          onChange={(e) => commit({ ...draft(), x: e.currentTarget.value })}
        />
      </label>
      <label class="text-xs text-text-muted">
        y
        <input
          type="text"
          class="w-12"
          value={draft().y}
          onChange={(e) => commit({ ...draft(), y: e.currentTarget.value })}
        />
      </label>
      <label class="text-xs text-text-muted">
        blur
        <input
          type="text"
          class="w-12"
          value={draft().blur}
          onChange={(e) => commit({ ...draft(), blur: e.currentTarget.value })}
        />
      </label>
      <label class="text-xs text-text-muted">
        spread
        <input
          type="text"
          class="w-12"
          value={draft().spread}
          onChange={(e) =>
            commit({ ...draft(), spread: e.currentTarget.value })}
        />
      </label>
      <label class="text-xs text-text-muted">
        colour
        <input
          type="text"
          class="w-[7rem]"
          value={draft().color}
          onChange={(e) => commit({ ...draft(), color: e.currentTarget.value })}
        />
      </label>
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

import { Show } from "solid-js";
import { formatHex, parseColor } from "@spin/theme";

function asHex(value: string): string | undefined {
  try {
    return formatHex(parseColor(value));
  } catch {
    return undefined;
  }
}

/**
 * One token's value, and the only way it changes.
 *
 * The color field is a `<input type="color">` when the value parses, and a
 * text field when it does not. The text field is CONSTRAINED, not merely
 * forgiving: it only commits a value the theme's own color parser accepts.
 * A free-text field is how a non-color reaches a document, and a document
 * with `"primary": "teal-ish"` in it fails at build time with no idea which
 * edit did it.
 *
 * So the picker is the honest path, and the text field is for the cases the
 * picker cannot express — a value with no hex form, like `oklch(...)` — which
 * still has to parse.
 */
export default function ValueInput(props: {
  value: string;
  placeholder?: string;
  /** Applies the value. Returns false when the theme refused it. */
  onCommit: (value: string) => boolean;
}) {
  const hex = () => asHex(props.value);
  return (
    <Show
      when={hex()}
      fallback={
        <input
          class="text-sm p-2 border border-border rounded-md font-mono"
          type="text"
          value={props.value}
          placeholder={props.placeholder}
          // Commit on blur, not per keystroke: every keystroke is a document
          // mutation, and a partial hex is not a value.
          onBlur={(event) => {
            const next = event.currentTarget.value.trim();
            if (next === "") return;
            if (asHex(next) === undefined) {
              // Not a color. Leave the document alone rather than storing it.
              event.currentTarget.value = props.value;
              return;
            }
            if (next !== props.value) props.onCommit(next);
          }}
        />
      }
    >
      {(current) => (
        <>
          <input
            type="color"
            value={current()}
            onChange={(event) => {
              // A refused commit reports it, and the control goes back to
              // what the document says. Without this the picker shows a value
              // the theme is never going to hold, and the author believes it
              // took.
              if (props.onCommit(event.currentTarget.value) === false) {
                event.currentTarget.value = current();
              }
            }}
          />
          <code>{props.value}</code>
        </>
      )}
    </Show>
  );
}

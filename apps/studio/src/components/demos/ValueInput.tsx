import { createSignal, Match, Show, Switch } from "solid-js";
import { formatHex, parseColor } from "@spin/theme";

function asHex(value: string): string | undefined {
  try {
    return formatHex(parseColor(value));
  } catch {
    return undefined;
  }
}

/**
 * A dimension split into its number and its unit, as authored.
 *
 * The unit is THE THEME'S: `radius.full` is `9999px` in a scale that is
 * otherwise rem, and rewriting it in rem would change a value the author
 * chose. A number control therefore steps in whatever unit the token already
 * speaks, and a value with no number (or no unit) falls through to text.
 */
function toDimension(value: string): { n: number; unit: string } | undefined {
  const match = value.trim().match(/^(-?[\d.]+)(rem|em|px|%)?$/);
  if (match === null) return undefined;
  return { n: Number(match[1]), unit: match[2] ?? "" };
}

/** What the editor's control is, chosen by the theme's declared token type. */
type Control = "color" | "dimension" | "text";

function controlFor(type: string): Control {
  if (type === "color") return "color";
  if (type === "dimension") return "dimension";
  return "text";
}

/**
 * One token's value, and the only way it changes.
 *
 * The CONTROL follows the theme's declared type, which is the point: a color
 * token gets a picker, a dimension gets a step control, anything else is
 * text. One field that pretends to accept anything validates nothing — a
 * validator applied afterwards can only reject, never prevent.
 *
 * Each branch therefore constrains what it can produce. The text branch is
 * the fallback for types with no structured control (a shadow is a list of
 * lengths and colors; there is nothing to pick), and it is permissive because
 * there is no shorter honest check.
 */
export default function ValueInput(props: {
  value: string;
  type: string;
  onCommit: (value: string) => boolean;
}) {
  return (
    <Switch fallback={<TextControl {...props} />}>
      <Match when={controlFor(props.type) === "color"}>
        <ColorControl {...props} />
      </Match>
      <Match when={controlFor(props.type) === "dimension"}>
        <DimensionControl {...props} />
      </Match>
    </Switch>
  );
}

/** A color: the picker is the path, the text is for values it cannot express. */
function ColorControl(props: {
  value: string;
  onCommit: (value: string) => boolean;
}) {
  const hex = () => asHex(props.value);
  const [draft, setDraft] = createSignal(props.value);
  return (
    <Show
      // The hex itself, not a boolean: `<Show>` hands its children the `when`
      // value, and a `!== undefined` test would hand them `true` — which
      // `String()`-ed into a colour input and rendered black.
      when={hex()}
      fallback={
        <input
          type="text"
          class="p-2 border-border rounded-md border text-sm"
          value={draft()}
          placeholder="oklch(…) or #hex"
          onChange={(event) => {
            const next = event.currentTarget.value;
            setDraft(next);
            // A text color is legitimate — oklch has no hex form — but it
            // still has to parse. Anything else is not committed.
            if (asHex(next) !== undefined) props.onCommit(next);
          }}
        />
      }
    >
      {(current) => (
        <>
          <input
            type="color"
            value={String(current())}
            onChange={(event) => {
              // A refused commit reports it, and the control goes back to
              // what the document says.
              if (props.onCommit(event.currentTarget.value) === false) {
                event.currentTarget.value = String(current());
              }
            }}
          />
          <code>{props.value}</code>
        </>
      )}
    </Show>
  );
}

/** The step control itself, once the value is known to be a dimension. */
function DimensionInput(props: {
  dimension: { n: number; unit: string };
  onCommit: (value: string) => boolean;
}) {
  const unit = () => props.dimension.unit;
  return (
    <input
      type="number"
      // The scale's own quantum, in the scale's own unit.
      step={unit() === "px" ? 1 : 0.0625}
      min={0}
      class="p-2 border-border rounded-md border w-24 text-sm"
      value={props.dimension.n}
      onChange={(event) => {
        const next = Number(event.currentTarget.value);
        if (!Number.isFinite(next)) return;
        const at = unit();
        const rounded = at === "px"
          ? Math.round(next)
          : Math.round(next * 16) / 16;
        props.onCommit(`${rounded}${at}`);
      }}
    />
  );
}

/** A dimension: a step control, stepping in the theme's own unit. */
function DimensionControl(props: {
  value: string;
  onCommit: (value: string) => boolean;
}) {
  const dimension = () => toDimension(props.value);
  return (
    <Show
      when={dimension()}
      fallback={<TextControl value={props.value} onCommit={props.onCommit} />}
    >
      {(current) => (
        <DimensionInput
          dimension={current()}
          onCommit={(value) => props.onCommit(value)}
        />
      )}
    </Show>
  );
}

/** Free text, for types with nothing structured to control. */
function TextControl(props: {
  value: string;
  onCommit: (value: string) => boolean;
}) {
  const [draft, setDraft] = createSignal(props.value);
  return (
    <input
      type="text"
      class="p-2 border-border rounded-md border text-sm"
      value={draft()}
      onChange={(event) => {
        const next = event.currentTarget.value;
        setDraft(next);
        props.onCommit(next);
      }}
    />
  );
}

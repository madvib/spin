import { createSignal, Match, Show, Switch } from "solid-js";
import { formatHex, parseColor } from "@spin/theme";
import { measure, quantize, sliderRange } from "../../lib/scale.ts";
import { paintPreview } from "../../lib/preview.ts";

function asHex(value: string): string | undefined {
  try {
    return formatHex(parseColor(value));
  } catch {
    return undefined;
  }
}

/** What the editor's control is, chosen by the value the theme holds. */
type Control = "color" | "range" | "text";

/**
 * The control follows what the value IS.
 *
 * A colour picks; a number — a length, a duration, a plain number — is a
 * track, because a spinner makes an author click forty times to watch a
 * corner round, and dragging is how you look at a value while you change
 * it. Everything a slider cannot honestly step (a shadow is a list of
 * lengths and colours; a curve is four points) is text, where the value
 * can say all of itself.
 */
function controlFor(type: string, value: string): Control {
  if (type === "color") return "color";
  if (measure(value) !== undefined) return "range";
  return "text";
}

/**
 * One token's value, and the only way it changes.
 *
 * Each branch constrains what it can produce. The text branch is the
 * fallback for values with no structured control, and it is permissive
 * because there is no shorter honest check.
 */
export default function ValueInput(props: {
  value: string;
  type: string;
  onCommit: (value: string) => boolean;
  /** The control's id, so the token's path is its label. */
  id?: string;
  /** The token's path, named to the control when no label claims it. */
  label?: string;
  /**
   * Every value in the token's own group. The slider's ceiling is read
   * from it — twice the top of the ramp — so all of a scale's steps share
   * one track and line up as the scale they belong to.
   */
  group?: readonly string[];
  /** The token's custom property, painted on the preview surface while dragging. */
  variable?: string;
  /**
   * Reports a value the control PROPOSES while dragged, in place of
   * painting the token's own property: a linked group paints the whole
   * family, and two painters on one variable cannot both take it off.
   */
  onPreview?: (value: string) => void;
  /** Reports a drag abandoned before it committed. */
  onCancel?: () => void;
}) {
  return (
    <Switch fallback={<TextControl {...props} />}>
      <Match when={controlFor(props.type, props.value) === "color"}>
        <ColorControl {...props} />
      </Match>
      <Match when={controlFor(props.type, props.value) === "range"}>
        <RangeControl {...props} />
      </Match>
    </Switch>
  );
}

/** A color: the picker is the path, the text is for values it cannot express. */
function ColorControl(props: {
  value: string;
  onCommit: (value: string) => boolean;
  id?: string;
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
            id={props.id}
            type="color"
            // A sized swatch, not a stretched field: inside a flex row the
            // picker would otherwise claim the space the hex readout needs.
            class="h-8 w-12 shrink-0 rounded-sm"
            value={String(current())}
            onChange={(event) => {
              // A refused commit reports it, and the control goes back to
              // what the document says.
              if (props.onCommit(event.currentTarget.value) === false) {
                event.currentTarget.value = String(current());
              }
            }}
          />
          <code class="text-sm">{props.value}</code>
        </>
      )}
    </Show>
  );
}

/**
 * A number the theme authored, as a track.
 *
 * The bounds are the group's — twice the top of the ramp — so every step
 * of a scale shares one ceiling and the sliders read as the ramp they
 * belong to; a value the outlier rule dropped (a `9999px` pill among
 * corners) takes headroom of its own. While the pointer is down the token's
 * own custom property is painted on the preview surface, so the specimen
 * moves under the finger; on release one commit lands, one snapshot of
 * undo, and the paint comes off.
 */
function RangeControl(props: {
  value: string;
  onCommit: (value: string) => boolean;
  id?: string;
  label?: string;
  group?: readonly string[];
  variable?: string;
  onPreview?: (value: string) => void;
  onCancel?: () => void;
}) {
  const current = () => measure(props.value);
  const range = () => sliderRange(props.value, props.group ?? [props.value]);
  // What the track proposes while it is being dragged; the document's own
  // value once the gesture is over.
  const [draft, setDraft] = createSignal<string | undefined>(undefined);
  let clear: (() => void) | undefined;
  const release = () => {
    clear?.();
    clear = undefined;
  };

  return (
    <Show
      when={current()}
      fallback={
        <TextControl
          value={props.value}
          onCommit={props.onCommit}
          id={props.id}
        />
      }
    >
      <div class="row-sm flex-wrap gap-2">
        <input
          id={props.id}
          type="range"
          aria-label={props.label}
          min={range().min}
          max={range().max}
          step={range().step}
          value={current()?.n ?? range().min}
          class="min-w-24 flex-1"
          onInput={(event) => {
            const next = quantize(
              props.value,
              Number(event.currentTarget.value),
            );
            setDraft(next);
            // A family preview paints the whole group and owns its paint;
            // a lone token paints only its own property.
            if (props.onPreview !== undefined) {
              props.onPreview(next);
            } else if (props.variable !== undefined) {
              release();
              clear = paintPreview({ [props.variable]: next });
            }
          }}
          onChange={(event) => {
            const next = quantize(
              props.value,
              Number(event.currentTarget.value),
            );
            release();
            const accepted = props.onCommit(next);
            setDraft(undefined);
            // A refused commit puts the thumb back on the document's value,
            // which is the only word the readout will show.
            if (!accepted) {
              event.currentTarget.value = String(current()?.n ?? "");
            }
          }}
          onPointerCancel={() => {
            release();
            props.onCancel?.();
            setDraft(undefined);
          }}
        />
        <code class="text-sm">{draft() ?? props.value}</code>
      </div>
    </Show>
  );
}

/** Free text, for values with nothing structured to control. */
function TextControl(props: {
  value: string;
  onCommit: (value: string) => boolean;
  id?: string;
}) {
  const [draft, setDraft] = createSignal(props.value);
  return (
    <input
      id={props.id}
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

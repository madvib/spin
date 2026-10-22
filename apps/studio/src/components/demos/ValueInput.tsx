import {
  createEffect,
  createMemo,
  createSignal,
  For,
  Match,
  on,
  Show,
  Switch,
} from "solid-js";
import { formatHex, indexTree, parseColor } from "@spin/theme";
import { measure, quantize, sliderRange } from "../../lib/scale.ts";
import { analyzeTheme } from "../../lib/theme.ts";
import {
  activeMode,
  activeName,
  registry,
  themeText,
} from "../../lib/store.ts";
import { paintPreview } from "../../lib/preview.ts";
import {
  declaredValue,
  rangeProgress,
  tokenPath,
} from "../../lib/live-edit.ts";
import { compositeLadders, isCompositeType } from "../../lib/tokens.ts";
import ShadowEditor from "./ShadowEditor.tsx";
import BezierEditor from "./BezierEditor.tsx";
import CompositeEditor from "./CompositeEditor.tsx";

function isBezierValue(value: string): boolean {
  return /^cubic-bezier\s*\(/.test(value.trim());
}

function isShadowValue(value: string): boolean {
  return /^\s*-?\d+(?:\.\d+)?(?:px|rem|em|%)?\s+-?\d+(?:\.\d+)?(?:px|rem|em|%)?\s+\d+(?:\.\d+)?(?:px|rem|em|%)?\s+-?\d+(?:\.\d+)?(?:px|rem|em|%)?\s+.+$/
    .test(
      value.trim(),
    );
}

function asHex(value: string): string | undefined {
  try {
    return formatHex(parseColor(value));
  } catch {
    return undefined;
  }
}

/** What the editor's control is, chosen by the value the theme holds. */
type Control = "color" | "range" | "boolean" | "text";

/**
 * The control follows what the value IS.
 *
 * A colour picks; a boolean is one box with two answers; a number — a
 * length, a duration, a plain number — is a track, because a spinner makes
 * an author click forty times to watch a corner round, and dragging is how
 * you look at a value while you change it. Everything a slider cannot
 * honestly step (a shadow is a list of lengths and colours; a curve is four
 * points) is text, where the value can say all of itself.
 */
function controlFor(type: string, value: string): Control {
  if (type === "boolean") return "boolean";
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
 *
 * Beside the control there is a RESET: the token back to the value the
 * theme declares. It is there for every control, because every control
 * here edits a token, and a gesture that went the wrong way should not
 * need the document to be retyped.
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
  // The theme's own ladders, for a composite whose parts are steps the
  // theme declared elsewhere. Read from the document being edited, in the
  // mode being edited, so the steps offered are the ones in force.
  const ladders = createMemo(() => {
    const tree = analyzeTheme(themeText()).tree;
    return tree === undefined
      ? undefined
      : compositeLadders(tree, activeMode());
  });
  /**
   * The control's id: the caller's, or one derived from the token's path.
   *
   * The id is what `keepFocus` puts back after a commit rebuilds the row.
   * A control that has none is a control the author has to find again, so
   * the path — which every row carries and which is exactly what identifies
   * the token across a render — is the fallback.
   */
  const controlId = () =>
    props.id ??
      (props.label === undefined ? undefined : `token-${props.label}`);
  return (
    <div class="row-sm gap-2">
      <Switch fallback={<TextControl {...props} id={controlId()} />}>
        <Match when={isCompositeType(props.type) && ladders() !== undefined}>
          <CompositeEditor
            type={props.type}
            value={props.value}
            ladders={ladders()!}
            onCommit={props.onCommit}
            id={controlId()}
            label={props.label}
          />
        </Match>
        <Match when={isBezierValue(props.value)}>
          <BezierEditor value={props.value} onCommit={props.onCommit} />
        </Match>
        <Match when={isShadowValue(props.value)}>
          <ShadowEditor value={props.value} onCommit={props.onCommit} />
        </Match>
        <Match when={controlFor(props.type, props.value) === "boolean"}>
          <CheckControl {...props} id={controlId()} />
        </Match>
        <Match when={controlFor(props.type, props.value) === "color"}>
          <ColorControl {...props} id={controlId()} />
        </Match>
        <Match when={controlFor(props.type, props.value) === "range"}>
          <RangeControl {...props} id={controlId()} />
        </Match>
      </Switch>
      <ResetButton
        id={props.id}
        label={props.label}
        value={props.value}
        onCommit={props.onCommit}
      />
    </div>
  );
}

/**
 * The reset: the token back to the value the theme declares.
 *
 * The value the theme declares is the PROJECT's document — the file the
 * project holds, or the starter it has not forked — and never the studio's
 * own theme: the studio wears its own theme, and a reset that put a token
 * back to the studio's value would move the project towards the tool.
 *
 * Inert when the value already IS the theme's value: a reset that would
 * change nothing is a button that says nothing, and a button that can be
 * pressed to do nothing is a button that lies.
 */
function ResetButton(props: {
  id?: string;
  label?: string;
  value: string;
  onCommit: (value: string) => boolean;
}) {
  const path = () => tokenPath(props.id, props.label);
  /** The project's own document for the theme being edited. */
  const projectText = () =>
    registry()?.find((theme) => theme.name === activeName())?.text;
  /** What the theme declares for this token, in the mode being edited. */
  const declared = () => {
    const token = path();
    if (token === undefined) return undefined;
    const text = projectText();
    if (text === undefined) return undefined;
    return declaredValue(text, token, activeMode());
  };
  const inert = () => {
    const value = declared();
    return value === undefined || value === props.value;
  };
  const title = () =>
    `Reset ${path() ?? "this token"} to the value the theme declares`;
  return (
    <button
      type="button"
      class="secondary s-sm shrink-0 text-text-muted hover:border-primary hover:text-text disabled:opacity-50"
      title={title()}
      aria-label={title()}
      disabled={inert()}
      onClick={() => {
        const value = declared();
        if (value === undefined) return;
        props.onCommit(value);
      }}
    >
      <span class="i-lucide-undo-2" aria-hidden="true" />
    </button>
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
  // The document is the source of truth: undo, redo, a reset, a reload or a
  // picker elsewhere moves the value, and a field holding the old spelling is
  // a field lying about the document. `on` so the effect answers the value
  // rather than the draft the author is typing.
  createEffect(on(() => props.value, (value) => setDraft(value)));
  return (
    <Show
      // The hex itself, not a boolean: `<Show>` hands its children the `when`
      // value, and a `!== undefined` test would hand them `true` — which
      // `String()`-ed into a colour input and rendered black.
      when={hex()}
      fallback={
        <input
          type="text"
          class="w-full"
          value={draft()}
          placeholder="oklch(…) or #hex"
          onChange={(event) => {
            const next = event.currentTarget.value;
            setDraft(next);
            // A text color is legitimate — oklch has no hex form — but it
            // still has to parse. Anything else is not committed, and the
            // field goes back to the document's value: a field that keeps a
            // word the document refused is a field saying something false.
            if (asHex(next) === undefined) {
              setDraft(props.value);
              return;
            }
            if (!props.onCommit(next)) setDraft(props.value);
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
            class="h-8 w-12 shrink-0"
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

/** A boolean: one box, two answers, and the word beside it. */
function CheckControl(props: {
  value: string;
  onCommit: (value: string) => boolean;
  id?: string;
  label?: string;
}) {
  const checked = () => props.value === "true";
  return (
    <div class="row-sm flex-wrap gap-2">
      <input
        id={props.id}
        type="checkbox"
        aria-label={props.label}
        checked={checked()}
        class="h-6 w-6 shrink-0"
        onChange={(event) => {
          // A refused commit reports it, and the box goes back to what the
          // document says — the same honesty the colour and track keep.
          if (
            props.onCommit(event.currentTarget.checked ? "true" : "false") ===
              false
          ) {
            event.currentTarget.checked = checked();
          }
        }}
      />
      <code>{props.value}</code>
    </div>
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
 *
 * **The track's value follows the drag.** The control shows the value the
 * gesture proposes, not the value the document held when the gesture
 * started: a slider that springs back to the document's value under the
 * pointer is a slider the author cannot aim with. The document's value is
 * what the control falls back to once the gesture is over.
 *
 * **The readout does not move.** Its width is fixed, because the row it
 * sits in is packed to one side: a readout that grows as the value grows
 * pushes the track sideways, and a track that moves under the pointer
 * turns the drag into a jitter — the value the author is aiming at is the
 * value under a pointer that has moved, so the two disagree and the value
 * walks backwards while the finger walks forwards.
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

  // The value the control shows: the gesture's own while it is in flight,
  // the document's once it is over.
  const shown = () => draft() ?? props.value;
  const shownNumber = () => measure(shown())?.n;
  // How far along the value is, as the share of the travel the fill paints.
  const progress = () =>
    rangeProgress(shownNumber() ?? range().min, range().min, range().max);

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
          value={shownNumber() ?? range().min}
          // The fill the groove paints stops where the thumb is: the sheet
          // cannot read the value, so the control hands it the share.
          style={{ "--range-progress": progress() }}
          class="min-w-16 max-w-32 flex-1"
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
        <code
          class="w-[6rem] shrink-0 truncate text-right tabular-nums"
          title={shown()}
        >
          {shown()}
        </code>
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
  const multiline = () =>
    props.value.includes("(") ||
    props.value.includes(",") ||
    props.value.length > 24;
  const [draft, setDraft] = createSignal(props.value);
  // The document is the source of truth. A field that kept the word it had
  // when it mounted is a field that disagrees with the document the moment
  // the author presses undo, redo or reset — and the word it shows is the
  // one they will next act on. `on` so typing is not undone by the effect's
  // own read.
  createEffect(on(() => props.value, (value) => setDraft(value)));
  const paths = () => {
    const current = analyzeTheme(themeText()).tree;
    if (current === undefined) return [];
    return Object.keys(indexTree(current).leaves);
  };
  const isShadow = (v: string) => v.includes("px") && v.split(" ").length >= 3;
  return (
    <Show
      when={multiline()}
      fallback={
        <>
          <input
            id={props.id}
            type="text"
            list="spin-token-paths"
            class="w-[10rem]"
            value={draft()}
            onChange={(event) => {
              const next = event.currentTarget.value;
              setDraft(next);
              // A refused value stays in the document's word, so the field
              // says what is true rather than what was typed at it.
              if (!props.onCommit(next)) setDraft(props.value);
            }}
          />
          <datalist id="spin-token-paths">
            <For each={paths()}>{(p) => <option value={`{${p}}`} />}</For>
          </datalist>
        </>
      }
    >
      <div class="stack-sm">
        <textarea
          id={props.id}
          spellcheck={false}
          rows={2}
          class="w-[12rem] min-h-10 resize-y"
          value={draft()}
          onChange={(event) => {
            const next = event.currentTarget.value;
            setDraft(next);
            if (!props.onCommit(next)) setDraft(props.value);
          }}
        />
        <Show when={isShadow(draft())}>
          <div
            class="h-8 w-16 rounded-md bg-surface-raised"
            style={{ "box-shadow": draft() }}
          />
        </Show>
        <datalist id="spin-token-paths">
          <For each={paths()}>{(p) => <option value={`{${p}}`} />}</For>
        </datalist>
      </div>
    </Show>
  );
}

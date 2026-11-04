import {
  createEffect,
  createMemo,
  createSignal,
  For,
  Match,
  on,
  onCleanup,
  Show,
  Switch,
} from "solid-js";
import { createSpinComponent } from "@spinjs/components/solid";
import { combobox } from "@spinjs/components/combobox";
import { colorPicker } from "@spinjs/components/color-picker";

import { formatHex, indexTree, parseColor } from "@spinjs/spin/theme";
import { measure, quantize, sliderRange } from "../../lib/scale.ts";
import {
  activeLadders,
  activeMode,
  activeName,
  activeTree,
  registry,
  themeText,
} from "../../lib/store.ts";
import { paintPreview } from "../../lib/preview.ts";
import {
  declaredValue,
  rangeProgress,
  tokenPath,
} from "../../lib/live-edit.ts";
import { removeToken } from "../../lib/editing.ts";
import { isCompositeType } from "../../lib/tokens.ts";
import ShadowEditor from "./ShadowEditor.tsx";
import BezierEditor from "./BezierEditor.tsx";
import CompositeEditor from "./CompositeEditor.tsx";

function isBezierValue(value: string): boolean {
  return /^cubic-bezier\s*\(/.test(value.trim());
}

function isShadowValue(value: string): boolean {
  return /^\s*(-?\d+(?:\.\d+)?(?:px|rem|em|%)?)\s+(-?\d+(?:\.\d+)?(?:px|rem|em|%)?)\s+(\d+(?:\.\d+)?(?:px|rem|em|%)?)(?:\s+(-?\d+(?:\.\d+)?(?:px|rem|em|%)?))?\s+((?:#|rgb|hsl|oklch|var\(|color\(|[a-zA-Z]).*)$/
    .test(
      value.trim(),
    );
}

function cleanNum(n: number): number {
  return Number(n.toFixed(4));
}

function controlRange(
  value: string,
  group: readonly string[],
  label?: string,
  type?: string,
): { min: number; max: number; step: number } {
  const base = sliderRange(value, group);
  const own = measure(value);
  if (own === undefined) return base;
  if (
    type === "fontWeight" ||
    label?.startsWith("font.weight") ||
    label?.endsWith(".weight") ||
    label?.endsWith("-weight") ||
    (own.unit === "" &&
      own.n >= 100 &&
      own.n <= 900 &&
      own.n % 100 === 0 &&
      group.length > 1 &&
      group.every((g) => {
        const m = measure(g);
        return m !== undefined && m.unit === "" && m.n >= 100 && m.n <= 900;
      }))
  ) {
    return { min: 100, max: 900, step: 100 };
  }
  if (
    label?.startsWith("opacity.") ||
    (own.unit === "" &&
      own.n >= 0 &&
      own.n <= 1 &&
      group.length > 0 &&
      group.every((g) => {
        const m = measure(g);
        return m !== undefined && m.unit === "" && m.n >= 0 && m.n <= 1;
      }))
  ) {
    return { min: 0, max: 1, step: 0.05 };
  }
  if (label?.startsWith("z-index.")) {
    const step =
      own.n >= 100 && own.n % 100 === 0
        ? 100
        : own.n >= 10 && own.n % 10 === 0
          ? 10
          : 1;
    return { min: base.min, max: Math.max(base.max, 1000), step };
  }
  if (label?.startsWith("breakpoint.") && own.unit === "px") {
    const step = own.n % 32 === 0 ? 32 : 16;
    return { min: 320, max: Math.max(base.max, 1920), step };
  }
  if (
    (label?.startsWith("border.") || label?.startsWith("focus.")) &&
    own.unit === "px"
  ) {
    const step = Number.isInteger(own.n) ? 1 : 0.5;
    return { min: 0, max: Math.max(base.max, 16), step };
  }
  if (own.unit === "rem") {
    const step = Math.abs(own.n) >= 0.5 ? 0.125 : 0.0625;
    const min = own.n > 0 ? Math.max(base.min, 0.0625) : base.min;
    return {
      min,
      max: Math.max(base.max, step * 4),
      step,
    };
  }
  if (own.unit === "em") {
    return {
      min: Math.min(base.min, -0.05),
      max: Math.max(base.max, 0.1),
      step: 0.005,
    };
  }
  if (own.unit === "ms") {
    const step =
      own.n >= 500 && own.n % 50 === 0
        ? 50
        : own.n % 10 === 0
          ? 10
          : 1;
    const min = own.n > 0 ? Math.max(base.min, step) : base.min;
    return { min, max: base.max, step };
  }
  if (own.unit === "s") {
    const step = 0.05;
    const min = own.n > 0 ? Math.max(base.min, step) : base.min;
    return { min, max: Math.max(base.max, 2), step };
  }
  if (own.unit === "px") {
    const step = Number.isInteger(own.n) ? 1 : 0.5;
    const min = own.n > 0 ? Math.max(base.min, step) : base.min;
    return { min, max: base.max, step };
  }
  return base;
}

function formatStepped(value: string, n: number, step: number, min = 0): string {
  const own = measure(value);
  if (own === undefined || !Number.isFinite(n)) return value;
  const q = step > 0 ? step : 1;
  // Min-relative, like the native track: the grid is min + k·step, so a
  // value the track already holds formats back to itself.
  const snapped = cleanNum(min + Math.round((n - min) / q) * q);
  return `${snapped}${own.unit}`;
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
  /** Reports a value the control PROPOSES while dragged, in place of
   * painting the token's own property: a linked group paints the whole
   * family, and two painters on one variable cannot both take it off.
   */
  onPreview?: (value: string) => void;
  /** Reports a drag abandoned before it committed. */
  onCancel?: () => void;
  /** Live proposed value when a linked sibling in the group is being dragged. */
  proposed?: string;
}) {
  // The theme's own ladders, narrowed once at the store boundary so the
  // steps offered are the ones in force.
  const ladders = createMemo(() => activeLadders());
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
    <div data-studio-chrome="" class="row-sm flex-wrap gap-2">
      <Switch fallback={<TextControl {...props} id={controlId()} />}>
        <Match when={isCompositeType(props.type)}>
          <CompositeEditor
            type={props.type}
            value={props.value}
            ladders={ladders()}
            onCommit={props.onCommit}
            id={controlId()}
            label={props.label}
          />
        </Match>
        <Match when={isBezierValue(props.value)}>
          <BezierEditor value={props.value} onCommit={props.onCommit} />
        </Match>
        <Match
          when={
            props.type === "textTransform" ||
            props.label?.endsWith(".case")
          }
        >
          <TextTransformControl
            value={props.value}
            onCommit={props.onCommit}
            id={controlId()}
            label={props.label}
          />
        </Match>
        <Match when={props.type === "shadow" || isShadowValue(props.value)}>
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
  /** What the working document currently holds for this token. */
  const currentDeclared = () => {
    const token = path();
    if (token === undefined) return undefined;
    return declaredValue(themeText(), token, activeMode());
  };
  /** True when the token was created in this session and did not exist on disk. */
  const createdInSession = () =>
    declared() === undefined && currentDeclared() !== undefined;
  const inert = () => {
    if (createdInSession()) return false;
    const value = declared();
    return value === undefined || value === props.value;
  };
  const title = () =>
    `Reset ${path() ?? "this token"} to the value the theme declares`;
  return (
    <button
      type="button"
      class="secondary s-sm shrink-0 shadow-none"
      title={title()}
      aria-label={title()}
      disabled={inert()}
      onClick={() => {
        if (createdInSession()) {
          const token = path();
          if (token !== undefined) removeToken(token.split("."));
          return;
        }
        const value = declared();
        if (value === undefined) return;
        props.onCommit(value);
      }}
    >
      <span class="i-lucide-undo-2" aria-hidden="true" />
    </button>
  );
}
/** The spin picker as a swatch: a press opens the panel, a committed move writes the token. */
function ColorSwatch(props: {
  value: string;
  onCommit: (value: string) => boolean;
  id?: string;
}) {
  const [element, setElement] = createSignal<HTMLElement>();
  const ctl = createSpinComponent(element, colorPicker);
  createEffect(() =>
    ctl.bind(
      { value: props.value, format: "hex" },
      {
        "value-change-end": (event: CustomEvent<{ value: string }>) => {
          props.onCommit(event.detail.value);
        },
      },
    )
  );
  return (
    <studio-color-picker
      ref={(el: HTMLElement) => setElement(el)}
      id={props.id}
      prop:value={props.value}
      prop:format="hex"
    />
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
          <ColorSwatch
            id={props.id}
            value={String(current())}
            onCommit={props.onCommit}
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
const TEXT_TRANSFORM_OPTIONS = [
  "none",
  "uppercase",
  "lowercase",
  "capitalize",
] as const;

function TextTransformControl(props: {
  value: string;
  onCommit: (value: string) => boolean;
  id?: string;
  label?: string;
}) {
  return (
    <div
      id={props.id}
      role="group"
      aria-label={props.label ?? "Text transform"}
      class="row-sm items-center rounded-md border border-border bg-surface p-1"
    >
      <For each={TEXT_TRANSFORM_OPTIONS}>
        {(option) => {
          const active = () => props.value.trim() === option;
          return (
            <button
              type="button"
              aria-pressed={active()}
              class={`min-h-0 cursor-pointer rounded-sm border px-2 py-1 font-mono text-xs font-regular normal-case tracking-normal shadow-none ${
                active()
                  ? "border-transparent bg-primary text-on-primary"
                  : "bare border-transparent text-text-muted"
              }`}
              onClick={() => {
                if (!active()) props.onCommit(option);
              }}
            >
              {option}
            </button>
          );
        }}
      </For>
    </div>
  );
}

function RangeControl(props: {
  value: string;
  type?: string;
  onCommit: (value: string) => boolean;
  id?: string;
  label?: string;
  group?: readonly string[];
  variable?: string;
  onPreview?: (value: string) => void;
  onCancel?: () => void;
  proposed?: string;
}) {
  const current = () => measure(props.value);
  const range = () =>
    controlRange(
      props.value,
      props.group ?? [props.value],
      props.label,
      props.type,
    );
  // value once the gesture is over.
  const [draft, setDraft] = createSignal<string | undefined>(undefined);
  let textInput: HTMLInputElement | undefined;
  let clear: (() => void) | undefined;
  const release = () => {
    clear?.();
    clear = undefined;
  };

  // The value the control shows: the gesture's own draft while it is in
  // flight — read before any proposal, because the proposal for the
  // dragged row echoes back through lockstep and would rewrite the thumb
  // mid-gesture — then a linked sibling's proposal, then the document's.
  const shown = () => draft() ?? props.proposed ?? props.value;
  const shownNumber = () => measure(shown())?.n;
  // How far along the value is, as the share of the travel the fill paints.
  const progress = () =>
    rangeProgress(shownNumber() ?? range().min, range().min, range().max);
  const isStepperOnly = () =>
    /^(font|icon|breakpoint|border|focus|opacity|z-index)\./.test(
      props.label ?? "",
    ) ||
    props.label === "radius.none" ||
    props.label === "radius.full";

  const stepBy = (dir: -1 | 1) => {
    const m = measure(shown());
    if (m === undefined) return;
    const r = range();
    const target = cleanNum(
      Math.min(r.max, Math.max(r.min, m.n + dir * r.step)),
    );
    const next = formatStepped(props.value, target, r.step, r.min);
    if (next === props.value) return;
    props.onCommit(next);
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
      <div class="row-sm items-center gap-2">
        <Show when={!isStepperOnly()}>
          <input
            id={props.id}
            type="range"
            aria-label={props.label}
            min={range().min}
            max={range().max}
            step={range().step}
            value={shownNumber() ?? range().min}
            style={{ "--range-progress": progress() }}
            class="min-w-20 max-w-36 flex-1"
            onInput={(event) => {
              const next = formatStepped(
                props.value,
                Number(event.currentTarget.value),
                range().step,
                range().min,
              );
              setDraft(next);
              if (props.onPreview !== undefined) {
                props.onPreview(next);
              } else if (props.variable !== undefined) {
                release();
                clear = paintPreview({ [props.variable]: next });
              }
            }}
            onChange={(event) => {
              const next = formatStepped(
                props.value,
                Number(event.currentTarget.value),
                range().step,
                range().min,
              );
              release();
              const accepted = props.onCommit(next);
              setDraft(undefined);
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
        </Show>
        <div class="row-sm shrink-0 items-center">
          <button
            id={props.id === undefined ? undefined : `${props.id}-dec`}
            type="button"
            class="secondary s-sm px-2 font-mono text-xs shadow-none"
            aria-label={`Decrease ${props.label ?? "value"}`}
            disabled={(shownNumber() ?? range().min) <= range().min}
            onClick={() => stepBy(-1)}
          >
            −
          </button>
          <input
            ref={textInput}
            id={isStepperOnly()
              ? props.id
              : props.id === undefined
              ? undefined
              : `${props.id}-text`}
            type="text"
            aria-label={props.label === undefined
              ? "Token value"
              : `${props.label} value`}
            class="w-24 shrink-0 px-2 font-mono text-xs text-center tabular-nums"
            value={shown()}
            onChange={(event) => {
              const raw = event.currentTarget.value.trim();
              const unit = current()?.unit ?? "";
              const next = /^-?\d+(?:\.\d+)?$/.test(raw) && unit !== ""
                ? `${raw}${unit}`
                : raw;
              if (!props.onCommit(next) && textInput !== undefined) {
                textInput.value = props.value;
              }
            }}
          />
          <button
            id={props.id === undefined ? undefined : `${props.id}-inc`}
            type="button"
            class="secondary s-sm px-2 font-mono text-xs shadow-none"
            aria-label={`Increase ${props.label ?? "value"}`}
            disabled={(shownNumber() ?? range().max) >= range().max}
            onClick={() => stepBy(1)}
          >
            +
          </button>
        </div>
        <code hidden title={shown()}>
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
  const paths = () => Object.keys(indexTree(activeTree()).leaves);
  const isShadow = (v: string) => v.includes("px") && v.split(" ").length >= 3;
  return (
    <Show
      when={multiline()}
      fallback={
        <ReferenceField
          value={draft()}
          paths={paths()}
          onCommit={(next) => {
            setDraft(next);
            if (!props.onCommit(next)) {
              setDraft(props.value);
              return false;
            }
            return true;
          }}
        />
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
      </div>
    </Show>
  );
}

/**
 * A single-line token value: a searchable reference that still takes
 * literals.
 *
 * The combobox owns the filtered list of `{token.path}` references; a pick
 * commits the reference. A literal the list does not offer — a hex, a
 * length — commits on Enter or blur through the input the machine owns,
 * the same honesty the bare field kept.
 */
function ReferenceField(props: {
  value: string;
  paths: readonly string[];
  onCommit: (value: string) => boolean;
}) {
  const [element, setElement] = createSignal<HTMLElement>();
  const box = createSpinComponent(element, combobox);
  const items = () =>
    props.paths.map((path) => ({ value: `{${path}}`, label: `{${path}}` }));
  const commitLiteral = (input: HTMLInputElement | null): void => {
    if (input === null) return;
    props.onCommit(input.value);
  };
  createEffect(() =>
    box.bind(
      {
        items: items(),
        allowCustomValue: true,
        value: props.value,
        inputValue: props.value,
      },
      {
        "value-change": (event: CustomEvent<{ value: readonly string[] }>) => {
          const next = event.detail.value[0];
          if (next !== undefined) props.onCommit(next);
        },
      },
    )
  );
  // The document is the truth while typing is the author's: an undo, redo
  // or reset lands in the field without swallowing the word being typed,
  // because only the committed value moves this.
  createEffect(() => {
    box.commands.setInputValue(props.value);
  });
  // The machine owns the input: Enter on a literal and blur commit what
  // the field holds, which is how the bare field behaved.
  createEffect(() => {
    const host = element() ?? null;
    const input = host?.querySelector("input") ?? null;
    if (input === null || input.dataset["literal"] === "wired") return;
    input.dataset["literal"] = "wired";
    input.addEventListener("keydown", (event) => {
      if ((event as KeyboardEvent).key === "Enter") commitLiteral(input);
    });
    input.addEventListener("focusout", () => commitLiteral(input));
  });
  return <studio-token-combobox ref={(el: HTMLElement) => setElement(el)} prop:items={items()} prop:inputValue={props.value} prop:allowCustomValue={true} />;
}

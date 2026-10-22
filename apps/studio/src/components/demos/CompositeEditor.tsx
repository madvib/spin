/**
 * The composite editors: a control for a value that is more than one thing.
 *
 * A colour is one thing and a dimension is one thing, so a text field can
 * serve them and the studio's fields do. A typography is a family, a size, a
 * weight and a tracking; a border is a width, a style and a colour; a
 * transition is a duration and an easing; a gradient is a direction and a
 * list of stops. One string carries all of them, so one string cannot be
 * edited part by part — and a text box that takes the whole string is how a
 * border ends up with a colour that is not one.
 *
 * So each composite type has an editor of its own, and the TYPE decides
 * which one opens. This file is the dispatcher and the parts the editors
 * share:
 *
 * - a **step**: a control that opens a panel of the theme's own ladder, so
 *   a size offers the theme's sizes and a width the theme's widths — the
 *   steps the theme already declared, never a free number;
 * - a **colour**: a swatch that opens a panel of the theme's palette, with
 *   a field beside it for a colour the theme does not name;
 * - a **field**: a control that takes the value, for the parts the theme
 *   has no ladder for.
 *
 * Nothing here is a native `<select>`: the studio does not wear the
 * browser's idea of a control.
 *
 * The value is written back the way the theme spells it, and only the part
 * that changed moves: the editor reads the value into its parts, changes
 * one, and writes the whole thing again — so the parts that were not
 * touched are the parts that were there.
 */

import {
  createEffect,
  createMemo,
  createSignal,
  For,
  on,
  onCleanup,
  onMount,
  Show,
} from "solid-js";
import type { JSX } from "solid-js";
import { formatComposite, parseComposite } from "../../lib/tokens.ts";
import type {
  Composite,
  CompositeLadders,
  LadderStep,
} from "../../lib/tokens.ts";
import { refusalFor } from "../../lib/store.ts";
import { tokenPath } from "../../lib/live-edit.ts";
import TypographyEditor from "./TypographyEditor.tsx";
import BorderEditor from "./BorderEditor.tsx";
import TransitionEditor from "./TransitionEditor.tsx";
import GradientEditor from "./GradientEditor.tsx";

/**
 * A row of a panel.
 *
 * The studio's own row: no fill, no edge, the page's ink, and the surface
 * behind the row that is current — so the reader can see where they are
 * without the row shouting.
 */
const ROW =
  "flex min-h-0 w-full items-center justify-start gap-2 rounded-md border border-transparent bg-transparent px-2 py-1 text-left text-sm font-regular text-text-muted hover:bg-surface-sunken hover:text-text aria-selected:bg-surface-sunken aria-selected:text-text";

/**
 * The panel's own frame.
 *
 * Out of the flow, so opening it moves nothing: the row it hangs off stays
 * where it was, and the panel floats over the page.
 */
const PANEL =
  "absolute top-full start-0 z-dropdown mt-1 w-max max-w-[80vw] max-h-[16rem] overflow-y-auto rounded-md border border-border bg-surface-raised p-1 shadow-lg";

/**
 * Which panel is open.
 *
 * At most one: two panels over one another is a stack of furniture, and the
 * reader cannot tell which of them they are looking at. The studio's own
 * bar keeps the same rule for the same reason.
 */
const [openPanel, setOpenPanel] = createSignal<string | undefined>(undefined);

let panelCount = 0;

/**
 * A panel over the page: an affordance, and what it opens.
 *
 * The dismissal is the platform's own — a click elsewhere, or Escape — the
 * two things a reader reaches for when a panel is in the way.
 */
function Panel(props: {
  /** What the control is called, for the reader and for the pointer. */
  label: string;
  /** The affordance's own face. */
  trigger: JSX.Element;
  /** The rows the panel offers, and the way to close it. */
  children: (close: () => void) => JSX.Element;
}) {
  const id = `composite-panel-${panelCount++}`;
  const open = () => openPanel() === id;
  const hide = () => setOpenPanel(undefined);
  /**
   * Close, and put the reader back on the control that opened the panel.
   *
   * The row they picked is gone from the tab order the moment the panel is
   * hidden, so focus left there is focus nowhere: the next Tab would start
   * the page over.
   */
  const dismiss = () => {
    hide();
    trigger?.focus();
  };
  let root: HTMLDivElement | undefined;
  let trigger: HTMLButtonElement | undefined;
  let panel: HTMLDivElement | undefined;

  const items = (): HTMLElement[] => [
    ...(panel?.querySelectorAll<HTMLElement>(
      '[role="option"]:not([disabled])',
    ) ?? []),
  ];
  const chosen = (): HTMLElement | undefined =>
    items().find((item) => item.getAttribute("aria-selected") === "true");

  /** Open, and land a keyboard reader on the answer in force. */
  function show(edge: "first" | "last" | "current"): void {
    setOpenPanel(id);
    queueMicrotask(() => {
      const list = items();
      const target = edge === "first"
        ? list[0]
        : edge === "last"
        ? list[list.length - 1]
        : chosen() ?? list[0];
      target?.focus();
    });
  }

  onMount(() => {
    const onPointer = (event: MouseEvent) => {
      if (open() && !root?.contains(event.target as Node)) hide();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && open()) hide();
    };
    document.addEventListener("click", onPointer, true);
    document.addEventListener("keydown", onKey);
    onCleanup(() => {
      document.removeEventListener("click", onPointer, true);
      document.removeEventListener("keydown", onKey);
    });
  });

  const onTriggerKey = (event: KeyboardEvent) => {
    // The picker opens on the step in force, so the arrow keys start from
    // the document rather than from the top of the ladder.
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      show("current");
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (open()) dismiss();
      else show("current");
      return;
    }
    if (event.key === "Escape" && open()) {
      event.preventDefault();
      dismiss();
    }
  };

  const onPanelKey = (event: KeyboardEvent) => {
    const list = items();
    if (list.length === 0) return;
    const at = list.indexOf(document.activeElement as HTMLElement);
    const move = (index: number) => {
      event.preventDefault();
      list[(index + list.length) % list.length]?.focus();
    };
    switch (event.key) {
      case "ArrowDown":
        move(at < 0 ? 0 : at + 1);
        break;
      case "ArrowUp":
        move(at < 0 ? list.length - 1 : at - 1);
        break;
      case "Home":
        move(0);
        break;
      case "End":
        move(list.length - 1);
        break;
      case "Escape":
        event.preventDefault();
        dismiss();
        break;
      case "Tab":
        hide();
        break;
    }
  };

  return (
    <div class="relative shrink-0" ref={root}>
      <button
        ref={trigger}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open()}
        aria-label={props.label}
        title={props.label}
        class="secondary s-sm row-sm min-w-0 gap-2 text-text-muted hover:border-primary hover:text-text"
        onClick={() => {
          if (open()) hide();
          else setOpenPanel(id);
        }}
        onKeyDown={onTriggerKey}
      >
        {props.trigger}
      </button>
      <div
        ref={panel}
        hidden={!open()}
        role="listbox"
        aria-label={props.label}
        class={PANEL}
        onKeyDown={onPanelKey}
      >
        {props.children(dismiss)}
      </div>
    </div>
  );
}

/**
 * One step of a ladder, chosen from the theme's own.
 *
 * The trigger wears the step's NAME — `3xl`, `bold`, `wide` — because the
 * name is what the theme calls it and the value beside it is what it is
 * worth. A step the theme's ladder does not carry is shown as its value, so
 * a composite the theme wrote by hand still says what it holds.
 *
 * A ladder the theme declares no steps for has no panel to open, so the
 * field takes the value instead: the theme's own scale is the first answer,
 * and a field is the fallback rather than the rule.
 */
export function StepPicker(props: {
  /** What the control is called, for the reader and for the pointer. */
  label: string;
  /** The value currently in force. */
  value: string;
  /** The theme's own steps for the group. */
  steps: readonly LadderStep[];
  /** Called with the picked step entry; false when refused. */
  onPick: (step: LadderStep) => boolean | void;
}) {
  const current = createMemo(() =>
    props.steps.find((step) => step.value === props.value)
  );
  const shown = createMemo(() => current()?.name ?? (props.value || "—"));
  return (
    <Panel
      label={props.label}
      trigger={<span class="truncate">{shown()}</span>}
    >
      {(close) => (
        <For each={props.steps}>
          {(step) => (
            <button
              type="button"
              role="option"
              aria-selected={step.value === props.value}
              class={ROW}
              onClick={() => {
                props.onPick(step);
                close();
              }}
            >
              <span class="truncate">{step.name}</span>
              <span class="ms-auto truncate text-xs text-text-muted">
                {step.value}
              </span>
            </button>
          )}
        </For>
      )}
    </Panel>
  );
}

export function StepField(props: {
  /** What the part is, in the words an author edits it by. */
  label: string;
  /** The value the composite holds for the part. */
  value: string;
  /** The theme's own steps for the part. */
  steps: readonly LadderStep[];
  /** Called with the step's value when one is picked; false when refused. */
  onPick: (value: string) => boolean;
}) {
  const current = createMemo(() =>
    props.steps.find((step) => step.value === props.value)
  );
  const shown = createMemo(() => current()?.name ?? props.value);
  return (
    <label class="stack-sm text-xs text-text-muted">
      {props.label}
      <Show
        when={props.steps.length > 0}
        fallback={
          <input
            type="text"
            class="w-24"
            value={props.value}
            onChange={(event) => {
              // A refused value is not the document's: the field says what
              // the theme still holds rather than what was typed at it.
              if (props.onPick(event.currentTarget.value) === false) {
                event.currentTarget.value = props.value;
              }
            }}
          />
        }
      >
        <Panel
          label={`${props.label}: ${shown()}`}
          trigger={<span class="truncate">{shown()}</span>}
        >
          {(close) => (
            <For each={props.steps}>
              {(step) => (
                <button
                  type="button"
                  role="option"
                  aria-selected={step.value === props.value}
                  class={ROW}
                  onClick={() => {
                    props.onPick(step.value);
                    close();
                  }}
                >
                  <span class="truncate">{step.name}</span>
                  <span class="ms-auto truncate text-xs text-text-muted">
                    {step.value}
                  </span>
                </button>
              )}
            </For>
          )}
        </Panel>
      </Show>
    </label>
  );
}

/**
 * A colour: the theme's palette, and a field for a colour it does not name.
 *
 * The swatch is DATA — it paints the value as it stands — because the
 * studio wears its own theme and a utility here would paint the studio's
 * colour and call it the theme being edited.
 */
export function ColourField(props: {
  label: string;
  value: string;
  /** The theme's own colours — the roles of its palette. */
  steps: readonly LadderStep[];
  /** Called with the colour; false when the document refused it. */
  onPick: (value: string) => boolean;
}) {
  const [draft, setDraft] = createSignal(props.value);
  // The document is the source of truth: undo, redo and a reset move the
  // colour, and a field holding the old spelling is a field lying about the
  // document. `on` so the effect answers the value, not the draft.
  createEffect(on(() => props.value, (value) => setDraft(value)));
  return (
    <label class="stack-sm text-xs text-text-muted">
      {props.label}
      <div class="row-sm gap-2">
        <Panel
          label={`${props.label}: ${props.value}`}
          trigger={
            <span
              class="block h-5 w-8 shrink-0 rounded-sm border border-border"
              style={{ background: props.value }}
              aria-hidden="true"
            />
          }
        >
          {(close) => (
            <For each={props.steps}>
              {(step) => (
                <button
                  type="button"
                  role="option"
                  aria-selected={step.value === props.value}
                  class={ROW}
                  onClick={() => {
                    props.onPick(step.value);
                    close();
                  }}
                >
                  <span
                    class="block h-5 w-5 shrink-0 rounded-sm border border-border"
                    style={{ background: step.value }}
                    aria-hidden="true"
                  />
                  <span class="truncate">{step.name}</span>
                </button>
              )}
            </For>
          )}
        </Panel>
        <input
          type="text"
          class="w-24"
          value={draft()}
          onChange={(event) => {
            const next = event.currentTarget.value;
            setDraft(next);
            if (props.onPick(next) === false) setDraft(props.value);
          }}
        />
      </div>
    </label>
  );
}

/**
 * A value the theme has no ladder for: a field that takes it.
 */
export function TextField(props: {
  label: string;
  value: string;
  onPick: (value: string) => boolean;
  placeholder?: string;
}) {
  return (
    <label class="stack-sm text-xs text-text-muted">
      {props.label}
      <input
        type="text"
        class="w-32"
        placeholder={props.placeholder}
        value={props.value}
        onChange={(event) => {
          // Same honesty as the step field: a refused value does not stay
          // in a field the document never took.
          if (props.onPick(event.currentTarget.value) === false) {
            event.currentTarget.value = props.value;
          }
        }}
      />
    </label>
  );
}

/**
 * A choice from a closed set: a panel that opens on the values there are.
 *
 * The set is the theme language's own — the line styles a border may be
 * drawn in — so the control offers exactly those and nothing else. The
 * value the theme holds that is not in the set is kept in the panel as the
 * current answer, so a document that says something else still says it.
 */
export function ChoiceField(props: {
  label: string;
  value: string;
  /** The values there are to choose from. */
  choices: readonly string[];
  onPick: (value: string) => boolean;
}) {
  const known = createMemo(() => props.choices.includes(props.value));
  return (
    <label class="stack-sm text-xs text-text-muted">
      {props.label}
      <Panel
        label={`${props.label}: ${props.value}`}
        trigger={<span class="truncate">{props.value || "—"}</span>}
      >
        {(close) => (
          <>
            <Show when={!known()}>
              <button
                type="button"
                role="option"
                aria-selected="true"
                class={ROW}
                onClick={() => {
                  props.onPick(props.value);
                  close();
                }}
              >
                <span class="truncate">{props.value || "—"}</span>
              </button>
            </Show>
            <For each={props.choices}>
              {(choice) => (
                <button
                  type="button"
                  role="option"
                  aria-selected={choice === props.value}
                  class={ROW}
                  onClick={() => {
                    props.onPick(choice);
                    close();
                  }}
                >
                  <span class="truncate">{choice}</span>
                </button>
              )}
            </For>
          </>
        )}
      </Panel>
    </label>
  );
}

/**
 * The composite's own editor.
 *
 * The type decides the editor: a typography opens the type's four parts, a
 * border the edge's three, a transition the motion's two, a gradient the
 * fill's direction and stops. A value the type cannot be read as says so
 * rather than showing parts that were never there.
 */
export default function CompositeEditor(props: {
  /** The token's declared type — the composite it is. */
  type: string;
  /** The value the theme holds for it. */
  value: string;
  /** The theme's own ladders, for the parts that have one. */
  ladders: CompositeLadders;
  /** Called with the value to write; false when the theme refused it. */
  onCommit: (value: string) => boolean;
  /** The token's path, so the refusal can be read beside the value. */
  id?: string;
  /** The token's path, named to the control when no label claims it. */
  label?: string;
}) {
  const parts = createMemo(() => parseComposite(props.type, props.value));
  const path = createMemo(() => tokenPath(props.id, props.label));
  const refusal = createMemo(() => {
    const token = path();
    return token === undefined ? undefined : refusalFor(token);
  });
  return (
    <div class="stack-sm">
      <Show
        when={parts()}
        fallback={
          <p class="text-xs text-text-muted">
            This value is not a {props.type} the studio can take apart.
          </p>
        }
      >
        {(composite) => (
          <Body
            parts={composite()}
            ladders={props.ladders}
            onCommit={props.onCommit}
          />
        )}
      </Show>
      <Show when={refusal()}>
        {(message) => (
          <p class="text-xs text-semantic-error" role="alert">
            {message()}
          </p>
        )}
      </Show>
    </div>
  );
}

/**
 * The editor that owns a composite type.
 */
function Body(props: {
  parts: Composite;
  ladders: CompositeLadders;
  onCommit: (value: string) => boolean;
}) {
  const parts = props.parts;
  switch (parts.type) {
    case "typography":
      return (
        <TypographyEditor
          composite={parts}
          ladders={props.ladders}
          onCommit={(next) => props.onCommit(formatComposite(next))}
        />
      );
    case "border":
      return (
        <BorderEditor
          composite={parts}
          ladders={props.ladders}
          onCommit={(next) => props.onCommit(formatComposite(next))}
        />
      );
    case "transition":
      return (
        <TransitionEditor
          composite={parts}
          ladders={props.ladders}
          onCommit={(next) => props.onCommit(formatComposite(next))}
        />
      );
    case "gradient":
      return (
        <GradientEditor
          composite={parts}
          ladders={props.ladders}
          onCommit={(next) => props.onCommit(formatComposite(next))}
        />
      );
  }
}

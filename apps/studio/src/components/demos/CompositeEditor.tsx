/**
 * The composite editors: a control for a value that is more than one thing.
 *
 * A colour is one thing and a dimension is one thing, so a text field can
 * serve them and the studio's fields do. A border is a width, a style and a
 * colour; a transition is a duration and an easing; a gradient is a
 * direction and a list of stops. One string carries all of them, so one
 * string cannot be edited part by part — and a text box that takes the whole
 * string is how a border ends up with a colour that is not one. (TYPE-c:
 * the `typography` composite is gone — one path, `font.style`.)
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
import BorderEditor from "./BorderEditor.tsx";
import TransitionEditor from "./TransitionEditor.tsx";
import GradientEditor from "./GradientEditor.tsx";
import { createSpinComponent } from "@spinjs/components/solid";

/**
 * A row of a panel.
 *
 * The studio's own row: no fill, no edge, the page's ink, and the surface
 * behind the row that is current — so the reader can see where they are
 * without the row shouting.
 */
const ROW =
  "flex min-h-0 w-full items-center justify-start gap-2 rounded-md border border-transparent bg-transparent px-2 py-1 text-left type-body text-muted hover:bg-surface-sunken aria-selected:bg-surface-sunken";

/**
 * The panel's own frame.
 *
 * Out of the flow, so opening it moves nothing: the row it hangs off stays
 * where it was, and the panel floats over the page.
 */
const PANEL =
  "absolute top-full start-0 z-dropdown mt-1 w-max max-w-[80vw] max-h-[16rem] overflow-y-auto rounded-md border bg-surface-raised p-1 shadow-lg";

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
 * two things a reader reaches for when a panel is in the way. The rows are
 * a `studio-step-list`: the listbox machine owns the highlight, the arrows,
 */
function Panel(props: {
  /** What the control is called, for the reader and for the pointer. */
  label: string;
  /** The affordance's own face. */
  trigger: JSX.Element;
  /** The rows the panel offers, and the way to close it. */
  children: (close: () => void, isOpen: () => boolean) => JSX.Element;
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
    const wasOpen = open();
    hide();
    if (wasOpen) trigger?.focus({ preventScroll: true });
  };
  let root: HTMLDivElement | undefined;
  let trigger: HTMLButtonElement | undefined;
  let panel: HTMLDivElement | undefined;

  /**
   * Open, and land a keyboard reader on the answer in force.
   *
   * Focus lands on the list itself: the machine highlights the value in
   * force when focus arrives, so the arrows start from the document rather
   * than from the top of the ladder.
   */
  function show(): void {
    setOpenPanel(id);
    queueMicrotask(() => {
      panel?.querySelector<HTMLElement>('[role="listbox"]')?.focus();
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
    // The picker opens on the step in force: the machine highlights the
    // value when focus arrives, so the arrow keys start from the document
    // rather than from the top of the ladder.
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      show();
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (open()) dismiss();
      else show();
      return;
    }
    if (event.key === "Escape" && open()) {
      event.preventDefault();
      dismiss();
    }
  };

  const onPanelKey = (event: KeyboardEvent) => {
    // The machine owns the rows' keys; leaving the panel closes it, and
    // focus is moving somewhere on purpose.
    if (event.key === "Tab") hide();
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
        class="secondary s-sm row-sm min-w-0 gap-2 text-muted hover:border-primary"
        onClick={() => {
          if (open()) hide();
          else show();
        }}
        onKeyDown={onTriggerKey}
      >
        {props.trigger}
      </button>
      <div
        ref={panel}
        hidden={!open()}
        aria-label={props.label}
        class={PANEL}
        onKeyDown={onPanelKey}
      >
        {props.children(dismiss, open)}
      </div>
    </div>
  );
}


/**
 * The ladder's rows, owned by the listbox machine.
 *
 * The steps are the theme's own — name beside value — and the value in
 * force is the machine's controlled answer. A pick the document refuses
 * leaves the value where it was, because the prop never moves.
 */
function StepList(props: {
  /** The theme's own steps for the part. */
  steps: readonly LadderStep[];
  /** The value currently in force. */
  value: string;
  /** Called with the picked step's value. */
  onPick: (value: string) => void;
}) {
  const [element, setElement] = createSignal<HTMLElement>();
  const list = createSpinComponent(element);
  // The controlled channel: the steps and the value in force go down, the
  // pick comes up. Bound in an effect, not passed as props: the bridge
  // reads its callbacks when it builds, and a prop set after that read
  // never becomes a subscription.
  createEffect(() => {
    const unbind = list.bind(
      {
        items: props.steps.map((step) => ({
          value: step.value,
          label: step.name,
        })),
        value: props.value,
      },
      {
        "value-change": (event: CustomEvent<{ value: readonly string[] }>) => {
          const picked = event.detail.value[0];
          if (picked !== undefined && picked !== props.value) {
            props.onPick(picked);
          }
        },
      },
    );
    onCleanup(unbind);
  });
  return (
    <studio-step-list
      ref={setElement}
      prop:items={props.steps.map((step) => ({
        value: step.value,
        label: step.name,
      }))}
      prop:value={props.value}
    />
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
      {(close, isOpen) => (
        <StepList
          steps={props.steps}
          value={props.value}
          onPick={(value) => {
            if (!isOpen()) return;
            const step = props.steps.find((entry) => entry.value === value);
            if (step !== undefined) props.onPick(step);
            close();
          }}
        />
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
    <label class="stack-sm text-muted">
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
          {(close, isOpen) => (
            <StepList
              steps={props.steps}
              value={props.value}
              onPick={(value) => {
                if (!isOpen()) return;
                props.onPick(value);
                close();
              }}
            />
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
    <label class="stack-sm text-muted">
      {props.label}
      <div class="row-sm gap-2">
        <Panel
          label={`${props.label}: ${props.value}`}
          trigger={
            <span
              class="block h-5 w-8 shrink-0 rounded-sm border"
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
                    class="block h-5 w-5 shrink-0 rounded-sm border"
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
    <label class="stack-sm text-muted">
      {props.label}
      <input
        type="text"
        class="w-36"
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
    <label class="stack-sm text-muted">
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
 * The type decides the editor: a border the edge's three, a transition the
 * motion's two, a gradient the fill's direction and stops. A value the type
 * cannot be read as says so rather than showing parts that were never there.
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
          <p class="text-muted">
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
          <p class="text-semantic-error" role="alert">
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

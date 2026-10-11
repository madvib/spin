import { createSignal } from "solid-js";
import { createSpin } from "@spin/hooks/solid";
import type { EditableEditChange, EditableValueChange } from "../../../src/spin-editable/editable.bridge.ts";

interface EditableCommands {
  setValue: (value: string) => void;
  clearValue: () => void;
  edit: () => void;
  cancel: () => void;
  submit: () => void;
}

const button =
  "rounded-lg border border-border bg-surface-raised px-4 py-2 text-sm font-medium text-text shadow-sm transition-colors hover:bg-surface";

/**
 * Editable on the forked FSM: the preview/edit pair, the controlled edit
 * channel, the auto-resize stack and the submit-on-blur reflex.
 *
 * The claim under test: Zag's two-state machine survives config-first
 * authoring with the focus reflexes and the interact-outside tracking moved
 * out to the view, and the four callbacks are reported from the transition
 * the bridge watches rather than from inside the machine.
 */
export default function EditableFsm() {
  const [value, setValue] = createSignal("Ada Lovelace");
  const [commits, setCommits] = createSignal(0);
  const [reverts, setReverts] = createSignal(0);
  const [edit, setEdit] = createSignal(false);
  const [outside, setOutside] = createSignal("none");

  const uncontrolled = createSpin<
    { label: string; defaultValue: string; placeholder: string },
    EditableCommands
  >(
    "spin-editable-fsm",
    () => ({ label: "Name", defaultValue: "Ada Lovelace", placeholder: "Type a name" }),
    {
      "value-change": (event: CustomEvent<EditableValueChange>) => setValue(event.detail.value),
      "value-commit": () => setCommits((n) => n + 1),
      "value-revert": () => setReverts((n) => n + 1),
    },
  );

  const controlled = createSpin<{ label: string; editing: boolean; defaultValue: string }, EditableCommands>(
    "spin-editable-fsm",
    () => ({ label: "Controlled edit", editing: edit(), defaultValue: "Grace Hopper" }),
    {
      "edit-change": (event: CustomEvent<EditableEditChange>) => {
        setEdit(event.detail.edit);
        setOutside(`edit-change: ${event.detail.edit}`);
      },
    },
  );

  const autoresize = createSpin<{ label: string; autoResize: boolean; placeholder: string }, EditableCommands>(
    "spin-editable-fsm",
    () => ({ label: "Auto-resizing", autoResize: true, placeholder: "It grows with the text" }),
    {
      "edit-change": (event: CustomEvent<EditableEditChange>) => setOutside(`auto-resize: ${event.detail.edit}`),
    },
  );

  const disabled = createSpin<{ label: string; defaultValue: string; disabled: boolean }, EditableCommands>(
    "spin-editable-fsm",
    () => ({ label: "Disabled", defaultValue: "not editable", disabled: true }),
  );

  return (
    <section>
      <h2 class="text-xl mb-1">Editable — forked FSM</h2>
      <p class="text-muted mb-4">
        Focus the preview (or click it, or double click it, depending on <code>activationMode</code>), type, then submit
        with Enter or the ✓ trigger, or cancel with Escape or the ✕ trigger. Walking away from the field submits too —
        or cancels it, with <code>submitMode="enter"</code>. The second field drives its edit state from the host, so
        the machine asks and the host answers.
      </p>

      <div class="grid gap-6 sm:grid-cols-2">
        <div>
          <h3 class="mb-2 text-sm font-medium text-text">Uncontrolled</h3>
          <spin-editable-fsm
            id="uncontrolled"
            ref={uncontrolled.ref}
            prop:label="Name"
            prop:defaultValue="Ada Lovelace"
            prop:placeholder="Type a name"
            prop:name="fullName"
          />
        </div>
        <div>
          <h3 class="mb-2 text-sm font-medium text-text">Controlled edit</h3>
          <spin-editable-fsm
            id="controlled"
            ref={controlled.ref}
            prop:label="Controlled edit"
            prop:editing={edit()}
            prop:defaultValue="Grace Hopper"
          />
          <div class="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              class={button}
              onClick={() => controlled.commands().edit()}
            >
              el.edit()
            </button>
            <button
              type="button"
              class={button}
              onClick={() => controlled.commands().submit()}
            >
              el.submit()
            </button>
            <button
              type="button"
              class={button}
              onClick={() => controlled.commands().cancel()}
            >
              el.cancel()
            </button>
          </div>
        </div>
        <div>
          <h3 class="mb-2 text-sm font-medium text-text">Auto-resize</h3>
          <spin-editable-fsm
            id="autoresize"
            ref={autoresize.ref}
            prop:label="Auto-resizing"
            prop:autoResize={true}
            prop:placeholder="It grows with the text"
          />
        </div>
        <div>
          <h3 class="mb-2 text-sm font-medium text-text">Disabled</h3>
          <spin-editable-fsm
            id="disabled"
            ref={disabled.ref}
            prop:label="Disabled"
            prop:defaultValue="not editable"
            prop:disabled={true}
          />
        </div>
      </div>

      <div class="mt-4 text-sm text-muted font-mono tabular-nums">
        <div>
          value: <span id="editable-value">{value()}</span> · commits:{" "}
          <span id="editable-commits">{commits()}</span> · reverts:{" "}
          <span id="editable-reverts">{reverts()}</span>
        </div>
        <div>
          controlled edit: <span id="editable-edit">{edit() ? "edit" : "preview"}</span> · last report:{" "}
          <span id="editable-outside">{outside()}</span>
        </div>
      </div>
    </section>
  );
}

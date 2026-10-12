import { createEffect, createSignal } from "solid-js";
import { createSpinComponent } from "@spin/hooks/solid";
import type {
  EditableEditChange,
  EditableValueChange,
} from "../../../src/spin-editable/editable.bridge.ts";
import {
  DEMO_BUTTON,
  DemoCard,
  DemoControls,
  DemoGrid,
  DemoReadout,
} from "../demo.tsx";

interface EditableCommands {
  setValue: (value: string) => void;
  clearValue: () => void;
  edit: () => void;
  cancel: () => void;
  submit: () => void;
}

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

  const [uncontrolledEl, setUncontrolled] = createSignal<HTMLElement>();
  const uncontrolled = createSpinComponent<EditableCommands>(uncontrolledEl);
  createEffect(() => {
    const ctl = uncontrolled();
    if (ctl === undefined) return undefined;
    return ctl.bind({
      label: "Name",
      defaultValue: "Ada Lovelace",
      placeholder: "Type a name",
    }, {
      "value-change": (event: CustomEvent<EditableValueChange>) =>
        setValue(event.detail.value),
      "value-commit": () => setCommits((n) => n + 1),
      "value-revert": () => setReverts((n) => n + 1),
    });
  });
;

  const [controlledEl, setControlled] = createSignal<HTMLElement>();
  const controlled = createSpinComponent<EditableCommands>(controlledEl);
  createEffect(() => {
    const ctl = controlled();
    if (ctl === undefined) return undefined;
    return ctl.bind({
      label: "Controlled edit",
      editing: edit(),
      defaultValue: "Grace Hopper",
    }, {
      "edit-change": (event: CustomEvent<EditableEditChange>) => {
        setEdit(event.detail.edit);
        setOutside(`edit-change: ${event.detail.edit}`);
      },
    });
  });
;

  const [autoresizeEl, setAutoresize] = createSignal<HTMLElement>();
  const autoresize = createSpinComponent<EditableCommands>(autoresizeEl);
  createEffect(() => {
    const ctl = autoresize();
    if (ctl === undefined) return undefined;
    return ctl.bind({
      label: "Auto-resizing",
      autoResize: true,
      placeholder: "It grows with the text",
    }, {
      "edit-change": (event: CustomEvent<EditableEditChange>) =>
        setOutside(`auto-resize: ${event.detail.edit}`),
    });
  });
;

  const [disabledEl, setDisabled] = createSignal<HTMLElement>();
  const disabled = createSpinComponent<EditableCommands>(disabledEl);
  createEffect(() => {
    const ctl = disabled();
    if (ctl === undefined) return undefined;
    return ctl.bind({ label: "Disabled", defaultValue: "not editable", disabled: true }, );
  });
;

  return (
    <DemoGrid>
      <DemoCard
        title="Uncontrolled"
        width="md"
        note="The host readouts belong to this field: it is the one the route reports value-change, value-commit and value-revert from."
      >
        <spin-editable
          id="uncontrolled"
          ref={setUncontrolled}
          prop:label="Name"
          prop:defaultValue="Ada Lovelace"
          prop:placeholder="Type a name"
          prop:name="fullName"
        />
        <DemoReadout>
          value: <span id="editable-value">{value()}</span> · commits:{" "}
          <span id="editable-commits">{commits()}</span> · reverts:{" "}
          <span id="editable-reverts">{reverts()}</span>
        </DemoReadout>
      </DemoCard>

      <DemoCard
        title="Controlled edit"
        width="md"
        note="The host owns the edit channel: the field asks, the host answers, and the last report reads out."
      >
        <spin-editable
          id="controlled"
          ref={setControlled}
          prop:label="Controlled edit"
          prop:editing={edit()}
          prop:defaultValue="Grace Hopper"
        />
        <DemoControls>
          <button
            type="button"
            class={DEMO_BUTTON}
            onClick={() => controlled()?.commands.edit()}
          >
            el.edit()
          </button>
          <button
            type="button"
            class={DEMO_BUTTON}
            onClick={() => controlled()?.commands.submit()}
          >
            el.submit()
          </button>
          <button
            type="button"
            class={DEMO_BUTTON}
            onClick={() => controlled()?.commands.cancel()}
          >
            el.cancel()
          </button>
        </DemoControls>
        <DemoReadout>
          controlled edit:{" "}
          <span id="editable-edit">{edit() ? "edit" : "preview"}</span>{" "}
          · last report: <span id="editable-outside">{outside()}</span>
        </DemoReadout>
      </DemoCard>

      <DemoCard
        title="Auto-resize"
        width="md"
        note="Both parts share one grid cell, so the inactive one is invisible but still laid out."
      >
        <spin-editable
          id="autoresize"
          ref={setAutoresize}
          prop:label="Auto-resizing"
          prop:autoResize={true}
          prop:placeholder="It grows with the text"
        />
      </DemoCard>

      <DemoCard
        title="Disabled"
        width="md"
        note="The preview leaves the tab order and the input is disabled."
      >
        <spin-editable
          id="disabled"
          ref={setDisabled}
          prop:label="Disabled"
          prop:defaultValue="not editable"
          prop:disabled={true}
        />
      </DemoCard>
    </DemoGrid>
  );
}

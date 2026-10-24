import { test } from "bun:test";
import { deepStrictEqual } from "node:assert/strict";
import { parseHTML } from "@spin/runtime/testing";
import { signal } from "@spin/runtime";
import { editable } from "./editable.presentation.ts";
const createEditableBridge = editable.createBridge;
import type { EditableEditChange, EditableValueChange } from "./editable.presentation.ts";
import type { EditableApi } from "./editable.presentation.ts";
import type { InteractOutsideEvent } from "@spin/runtime/actions";

/** A live writable read, as the element's prop store exposes one. */
type WriteSignal = { (): unknown; (value: unknown): void };

const win = parseHTML("<!doctype html><html><body></body></html>") as unknown as Record<string, unknown>;
declare const globalThis: Record<string, unknown>;
globalThis.document = win.document;
globalThis.CustomEvent = win.CustomEvent;
globalThis.HTMLElement = win.HTMLElement;
globalThis.Element = win.Element;

/**
 * Prop bags hand back `Record<string, unknown>`, so a handler read out of one
 * is checked here and typed once, instead of an unchecked cast at every call
 * site.
 */
function handler<H>(bag: Record<string, unknown>, key: string): H {
  const value: unknown = bag[key];
  if (typeof value !== "function") throw new Error(`no handler at ${key}`);
  return value as H;
}

/**
 * linkedom ships no KeyboardEvent constructor, so the events the handlers need
 * are synthesized here — one place, with the minimal field set each reads.
 */
function keydown(
  key: string,
  modifiers: Readonly<{ shift?: boolean; meta?: boolean; composing?: boolean }> = {},
): KeyboardEvent {
  const made: Record<string, unknown> = {
    key,
    shiftKey: modifiers.shift === true,
    metaKey: modifiers.meta === true,
    altKey: false,
    isComposing: modifiers.composing === true,
    defaultPrevented: false,
  };
  made["preventDefault"] = (): void => {
    made["defaultPrevented"] = true;
  };
  return made as unknown as KeyboardEvent;
}

/** The event the outside reflex hands its callbacks, vetoable by the host. */
function outsideEvent(focusable: boolean): InteractOutsideEvent {
  const event = {
    type: "focus",
    detail: { originalEvent: new Event("focus"), contextmenu: false, focusable, target: null },
    defaultPrevented: false,
  } as InteractOutsideEvent;
  event.preventDefault = (): void => {
    event.defaultPrevented = true;
  };
  return event;
}

interface OutsideReport {
  focus: number;
  pointer: number;
  interact: number;
}

interface Harness {
  readonly api: EditableApi;
  readonly valueChanges: string[];
  readonly editChanges: boolean[];
  readonly commits: string[];
  readonly reverts: string[];
  readonly outside: OutsideReport;
  /** A part's bag by the api method that produces it. */
  bag(part: "root" | "area" | "label" | "input" | "preview" | "control" | "edit" | "submit" | "cancel"): Record<string, unknown>;
  state(): "preview" | "edit";
  /** Type into the field through the input's `input` event. */
  type(value: string): void;
  press(key: string, modifiers?: Readonly<{ shift?: boolean; meta?: boolean; composing?: boolean }>): void;
  activatePreview(mode: "click" | "focus" | "dblclick"): void;
  trigger(part: "edit" | "submit" | "cancel"): void;
  focusOutside(focusable?: boolean): void;
  /** Hand the focus-outside callback an event the host has already vetoed. */
  vetoedFocusOutside(): void;
  pointerOutside(focusable?: boolean): void;
  write(name: string, value: unknown): void;
}

/** Props are signals, exactly as the element's prop store makes them, so a host
 * write re-runs the bridge's controlled-channel effect. A prop passed in
 * `overrides` is AUTHORED, which is the element's `@@authored` predicate. */
function mount(overrides: Readonly<Record<string, unknown>> = {}): Harness {
  const root = document.createElement("div");
  document.body.appendChild(root);
  const valueChanges: string[] = [];
  const editChanges: boolean[] = [];
  const commits: string[] = [];
  const reverts: string[] = [];
  const outside: OutsideReport = { focus: 0, pointer: 0, interact: 0 };
  const values: Record<string, WriteSignal> = {};
  const authoredKeys = new Set(Object.keys(overrides));
  const write = (name: string, value: unknown): void => {
    const source = values[name];
    if (source === undefined) values[name] = signal<unknown>(value);
    else source(value);
  };
  for (const [name, value] of Object.entries(overrides)) write(name, value);
  write("onValueChange", (d: EditableValueChange): void => {
    valueChanges.push(d.value);
  });
  write("onValueCommit", (d: EditableValueChange): void => {
    commits.push(d.value);
  });
  write("onValueRevert", (d: EditableValueChange): void => {
    reverts.push(d.value);
  });
  write("onEditChange", (d: EditableEditChange): void => {
    editChanges.push(d.edit);
  });
  write("onFocusOutside", (): void => {
    outside.focus += 1;
  });
  write("onPointerDownOutside", (): void => {
    outside.pointer += 1;
  });
  write("onInteractOutside", (event: InteractOutsideEvent): void => {
    outside.interact += 1;
    if (event.defaultPrevented) return;
  });
  const bridge = createEditableBridge(
    () => {
      const bag: Record<string, unknown> = {};
      for (const [name, source] of Object.entries(values)) bag[name] = source();
      bag["@@authored"] = (name: string): boolean => authoredKeys.has(name);
      return bag;
    },
    () => root,
    "harness",
  );

  const bag = (part: Harness["bag"] extends never ? never : Parameters<Harness["bag"]>[0]): Record<string, unknown> => {
    switch (part) {
      case "root": return bridge.api.getRootProps();
      case "area": return bridge.api.getAreaProps();
      case "label": return bridge.api.getLabelProps();
      case "input": return bridge.api.getInputProps();
      case "preview": return bridge.api.getPreviewProps();
      case "control": return bridge.api.getControlProps();
      case "edit": return bridge.api.getEditTriggerProps();
      case "submit": return bridge.api.getSubmitTriggerProps();
      case "cancel": return bridge.api.getCancelTriggerProps();
    }
  };

  /** The input's `use:interact-outside` entry, which is data. */
  const params = (): Record<string, unknown> => {
    const entry: unknown = bag("input")["use:interact-outside"];
    if (typeof entry !== "object" || entry === null) throw new Error("no action param at use:interact-outside");
    return entry as Record<string, unknown>;
  };

  const callback = <H>(key: string): H => {
    const value: unknown = params()[key];
    if (typeof value !== "function") throw new Error(`no callback at ${key}`);
    return value as H;
  };

  return {
    api: bridge.api,
    valueChanges,
    editChanges,
    commits,
    reverts,
    outside,
    bag,
    state: () => (bridge.api.editing ? "edit" : "preview"),
    type: (value: string): void => {
      handler<(event: { currentTarget: { value: string } }) => void>(bag("input"), "onInput")({
        currentTarget: { value },
      });
    },
    press: (key, modifiers): void => {
      handler<(event: KeyboardEvent) => void>(bag("input"), "onKeydown")(keydown(key, modifiers));
    },
    activatePreview: (mode): void => {
      const preview = bag("preview");
      if (mode === "click") handler<(event: MouseEvent) => void>(preview, "onClick")({ defaultPrevented: false } as MouseEvent);
      if (mode === "focus") handler<() => void>(preview, "onFocus")();
      if (mode === "dblclick") {
        handler<(event: MouseEvent) => void>(preview, "onDoubleClick")({ defaultPrevented: false } as MouseEvent);
      }
    },
    trigger: (part): void => {
      handler<(event: MouseEvent) => void>(bag(part), "onClick")({ defaultPrevented: false } as MouseEvent);
    },
    focusOutside: (focusable = false): void => {
      callback<(event: InteractOutsideEvent) => void>("onFocusOutside")(outsideEvent(focusable));
    },
    vetoedFocusOutside: (): void => {
      const event = outsideEvent(false);
      event.preventDefault();
      callback<(event: InteractOutsideEvent) => void>("onFocusOutside")(event);
    },
    pointerOutside: (focusable = false): void => {
      callback<(event: InteractOutsideEvent) => void>("onPointerDownOutside")(outsideEvent(focusable));
    },
    write,
  };
}

// ---- the start states ----------------------------------------------------
//
// `preview` is the start; `edit` is the field being edited. Both are
// reachable from a seed, and both are reachable from the events below.

test("Given a fresh editable / When nothing is authored / Then preview is the reachable start state", () => {
  const h = mount();
  deepStrictEqual(h.state(), "preview", "the field starts in preview");
  deepStrictEqual(h.api.editing, false, "the api reports not editing");
  deepStrictEqual(h.api.value, "", "the value is empty");
  deepStrictEqual(h.api.empty, true, "an empty value is empty");
  deepStrictEqual(h.api.valueText, "", "an empty value has no text");
  deepStrictEqual(h.valueChanges, [], "seeding reports nothing");
  deepStrictEqual(h.editChanges, [], "no edit change is reported");
});

test("Given defaultValue and placeholder / When the editable mounts / Then the seed is the start state", () => {
  const h = mount({ defaultValue: "Ada" });
  deepStrictEqual(h.api.value, "Ada", "defaultValue seeds the value");
  deepStrictEqual(h.api.empty, false, "a seeded value is not empty");
  deepStrictEqual(h.api.valueText, "Ada", "the value is its own text");
  deepStrictEqual(h.valueChanges, [], "seeding reports nothing");

  const blank = mount({ placeholder: "Type here" });
  deepStrictEqual(blank.api.valueText, "Type here", "a blank value shows the placeholder");
  deepStrictEqual(blank.bag("preview")["data-placeholder-shown"], "", "the preview reports the placeholder");
  deepStrictEqual(blank.api.empty, true, "a placeholder does not count as a value");
});

test("Given defaultEdit / When the editable mounts / Then edit is the reachable start state", () => {
  const h = mount({ defaultValue: "Ada", defaultEdit: true });
  deepStrictEqual(h.state(), "edit", "the field starts in edit");
  deepStrictEqual(h.api.editing, true, "the api reports editing");
  deepStrictEqual(h.editChanges, [], "opening in edit mode reports nothing");
});

test("Given an authored value / When the editable mounts / Then it seeds the value", () => {
  const h = mount({ value: "Grace" });
  deepStrictEqual(h.api.value, "Grace", "the authored value seeds the field");
  deepStrictEqual(h.valueChanges, [], "seeding reports nothing");
});

test("Given an authored edit / When the editable mounts / Then edit is the start state", () => {
  const h = mount({ editing: true });
  deepStrictEqual(h.state(), "edit", "the authored edit opens the field");
});

// ---- preview: EDIT, CONTROLLED.EDIT --------------------------------------

test("Given a previewing field / When EDIT arrives / Then the edit state is reachable", () => {
  const h = mount({ defaultValue: "Ada" });
  h.trigger("edit");
  deepStrictEqual(h.state(), "edit", "the edit trigger opens the field");
  deepStrictEqual(h.editChanges, [true], "edit-change reports the open");
  deepStrictEqual(h.valueChanges, [], "opening changes no value");
});

test("Given a previewing field / When the preview is activated / Then each activation mode behaves", () => {
  const focus = mount({ defaultValue: "Ada" });
  focus.activatePreview("focus");
  deepStrictEqual(focus.state(), "edit", "the default mode opens on focus");
  deepStrictEqual(focus.editChanges, [true], "and reports it");

  const click = mount({ defaultValue: "Ada", activationMode: "click" });
  click.activatePreview("focus");
  deepStrictEqual(click.state(), "preview", "a click-mode field ignores a focus");
  click.activatePreview("click");
  deepStrictEqual(click.state(), "edit", "and opens on a click");

  const dbl = mount({ defaultValue: "Ada", activationMode: "dblclick" });
  dbl.activatePreview("click");
  deepStrictEqual(dbl.state(), "preview", "a dblclick-mode field ignores a click");
  dbl.activatePreview("dblclick");
  deepStrictEqual(dbl.state(), "edit", "and opens on a double click");

  const none = mount({ defaultValue: "Ada", activationMode: "none" });
  none.activatePreview("focus");
  none.activatePreview("click");
  none.activatePreview("dblclick");
  deepStrictEqual(none.state(), "preview", "a none-mode field never opens from the preview");
});

test("Given a previewing field / When the preview takes a key / Then Enter and Space open it", () => {
  const h = mount({ defaultValue: "Ada" });
  handler<(event: KeyboardEvent) => void>(h.bag("preview"), "onKeydown")(keydown("Enter"));
  deepStrictEqual(h.state(), "edit", "Enter opens the field");
  deepStrictEqual(h.editChanges, [true], "and reports it");

  const other = mount();
  handler<(event: KeyboardEvent) => void>(other.bag("preview"), "onKeydown")(keydown("a"));
  deepStrictEqual(other.state(), "preview", "a printable key does not open the field");
});

test("Given a controlled edit / When EDIT arrives / Then the machine reports and waits", () => {
  const h = mount({ defaultValue: "Ada", editing: false });
  h.trigger("edit");
  deepStrictEqual(h.state(), "preview", "the controlled field does not move on its own");
  deepStrictEqual(h.editChanges, [true], "but it reports the open");
  h.write("editing", true);
  deepStrictEqual(h.state(), "edit", "the host's own write opens it");
  deepStrictEqual(h.editChanges, [true], "and reports nothing a second time");
});

test("Given a controlled edit / When CONTROLLED.EDIT arrives / Then the edit state is reachable", () => {
  const h = mount({ defaultValue: "Ada", editing: true });
  deepStrictEqual(h.state(), "edit", "the authored edit is the start state");
  h.write("editing", false);
  h.write("editing", true);
  deepStrictEqual(h.state(), "edit", "the host's write brings it back");
  deepStrictEqual(h.editChanges, [], "a controlled close reports nothing");
});

test("Given a disabled field / When the triggers are pressed / Then nothing opens", () => {
  const disabled = mount({ defaultValue: "Ada", disabled: true });
  disabled.trigger("edit");
  disabled.activatePreview("focus");
  deepStrictEqual(disabled.state(), "preview", "a disabled field stays in preview");
  deepStrictEqual(disabled.editChanges, [], "and reports nothing");
  deepStrictEqual(disabled.bag("edit")["aria-label"], "edit", "the trigger still carries its label");
  deepStrictEqual(disabled.bag("input")["disabled"], true, "the input is disabled");

  const readOnly = mount({ defaultValue: "Ada", readOnly: true });
  readOnly.trigger("edit");
  readOnly.activatePreview("click");
  deepStrictEqual(readOnly.state(), "preview", "a read-only field stays in preview");
  deepStrictEqual(readOnly.bag("preview")["aria-readonly"], true, "and announces read-only");
});

test("Given a previewing field / When the host sets the value / Then the value follows", () => {
  const h = mount();
  h.api.setValue("Lin");
  deepStrictEqual(h.api.value, "Lin", "setValue moves the value");
  deepStrictEqual(h.valueChanges, ["Lin"], "and reports it");
  h.api.clearValue();
  deepStrictEqual(h.api.value, "", "clearValue empties the field");
  deepStrictEqual(h.valueChanges, ["Lin", ""], "and reports the clear");
  h.api.setValue("");
  deepStrictEqual(h.valueChanges, ["Lin", ""], "an unchanged value reports nothing");
});

// ---- edit: SUBMIT --------------------------------------------------------

test("Given an editing field / When SUBMIT arrives / Then preview is reachable again and the value commits", () => {
  const h = mount({ defaultValue: "Ada" });
  h.trigger("edit");
  h.type("Grace");
  h.trigger("submit");
  deepStrictEqual(h.state(), "preview", "the submit trigger closes the field");
  deepStrictEqual(h.api.value, "Grace", "the typed value is kept");
  deepStrictEqual(h.valueChanges, ["Grace"], "the value change was reported once");
  deepStrictEqual(h.commits, ["Grace"], "value-commit reports the committed value");
  deepStrictEqual(h.reverts, [], "nothing reverts on a submit");
  deepStrictEqual(h.editChanges, [true, false], "edit-change reports the open and the close");
});

test("Given an editing field / When Enter is pressed / Then the value commits", () => {
  const h = mount({ defaultValue: "Ada" });
  h.trigger("edit");
  h.type("Grace");
  h.press("Enter");
  deepStrictEqual(h.state(), "preview", "Enter closes the field");
  deepStrictEqual(h.commits, ["Grace"], "and commits the value");
});

test("Given an editing field / When Enter is pressed with submitMode none or blur / Then nothing submits", () => {
  const none = mount({ defaultValue: "Ada", submitMode: "none" });
  none.trigger("edit");
  none.press("Enter");
  deepStrictEqual(none.state(), "edit", "a none submit mode ignores Enter");
  deepStrictEqual(none.commits, [], "and commits nothing");

  const blurOnly = mount({ defaultValue: "Ada", submitMode: "blur" });
  blurOnly.trigger("edit");
  blurOnly.press("Enter");
  deepStrictEqual(blurOnly.state(), "edit", "a blur submit mode ignores Enter");
  deepStrictEqual(blurOnly.commits, [], "and commits nothing");
});

test("Given an editing field / When Enter is pressed with a modifier / Then it does not submit", () => {
  const h = mount({ defaultValue: "Ada" });
  h.trigger("edit");
  h.press("Enter", { shift: true });
  h.press("Enter", { meta: true });
  deepStrictEqual(h.state(), "edit", "a modified Enter leaves the field open");
  deepStrictEqual(h.commits, [], "and commits nothing");
});

test("Given an editing field with an IME in flight / When Enter is pressed / Then it does not submit", () => {
  const h = mount({ defaultValue: "Ada" });
  h.trigger("edit");
  h.press("Enter", { composing: true });
  deepStrictEqual(h.state(), "edit", "a composing Enter leaves the field open");
  deepStrictEqual(h.commits, [], "and commits nothing");
});

test("Given an editing field / When the api submits / Then the value commits", () => {
  const h = mount({ defaultValue: "Ada" });
  h.trigger("edit");
  h.type("Grace");
  h.api.submit();
  deepStrictEqual(h.state(), "preview", "the host may submit");
  deepStrictEqual(h.commits, ["Grace"], "and the value commits");
});

// ---- edit: CANCEL --------------------------------------------------------

test("Given an editing field / When CANCEL arrives / Then the value reverts", () => {
  const h = mount({ defaultValue: "Ada" });
  h.trigger("edit");
  h.type("Grace");
  h.trigger("cancel");
  deepStrictEqual(h.state(), "preview", "the cancel trigger closes the field");
  deepStrictEqual(h.api.value, "Ada", "the typed value is discarded");
  deepStrictEqual(h.valueChanges, ["Grace", "Ada"], "the restore is reported");
  deepStrictEqual(h.reverts, ["Ada"], "value-revert reports the restored value");
  deepStrictEqual(h.commits, [], "nothing commits on a cancel");
  deepStrictEqual(h.editChanges, [true, false], "edit-change reports both moves");
});

test("Given an editing field / When Escape is pressed / Then the value reverts", () => {
  const h = mount({ defaultValue: "Ada" });
  h.trigger("edit");
  h.type("Grace");
  h.press("Escape");
  deepStrictEqual(h.state(), "preview", "Escape closes the field");
  deepStrictEqual(h.reverts, ["Ada"], "and reverts the value");
});

test("Given an editing field that started blank / When CANCEL arrives / Then the typed text stays", () => {
  // The revert restores the previous value only when it is not empty, so a
  // field that opened blank keeps what was typed into it.
  const h = mount();
  h.trigger("edit");
  h.type("Grace");
  h.trigger("cancel");
  deepStrictEqual(h.state(), "preview", "the field closes");
  deepStrictEqual(h.api.value, "Grace", "the typed text stays");
  deepStrictEqual(h.reverts, [""], "and the revert reports the empty previous value");
});

test("Given an editing field / When the focus or the pointer leaves / Then the submit mode decides", () => {
  const both = mount({ defaultValue: "Ada", submitMode: "both" });
  both.trigger("edit");
  both.type("Grace");
  both.focusOutside(true);
  deepStrictEqual(both.state(), "preview", "a focus outside closes the field");
  deepStrictEqual(both.commits, ["Grace"], "and commits it");
  deepStrictEqual(both.outside.focus, 1, "onFocusOutside reports once");
  deepStrictEqual(both.outside.interact, 1, "onInteractOutside reports once");

  const blur = mount({ defaultValue: "Ada", submitMode: "blur" });
  blur.trigger("edit");
  blur.type("Grace");
  blur.pointerOutside(false);
  deepStrictEqual(blur.state(), "preview", "a pointer outside closes the field");
  deepStrictEqual(blur.commits, ["Grace"], "and commits it");
  deepStrictEqual(blur.outside.pointer, 1, "onPointerDownOutside reports once");

  const enterOnly = mount({ defaultValue: "Ada", submitMode: "enter" });
  enterOnly.trigger("edit");
  enterOnly.type("Grace");
  enterOnly.focusOutside(false);
  deepStrictEqual(enterOnly.state(), "preview", "an outside interaction still closes the field");
  deepStrictEqual(enterOnly.reverts, ["Ada"], "and reverts it, because only Enter submits");
});

test("Given an editing field / When the host vetoes the outside report / Then nothing moves", () => {
  const h = mount({ defaultValue: "Ada" });
  h.trigger("edit");
  h.type("Grace");
  h.vetoedFocusOutside();
  deepStrictEqual(h.state(), "edit", "a vetoed report leaves the field open");
  deepStrictEqual(h.commits, [], "and commits nothing");
  deepStrictEqual(h.reverts, [], "and reverts nothing");
  // The report reaches the host before the veto is read, the way the
  // callAll of the two callbacks works.
  deepStrictEqual(h.outside.focus, 1, "onFocusOutside still reports");
  deepStrictEqual(h.outside.interact, 1, "onInteractOutside still reports");
});

test("Given a previewing field / When an outside report arrives / Then it is inert", () => {
  const h = mount({ defaultValue: "Ada" });
  h.focusOutside(false);
  h.pointerOutside(false);
  deepStrictEqual(h.state(), "preview", "the field stays in preview");
  deepStrictEqual(h.editChanges, [], "and reports nothing");
});

// ---- the value in edit ---------------------------------------------------

test("Given an editing field / When the value is typed / Then the bag carries it and reports it", () => {
  const h = mount({ defaultValue: "Ada" });
  h.trigger("edit");
  h.type("Gra");
  deepStrictEqual(h.api.value, "Gra", "the machine holds the typed value");
  deepStrictEqual(h.bag("input")["value"], "Gra", "the bag carries it for the platform's setter");
  deepStrictEqual(h.valueChanges, ["Gra"], "and reports it once");
  h.type("Grace");
  deepStrictEqual(h.valueChanges, ["Gra", "Grace"], "each keystroke reports");
});

test("Given an editing field with a maxLength / When a longer value arrives / Then it is capped", () => {
  const h = mount({ maxLength: 4 });
  h.trigger("edit");
  h.type("Grace Hopper");
  deepStrictEqual(h.api.value, "Grac", "the value is capped at the max length");
  deepStrictEqual(h.bag("input")["maxLength"], 4, "the input carries the cap");
  deepStrictEqual(h.valueChanges, ["Grac"], "and reports the capped value");
});

test("Given an editing field / When the value is set while editing / Then it follows the host", () => {
  const h = mount({ defaultValue: "Ada" });
  h.trigger("edit");
  h.api.setValue("Lin");
  deepStrictEqual(h.api.value, "Lin", "the host's setValue reaches the field");
  h.trigger("submit");
  deepStrictEqual(h.commits, ["Lin"], "and the new value commits");
});

// ---- the controlled channel ----------------------------------------------

test("Given a controlled edit / When SUBMIT arrives / Then the host owns the close and the value commits after", () => {
  const h = mount({ defaultValue: "Ada", editing: true });
  h.type("Grace");
  h.trigger("submit");
  deepStrictEqual(h.state(), "edit", "the controlled field stays open");
  deepStrictEqual(h.editChanges, [false], "but it reports the close asked for");
  deepStrictEqual(h.commits, [], "and commits nothing yet");
  h.write("editing", false);
  deepStrictEqual(h.state(), "preview", "the host's write closes the field");
  deepStrictEqual(h.commits, ["Grace"], "and the value commits");
  deepStrictEqual(h.editChanges, [false], "with no second close report");
  deepStrictEqual(h.valueChanges, ["Grace"], "and no second value report");
});

test("Given a controlled edit / When CANCEL arrives / Then the value reverts after the host closes it", () => {
  const h = mount({ defaultValue: "Ada", editing: false });
  h.trigger("edit");
  deepStrictEqual(h.editChanges, [true], "the open is reported");
  h.write("editing", true);
  deepStrictEqual(h.state(), "edit", "the host opens the field");
  h.type("Grace");
  h.trigger("cancel");
  deepStrictEqual(h.state(), "edit", "the controlled field stays open");
  deepStrictEqual(h.editChanges, [true, false], "and reports the close asked for");
  h.write("editing", false);
  deepStrictEqual(h.state(), "preview", "the host's write closes the field");
  deepStrictEqual(h.api.value, "Ada", "and the value reverts");
  deepStrictEqual(h.reverts, ["Ada"], "with the revert reported once");
});

test("Given a controlled value / When the host writes it / Then the machine follows", () => {
  const h = mount({ value: "Ada" });
  h.write("value", "Grace");
  deepStrictEqual(h.api.value, "Grace", "the authored value moves the machine");
  deepStrictEqual(h.valueChanges, ["Grace"], "and reports the change");
  h.api.setValue("Lin");
  deepStrictEqual(h.api.value, "Lin", "the field's own move lands");
  h.write("value", "Ada");
  deepStrictEqual(h.api.value, "Ada", "the host's next write wins over the field");
  deepStrictEqual(h.valueChanges, ["Grace", "Lin", "Ada"], "and each move reports");
});

test("Given a controlled edit / When the host writes it while the field is closed / Then nothing moves", () => {
  const h = mount({ editing: false });
  h.write("editing", false);
  deepStrictEqual(h.state(), "preview", "the field stays in preview");
  deepStrictEqual(h.editChanges, [], "and reports nothing");
});

// ---- the parts -----------------------------------------------------------

test("Given an editable / When the parts are read / Then each carries its contract", () => {
  const h = mount({ defaultValue: "Ada", label: "Name" });
  deepStrictEqual(h.bag("root")["id"], "editable:harness", "the root is namespaced");
  deepStrictEqual(h.bag("area")["id"], "editable:harness:area", "the area is namespaced");
  deepStrictEqual(h.bag("label")["for"], "editable:harness:input", "the label points at the input");
  deepStrictEqual(h.bag("input")["id"], "editable:harness:input", "the input is namespaced");
  deepStrictEqual(h.bag("preview")["id"], "editable:harness:preview", "the preview is namespaced");
  deepStrictEqual(h.bag("control")["id"], "editable:harness:control", "the control is namespaced");
  deepStrictEqual(h.bag("edit")["id"], "editable:harness:edit", "the edit trigger is namespaced");
  deepStrictEqual(h.bag("submit")["id"], "editable:harness:submit", "the submit trigger is namespaced");
  deepStrictEqual(h.bag("cancel")["id"], "editable:harness:cancel", "the cancel trigger is namespaced");
  deepStrictEqual(h.bag("input")["aria-label"], "editable input", "the input is labelled");
  deepStrictEqual(h.bag("preview")["aria-label"], "edit", "the preview is labelled");
  deepStrictEqual(h.bag("submit")["aria-label"], "submit", "the submit trigger is labelled");
  deepStrictEqual(h.bag("cancel")["aria-label"], "cancel", "the cancel trigger is labelled");
  deepStrictEqual(h.bag("input")["name"], undefined, "an unnamed field submits nothing");
  deepStrictEqual(h.bag("preview")["tabIndex"], 0, "an interactive preview is a tab stop");
});

test("Given an editable / When the state moves / Then the parts report it", () => {
  const h = mount({ defaultValue: "Ada" });
  deepStrictEqual(h.bag("area")["data-state"], "preview", "the area reports the preview state");
  deepStrictEqual(h.bag("input")["data-hidden"], "", "the input leaves the layout while previewing");
  deepStrictEqual(h.bag("preview")["data-hidden"], undefined, "and the preview holds it");
  h.trigger("edit");
  deepStrictEqual(h.bag("area")["data-state"], "edit", "the area reports the edit state");
  deepStrictEqual(h.bag("area")["data-focus"], "", "the area reports the focus");
  deepStrictEqual(h.bag("input")["data-hidden"], undefined, "the input takes the layout");
  deepStrictEqual(h.bag("preview")["data-hidden"], "", "and the preview leaves it");
});

test("Given an auto-resizing editable / When the state moves / Then both parts stay in the layout", () => {
  const h = mount({ defaultValue: "Ada", autoResize: true });
  deepStrictEqual(h.bag("area")["data-autoresize"], "", "the area reports the stack");
  deepStrictEqual(h.bag("input")["data-hidden"], undefined, "the input never leaves the layout");
  deepStrictEqual(h.bag("input")["size"], 1, "and is content-sized");
  deepStrictEqual(h.bag("preview")["data-hidden"], undefined, "the preview never leaves it either");
  h.trigger("edit");
  deepStrictEqual(h.bag("input")["data-hidden"], undefined, "opening keeps the input in the layout");
  deepStrictEqual(h.bag("preview")["data-hidden"], undefined, "and keeps the preview sizing the box");
});

test("Given an editable with a part id to focus / When it closes / Then the api still reports the state", () => {
  const h = mount({ defaultValue: "Ada", finalFocus: "elsewhere" });
  h.trigger("edit");
  h.trigger("cancel");
  deepStrictEqual(h.state(), "preview", "the field closes");
  deepStrictEqual(h.api.value, "Ada", "and reverts");
});

// ---- two instances -------------------------------------------------------

test("Given two editables on one page / When each is driven / Then their contexts stay independent", () => {
  const first = mount({ defaultValue: "Ada" });
  const second = mount({ defaultValue: "Grace" });
  first.trigger("edit");
  first.type("Lin");
  deepStrictEqual(second.state(), "preview", "the second field is untouched");
  deepStrictEqual(second.api.value, "Grace", "and keeps its own value");
  deepStrictEqual(second.valueChanges, [], "and reports nothing");
  second.trigger("edit");
  deepStrictEqual(first.state(), "edit", "the first field is still editing");
  deepStrictEqual(second.editChanges, [true], "the second field reports its own open");
  second.trigger("submit");
  deepStrictEqual(first.api.value, "Lin", "the first field keeps its typed value");
  deepStrictEqual(first.commits, [], "and has committed nothing");
  deepStrictEqual(second.commits, ["Grace"], "while the second field commits its own value");
});

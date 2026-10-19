import { assertEquals } from "@std/assert";
import { parseHTML } from "@spin/runtime/testing";
import { signal } from "@spin/runtime";
import { editable } from "./editable.bindings.ts";
const createEditableBridge = editable.createBridge;
import type { EditableEditChange, EditableValueChange } from "./editable.bindings.ts";
import type { EditableApi } from "./editable.bindings.ts";
import type { InteractOutsideEvent } from "./actions/interact-outside.action.ts";

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

Deno.test("Given a fresh editable / When nothing is authored / Then preview is the reachable start state", () => {
  const h = mount();
  assertEquals(h.state(), "preview", "the field starts in preview");
  assertEquals(h.api.editing, false, "the api reports not editing");
  assertEquals(h.api.value, "", "the value is empty");
  assertEquals(h.api.empty, true, "an empty value is empty");
  assertEquals(h.api.valueText, "", "an empty value has no text");
  assertEquals(h.valueChanges, [], "seeding reports nothing");
  assertEquals(h.editChanges, [], "no edit change is reported");
});

Deno.test("Given defaultValue and placeholder / When the editable mounts / Then the seed is the start state", () => {
  const h = mount({ defaultValue: "Ada" });
  assertEquals(h.api.value, "Ada", "defaultValue seeds the value");
  assertEquals(h.api.empty, false, "a seeded value is not empty");
  assertEquals(h.api.valueText, "Ada", "the value is its own text");
  assertEquals(h.valueChanges, [], "seeding reports nothing");

  const blank = mount({ placeholder: "Type here" });
  assertEquals(blank.api.valueText, "Type here", "a blank value shows the placeholder");
  assertEquals(blank.bag("preview")["data-placeholder-shown"], "", "the preview reports the placeholder");
  assertEquals(blank.api.empty, true, "a placeholder does not count as a value");
});

Deno.test("Given defaultEdit / When the editable mounts / Then edit is the reachable start state", () => {
  const h = mount({ defaultValue: "Ada", defaultEdit: true });
  assertEquals(h.state(), "edit", "the field starts in edit");
  assertEquals(h.api.editing, true, "the api reports editing");
  assertEquals(h.editChanges, [], "opening in edit mode reports nothing");
});

Deno.test("Given an authored value / When the editable mounts / Then it seeds the value", () => {
  const h = mount({ value: "Grace" });
  assertEquals(h.api.value, "Grace", "the authored value seeds the field");
  assertEquals(h.valueChanges, [], "seeding reports nothing");
});

Deno.test("Given an authored edit / When the editable mounts / Then edit is the start state", () => {
  const h = mount({ editing: true });
  assertEquals(h.state(), "edit", "the authored edit opens the field");
});

// ---- preview: EDIT, CONTROLLED.EDIT --------------------------------------

Deno.test("Given a previewing field / When EDIT arrives / Then the edit state is reachable", () => {
  const h = mount({ defaultValue: "Ada" });
  h.trigger("edit");
  assertEquals(h.state(), "edit", "the edit trigger opens the field");
  assertEquals(h.editChanges, [true], "edit-change reports the open");
  assertEquals(h.valueChanges, [], "opening changes no value");
});

Deno.test("Given a previewing field / When the preview is activated / Then each activation mode behaves", () => {
  const focus = mount({ defaultValue: "Ada" });
  focus.activatePreview("focus");
  assertEquals(focus.state(), "edit", "the default mode opens on focus");
  assertEquals(focus.editChanges, [true], "and reports it");

  const click = mount({ defaultValue: "Ada", activationMode: "click" });
  click.activatePreview("focus");
  assertEquals(click.state(), "preview", "a click-mode field ignores a focus");
  click.activatePreview("click");
  assertEquals(click.state(), "edit", "and opens on a click");

  const dbl = mount({ defaultValue: "Ada", activationMode: "dblclick" });
  dbl.activatePreview("click");
  assertEquals(dbl.state(), "preview", "a dblclick-mode field ignores a click");
  dbl.activatePreview("dblclick");
  assertEquals(dbl.state(), "edit", "and opens on a double click");

  const none = mount({ defaultValue: "Ada", activationMode: "none" });
  none.activatePreview("focus");
  none.activatePreview("click");
  none.activatePreview("dblclick");
  assertEquals(none.state(), "preview", "a none-mode field never opens from the preview");
});

Deno.test("Given a previewing field / When the preview takes a key / Then Enter and Space open it", () => {
  const h = mount({ defaultValue: "Ada" });
  handler<(event: KeyboardEvent) => void>(h.bag("preview"), "onKeydown")(keydown("Enter"));
  assertEquals(h.state(), "edit", "Enter opens the field");
  assertEquals(h.editChanges, [true], "and reports it");

  const other = mount();
  handler<(event: KeyboardEvent) => void>(other.bag("preview"), "onKeydown")(keydown("a"));
  assertEquals(other.state(), "preview", "a printable key does not open the field");
});

Deno.test("Given a controlled edit / When EDIT arrives / Then the machine reports and waits", () => {
  const h = mount({ defaultValue: "Ada", editing: false });
  h.trigger("edit");
  assertEquals(h.state(), "preview", "the controlled field does not move on its own");
  assertEquals(h.editChanges, [true], "but it reports the open");
  h.write("editing", true);
  assertEquals(h.state(), "edit", "the host's own write opens it");
  assertEquals(h.editChanges, [true], "and reports nothing a second time");
});

Deno.test("Given a controlled edit / When CONTROLLED.EDIT arrives / Then the edit state is reachable", () => {
  const h = mount({ defaultValue: "Ada", editing: true });
  assertEquals(h.state(), "edit", "the authored edit is the start state");
  h.write("editing", false);
  h.write("editing", true);
  assertEquals(h.state(), "edit", "the host's write brings it back");
  assertEquals(h.editChanges, [], "a controlled close reports nothing");
});

Deno.test("Given a disabled field / When the triggers are pressed / Then nothing opens", () => {
  const disabled = mount({ defaultValue: "Ada", disabled: true });
  disabled.trigger("edit");
  disabled.activatePreview("focus");
  assertEquals(disabled.state(), "preview", "a disabled field stays in preview");
  assertEquals(disabled.editChanges, [], "and reports nothing");
  assertEquals(disabled.bag("edit")["aria-label"], "edit", "the trigger still carries its label");
  assertEquals(disabled.bag("input")["disabled"], true, "the input is disabled");

  const readOnly = mount({ defaultValue: "Ada", readOnly: true });
  readOnly.trigger("edit");
  readOnly.activatePreview("click");
  assertEquals(readOnly.state(), "preview", "a read-only field stays in preview");
  assertEquals(readOnly.bag("preview")["aria-readonly"], true, "and announces read-only");
});

Deno.test("Given a previewing field / When the host sets the value / Then the value follows", () => {
  const h = mount();
  h.api.setValue("Lin");
  assertEquals(h.api.value, "Lin", "setValue moves the value");
  assertEquals(h.valueChanges, ["Lin"], "and reports it");
  h.api.clearValue();
  assertEquals(h.api.value, "", "clearValue empties the field");
  assertEquals(h.valueChanges, ["Lin", ""], "and reports the clear");
  h.api.setValue("");
  assertEquals(h.valueChanges, ["Lin", ""], "an unchanged value reports nothing");
});

// ---- edit: SUBMIT --------------------------------------------------------

Deno.test("Given an editing field / When SUBMIT arrives / Then preview is reachable again and the value commits", () => {
  const h = mount({ defaultValue: "Ada" });
  h.trigger("edit");
  h.type("Grace");
  h.trigger("submit");
  assertEquals(h.state(), "preview", "the submit trigger closes the field");
  assertEquals(h.api.value, "Grace", "the typed value is kept");
  assertEquals(h.valueChanges, ["Grace"], "the value change was reported once");
  assertEquals(h.commits, ["Grace"], "value-commit reports the committed value");
  assertEquals(h.reverts, [], "nothing reverts on a submit");
  assertEquals(h.editChanges, [true, false], "edit-change reports the open and the close");
});

Deno.test("Given an editing field / When Enter is pressed / Then the value commits", () => {
  const h = mount({ defaultValue: "Ada" });
  h.trigger("edit");
  h.type("Grace");
  h.press("Enter");
  assertEquals(h.state(), "preview", "Enter closes the field");
  assertEquals(h.commits, ["Grace"], "and commits the value");
});

Deno.test("Given an editing field / When Enter is pressed with submitMode none or blur / Then nothing submits", () => {
  const none = mount({ defaultValue: "Ada", submitMode: "none" });
  none.trigger("edit");
  none.press("Enter");
  assertEquals(none.state(), "edit", "a none submit mode ignores Enter");
  assertEquals(none.commits, [], "and commits nothing");

  const blurOnly = mount({ defaultValue: "Ada", submitMode: "blur" });
  blurOnly.trigger("edit");
  blurOnly.press("Enter");
  assertEquals(blurOnly.state(), "edit", "a blur submit mode ignores Enter");
  assertEquals(blurOnly.commits, [], "and commits nothing");
});

Deno.test("Given an editing field / When Enter is pressed with a modifier / Then it does not submit", () => {
  const h = mount({ defaultValue: "Ada" });
  h.trigger("edit");
  h.press("Enter", { shift: true });
  h.press("Enter", { meta: true });
  assertEquals(h.state(), "edit", "a modified Enter leaves the field open");
  assertEquals(h.commits, [], "and commits nothing");
});

Deno.test("Given an editing field with an IME in flight / When Enter is pressed / Then it does not submit", () => {
  const h = mount({ defaultValue: "Ada" });
  h.trigger("edit");
  h.press("Enter", { composing: true });
  assertEquals(h.state(), "edit", "a composing Enter leaves the field open");
  assertEquals(h.commits, [], "and commits nothing");
});

Deno.test("Given an editing field / When the api submits / Then the value commits", () => {
  const h = mount({ defaultValue: "Ada" });
  h.trigger("edit");
  h.type("Grace");
  h.api.submit();
  assertEquals(h.state(), "preview", "the host may submit");
  assertEquals(h.commits, ["Grace"], "and the value commits");
});

// ---- edit: CANCEL --------------------------------------------------------

Deno.test("Given an editing field / When CANCEL arrives / Then the value reverts", () => {
  const h = mount({ defaultValue: "Ada" });
  h.trigger("edit");
  h.type("Grace");
  h.trigger("cancel");
  assertEquals(h.state(), "preview", "the cancel trigger closes the field");
  assertEquals(h.api.value, "Ada", "the typed value is discarded");
  assertEquals(h.valueChanges, ["Grace", "Ada"], "the restore is reported");
  assertEquals(h.reverts, ["Ada"], "value-revert reports the restored value");
  assertEquals(h.commits, [], "nothing commits on a cancel");
  assertEquals(h.editChanges, [true, false], "edit-change reports both moves");
});

Deno.test("Given an editing field / When Escape is pressed / Then the value reverts", () => {
  const h = mount({ defaultValue: "Ada" });
  h.trigger("edit");
  h.type("Grace");
  h.press("Escape");
  assertEquals(h.state(), "preview", "Escape closes the field");
  assertEquals(h.reverts, ["Ada"], "and reverts the value");
});

Deno.test("Given an editing field that started blank / When CANCEL arrives / Then the typed text stays", () => {
  // Zag's revert restores the previous value only when it is not empty, so a
  // field that opened blank keeps what was typed into it.
  const h = mount();
  h.trigger("edit");
  h.type("Grace");
  h.trigger("cancel");
  assertEquals(h.state(), "preview", "the field closes");
  assertEquals(h.api.value, "Grace", "the typed text stays");
  assertEquals(h.reverts, [""], "and the revert reports the empty previous value");
});

Deno.test("Given an editing field / When the focus or the pointer leaves / Then the submit mode decides", () => {
  const both = mount({ defaultValue: "Ada", submitMode: "both" });
  both.trigger("edit");
  both.type("Grace");
  both.focusOutside(true);
  assertEquals(both.state(), "preview", "a focus outside closes the field");
  assertEquals(both.commits, ["Grace"], "and commits it");
  assertEquals(both.outside.focus, 1, "onFocusOutside reports once");
  assertEquals(both.outside.interact, 1, "onInteractOutside reports once");

  const blur = mount({ defaultValue: "Ada", submitMode: "blur" });
  blur.trigger("edit");
  blur.type("Grace");
  blur.pointerOutside(false);
  assertEquals(blur.state(), "preview", "a pointer outside closes the field");
  assertEquals(blur.commits, ["Grace"], "and commits it");
  assertEquals(blur.outside.pointer, 1, "onPointerDownOutside reports once");

  const enterOnly = mount({ defaultValue: "Ada", submitMode: "enter" });
  enterOnly.trigger("edit");
  enterOnly.type("Grace");
  enterOnly.focusOutside(false);
  assertEquals(enterOnly.state(), "preview", "an outside interaction still closes the field");
  assertEquals(enterOnly.reverts, ["Ada"], "and reverts it, because only Enter submits");
});

Deno.test("Given an editing field / When the host vetoes the outside report / Then nothing moves", () => {
  const h = mount({ defaultValue: "Ada" });
  h.trigger("edit");
  h.type("Grace");
  h.vetoedFocusOutside();
  assertEquals(h.state(), "edit", "a vetoed report leaves the field open");
  assertEquals(h.commits, [], "and commits nothing");
  assertEquals(h.reverts, [], "and reverts nothing");
  // The report reaches the host before the veto is read, the way Zag's
  // callAll of the two callbacks works.
  assertEquals(h.outside.focus, 1, "onFocusOutside still reports");
  assertEquals(h.outside.interact, 1, "onInteractOutside still reports");
});

Deno.test("Given a previewing field / When an outside report arrives / Then it is inert", () => {
  const h = mount({ defaultValue: "Ada" });
  h.focusOutside(false);
  h.pointerOutside(false);
  assertEquals(h.state(), "preview", "the field stays in preview");
  assertEquals(h.editChanges, [], "and reports nothing");
});

// ---- the value in edit ---------------------------------------------------

Deno.test("Given an editing field / When the value is typed / Then the bag carries it and reports it", () => {
  const h = mount({ defaultValue: "Ada" });
  h.trigger("edit");
  h.type("Gra");
  assertEquals(h.api.value, "Gra", "the machine holds the typed value");
  assertEquals(h.bag("input")["value"], "Gra", "the bag carries it for the platform's setter");
  assertEquals(h.valueChanges, ["Gra"], "and reports it once");
  h.type("Grace");
  assertEquals(h.valueChanges, ["Gra", "Grace"], "each keystroke reports");
});

Deno.test("Given an editing field with a maxLength / When a longer value arrives / Then it is capped", () => {
  const h = mount({ maxLength: 4 });
  h.trigger("edit");
  h.type("Grace Hopper");
  assertEquals(h.api.value, "Grac", "the value is capped at the max length");
  assertEquals(h.bag("input")["maxLength"], 4, "the input carries the cap");
  assertEquals(h.valueChanges, ["Grac"], "and reports the capped value");
});

Deno.test("Given an editing field / When the value is set while editing / Then it follows the host", () => {
  const h = mount({ defaultValue: "Ada" });
  h.trigger("edit");
  h.api.setValue("Lin");
  assertEquals(h.api.value, "Lin", "the host's setValue reaches the field");
  h.trigger("submit");
  assertEquals(h.commits, ["Lin"], "and the new value commits");
});

// ---- the controlled channel ----------------------------------------------

Deno.test("Given a controlled edit / When SUBMIT arrives / Then the host owns the close and the value commits after", () => {
  const h = mount({ defaultValue: "Ada", editing: true });
  h.type("Grace");
  h.trigger("submit");
  assertEquals(h.state(), "edit", "the controlled field stays open");
  assertEquals(h.editChanges, [false], "but it reports the close asked for");
  assertEquals(h.commits, [], "and commits nothing yet");
  h.write("editing", false);
  assertEquals(h.state(), "preview", "the host's write closes the field");
  assertEquals(h.commits, ["Grace"], "and the value commits");
  assertEquals(h.editChanges, [false], "with no second close report");
  assertEquals(h.valueChanges, ["Grace"], "and no second value report");
});

Deno.test("Given a controlled edit / When CANCEL arrives / Then the value reverts after the host closes it", () => {
  const h = mount({ defaultValue: "Ada", editing: false });
  h.trigger("edit");
  assertEquals(h.editChanges, [true], "the open is reported");
  h.write("editing", true);
  assertEquals(h.state(), "edit", "the host opens the field");
  h.type("Grace");
  h.trigger("cancel");
  assertEquals(h.state(), "edit", "the controlled field stays open");
  assertEquals(h.editChanges, [true, false], "and reports the close asked for");
  h.write("editing", false);
  assertEquals(h.state(), "preview", "the host's write closes the field");
  assertEquals(h.api.value, "Ada", "and the value reverts");
  assertEquals(h.reverts, ["Ada"], "with the revert reported once");
});

Deno.test("Given a controlled value / When the host writes it / Then the machine follows", () => {
  const h = mount({ value: "Ada" });
  h.write("value", "Grace");
  assertEquals(h.api.value, "Grace", "the authored value moves the machine");
  assertEquals(h.valueChanges, ["Grace"], "and reports the change");
  h.api.setValue("Lin");
  assertEquals(h.api.value, "Lin", "the field's own move lands");
  h.write("value", "Ada");
  assertEquals(h.api.value, "Ada", "the host's next write wins over the field");
  assertEquals(h.valueChanges, ["Grace", "Lin", "Ada"], "and each move reports");
});

Deno.test("Given a controlled edit / When the host writes it while the field is closed / Then nothing moves", () => {
  const h = mount({ editing: false });
  h.write("editing", false);
  assertEquals(h.state(), "preview", "the field stays in preview");
  assertEquals(h.editChanges, [], "and reports nothing");
});

// ---- the parts -----------------------------------------------------------

Deno.test("Given an editable / When the parts are read / Then each carries its contract", () => {
  const h = mount({ defaultValue: "Ada", label: "Name" });
  assertEquals(h.bag("root")["id"], "editable:harness", "the root is namespaced");
  assertEquals(h.bag("area")["id"], "editable:harness:area", "the area is namespaced");
  assertEquals(h.bag("label")["for"], "editable:harness:input", "the label points at the input");
  assertEquals(h.bag("input")["id"], "editable:harness:input", "the input is namespaced");
  assertEquals(h.bag("preview")["id"], "editable:harness:preview", "the preview is namespaced");
  assertEquals(h.bag("control")["id"], "editable:harness:control", "the control is namespaced");
  assertEquals(h.bag("edit")["id"], "editable:harness:edit", "the edit trigger is namespaced");
  assertEquals(h.bag("submit")["id"], "editable:harness:submit", "the submit trigger is namespaced");
  assertEquals(h.bag("cancel")["id"], "editable:harness:cancel", "the cancel trigger is namespaced");
  assertEquals(h.bag("input")["aria-label"], "editable input", "the input is labelled");
  assertEquals(h.bag("preview")["aria-label"], "edit", "the preview is labelled");
  assertEquals(h.bag("submit")["aria-label"], "submit", "the submit trigger is labelled");
  assertEquals(h.bag("cancel")["aria-label"], "cancel", "the cancel trigger is labelled");
  assertEquals(h.bag("input")["name"], undefined, "an unnamed field submits nothing");
  assertEquals(h.bag("preview")["tabIndex"], 0, "an interactive preview is a tab stop");
});

Deno.test("Given an editable / When the state moves / Then the parts report it", () => {
  const h = mount({ defaultValue: "Ada" });
  assertEquals(h.bag("area")["data-state"], "preview", "the area reports the preview state");
  assertEquals(h.bag("input")["data-hidden"], "", "the input leaves the layout while previewing");
  assertEquals(h.bag("preview")["data-hidden"], undefined, "and the preview holds it");
  h.trigger("edit");
  assertEquals(h.bag("area")["data-state"], "edit", "the area reports the edit state");
  assertEquals(h.bag("area")["data-focus"], "", "the area reports the focus");
  assertEquals(h.bag("input")["data-hidden"], undefined, "the input takes the layout");
  assertEquals(h.bag("preview")["data-hidden"], "", "and the preview leaves it");
});

Deno.test("Given an auto-resizing editable / When the state moves / Then both parts stay in the layout", () => {
  const h = mount({ defaultValue: "Ada", autoResize: true });
  assertEquals(h.bag("area")["data-autoresize"], "", "the area reports the stack");
  assertEquals(h.bag("input")["data-hidden"], undefined, "the input never leaves the layout");
  assertEquals(h.bag("input")["size"], 1, "and is content-sized");
  assertEquals(h.bag("preview")["data-hidden"], undefined, "the preview never leaves it either");
  h.trigger("edit");
  assertEquals(h.bag("input")["data-hidden"], undefined, "opening keeps the input in the layout");
  assertEquals(h.bag("preview")["data-hidden"], undefined, "and keeps the preview sizing the box");
});

Deno.test("Given an editable with a part id to focus / When it closes / Then the api still reports the state", () => {
  const h = mount({ defaultValue: "Ada", finalFocus: "elsewhere" });
  h.trigger("edit");
  h.trigger("cancel");
  assertEquals(h.state(), "preview", "the field closes");
  assertEquals(h.api.value, "Ada", "and reverts");
});

// ---- two instances -------------------------------------------------------

Deno.test("Given two editables on one page / When each is driven / Then their contexts stay independent", () => {
  const first = mount({ defaultValue: "Ada" });
  const second = mount({ defaultValue: "Grace" });
  first.trigger("edit");
  first.type("Lin");
  assertEquals(second.state(), "preview", "the second field is untouched");
  assertEquals(second.api.value, "Grace", "and keeps its own value");
  assertEquals(second.valueChanges, [], "and reports nothing");
  second.trigger("edit");
  assertEquals(first.state(), "edit", "the first field is still editing");
  assertEquals(second.editChanges, [true], "the second field reports its own open");
  second.trigger("submit");
  assertEquals(first.api.value, "Lin", "the first field keeps its typed value");
  assertEquals(first.commits, [], "and has committed nothing");
  assertEquals(second.commits, ["Grace"], "while the second field commits its own value");
});

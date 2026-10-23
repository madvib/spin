import { assertEquals, assertNotStrictEquals } from "@std/assert";
import { parseHTML } from "@spin/runtime/testing";
import { signal } from "@spin/runtime";
import { cascade } from "./cascade.presentation.ts";
const createCascadeBridge = cascade.createBridge;
import type {
  CascadeApi,
  CascadeHighlightChange,
  CascadeItem,
  CascadeLevel,
  CascadeNode,
  CascadeOpenChange,
  CascadeValueChange,
} from "./cascade.presentation.ts";

/** A live writable read, as the element's prop store exposes one. */
type WriteSignal = { (): unknown; (value: unknown): void };

const win = parseHTML("<!doctype html><html><body></body></html>") as unknown as Record<string, unknown>;
declare const globalThis: Record<string, unknown>;
globalThis.document = win.document;
globalThis.CustomEvent = win.CustomEvent;
globalThis.HTMLElement = win.HTMLElement;
globalThis.Element = win.Element;

/**
 * Prop bags hand back `Record<string, unknown>`, so a handler read out of one is
 * checked here and typed once, instead of an unchecked cast at every call site.
 */
function handler<H>(bag: Record<string, unknown>, key: string): H {
  const value: unknown = bag[key];
  if (typeof value !== "function") throw new Error(`no handler at ${key}`);
  return value as H;
}

/** Read a callback out of a bag's `use:name` entry, which is data. */
function callback<H>(bag: Record<string, unknown>, action: string, name: string): H {
  const params: unknown = bag[action];
  if (typeof params !== "object" || params === null) throw new Error(`no action param at ${action}`);
  return handler<H>(params as Record<string, unknown>, name);
}

/**
 * linkedom ships no KeyboardEvent/MouseEvent/PointerEvent constructors, so the
 * events the handlers need are synthesized here — one place, with the minimal
 * field set each handler reads.
 */
const keyboard = (key: string, altKey = false): KeyboardEvent => {
  const event: { key: string; altKey: boolean; defaultPrevented: boolean; preventDefault(): void } = {
    key,
    altKey,
    defaultPrevented: false,
    preventDefault(): void {
      event.defaultPrevented = true;
    },
  };
  return event as unknown as KeyboardEvent;
};
const pointer = (pointerType: string): PointerEvent =>
  ({ pointerType }) as PointerEvent;
const outside = (target: unknown): PointerEvent =>
  ({ target, button: 0 }) as unknown as PointerEvent;
const contextMenu = (target: unknown): PointerEvent =>
  ({ target, button: 2 }) as unknown as PointerEvent;
const click = (): MouseEvent => ({ defaultPrevented: false, preventDefault: () => {} }) as unknown as MouseEvent;

/**
 * The tree under test: two roots, each with two branches, one disabled leaf in
 * each of two places, so navigation, selection and the level stack all have
 * something to prove.
 */
const TREE: readonly CascadeNode[] = [
  {
    value: "asia",
    label: "Asia",
    children: [
      {
        value: "india",
        label: "India",
        children: [
          { value: "haryana", label: "Haryana" },
          { value: "karnataka", label: "Karnataka" },
          { value: "punjab", label: "Punjab", disabled: true },
        ],
      },
      {
        value: "china",
        label: "China",
        children: [
          { value: "beijing", label: "Beijing" },
          { value: "shanghai", label: "Shanghai" },
        ],
      },
    ],
  },
  {
    value: "europe",
    label: "Europe",
    children: [
      {
        value: "france",
        label: "France",
        children: [
          { value: "paris", label: "Paris" },
          { value: "lyon", label: "Lyon" },
        ],
      },
      {
        value: "germany",
        label: "Germany",
        children: [
          { value: "berlin", label: "Berlin", disabled: true },
          { value: "munich", label: "Munich" },
        ],
      },
    ],
  },
];

interface Harness {
  readonly api: CascadeApi;
  /** The element id this mount handed the bridge, so part ids are its own. */
  readonly id: string;
  /** A part id in this mount's namespace: `cascade:<id>:<part>`. */
  part(part: string): string;
  readonly root: Element;
  readonly events: {
    readonly openChange: CascadeOpenChange[];
    readonly valueChange: CascadeValueChange[];
    readonly highlightChange: CascadeHighlightChange[];
    readonly outside: {
      pointer: number;
      focus: number;
      interact: string[];
    };
  };
  /** The level stack's rows, by level depth. */
  levels(): readonly CascadeLevel[];
  rows(depth: number): readonly CascadeItem[];
  /** A row by its value path, drilling the highlight to it when it is not on
   *  the current stack (a select clears the highlight, so its rows leave). */
  row(...path: string[]): CascadeItem;
  /** The machine's state, as the content part reports it. */
  state(): unknown;
  /** The level stack as its parent paths: `[[], ["asia"], ["asia","india"]]`. */
  stack(): readonly (readonly string[])[];
  write(name: string, value: unknown): void;
}

let mounts = 0;

/** Props are signals, exactly as the element's prop store makes them, so a host
 *  write re-runs the bridge's controlled-channel effect. */
function mount(
  tree: readonly CascadeNode[] = TREE,
  overrides: Readonly<Record<string, unknown>> = {},
): Harness {
  const root = document.createElement("div");
  document.body.appendChild(root);
  const events = {
    openChange: [] as CascadeOpenChange[],
    valueChange: [] as CascadeValueChange[],
    highlightChange: [] as CascadeHighlightChange[],
    outside: { pointer: 0, focus: 0, interact: [] as string[] },
  };
  const values: Record<string, WriteSignal> = {};
  const authoredKeys = new Set(Object.keys(overrides));
  const write = (name: string, value: unknown): void => {
    const source = values[name];
    if (source === undefined) values[name] = signal<unknown>(value);
    else source(value);
  };
  write("collection", JSON.stringify(tree));
  write("label", "Location");
  // The element's prop store holds every declared prop as a signal, even
  // when the host never wrote it — so a late host write re-runs the
  // bridge's effect instead of landing in a signal nothing reads.
  write("invalid", false);
  for (const [name, value] of Object.entries(overrides)) write(name, value);
  write("onOpenChange", (change: CascadeOpenChange) => events.openChange.push(change));
  write("onValueChange", (change: CascadeValueChange) => events.valueChange.push(change));
  write("onHighlightChange", (change: CascadeHighlightChange) => events.highlightChange.push(change));
  write("onPointerDownOutside", () => {
    events.outside.pointer += 1;
  });
  write("onFocusOutside", () => {
    events.outside.focus += 1;
  });
  write("onInteractOutside", (details: { focusable: boolean; contextmenu: boolean }) =>
    events.outside.interact.push(details.contextmenu ? "contextmenu" : details.focusable ? "focusable" : "inert"));
  const bridge = createCascadeBridge(
    () => {
      const record: Record<string, unknown> = {};
      for (const [name, source] of Object.entries(values)) record[name] = source();
      record["@@authored"] = (name: string): boolean => authoredKeys.has(name);
      return record;
    },
    () => root,
    `cascade${(mounts += 1)}`,
  );
  const elementId = `cascade${mounts}`;
  return {
    api: bridge.api,
    id: elementId,
    part: (part: string) => `cascade:${elementId}:${part}`,
    root,
    events,
    levels: () => bridge.api.getLevels(),
    rows: (depth) => bridge.api.getLevels()[depth]?.items ?? [],
    row: (...path) => {
      const onStack = (): CascadeItem | undefined =>
        bridge.api.getLevels().flatMap((level) => level.items).find((item) => item.path.join(" > ") === path.join(" > "));
      const found = onStack();
      if (found !== undefined) return found;
      bridge.api.setHighlightValue(path);
      const drilled = onStack();
      if (drilled === undefined) throw new Error(`no row ${path.join(" / ")}`);
      return drilled;
    },
    state: () => bridge.api.getContentProps()["data-state"],
    stack: () => bridge.api.getLevels().map((level) => level.path),
    write,
  };
}

// ---- states: idle, focused, open ------------------------------------------

Deno.test("Given a fresh cascade-select / When nothing is authored / Then closed idle is the reachable start state", () => {
  const h = mount();
  assertEquals(h.state(), "closed", "the panel starts closed");
  assertEquals(h.api.open, false, "the api reports closed");
  assertEquals(h.api.focused, false, "the api reports unfocused");
  assertEquals(h.api.empty, true, "nothing is selected");
  assertEquals(h.api.hasSelectedItems, false, "there is nothing to clear");
  assertEquals(h.api.value, [], "the value starts empty");
  assertEquals(h.api.highlightedValue, [], "nothing is highlighted");
  assertEquals(h.api.getTriggerProps()["aria-expanded"], false, "the trigger reports collapsed");
  assertEquals(h.api.getTriggerProps()["role"], "combobox", "the trigger is a combobox");
  assertEquals(h.api.getTriggerProps()["aria-haspopup"], "listbox", "it owns a listbox");
  assertEquals(h.api.getContentProps()["hidden"], true, "the content is hidden while closed");
  assertEquals(h.stack(), [[]], "only the root level exists");
  assertEquals(h.rows(0).map((row) => row.value), ["asia", "europe"], "the root level lists the roots");
  h.api.setOpen(false);
  assertEquals(h.state(), "closed", "a close from closed is a no-op");
});

Deno.test("Given defaultOpen true / When the mount happens / Then open is the reachable start state", () => {
  const h = mount(undefined, { defaultOpen: true });
  assertEquals(h.state(), "open", "defaultOpen seeds the open state");
  assertEquals(h.api.open, true, "the api reports open");
  assertEquals(h.api.getTriggerProps()["aria-expanded"], true, "the trigger reports expanded");
  assertEquals(h.api.getContentProps()["hidden"], false, "the content is visible");
});

Deno.test("Given a closed select / When the trigger is focused / Then the machine takes the focused state", () => {
  const h = mount();
  handler<() => void>(h.api.getTriggerProps(), "onFocus")();
  assertEquals(h.state(), "closed", "focus alone does not open the panel");
  assertEquals(h.api.focused, true, "the api reports the focused state");
  assertEquals(h.api.getControlProps()["data-focus"], "", "the control carries data-focus");
  assertEquals(h.api.getTriggerProps()["data-focus"], "", "the trigger carries data-focus");
  handler<() => void>(h.api.getTriggerProps(), "onBlur")();
  assertEquals(h.api.focused, false, "blur returns to idle");
  assertEquals(h.api.getControlProps()["data-focus"], undefined, "the control loses data-focus");
});

Deno.test("Given a closed select / When the trigger is clicked / Then it opens and reports open-change", () => {
  const h = mount();
  handler<(event: MouseEvent) => void>(h.api.getTriggerProps(), "onClick")(click());
  assertEquals(h.state(), "open", "the click opens the panel");
  assertEquals(h.events.openChange, [{ open: true, value: [] }], "open-change carries the value");
  assertEquals(h.stack(), [[]], "opening shows the root level alone");
});

Deno.test("Given an open select / When the trigger is clicked again / Then it closes on the focused state", () => {
  const h = mount();
  handler<(event: MouseEvent) => void>(h.api.getTriggerProps(), "onClick")(click());
  handler<(event: MouseEvent) => void>(h.api.getTriggerProps(), "onClick")(click());
  assertEquals(h.state(), "closed", "the toggle closes the panel");
  assertEquals(h.api.focused, true, "the close lands on focused");
  assertEquals(h.events.openChange, [{ open: true, value: [] }, { open: false, value: [] }], "both directions report");
});

Deno.test("Given an open select / When the setOpen command runs / Then the panel follows", () => {
  const h = mount();
  h.api.setOpen(true);
  assertEquals(h.state(), "open", "setOpen(true) opens");
  assertEquals(h.events.openChange, [{ open: true, value: [] }], "the open reports once");
  h.api.setOpen(false);
  assertEquals(h.state(), "closed", "setOpen(false) closes");
  assertEquals(h.events.openChange, [
    { open: true, value: [] },
    { open: false, value: [] },
  ], "the close reports once");
});

// ---- the trigger's keyboard -------------------------------------------------

Deno.test("Given a focused trigger / When ArrowDown arrives / Then it opens on the first root", () => {
  const h = mount();
  handler<() => void>(h.api.getTriggerProps(), "onFocus")();
  handler<(event: KeyboardEvent) => void>(h.api.getTriggerProps(), "onKeydown")(keyboard("ArrowDown"));
  assertEquals(h.state(), "open", "arrow down opens the panel");
  assertEquals(h.api.highlightedValue, ["asia"], "the first root is highlighted");
  assertEquals(h.stack(), [[], ["asia"]], "the highlighted branch shows its own level");
});

Deno.test("Given a focused trigger / When ArrowUp arrives / Then it opens on the last root", () => {
  const h = mount();
  handler<() => void>(h.api.getTriggerProps(), "onFocus")();
  handler<(event: KeyboardEvent) => void>(h.api.getTriggerProps(), "onKeydown")(keyboard("ArrowUp"));
  assertEquals(h.state(), "open", "arrow up opens the panel");
  assertEquals(h.api.highlightedValue, ["europe"], "the last root is highlighted");
});

Deno.test("Given a focused trigger / When a disabled root is the only option / Then the highlight holds", () => {
  const h = mount([{ value: "only", label: "Only", disabled: true }]);
  handler<() => void>(h.api.getTriggerProps(), "onFocus")();
  handler<(event: KeyboardEvent) => void>(h.api.getTriggerProps(), "onKeydown")(keyboard("ArrowDown"));
  assertEquals(h.state(), "open", "the panel still opens");
  assertEquals(h.api.highlightedValue, [], "no enabled row takes the highlight");
});

Deno.test("Given a focused trigger / When Enter or Space arrives / Then it opens on the first root", () => {
  const h = mount();
  handler<() => void>(h.api.getTriggerProps(), "onFocus")();
  const keydown = handler<(event: KeyboardEvent) => void>(h.api.getTriggerProps(), "onKeydown");
  keydown(keyboard("Enter"));
  assertEquals(h.api.highlightedValue, ["asia"], "enter highlights the first root");
  h.api.setOpen(false);
  keydown(keyboard(" "));
  assertEquals(h.api.highlightedValue, ["asia"], "space does the same");
});

Deno.test("Given a focused trigger / When ArrowLeft arrives / Then it opens with nothing highlighted", () => {
  const h = mount();
  handler<() => void>(h.api.getTriggerProps(), "onFocus")();
  handler<(event: KeyboardEvent) => void>(h.api.getTriggerProps(), "onKeydown")(keyboard("ArrowLeft"));
  assertEquals(h.state(), "open", "arrow left opens the panel");
  assertEquals(h.api.highlightedValue, [], "no row is highlighted");
});

Deno.test("Given a focused trigger and rtl / When ArrowLeft arrives / Then the directions flip", () => {
  const h = mount(undefined, { dir: "rtl" });
  handler<() => void>(h.api.getTriggerProps(), "onFocus")();
  handler<(event: KeyboardEvent) => void>(h.api.getTriggerProps(), "onKeydown")(keyboard("ArrowLeft"));
  assertEquals(h.api.highlightedValue, ["asia"], "rtl maps the forward key to ArrowLeft");
  h.api.setOpen(false);
  handler<(event: KeyboardEvent) => void>(h.api.getTriggerProps(), "onKeydown")(keyboard("ArrowRight"));
  assertEquals(h.state(), "open", "arrow right still opens");
  assertEquals(h.api.highlightedValue, [], "rtl maps the back key to ArrowRight");
});

Deno.test("Given a focused trigger / When Alt+ArrowDown arrives / Then it opens plain", () => {
  const h = mount();
  handler<() => void>(h.api.getTriggerProps(), "onFocus")();
  handler<(event: KeyboardEvent) => void>(h.api.getTriggerProps(), "onKeydown")(keyboard("ArrowDown", true));
  assertEquals(h.state(), "open", "alt+arrow down opens the panel");
  assertEquals(h.api.highlightedValue, [], "without a highlight");
});

Deno.test("Given a trigger click that selected / When the panel opens again / Then the selection resumes the highlight", () => {
  const h = mount();
  h.api.setValue([["asia", "india"]]);
  h.api.setOpen(false);
  handler<(event: MouseEvent) => void>(h.api.getTriggerProps(), "onClick")(click());
  assertEquals(h.state(), "open", "the click opens the panel");
  assertEquals(h.api.highlightedValue, ["asia", "india"], "the most recent selection is the highlight");
});

// ---- closing and focus -----------------------------------------------------

Deno.test("Given an open panel / When the dismissable reports Escape / Then it closes back on the trigger", () => {
  const h = mount();
  h.api.setOpen(true);
  callback<() => void>(h.api.getContentProps(), "use:dismissable", "onEscape")();
  assertEquals(h.state(), "closed", "escape closes the panel");
  assertEquals(h.api.focused, true, "focus returns to the trigger");
  assertEquals(h.events.openChange, [{ open: true, value: [] }, { open: false, value: [] }], "the close reports once");
});

Deno.test("Given an open panel / When a press outside lands on an inert target / Then it closes on the trigger", () => {
  const h = mount();
  h.api.setOpen(true);
  callback<(event: PointerEvent) => void>(h.api.getContentProps(), "use:dismissable", "onOutside")(outside(document.createElement("div")));
  assertEquals(h.state(), "closed", "an outside press closes the panel");
  assertEquals(h.api.focused, true, "focus returns to the trigger");
  assertEquals(h.events.outside.pointer, 1, "the pointer callback fires once");
  assertEquals(h.events.outside.interact, ["inert"], "and reports the inert flag");
});

Deno.test("Given an open panel / When a press outside lands on a focusable target / Then focus leaves instead", () => {
  const h = mount();
  h.api.setOpen(true);
  const button = document.createElement("button");
  callback<(event: PointerEvent) => void>(h.api.getContentProps(), "use:dismissable", "onOutside")(outside(button));
  assertEquals(h.state(), "closed", "the panel still closes");
  assertEquals(h.api.focused, false, "but the machine lands idle: the outside takes focus");
  assertEquals(h.events.outside.interact, ["focusable"], "the focusable flag reaches the callback");
});

Deno.test("Given an open panel / When a press outside is a context menu / Then the machine lands idle", () => {
  const h = mount();
  h.api.setOpen(true);
  callback<(event: PointerEvent) => void>(h.api.getContentProps(), "use:dismissable", "onOutside")(contextMenu(document.createElement("div")));
  assertEquals(h.state(), "closed", "the panel closes");
  assertEquals(h.api.focused, false, "a context menu keeps focus away from the trigger");
  assertEquals(h.events.outside.interact, ["contextmenu"], "the contextmenu flag reaches the callback");
});

Deno.test("Given an open panel / When a press on the trigger is reported / Then it is not a dismissal", () => {
  const h = mount();
  h.api.setOpen(true);
  const trigger = document.createElement("button");
  trigger.id = String(h.api.getTriggerProps()["id"]);
  h.root.appendChild(trigger);
  callback<(event: PointerEvent) => void>(h.api.getContentProps(), "use:dismissable", "onOutside")(outside(trigger));
  assertEquals(h.state(), "open", "the trigger's own gesture is not an outside press");
  assertEquals(h.events.outside.pointer, 0, "no outside callback fires");
});

Deno.test("Given an open panel / When a press on the clear trigger is reported / Then it is not a dismissal", () => {
  const h = mount();
  h.api.setValue([["asia"]]);
  h.api.setOpen(true);
  const clear = document.createElement("button");
  clear.id = String(h.api.getClearTriggerProps()["id"]);
  h.root.appendChild(clear);
  callback<(event: PointerEvent) => void>(h.api.getContentProps(), "use:dismissable", "onOutside")(outside(clear));
  assertEquals(h.state(), "open", "the clear trigger's own gesture is not an outside press");
});

Deno.test("Given an open panel / When focus leaves for something inside / Then it reports nothing", () => {
  const h = mount();
  h.api.setOpen(true);
  const inside = document.createElement("div");
  h.root.appendChild(inside);
  handler<(event: FocusEvent) => void>(h.api.getContentProps(), "onFocusOut")({
    relatedTarget: inside,
  } as unknown as FocusEvent);
  assertEquals(h.state(), "open", "focus inside the component is not outside");
  assertEquals(h.events.outside.focus, 0, "no outside callback fires");
});

Deno.test("Given an open panel / When focus leaves the component / Then it closes without focus on the trigger", () => {
  const h = mount();
  h.api.setOpen(true);
  handler<(event: FocusEvent) => void>(h.api.getContentProps(), "onFocusOut")({
    relatedTarget: null,
  } as unknown as FocusEvent);
  assertEquals(h.state(), "closed", "focus leaving dismisses the panel");
  assertEquals(h.api.focused, false, "focus went elsewhere, so the trigger does not take it back");
  assertEquals(h.events.outside.focus, 1, "the focus callback fires once");
  assertEquals(h.events.outside.interact, ["inert"], "and reports the inert flag");
});

Deno.test("Given a closed panel / When focus leaves it anyway / Then nothing reports", () => {
  const h = mount();
  handler<(event: FocusEvent) => void>(h.api.getContentProps(), "onFocusOut")({
    relatedTarget: null,
  } as unknown as FocusEvent);
  assertEquals(h.events.outside.focus, 0, "a closed panel has no outside to report");
});

Deno.test("Given an open panel / When Tab arrives on the content / Then focus holds", () => {
  const h = mount();
  h.api.setOpen(true);
  const event = keyboard("Tab");
  handler<(event: KeyboardEvent) => void>(h.api.getContentProps(), "onKeydown")(event);
  assertEquals(event.defaultPrevented, true, "tab is trapped in the listbox");
  assertEquals(h.api.highlightedValue, [], "tab moves no highlight");
});

// ---- content navigation ----------------------------------------------------

const openAt = (h: Harness, ...path: string[]): void => {
  h.api.setOpen(true);
  if (path.length > 0) h.api.setHighlightValue(path);
};

Deno.test("Given an open panel with a highlight / When arrows move / Then the level walks its enabled rows", () => {
  const h = mount();
  openAt(h, "asia");
  const keydown = handler<(event: KeyboardEvent) => void>(h.api.getContentProps(), "onKeydown");
  keydown(keyboard("ArrowDown"));
  assertEquals(h.api.highlightedValue, ["europe"], "arrow down moves to the next root");
  keydown(keyboard("ArrowUp"));
  assertEquals(h.api.highlightedValue, ["asia"], "arrow up moves back");
  keydown(keyboard("ArrowUp"));
  assertEquals(h.api.highlightedValue, ["asia"], "without loopFocus the first root is the boundary");
});

Deno.test("Given loopFocus / When the highlight runs past the edge / Then it wraps", () => {
  const h = mount(undefined, { loopFocus: true });
  openAt(h, "asia");
  const keydown = handler<(event: KeyboardEvent) => void>(h.api.getContentProps(), "onKeydown");
  keydown(keyboard("ArrowUp"));
  assertEquals(h.api.highlightedValue, ["europe"], "past the first root the highlight wraps to the last");
  keydown(keyboard("ArrowDown"));
  assertEquals(h.api.highlightedValue, ["asia"], "and forward again it wraps back");
});

Deno.test("Given a level with a disabled row / When arrows move / Then it is skipped", () => {
  const h = mount();
  openAt(h, "asia", "china", "beijing");
  const keydown = handler<(event: KeyboardEvent) => void>(h.api.getContentProps(), "onKeydown");
  keydown(keyboard("ArrowDown"));
  assertEquals(h.api.highlightedValue, ["asia", "china", "shanghai"], "the next enabled sibling wins");
  keydown(keyboard("ArrowDown"));
  assertEquals(h.api.highlightedValue, ["asia", "china", "shanghai"], "the last enabled sibling is the boundary");
});

Deno.test("Given a root level with a disabled row / When the first is taken / Then the enabled one is chosen", () => {
  const h = mount([
    { value: "gone", label: "Gone", disabled: true },
    { value: "kept", label: "Kept" },
  ]);
  openAt(h);
  const keydown = handler<(event: KeyboardEvent) => void>(h.api.getContentProps(), "onKeydown");
  keydown(keyboard("Home"));
  assertEquals(h.api.highlightedValue, ["kept"], "home skips the disabled row");
});

Deno.test("Given an open panel with no highlight / When an arrow arrives / Then an edge is taken", () => {
  const h = mount();
  openAt(h);
  const keydown = handler<(event: KeyboardEvent) => void>(h.api.getContentProps(), "onKeydown");
  keydown(keyboard("ArrowDown"));
  assertEquals(h.api.highlightedValue, ["asia"], "forward from nothing takes the first");
  keydown(keyboard("ArrowUp"));
  assertEquals(h.api.highlightedValue, ["asia"], "the highlight now walks from there");
  h.api.setHighlightValue([]);
  keydown(keyboard("ArrowUp"));
  assertEquals(h.api.highlightedValue, ["europe"], "backward from nothing takes the last, loop or not");
});

Deno.test("Given an open panel with a highlight / When Home and End arrive / Then the level's edges are taken", () => {
  const h = mount();
  openAt(h, "asia", "china", "beijing");
  const keydown = handler<(event: KeyboardEvent) => void>(h.api.getContentProps(), "onKeydown");
  keydown(keyboard("End"));
  assertEquals(h.api.highlightedValue, ["asia", "china", "shanghai"], "end takes the last row of this level");
  keydown(keyboard("Home"));
  assertEquals(h.api.highlightedValue, ["asia", "china", "beijing"], "home takes the first");
  keydown(keyboard("End"));
  keydown(keyboard("End"));
  assertEquals(h.api.highlightedValue, ["asia", "china", "shanghai"], "the last row is the boundary");
  h.api.setHighlightValue(["asia", "china"]);
  keydown(keyboard("End"));
  assertEquals(h.api.highlightedValue, ["asia", "china"], "a highlight already at its level's edge holds");
});

Deno.test("Given a highlighted branch / When ArrowRight arrives / Then the first enabled child is highlighted", () => {
  const h = mount();
  openAt(h, "asia");
  const keydown = handler<(event: KeyboardEvent) => void>(h.api.getContentProps(), "onKeydown");
  keydown(keyboard("ArrowRight"));
  assertEquals(h.api.highlightedValue, ["asia", "india"], "the first child is highlighted");
  assertEquals(h.stack(), [[], ["asia"], ["asia", "india"]], "its own level joins the stack");
  keydown(keyboard("ArrowRight"));
  assertEquals(h.api.highlightedValue, ["asia", "india", "haryana"], "and again, one level deeper");
});

Deno.test("Given a highlighted leaf / When ArrowRight arrives / Then nothing moves", () => {
  const h = mount();
  openAt(h, "asia", "india", "haryana");
  const keydown = handler<(event: KeyboardEvent) => void>(h.api.getContentProps(), "onKeydown");
  keydown(keyboard("ArrowRight"));
  assertEquals(h.api.highlightedValue, ["asia", "india", "haryana"], "a leaf has no child level");
  assertEquals(h.stack(), [[], ["asia"], ["asia", "india"]], "the stack holds at the leaf's siblings");
});

Deno.test("Given a highlight two levels deep / When ArrowLeft arrives / Then the parent takes it", () => {
  const h = mount();
  openAt(h, "asia", "india", "haryana");
  const keydown = handler<(event: KeyboardEvent) => void>(h.api.getContentProps(), "onKeydown");
  keydown(keyboard("ArrowLeft"));
  assertEquals(h.api.highlightedValue, ["asia", "india"], "the parent takes the highlight");
  assertEquals(h.stack(), [[], ["asia"], ["asia", "india"]], "the deepest level leaves the stack");
});

Deno.test("Given a highlight at the root level / When ArrowLeft arrives / Then the panel closes", () => {
  const h = mount();
  openAt(h, "asia");
  const keydown = handler<(event: KeyboardEvent) => void>(h.api.getContentProps(), "onKeydown");
  keydown(keyboard("ArrowLeft"));
  assertEquals(h.state(), "closed", "at the root level arrow left closes the panel");
  assertEquals(h.api.focused, true, "focus returns to the trigger");
  assertEquals(h.events.openChange.length, 2, "the open and the close each report once");
});

// ---- selection -------------------------------------------------------------

Deno.test("Given a highlighted leaf / When Enter arrives / Then it selects, closes and clears the highlight", () => {
  const h = mount();
  openAt(h, "asia", "india", "haryana");
  const keydown = handler<(event: KeyboardEvent) => void>(h.api.getContentProps(), "onKeydown");
  keydown(keyboard("Enter"));
  assertEquals(h.api.value, [["asia", "india", "haryana"]], "the path is selected");
  assertEquals(h.state(), "closed", "closeOnSelect closes the panel");
  assertEquals(h.api.highlightedValue, [], "the highlight clears on close");
  assertEquals(h.events.valueChange.map((change) => change.value), [[["asia", "india", "haryana"]]], "value-change carries the paths");
  assertEquals(
    h.events.valueChange.map((change) => change.items.map((chain) => chain.map((node) => node.label))),
    [[["Asia", "India", "Haryana"]]],
    "and the item chains along each path",
  );
  assertEquals(
    h.events.highlightChange.map((change) => change.highlightedValue),
    [["asia", "india", "haryana"], []],
    "the open highlight and the cleared one each report",
  );
});

Deno.test("Given a highlighted leaf and closeOnSelect false / When Enter arrives / Then it selects and stays open", () => {
  const h = mount(undefined, { closeOnSelect: false });
  openAt(h, "asia", "india", "haryana");
  handler<(event: KeyboardEvent) => void>(h.api.getContentProps(), "onKeydown")(keyboard("Enter"));
  assertEquals(h.api.value, [["asia", "india", "haryana"]], "the path is selected");
  assertEquals(h.state(), "open", "the panel stays open");
  assertEquals(h.api.highlightedValue, ["asia", "india", "haryana"], "the highlight holds without a close");
});

Deno.test("Given a highlighted branch / When Enter arrives / Then it is not selectable", () => {
  const h = mount();
  openAt(h, "asia");
  handler<(event: KeyboardEvent) => void>(h.api.getContentProps(), "onKeydown")(keyboard("Enter"));
  assertEquals(h.api.value, [], "a branch without allowParentSelection selects nothing");
  assertEquals(h.state(), "open", "the panel stays open");
});

Deno.test("Given allowParentSelection and a highlighted branch / When Enter arrives / Then it selects and drills", () => {
  const h = mount(undefined, { allowParentSelection: true });
  openAt(h, "asia");
  handler<(event: KeyboardEvent) => void>(h.api.getContentProps(), "onKeydown")(keyboard("Enter"));
  assertEquals(h.api.value, [["asia"]], "the branch itself is selected");
  assertEquals(h.api.highlightedValue, ["asia"], "and the highlight drills into it");
  assertEquals(h.stack(), [[], ["asia"]], "the drilled child level shows");
});

Deno.test("Given a clicked leaf / When it is clicked again under multiple / Then it deselects", () => {
  const h = mount(undefined, { multiple: true });
  openAt(h, "asia", "india", "haryana");
  const bag = h.api.getItemProps(h.row("asia", "india", "haryana"));
  handler<() => void>(bag, "onClick")();
  assertEquals(h.api.value, [["asia", "india", "haryana"]], "the first click selects");
  assertEquals(h.state(), "open", "multiple keeps the panel open");
  handler<() => void>(bag, "onClick")();
  assertEquals(h.api.value, [], "the second click deselects");
  assertEquals(h.events.valueChange.length, 2, "both moves report");
});

Deno.test("Given multiple and two selections / When both are chosen / Then both paths land", () => {
  const h = mount(undefined, { multiple: true });
  openAt(h);
  handler<() => void>(h.api.getItemProps(h.row("asia", "india", "haryana")), "onClick")();
  h.api.setHighlightValue(["europe", "france", "lyon"]);
  handler<() => void>(h.api.getItemProps(h.row("europe", "france", "lyon")), "onClick")();
  assertEquals(h.api.value, [["asia", "india", "haryana"], ["europe", "france", "lyon"]], "selection order is kept");
  assertEquals(h.api.getValueText(), "Haryana, Lyon", "multiple formats the last node of each path");
});

Deno.test("Given allowParentSelection and multiple / When a branch is chosen / Then related paths drop", () => {
  const h = mount(undefined, { multiple: true, allowParentSelection: true });
  openAt(h);
  handler<() => void>(h.api.getItemProps(h.row("europe", "france", "lyon")), "onClick")();
  assertEquals(h.api.value, [["europe", "france", "lyon"]], "a leaf is chosen");
  handler<() => void>(h.api.getItemProps(h.row("europe")), "onClick")();
  assertEquals(h.api.value, [["europe"]], "the branch takes its place and drops its descendant");
  assertEquals(h.api.highlightedValue, ["europe"], "and drills in");
});

Deno.test("Given a clicked branch / When it is clicked / Then the value drills to it", () => {
  const h = mount();
  openAt(h);
  handler<() => void>(h.api.getItemProps(h.row("asia")), "onClick")();
  assertEquals(h.api.value, [], "a branch that may not be selected is not a value");
  assertEquals(h.api.highlightedValue, ["asia"], "the highlight follows the click");
  assertEquals(h.stack(), [[], ["asia"]], "the child level shows");
});

Deno.test("Given a disabled row / When it is clicked / Then nothing happens", () => {
  const h = mount();
  openAt(h, "asia", "india");
  handler<() => void>(h.api.getItemProps(h.row("asia", "india", "punjab")), "onClick")();
  assertEquals(h.api.value, [], "a disabled row selects nothing");
  assertEquals(h.api.highlightedValue, ["asia", "india"], "and takes no highlight");
});

Deno.test("Given a disabled row / When a pointer moves over it / Then nothing highlights", () => {
  const h = mount(undefined, { highlightTrigger: "hover" });
  openAt(h, "asia", "india");
  const move = handler<(event: PointerEvent) => void>(h.api.getItemProps(h.row("asia", "india", "punjab")), "onPointerMove");
  move(pointer("mouse"));
  assertEquals(h.api.highlightedValue, ["asia", "india"], "a disabled row highlights nothing");
});

Deno.test("Given a row / When a double click arrives / Then the panel closes", () => {
  const h = mount();
  openAt(h, "asia");
  handler<() => void>(h.api.getItemProps(h.row("asia")), "onDoubleClick")();
  assertEquals(h.state(), "closed", "a double click closes outright");
});

// ---- the hover trigger -----------------------------------------------------

Deno.test("Given highlightTrigger hover and a pointer over a branch / When it moves / Then the branch is highlighted", () => {
  const h = mount(undefined, { highlightTrigger: "hover" });
  openAt(h);
  handler<(event: PointerEvent) => void>(h.api.getItemProps(h.row("asia")), "onPointerMove")(pointer("mouse"));
  assertEquals(h.api.highlightedValue, ["asia"], "the branch takes the highlight");
  assertEquals(h.stack(), [[], ["asia"]], "its level shows");
});

Deno.test("Given highlightTrigger hover and a pointer over a leaf / When it moves / Then the parent level highlights", () => {
  const h = mount(undefined, { highlightTrigger: "hover" });
  openAt(h);
  handler<(event: PointerEvent) => void>(h.api.getItemProps(h.row("asia", "india", "haryana")), "onPointerMove")(pointer("mouse"));
  assertEquals(h.api.highlightedValue, ["asia", "india"], "the leaf's parent takes the highlight");
});

Deno.test("Given highlightTrigger click / When a pointer moves over a row / Then the highlight holds", () => {
  const h = mount();
  openAt(h);
  handler<(event: PointerEvent) => void>(h.api.getItemProps(h.row("asia")), "onPointerMove")(pointer("mouse"));
  assertEquals(h.api.highlightedValue, [], "the default trigger is click, so hover does nothing");
});

Deno.test("Given a non-mouse pointer over a row / When it moves / Then the highlight holds", () => {
  const h = mount(undefined, { highlightTrigger: "hover" });
  openAt(h);
  handler<(event: PointerEvent) => void>(h.api.getItemProps(h.row("asia")), "onPointerMove")(pointer("touch"));
  assertEquals(h.api.highlightedValue, [], "a touch pointer is not a hover");
});

// ---- the level stack, the parts, the ids -----------------------------------

Deno.test("Given a highlight three deep / When the levels are read / Then each level is keyed by its parent path", () => {
  const h = mount();
  openAt(h, "asia", "india", "haryana");
  const levels = h.api.getLevels();
  assertEquals(levels.map((level) => level.path), [[], ["asia"], ["asia", "india"]], "one level per node on the path");
  assertEquals(levels.map((level) => level.depth), [0, 1, 2], "depth counts from the root");
  assertEquals(levels.map((level) => level.items.map((row) => row.value)), [
    ["asia", "europe"],
    ["india", "china"],
    ["haryana", "karnataka", "punjab"],
  ], "each level lists the node's children");
  assertEquals(levels[2]?.items[2]?.disabled, true, "the disabled row keeps its flag");
  assertEquals(levels[2]?.items[2]?.hasChildren, false, "the leaf is a leaf");
  assertEquals(levels[0]?.items[0]?.hasChildren, true, "the root is a branch");
});

Deno.test("Given an open panel / When the item state is read / Then it follows the highlight and the value", () => {
  const h = mount();
  openAt(h, "asia", "india");
  h.api.setValue([["asia", "india", "karnataka"]]);
  const state = h.api.getItemState(h.row("asia"));
  assertEquals(state.value, ["asia"], "the row's own path");
  assertEquals(state.highlighted, true, "an ancestor of the highlight is highlighted");
  assertEquals(state.hasChildren, true, "it is a branch");
  assertEquals(state.highlightedChild, "india", "the child the level stack shows");
  assertEquals(state.highlightedIndex, 0, "and its index in this level");
  assertEquals(state.depth, 0, "the root level");
  assertEquals(state.selected, false, "it is not selected");
  const leaf = h.api.getItemState(h.row("asia", "india", "karnataka"));
  assertEquals(leaf.selected, true, "the chosen leaf is selected");
  assertEquals(leaf.highlighted, false, "a sibling of the highlight is not");
  assertEquals(
    h.api.getItemState(h.row("europe", "france")).highlightedChild,
    undefined,
    "a row off the highlight has no highlighted child",
  );
});

Deno.test("Given an open panel / When the parts are read / Then the id scheme is cascade:<id>:<part>", () => {
  const h = mount();
  openAt(h, "asia");
  assertEquals(h.api.getRootProps()["id"], `cascade:${h.id}`, "the root part is the bare namespace");
  assertEquals(h.api.getLabelProps()["id"], h.part("label"), "the label part");
  assertEquals(h.api.getControlProps()["id"], h.part("control"), "the control part");
  assertEquals(h.api.getTriggerProps()["id"], h.part("trigger"), "the trigger part");
  assertEquals(h.api.getContentProps()["id"], h.part("content"), "the content part");
  assertEquals(h.api.getPositionerProps()["id"], h.part("positioner"), "the positioner part");
  assertEquals(h.api.getClearTriggerProps()["id"], h.part("clear-trigger"), "the clear trigger part");
  assertEquals(h.api.getHiddenInputProps()["id"], h.part("hidden-input"), "the hidden input part");
  const rootLevel = h.levels()[0];
  if (rootLevel === undefined) throw new Error("no root level");
  assertEquals(h.api.getListProps(rootLevel)["id"], h.part("list:"), "the root list is the bare namespace");
  const drilled = h.levels()[1];
  assertEquals(
    drilled === undefined ? "" : h.api.getListProps(drilled)["id"],
    h.part("list:asia"),
    "the drilled list is keyed by its parent path",
  );
  assertEquals(
    h.api.getItemProps(h.row("asia", "india"))["id"],
    h.part("item:asia,india"),
    "the item part is keyed by its value path",
  );
});

Deno.test("Given an open panel / When the item props are read / Then the treeitem contract follows the data", () => {
  const h = mount();
  openAt(h, "asia", "india");
  const branch = h.api.getItemProps(h.row("asia"));
  assertEquals(branch["role"], "treeitem", "every row is a treeitem");
  assertEquals(branch["aria-haspopup"], "menu", "a branch declares a popup");
  assertEquals(branch["aria-expanded"], true, "the highlighted branch reports expanded");
  assertEquals(
    branch["aria-controls"],
    h.part("list:asia"),
    "it points at its child level's list",
  );
  assertEquals(branch["aria-owns"], h.part("list:asia"), "and owns it");
  assertEquals(branch["data-type"], "branch", "the row knows its type");
  assertEquals(branch["data-highlighted"], "", "the highlighted row carries the attribute");
  assertEquals(branch["data-value"], "asia", "the row's own value");
  const leaf = h.api.getItemProps(h.row("asia", "india", "haryana"));
  assertEquals(leaf["aria-haspopup"], undefined, "a leaf declares no popup");
  assertEquals(leaf["aria-expanded"], false, "a leaf reports unexpanded");
  assertEquals(leaf["data-highlighted"], undefined, "an unhighlighted row carries nothing");
  assertEquals(leaf["data-type"], "leaf", "the row knows it is a leaf");
  const disabled = h.api.getItemProps(h.row("asia", "india", "punjab"));
  assertEquals(disabled["aria-disabled"], true, "the disabled row reports it");
  assertEquals(disabled["data-disabled"], "", "and carries the attribute");
});

Deno.test("Given a selected row / When its parts are read / Then the indicator follows", () => {
  const h = mount();
  openAt(h);
  h.api.setValue([["asia", "india", "haryana"]]);
  const row = h.row("asia", "india", "haryana");
  assertEquals(h.api.getItemProps(row)["data-selected"], "", "the row is selected");
  assertEquals(h.api.getItemProps(row)["data-selected"], "", "and reports the selection");
  assertEquals(h.api.getItemIndicatorProps(row)["hidden"], false, "its indicator shows");
  assertEquals(h.api.getItemIndicatorProps(row)["data-selected"], "", "and the indicator follows");
  assertEquals(h.api.getItemTextProps(row)["data-selected"], "", "the text follows too");
  const other = h.row("asia", "india", "karnataka");
  assertEquals(h.api.getItemIndicatorProps(other)["hidden"], true, "its indicator hides");
});

Deno.test("Given an open panel / When the content part is read / Then the listbox contract holds", () => {
  const h = mount();
  openAt(h, "asia", "india");
  const content = h.api.getContentProps();
  assertEquals(content["role"], "listbox", "the content is a listbox");
  assertEquals(content["tabIndex"], 0, "it takes focus");
  assertEquals(content["aria-labelledby"], h.part("label"), "and is labelled by the label part");
  assertEquals(
    content["aria-activedescendant"],
    h.part("item:asia,india"),
    "the active descendant is the highlighted row",
  );
  assertEquals(content["data-activedescendant"], h.part("item:asia,india"), "the attribute twin is there too");
  assertEquals(content["hidden"], false, "it shows while open");
});

Deno.test("Given a multi-select / When the content part is read / Then it declares multiselectable", () => {
  const h = mount(undefined, { multiple: true, required: true });
  openAt(h);
  assertEquals(h.api.multiple, true, "the api reports multiple");
  assertEquals(h.api.getContentProps()["aria-multiselectable"], true, "the content declares it");
  assertEquals(h.api.getContentProps()["aria-required"], true, "and required");
  const single = mount();
  assertEquals(single.api.getContentProps()["aria-multiselectable"], false, "a single select reports false");
});

Deno.test("Given an open panel / When the list part is read / Then it is a group with a level", () => {
  const h = mount();
  openAt(h, "asia");
  const level = h.levels()[1];
  if (level === undefined) throw new Error("no drilled level");
  const props = h.api.getListProps(level);
  assertEquals(props["role"], "group", "the level is a group");
  assertEquals(props["aria-level"], 1, "and reports its depth");
  assertEquals(props["data-depth"], 1, "and its depth attribute");
});

Deno.test("Given a positioner / When its props are read / Then the geometry leaves as style properties", () => {
  const h = mount();
  const style = h.api.getPositionerProps()["style"] as Record<string, string>;
  assertEquals(style["minWidth"], "100%", "no trigger to measure in the harness");
  const above = mount(undefined, { placement: "top-start" });
  assertEquals(above.api.getPositionerProps()["data-side"], "top", "the side follows the placement");
  assertEquals(h.api.getTriggerProps()["data-placement"], "bottom-start", "the trigger carries the placement");
});

Deno.test("Given a value / When the trigger part is read / Then the placeholder state follows", () => {
  const h = mount();
  h.api.setOpen(true);
  assertEquals(h.api.getTriggerProps()["data-placeholder-shown"], "", "nothing selected shows the placeholder state");
  h.api.setValue([["asia"]]);
  assertEquals(h.api.getTriggerProps()["data-placeholder-shown"], undefined, "a selection clears it");
});

Deno.test("Given a value / When the hidden input is read / Then it carries the hash a form submits", () => {
  const h = mount(undefined, { name: "location" });
  h.api.setValue([["asia", "india"]]);
  const input = h.api.getHiddenInputProps();
  assertEquals(input["name"], "location", "the name crosses");
  assertEquals(input["value"], "asia,india", "the value is the joined path");
  assertEquals(input["hidden"], true, "and the input is hidden");
  h.api.setValue([["asia", "india"], ["europe", "france"]]);
  assertEquals(h.api.getHiddenInputProps()["value"], "asia,india, europe,france", "paths join after their segments");
  const anonymous = mount();
  h.api.setValue([]);
  assertEquals(anonymous.api.getHiddenInputProps()["name"], undefined, "an unnamed host gets no attribute");
});

Deno.test("Given a selection / When the value text is read / Then it is the labels along the path", () => {
  const h = mount();
  h.api.setOpen(true);
  assertEquals(h.api.getValueText(), "", "nothing selected reads empty");
  h.api.setValue([["asia", "india", "haryana"]]);
  assertEquals(h.api.getValueText(), "Asia / India / Haryana", "single mode joins the path's labels");
  assertEquals(h.api.getValueTextRows(), [{ value: "Asia / India / Haryana" }], "and rides a one-row list");
  const custom = mount(TREE, { formatValue: (items: readonly (readonly CascadeNode[])[]) =>
    items.map((chain) => chain.map((node) => node.label).reverse().join("<")).join("|") });
  custom.api.setValue([["asia", "india"]]);
  assertEquals(custom.api.getValueText(), "India<Asia", "a host's formatValue wins");
});

Deno.test("Given a disabled select / When the parts are read / Then every part reports it", () => {
  const h = mount(undefined, { disabled: true, readOnly: true, invalid: true });
  assertEquals(h.api.disabled, true, "the api reports disabled");
  assertEquals(h.api.getTriggerProps()["disabled"], true, "the trigger is disabled");
  assertEquals(h.api.getTriggerProps()["data-disabled"], "", "and reports it as data");
  assertEquals(h.api.getTriggerProps()["data-readonly"], "", "readOnly too");
  assertEquals(h.api.getTriggerProps()["data-invalid"], "", "and invalid");
  assertEquals(h.api.getRootProps()["data-invalid"], "", "the root reports invalid");
  assertEquals(h.api.getHiddenInputProps()["disabled"], true, "the hidden input is disabled too");
  handler<(event: MouseEvent) => void>(h.api.getTriggerProps(), "onClick")(click());
  assertEquals(h.state(), "closed", "a disabled trigger opens nothing");
});

Deno.test("Given a valid field / When the host marks it invalid / Then the parts report it", () => {
  const h = mount();
  const before = h.api.getRootProps();
  h.write("invalid", true);
  const after = h.api.getRootProps();
  assertEquals(after["data-invalid"], "", "the root reports invalid");
  assertNotStrictEquals(after, before, "the bag was rebuilt");
});

Deno.test("Given a disabled fieldset / When the select is read / Then it reports disabled", () => {
  const root = document.createElement("fieldset");
  root.setAttribute("disabled", "");
  document.body.appendChild(root);
  const bridge = createCascadeBridge(
    () => ({ collection: JSON.stringify(TREE) }),
    () => root,
    "in-fieldset",
  );
  assertEquals(bridge.api.disabled, true, "the fieldset's own disabled state reaches the api");
  handler<(event: MouseEvent) => void>(bridge.api.getTriggerProps(), "onClick")(click());
  assertEquals(bridge.api.getContentProps()["hidden"], true, "a disabled fieldset opens nothing");
  root.remove();
});

Deno.test("Given a read-only select / When a row is clicked / Then the value holds", () => {
  const h = mount(undefined, { readOnly: true });
  openAt(h);
  handler<() => void>(h.api.getItemProps(h.row("asia")), "onClick")();
  assertEquals(h.api.value, [], "a read-only select takes no selection");
});

// ---- the imperative surface ------------------------------------------------

Deno.test("Given a host / When the value commands run / Then the machine follows", () => {
  const h = mount();
  h.api.setValue([["europe", "germany"]]);
  assertEquals(h.api.value, [["europe", "germany"]], "setValue lands the path");
  assertEquals(
    h.events.valueChange.map((change) => change.items.map((chain) => chain.map((node) => node.label))),
    [[["Europe", "Germany"]]],
    "and reports the chains once",
  );
  h.api.selectValue(["asia", "china"]);
  assertEquals(h.api.value, [["asia", "china"]], "selectValue replaces the path");
  h.api.clearValue(["asia", "china"]);
  assertEquals(h.api.value, [], "clearValue(path) drops that path");
  h.api.setValue([["asia"], ["europe"]]);
  h.api.clearValue();
  assertEquals(h.api.value, [], "clearValue() drops them all");
});

Deno.test("Given a host / When the highlight commands run / Then the level stack follows", () => {
  const h = mount();
  h.api.setHighlightValue(["asia", "china"]);
  assertEquals(h.api.highlightedValue, ["asia", "china"], "the highlight moves");
  assertEquals(h.stack(), [[], ["asia"], ["asia", "china"]], "and the stack drills to it");
  assertEquals(h.events.highlightChange.map((change) => change.highlightedValue), [["asia", "china"]], "highlight-change carries the path");
  assertEquals(
    h.events.highlightChange.map((change) => change.highlightedItems.map((node) => node.label)),
    [["Asia", "China"]],
    "and the item chain along it",
  );
  h.api.clearHighlightValue();
  assertEquals(h.api.highlightedValue, [], "the highlight clears");
  assertEquals(h.stack(), [[]], "and the stack collapses");
});

Deno.test("Given a selection / When the clear trigger is clicked / Then the value clears and the trigger takes focus", () => {
  const h = mount();
  h.api.setValue([["asia"]]);
  assertEquals(h.api.getClearTriggerProps()["hidden"], false, "the clear trigger shows");
  handler<(event: MouseEvent) => void>(h.api.getClearTriggerProps(), "onClick")(click());
  assertEquals(h.api.value, [], "the value clears");
  assertEquals(h.events.valueChange.length, 2, "the set and the clear each report");
  assertEquals(h.api.getClearTriggerProps()["hidden"], true, "and it hides again");
});

Deno.test("Given a host that scrolls its own content / When the reflex param is read / Then the host owns the reveal", () => {
  const seen: { index: number; immediate?: boolean; depth: number }[] = [];
  const h = mount(undefined, {
    scrollToIndexFn: (details: { index: number; immediate?: boolean; depth: number }) => seen.push(details),
  });
  h.api.setOpen(true);
  h.api.setHighlightValue(["asia", "india"]);
  const param = h.api.getContentProps()["use:scroll-into-view"] as {
    activeId(): string;
    reveal?: () => void;
  };
  assertEquals(param.activeId(), h.part("item:asia,india"), "the reflex still knows the active id");
  param.reveal?.();
  assertEquals(seen, [{ index: 0, immediate: true, depth: 1 }], "the host's scroller gets the row's position");
  const plain = mount();
  assertEquals(
    (plain.api.getContentProps()["use:scroll-into-view"] as { reveal?: () => void }).reveal,
    undefined,
    "without a host scroller the reflex scrolls itself",
  );
});

Deno.test("Given a host / When the value and highlight props are authored / Then the machine alternates", () => {
  const value = signal<unknown>([["asia"]]);
  const highlighted = signal<unknown>(["asia", "india"]);
  const open = signal<unknown>(true);
  const root = document.createElement("div");
  document.body.appendChild(root);
  const bridge = createCascadeBridge(
    () => ({
      collection: JSON.stringify(TREE),
      "@@authored": (name: string) => name === "value" || name === "highlightedValue" || name === "open",
      value: value(),
      highlightedValue: highlighted(),
      open: open(),
    }),
    () => root,
    "controlled",
  );
  assertEquals(bridge.api.open, true, "an authored open prop opens the panel");
  assertEquals(bridge.api.value, [["asia"]], "an authored value lands");
  assertEquals(bridge.api.highlightedValue, ["asia", "india"], "an authored highlight lands");
  assertEquals(bridge.api.getLevels().map((level) => level.path), [[], ["asia"], ["asia", "india"]], "the stack follows the highlight");
  value([["europe"]]);
  assertEquals(bridge.api.value, [["europe"]], "a host write moves the value");
  open(false);
  assertEquals(bridge.api.open, false, "a host write closes the panel");
  open(true);
  assertEquals(bridge.api.open, true, "and opens it again");
});

Deno.test("Given a host / When the value prop is not authored / Then a coerced default is not a write", () => {
  const root = document.createElement("div");
  document.body.appendChild(root);
  const bridge = createCascadeBridge(
    () => ({ collection: JSON.stringify(TREE), value: [["asia"]] }),
    () => root,
    "uncontrolled",
  );
  assertEquals(bridge.api.value, [], "the coerced default never reaches the machine");
});

// ---- the row identity and bag caching lessons ------------------------------

Deno.test("Given an open panel / When the highlight moves / Then the rows are the same objects across reads", () => {
  const h = mount();
  openAt(h, "asia");
  const before = h.api.getLevels();
  const keydown = handler<(event: KeyboardEvent) => void>(h.api.getContentProps(), "onKeydown");
  keydown(keyboard("ArrowRight"));
  const after = h.api.getLevels();
  assertEquals(after[0], before[0], "the untouched level keeps its identity");
  assertEquals(after[1]?.items[0], before[1]?.items[0], "a drilled level's row keeps its identity");
  assertEquals(
    h.api.getItemProps(h.row("asia"))["onClick"],
    h.api.getItemProps(h.row("asia"))["onClick"],
    "the row handlers are not rebuilt per move",
  );
});

Deno.test("Given an open panel / When nothing moves / Then re-reading the bags returns the same objects", () => {
  const h = mount();
  openAt(h, "asia");
  assertEquals(h.api.getRootProps(), h.api.getRootProps(), "the root bag is cached");
  assertEquals(h.api.getTriggerProps(), h.api.getTriggerProps(), "the trigger bag is cached");
  assertEquals(h.api.getContentProps(), h.api.getContentProps(), "the content bag is cached");
  assertEquals(h.api.getItemProps(h.row("asia")), h.api.getItemProps(h.row("asia")), "the item bag is cached");
  assertEquals(h.api.getListProps(h.levels()[0] ?? { depth: 0, path: [], key: "root", items: [] }), h.api.getListProps(h.levels()[0] ?? { depth: 0, path: [], key: "root", items: [] }), "the list bag is cached");
});

Deno.test("Given a moving highlight / When the item bag is read again / Then it follows the row's state", () => {
  const h = mount();
  openAt(h, "asia");
  assertEquals(h.api.getItemProps(h.row("asia"))["data-highlighted"], "", "the highlighted row carries it");
  handler<(event: KeyboardEvent) => void>(h.api.getContentProps(), "onKeydown")(keyboard("ArrowDown"));
  assertEquals(h.api.getItemProps(h.row("asia"))["data-highlighted"], undefined, "the old row loses it");
  assertEquals(h.api.getItemProps(h.row("europe"))["data-highlighted"], "", "the new row carries it");
  assertEquals(h.api.getItemProps(h.row("asia"))["aria-expanded"], false, "the ancestor branch reports unexpanded");
});

Deno.test("Given a host's malformed collection / When the levels are read / Then nothing renders", () => {
  const h = mount(TREE, { collection: "{not json" });
  assertEquals(h.api.getLevels(), [], "a malformed tree yields no levels");
  assertEquals(h.api.getValueTextRows(), [{ value: "" }], "and an empty readout");
});

Deno.test("Given a collection without labels / When the rows are read / Then the value stands in", () => {
  const h = mount([
    { value: "plain" } as unknown as CascadeNode,
    { label: "no value" } as unknown as CascadeNode,
  ]);
  const rows = h.rows(0);
  assertEquals(rows.map((row) => row.label), ["plain"], "a row without a value is dropped");
  h.api.setValue([["plain"]]);
  assertEquals(h.api.getValueText(), "plain", "the value stands in for the missing label");
});

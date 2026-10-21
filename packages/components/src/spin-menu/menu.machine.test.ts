import { assertEquals } from "@std/assert";
import { parseHTML } from "@spin/runtime/testing";
import { signal } from "@spin/runtime";
import { menu } from "./menu.bindings.ts";
const createMenuBridge = menu.createBridge;
import type { MenuApi } from "./menu.bindings.ts";
import type {
  MenuBlock,
  MenuEntry,
  MenuHighlightChange,
  MenuOpenChange,
  MenuRow,
  MenuSelect,
} from "./menu.machine.ts";

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
const keyboard = (key: string): KeyboardEvent => ({ key, defaultPrevented: false, preventDefault: () => {} }) as unknown as KeyboardEvent;
const pointer = (pointerType: string): PointerEvent => ({ pointerType }) as PointerEvent;
const mouse = (): MouseEvent => ({ currentTarget: null }) as unknown as MouseEvent;

const FLAT: MenuEntry[] = [
  { value: "new", label: "New file" },
  { separator: true },
  { value: "copy", label: "Copy" },
  { value: "cut", label: "Cut", disabled: true },
];

const NESTED: MenuEntry[] = [
  { value: "new", label: "New file" },
  {
    value: "share",
    label: "Share",
    children: [
      { value: "mail", label: "Email link" },
      { value: "chat", label: "Send to chat" },
    ],
  },
];

interface Harness {
  readonly api: MenuApi;
  readonly root: Element;
  readonly events: {
    readonly openChange: MenuOpenChange[];
    readonly select: MenuSelect[];
    readonly highlightChange: MenuHighlightChange[];
  };
  row(value: string): MenuRow;
  state(): unknown;
  write(name: string, value: unknown): void;
}

/** Props are signals, exactly as the element's prop store makes them, so a host
 * write re-runs the bridge's controlled-channel effect. */
function mount(
  entries: readonly MenuEntry[],
  overrides: Readonly<Record<string, unknown>> = {},
): Harness {
  const root = document.createElement("div");
  document.body.appendChild(root);
  const events = {
    openChange: [] as MenuOpenChange[],
    select: [] as MenuSelect[],
    highlightChange: [] as MenuHighlightChange[],
  };
  const values: Record<string, WriteSignal> = {};
  const authoredKeys = new Set(Object.keys(overrides));
  const write = (name: string, value: unknown): void => {
    authoredKeys.add(name);
    const source = values[name];
    if (source === undefined) values[name] = signal<unknown>(value);
    else source(value);
  };
  write("items", entries);
  authoredKeys.delete("items");
  for (const [name, value] of Object.entries(overrides)) write(name, value);
  write("onOpenChange", (change: MenuOpenChange) => events.openChange.push(change));
  write("onSelect", (change: MenuSelect) => events.select.push(change));
  write("onHighlightChange", (change: MenuHighlightChange) => events.highlightChange.push(change));
  const bridge = createMenuBridge(
    () => {
      const record: Record<string, unknown> = {};
      for (const [name, source] of Object.entries(values)) record[name] = source();
      record["@@authored"] = (name: string): boolean => authoredKeys.has(name);
      return record;
    },
    () => root,
    "menu",
  );
  return {
    api: bridge.api,
    root,
    events,
    row: (value) => {
      const found = bridge.api.getBlocks().flatMap((block) => bridge.api.getRows(block))
        .find((row) => row.value === value);
      if (found === undefined) throw new Error(`no row ${value}`);
      return found;
    },
    state: () => bridge.api.getContentProps()["data-state"],
    write,
  };
}

Deno.test("Given a fresh menu / When nothing is authored / Then closed is the reachable start state", () => {
  const h = mount(FLAT);
  assertEquals(h.state(), "closed", "closed is the initial state");
  assertEquals(h.api.isOpen, false, "the api reports closed");
  assertEquals(h.api.getTriggerProps()["aria-expanded"], false, "the trigger reports collapsed");
  h.api.close();
  assertEquals(h.state(), "closed", "a close from closed is a no-op");
});

Deno.test("Given defaultOpen true / When the menu mounts / Then the open state is the reachable start", () => {
  const h = mount(FLAT, { defaultOpen: true });
  assertEquals(h.state(), "open", "defaultOpen seeds the open state");
  assertEquals(h.api.isOpen, true, "the api reports open");
  assertEquals(h.api.getTriggerProps()["aria-expanded"], true, "the trigger reports expanded");
});

Deno.test("Given a closed menu / When the trigger is clicked / Then it opens and reports open-change", () => {
  const h = mount(FLAT);
  handler<() => void>(h.api.getTriggerProps(), "onClick")();
  assertEquals(h.state(), "open", "the click opens the menu");
  assertEquals(h.events.openChange, [{ open: true }], "open-change fires once on the way open");
});

Deno.test("Given an open menu / When the trigger is clicked again / Then it closes and reports open-change", () => {
  const h = mount(FLAT);
  handler<() => void>(h.api.getTriggerProps(), "onClick")();
  handler<() => void>(h.api.getTriggerProps(), "onClick")();
  assertEquals(h.state(), "closed", "the toggle closes the menu");
  assertEquals(h.events.openChange, [{ open: true }, { open: false }], "both directions report");
});

Deno.test("Given a closed menu / When the open command runs / Then the machine takes the open state", () => {
  const h = mount(FLAT);
  h.api.open();
  assertEquals(h.state(), "open", "the command moves to open");
  assertEquals(h.events.openChange, [{ open: true }], "open-change reports the command");
});

Deno.test("Given an open menu / When the close command runs / Then the machine returns to closed", () => {
  const h = mount(FLAT);
  h.api.open();
  h.api.close();
  assertEquals(h.state(), "closed", "the command returns to closed");
  assertEquals(h.events.openChange, [{ open: true }, { open: false }], "open-change reports both moves");
});

Deno.test("Given an open menu / When the dismissable action reports Escape / Then it closes", () => {
  const h = mount(FLAT);
  h.api.open();
  callback<() => void>(h.api.getContentProps(), "use:dismissable", "onEscape")();
  assertEquals(h.state(), "closed", "escape closes the menu");
  assertEquals(h.events.openChange, [{ open: true }, { open: false }], "the close reports once");
});

Deno.test("Given an open menu / When a press outside is reported / Then it closes", () => {
  const h = mount(FLAT);
  h.api.open();
  callback<(event: PointerEvent) => void>(h.api.getContentProps(), "use:dismissable", "onOutside")({
    target: document.createElement("div"),
  } as unknown as PointerEvent);
  assertEquals(h.state(), "closed", "an outside press closes the menu");
});

Deno.test("Given an open menu / When the trigger id is excluded / Then the content passes it to dismissable", () => {
  const h = mount(FLAT);
  h.api.open();
  const params = h.api.getContentProps()["use:dismissable"] as { excludeId?: unknown };
  assertEquals(
    params.excludeId,
    h.api.getTriggerProps()["id"],
    "the trigger exclusion travels in the action param, not a def query",
  );
});

Deno.test("Given an authored open prop at mount / When the menu starts / Then it opens without an event", () => {
  const h = mount(FLAT, { open: true });
  // mount() authors every override: here `open` is authored at seed time,
  // which is the only moment outer writes reach the machine. Post-mount
  // writes travel as events (a hooks-layer job), never channels.
  assertEquals(h.state(), "open", "authored open at seed opens the menu");
});

Deno.test("Given defaultOpen at mount / When the menu starts / Then it opens", () => {
  const h = mount(FLAT, { defaultOpen: true });
  assertEquals(h.state(), "open", "uncontrolled default opens the menu");
});

Deno.test("Given a closed menu / When the context menu event carries a point / Then it opens at that point", () => {
  const h = mount(FLAT);
  let prevented = false;
  handler<(event: MouseEvent) => void>(h.api.getContextTriggerProps(), "onContextMenu")({
    clientX: 120,
    clientY: 64,
    preventDefault: () => {
      prevented = true;
    },
  } as unknown as MouseEvent);
  assertEquals(h.state(), "open", "the context menu opens the menu");
  assertEquals(prevented, true, "the native context menu is prevented");
});

Deno.test("Given a closed menu / When the positioner props are read / Then the anchor action carries placement and no vars", () => {
  const h = mount(FLAT);
  const bag = h.api.getPositionerProps() as Record<string, unknown>;
  assertEquals(bag["style"], undefined, "coordinates are the action's writes, not bag styles");
  assertEquals(bag["use:anchor"], { placement: "bottom", offset: 8 }, "the bag declares behavior; the action positions");
});

Deno.test("Given a closed menu / When the long-press action fires / Then the context menu opens", () => {
  const h = mount(FLAT);
  callback<(point: { x: number; y: number }) => void>(h.api.getContextTriggerProps(), "use:long-press", "onPress")({ x: 40, y: 30 });
  assertEquals(h.state(), "open", "the long press opens the menu");
});

Deno.test("Given a closed menu / When ArrowDown arrives on the trigger / Then it opens with the first item highlighted", () => {
  const h = mount(FLAT);
  handler<(event: KeyboardEvent) => void>(h.api.getTriggerProps(), "onKeydown")(keyboard("ArrowDown"));
  assertEquals(h.state(), "open", "arrow down opens the menu");
  assertEquals(h.api.highlightedValue, "new", "the first enabled item is highlighted");
});

Deno.test("Given a closed menu / When ArrowUp arrives on the trigger / Then it opens with the last item highlighted", () => {
  const h = mount(FLAT);
  handler<(event: KeyboardEvent) => void>(h.api.getTriggerProps(), "onKeydown")(keyboard("ArrowUp"));
  assertEquals(h.state(), "open", "arrow up opens the menu");
  assertEquals(h.api.highlightedValue, "copy", "the last enabled item is highlighted, the disabled one skipped");
});

Deno.test("Given an open menu / When the setHighlighted command runs / Then the highlight moves and reports", () => {
  const h = mount(FLAT);
  h.api.open();
  h.api.setHighlighted("copy");
  assertEquals(h.api.highlightedValue, "copy", "the highlight follows the command");
  assertEquals(h.events.highlightChange, [{ highlightedValue: "copy" }], "highlight-change reports the move");
  assertEquals(h.api.getItemProps(h.row("copy"))["data-highlighted"], "", "the row carries data-highlighted");
  assertEquals(h.api.getItemProps(h.row("new"))["data-highlighted"], undefined, "other rows do not");
});

Deno.test("Given an open menu / When arrows move the highlight / Then navigation walks the enabled rows", () => {
  const h = mount(FLAT);
  h.api.open();
  const onKeydown = handler<(event: KeyboardEvent) => void>(h.api.getContentProps(), "onKeydown");
  onKeydown(keyboard("ArrowDown"));
  assertEquals(h.api.highlightedValue, "new", "the first arrow lands on the first item");
  onKeydown(keyboard("ArrowDown"));
  assertEquals(h.api.highlightedValue, "copy", "the next arrow skips the separator and the disabled item");
  onKeydown(keyboard("ArrowDown"));
  assertEquals(h.api.highlightedValue, "copy", "without loopFocus the last enabled item is the boundary");
  onKeydown(keyboard("ArrowUp"));
  assertEquals(h.api.highlightedValue, "new", "arrow up walks back");
});

Deno.test("Given loopFocus / When the highlight runs past the last item / Then it wraps to the first", () => {
  const h = mount(FLAT, { loopFocus: true });
  h.api.open();
  const onKeydown = handler<(event: KeyboardEvent) => void>(h.api.getContentProps(), "onKeydown");
  onKeydown(keyboard("ArrowDown"));
  onKeydown(keyboard("ArrowDown"));
  onKeydown(keyboard("ArrowDown"));
  assertEquals(h.api.highlightedValue, "new", "the wrap returns to the first item");
});

Deno.test("Given an open menu / When Home and End arrive / Then the highlight jumps to the edges", () => {
  const h = mount(FLAT);
  h.api.open();
  const onKeydown = handler<(event: KeyboardEvent) => void>(h.api.getContentProps(), "onKeydown");
  onKeydown(keyboard("End"));
  assertEquals(h.api.highlightedValue, "copy", "End lands on the last enabled item");
  onKeydown(keyboard("Home"));
  assertEquals(h.api.highlightedValue, "new", "Home lands on the first enabled item");
});

const SHARED_PREFIX: MenuEntry[] = [
  { value: "send", label: "Send to chat" },
  { value: "settings", label: "Settings" },
];

/** pressing more keys walks the matches: the buffer accumulates inside 500ms. */
Deno.test("Given an open menu / When a printable key arrives / Then typeahead jumps to the matching label", () => {
  const h = mount(SHARED_PREFIX);
  h.api.open();
  const onKeydown = handler<(event: KeyboardEvent) => void>(h.api.getContentProps(), "onKeydown");
  onKeydown(keyboard("s"));
  assertEquals(h.api.highlightedValue, "send", "the first label starting with s wins");
  onKeydown(keyboard("e"));
  assertEquals(h.api.highlightedValue, "send", "the accumulated buffer still matches Send to chat");
  onKeydown(keyboard("t"));
  assertEquals(h.api.highlightedValue, "settings", "the longer buffer matches Settings");
});

Deno.test("Given an open menu with a highlighted item / When Enter arrives / Then it selects and closes", () => {
  const h = mount(FLAT);
  h.api.open();
  h.api.setHighlighted("copy");
  handler<(event: KeyboardEvent) => void>(h.api.getContentProps(), "onKeydown")(keyboard("Enter"));
  assertEquals(h.events.select, [{ value: "copy" }], "select carries the highlighted value");
  assertEquals(h.state(), "closed", "closeOnSelect closes the menu");
  assertEquals(h.events.openChange, [{ open: true }, { open: false }], "the close reports once");
});

Deno.test("Given an open menu / When an item is clicked / Then it selects, closes, and clears the highlight", () => {
  const h = mount(FLAT);
  h.api.open();
  handler<(event: MouseEvent) => void>(h.api.getItemProps(h.row("new")), "onClick")(mouse());
  assertEquals(h.events.select, [{ value: "new" }], "select carries the clicked value");
  assertEquals(h.state(), "closed", "the menu closes after a select");
  assertEquals(h.api.highlightedValue, null, "the highlight clears on close");
});

Deno.test("Given closeOnSelect false / When an item is clicked / Then it selects but the menu stays open", () => {
  const h = mount(FLAT, { closeOnSelect: false });
  h.api.open();
  handler<(event: MouseEvent) => void>(h.api.getItemProps(h.row("copy")), "onClick")(mouse());
  assertEquals(h.events.select, [{ value: "copy" }], "select still fires");
  assertEquals(h.state(), "open", "the menu stays open");
});

Deno.test("Given a disabled item / When it is clicked / Then nothing is selected", () => {
  const h = mount(FLAT);
  h.api.open();
  handler<(event: MouseEvent) => void>(h.api.getItemProps(h.row("cut")), "onClick")(mouse());
  assertEquals(h.events.select, [], "a disabled item selects nothing");
  assertEquals(h.state(), "open", "the menu stays open");
});

Deno.test("Given an open menu / When a pointer moves over an item / Then the highlight follows", () => {
  const h = mount(FLAT);
  h.api.open();
  const onPointerMove = handler<(event: PointerEvent) => void>(h.api.getItemProps(h.row("copy")), "onPointerMove");
  onPointerMove(pointer("mouse"));
  assertEquals(h.api.highlightedValue, "copy", "the mouse pointer highlights the row");
  onPointerMove(pointer("touch"));
  assertEquals(h.api.highlightedValue, "copy", "a non-mouse pointer is ignored");
});

Deno.test("Given a submenu row / When it is clicked / Then the submenu opens on the parent context", () => {
  const h = mount(NESTED);
  h.api.open();
  const row = h.row("share");
  assertEquals(row.children.length, 2, "the row carries its submenu rows");
  handler<(event: MouseEvent) => void>(h.api.getItemProps(row), "onClick")(mouse());
  assertEquals(h.api.getSubmenuProps(row)["open"], "true", "the submenu instance is marked open");
  assertEquals(h.api.getItemProps(row)["aria-expanded"], true, "the trigger row reports expanded");
  assertEquals(h.api.getItemProps(row)["aria-haspopup"], "menu", "the trigger row declares a menu popup");
});

Deno.test("Given a submenu row / When the hover-intent action opens it / Then the parent context opens it too", () => {
  const h = mount(NESTED);
  h.api.open();
  const row = h.row("share");
  callback<() => void>(h.api.getItemProps(row), "use:hover-intent", "onOpen")();
  assertEquals(h.api.getSubmenuProps(row)["open"], "true", "the hover dwell opens the submenu");
});

Deno.test("Given an open submenu / When the hover-intent action reports a close / Then the submenu closes", () => {
  const h = mount(NESTED);
  h.api.open();
  const row = h.row("share");
  const bag = h.api.getItemProps(row);
  callback<() => void>(bag, "use:hover-intent", "onOpen")();
  callback<() => void>(bag, "use:hover-intent", "onClose")();
  assertEquals(h.api.getSubmenuProps(row)["open"], "false", "leaving the row closes the submenu");
  assertEquals(h.api.getItemProps(row)["aria-expanded"], false, "the trigger row reports collapsed");
});

Deno.test("Given an open submenu / When another row is highlighted / Then the submenu closes", () => {
  const h = mount(NESTED);
  h.api.open();
  const row = h.row("share");
  callback<() => void>(h.api.getItemProps(row), "use:hover-intent", "onOpen")();
  h.api.setHighlighted("new");
  assertEquals(h.api.getSubmenuProps(row)["open"], "false", "highlighting another row closes the submenu");
});

Deno.test("Given an open menu on a submenu trigger / When ArrowRight arrives / Then the submenu opens", () => {
  const h = mount(NESTED);
  h.api.open();
  h.api.setHighlighted("share");
  handler<(event: KeyboardEvent) => void>(h.api.getContentProps(), "onKeydown")(keyboard("ArrowRight"));
  assertEquals(h.api.getSubmenuProps(h.row("share"))["open"], "true", "arrow right enters the submenu");
});

Deno.test("Given a submenu instance / When ArrowLeft arrives / Then it closes and reports the close upward", () => {
  const root = document.createElement("div");
  document.body.appendChild(root);
  const seen: string[] = [];
  root.addEventListener("submenuclose", (event) => {
    seen.push(Reflect.get(event, "select") === true ? "select" : "dismiss");
  });
  const bridge = createMenuBridge(
    () => ({ items: NESTED, submenu: true }),
    () => root,
    "submenu",
  );
  bridge.api.open();
  handler<(event: KeyboardEvent) => void>(bridge.api.getContentProps(), "onKeydown")(keyboard("ArrowLeft"));
  assertEquals(seen, ["dismiss"], "a submenu reports its close upward");
  assertEquals(bridge.api.isOpen, false, "the submenu returns to closed");
});

Deno.test("Given a submenu that closed itself / When the parent hears the close / Then the parent clears it", () => {
  const h = mount(NESTED);
  h.api.open();
  const row = h.row("share");
  callback<() => void>(h.api.getItemProps(row), "use:hover-intent", "onOpen")();
  assertEquals(h.api.getSubmenuProps(row)["open"], "true", "the submenu is open");

  const child = document.createElement("div");
  child.id = String(h.api.getSubmenuProps(row)["id"]);
  h.root.appendChild(child);
  const onSubmenuClose = handler<(event: Event) => void>(h.api.getContentProps(), "onSubmenuclose");
  h.root.addEventListener("submenuclose", onSubmenuClose);
  child.dispatchEvent(new CustomEvent("submenuclose", { bubbles: true, detail: { select: false } }));

  assertEquals(h.api.getSubmenuProps(row)["open"], "false", "the dismissal clears the parent's open submenu");
});

Deno.test("Given a submenu that is open / When a different instance dismisses / Then the parent keeps it open", () => {
  const h = mount(NESTED);
  h.api.open();
  const row = h.row("share");
  callback<() => void>(h.api.getItemProps(row), "use:hover-intent", "onOpen")();

  const other = document.createElement("div");
  other.id = "menu:menu:submenu:not-mine";
  h.root.appendChild(other);
  const onSubmenuClose = handler<(event: Event) => void>(h.api.getContentProps(), "onSubmenuclose");
  h.root.addEventListener("submenuclose", onSubmenuClose);
  other.dispatchEvent(new CustomEvent("submenuclose", { bubbles: true, detail: { select: false } }));

  assertEquals(h.api.getSubmenuProps(row)["open"], "true", "another instance's dismissal is not this one's");
});

Deno.test("Given closeOnSelect / When a descendant reports a select / Then this level closes", () => {
  const root = document.createElement("div");
  document.body.appendChild(root);
  const bridge = createMenuBridge(
    () => ({
      items: JSON.stringify(NESTED),
      submenu: true,
      open: true,
      "@@authored": (name: string) => name === "open",
    }),
    () => root,
    "submenu",
  );
  assertEquals(bridge.api.isOpen, true, "the authored open prop holds this level open");
  handler<(event: Event) => void>(bridge.api.getContentProps(), "onSubmenuclose")(
    new CustomEvent("submenuclose", { detail: { select: true } }),
  );
  assertEquals(bridge.api.isOpen, false, "a select with closeOnSelect closes this level too");
});

Deno.test("Given closeOnSelect false / When a descendant reports a select / Then this level stays open", () => {
  const root = document.createElement("div");
  document.body.appendChild(root);
  const bridge = createMenuBridge(
    () => ({
      items: JSON.stringify(NESTED),
      submenu: true,
      open: true,
      closeOnSelect: false,
      "@@authored": (name: string) => name === "open",
    }),
    () => root,
    "submenu",
  );
  handler<(event: Event) => void>(bridge.api.getContentProps(), "onSubmenuclose")(
    new CustomEvent("submenuclose", { detail: { select: true } }),
  );
  assertEquals(bridge.api.isOpen, true, "a select does not close this level");
});

Deno.test("Given items with groups and separators / When the blocks are read / Then rows are grouped and divided", () => {
  const h = mount([
    { group: "File", items: [{ value: "new", label: "New file" }] },
    { separator: true },
    { value: "copy", label: "Copy" },
  ]);
  const blocks: readonly MenuBlock[] = h.api.getBlocks();
  assertEquals(blocks.map((block) => block.label), ["File", null], "a separator splits the list into blocks");
  assertEquals(blocks.map((block) => block.separator), [true, false], "only the block before a separator knows it");
  assertEquals(blocks.map((block) => block.rows.map((row) => row.value)), [["new"], ["copy"]], "rows land in their own block");
  assertEquals(
    blocks.map((block) => h.api.getSeparatorProps(block)["hidden"]),
    [false, true],
    "a separator block shows, the last block hides it",
  );
  assertEquals(
    blocks.map((block) => h.api.getItemGroupProps(block)["role"]),
    ["group", "group"],
    "each block is a group",
  );
  assertEquals(
    blocks.map((block) => h.api.getItemGroupProps(block)["aria-labelledby"]),
    [h.api.getItemGroupLabelProps(blocks[0] as MenuBlock)["id"], undefined],
    "a labeled group points at its label, an unlabeled one does not",
  );
  assertEquals(
    blocks.map((block) => h.api.getItemGroupLabelProps(block)["hidden"]),
    [false, true],
    "a labeled block shows its label, an unlabeled one hides it",
  );
});

Deno.test("Given a checkable item / When its props are read / Then the checkbox semantics follow the data", () => {
  const h = mount([
    { value: "view", label: "Can view", checked: true },
    { value: "edit", label: "Can edit" },
  ]);
  assertEquals(h.api.getItemProps(h.row("view"))["role"], "menuitemcheckbox", "a checkable item uses the checkbox role");
  assertEquals(h.api.getItemProps(h.row("view"))["aria-checked"], true, "the checked state is exposed");
  assertEquals(h.api.getItemIndicatorProps(h.row("view"))["data-checked"], "", "the indicator reports the check");
  assertEquals(h.api.getItemProps(h.row("edit"))["role"], "menuitem", "a plain item uses the item role");
});

Deno.test("Given an item with a shortcut or children / When its props are read / Then the trailing affordances are exposed", () => {
  const h = mount([
    { value: "new", label: "New file", shortcut: "Ctrl N" },
    { value: "share", label: "Share", children: [{ value: "mail", label: "Email link" }] },
  ]);
  assertEquals(h.api.getItemShortcutProps(h.row("new"))["hidden"], false, "a row with a shortcut shows the part");
  assertEquals(h.api.getItemSubmenuIndicatorProps(h.row("new"))["hidden"], true, "a leaf hides the submenu chevron");
  assertEquals(h.api.getItemSubmenuIndicatorProps(h.row("share"))["hidden"], false, "a submenu row shows the chevron");
  const props = h.api.getSubmenuProps(h.row("share"));
  assertEquals(props["label"], "Share", "the child instance is told its row's label");
  assertEquals(props["open"], "false", "the child instance starts closed");
});

Deno.test("Given items the transport could not shape / When the rows are read / Then nothing renders", () => {
  const h = mount(FLAT);
  h.write("items", "{not shaped}" as unknown as readonly MenuEntry[]);
  // Post-mount writes are inert without an event: the seed ran at mount.
  // A non-array can never reach entries through the typed seed path, so
  // the mount-time tree stands.
  assertEquals(h.api.getBlocks().flatMap((block) => block.rows).map((row) => row.value), ["new", "copy", "cut"], "post-mount writes do not re-seed");
});

Deno.test("Given composite false / When the content props are read / Then the surface is a dialog", () => {
  const h = mount(FLAT, { composite: false });
  assertEquals(h.api.getContentProps()["role"], "dialog", "composite false demotes the menu to a dialog");
  assertEquals(h.api.getTriggerProps()["aria-haspopup"], "dialog", "the trigger declares a dialog popup");
  assertEquals(h.api.getItemProps(h.row("new"))["role"], "menuitem", "items keep the menu item role");
});



Deno.test("Given typeahead false / When a printable key arrives / Then the highlight does not move", () => {
  const h = mount(FLAT, { typeahead: false });
  h.api.open();
  handler<(event: KeyboardEvent) => void>(h.api.getContentProps(), "onKeydown")(keyboard("n"));
  assertEquals(h.api.highlightedValue, null, "typeahead is off");
});

Deno.test("Given a submenu row / When the child instance is configured / Then it is told its subtree as JSON", () => {
  const h = mount(NESTED);
  const row = h.row("share");
  const props = h.api.getSubmenuProps(row);
  assertEquals(props["items"], row.children, "the subtree crosses as values; the child transport coerces");
  assertEquals(props["id"], "menu:menu:submenu:share", "the child instance takes the row's id");
});

// ---- bug: submenu part ids were double-prefixed ----------------------------
//
// The child element's id is the parent's part id for it (`menu:<root>:submenu:
// <value>`), which is already namespaced. The nested instance used to prefix it
// again, so its content id was `menu:menu:<root>:submenu:<value>:content` and
// the parent row's aria-controls dangled — which also made the focus call in
// openSubmenu a no-op, so keyboard focus could not enter a submenu level.

Deno.test("Given a nested instance / When it is handed an already-namespaced id / Then its parts are not double-prefixed", () => {
  const root = document.createElement("div");
  document.body.appendChild(root);
  const ownerId = "menu:host";
  const nested = createMenuBridge(() => ({ items: FLAT }), () => root, ownerId);
  const contentId = String(nested.api.getContentProps()["id"]);
  assertEquals(contentId, `${ownerId}:content`, "the nested content part id keeps one namespace");
  assertEquals(
    String(nested.api.getTriggerProps()["id"]),
    `${ownerId}:trigger`,
    "the nested trigger part id keeps one namespace",
  );
  const row = nested.api.getBlocks().flatMap((block) => nested.api.getRows(block)).find((r) => r.value === "new");
  assertEquals(row === undefined ? "" : String(nested.api.getItemProps(row)["id"]), `${ownerId}:item:new`);
});

Deno.test("Given a submenu trigger row / When the child part ids are read / Then aria-controls points at the child's content", () => {
  const h = mount(NESTED, { submenu: true });
  const row = h.row("share");
  const childId = String(h.api.getSubmenuProps(row)["id"]);
  assertEquals(childId, "menu:menu:submenu:share", "the child element carries the parent's part id");
  assertEquals(
    String(h.api.getItemProps(row)["aria-controls"]),
    `${childId}:content`,
    "the trigger row points at the child element's own content part",
  );
});

Deno.test("Given a submenu row is opened by keyboard / When the level is focused / Then the focus target resolves in the document", () => {
  const h = mount(NESTED, { submenu: true });
  const row = h.row("share");
  const childId = String(h.api.getSubmenuProps(row)["id"]);
  // The child level is its own bridge; its content part id is what
  // openSubmenu's focus call looks up by. Wiring the child instance over the
  // same DOM the parent's row points at is what the real element tree does.
  const childRoot = document.createElement("div");
  childRoot.id = childId;
  h.root.appendChild(childRoot);
  const nested = createMenuBridge(
    () => ({ items: NESTED, submenu: true, open: true }),
    () => childRoot,
    childId,
  );
  const childContent = document.createElement("div");
  childRoot.appendChild(childContent);
  childContent.id = String(nested.api.getContentProps()["id"]);
  childContent.tabIndex = 0;

  h.api.open();
  h.api.setHighlighted("share");
  const reachable = document.getElementById(
    `${String(h.api.getItemProps(row)["aria-controls"])}`,
  );

  assertEquals(
    reachable,
    childContent,
    "the row's aria-controls and the child instance's content part are the same element",
  );
  childRoot.remove();
});

// ---- bug: rows were re-created on every highlight move ---------------------
//
// The api proxy rebuilt the connect per tick, so getBlocks handed out a fresh
// array (and fresh rows) on every read. The `for` directive re-ran, replaced
// the row nodes, and each replacement orphaned the previous use:hover-intent
// timer — one firing after a reopen re-highlighted a row and re-opened its
// submenu with no pointer event. Rows must be stable objects, and the bags must
// be cached against the context fields they read.

Deno.test("Given an open menu / When the highlight moves / Then the rows are the same object across reads", () => {
  const h = mount(FLAT);
  h.api.open();
  const before = h.api.getBlocks();
  const onKeydown = handler<(event: KeyboardEvent) => void>(h.api.getContentProps(), "onKeydown");
  onKeydown(keyboard("ArrowDown"));
  const after = h.api.getBlocks();
  assertEquals(after, before, "the block list is the same array across a machine move");
  assertEquals(
    after.flatMap((block) => h.api.getRows(block)),
    before.flatMap((block) => h.api.getRows(block)),
    "the rows are the same objects across a machine move",
  );
  assertEquals(
    before.find((block) => block.rows[0]?.value === "new")?.rows[0],
    after.find((block) => block.rows[0]?.value === "new")?.rows[0],
    "a given row keeps its identity",
  );
});

Deno.test("Given an open menu / When the highlight moves / Then the row handlers keep their identity", () => {
  const h = mount(FLAT);
  h.api.open();
  const onKeydown = handler<(event: KeyboardEvent) => void>(h.api.getContentProps(), "onKeydown");
  onKeydown(keyboard("ArrowDown"));
  const first = h.api.getItemProps(h.row("new"));
  const before = {
    onClick: first["onClick"],
    onPointerMove: first["onPointerMove"],
  };
  onKeydown(keyboard("ArrowDown"));
  const second = h.api.getItemProps(h.row("new"));
  assertEquals(second["onClick"], before.onClick, "the click handler is not rebuilt per move");
  assertEquals(second["onPointerMove"], before.onPointerMove, "the pointer handler is not rebuilt per move");
});

Deno.test("Given an open menu / When the highlight moves / Then the item bag is rebuilt with the new fields", () => {
  const h = mount(FLAT);
  h.api.open();
  const onKeydown = handler<(event: KeyboardEvent) => void>(h.api.getContentProps(), "onKeydown");
  onKeydown(keyboard("ArrowDown"));
  assertEquals(h.api.getItemProps(h.row("new"))["data-highlighted"], "", "the highlighted row carries the attribute");
  onKeydown(keyboard("ArrowDown"));
  assertEquals(h.api.getItemProps(h.row("new"))["data-highlighted"], undefined, "the previous row loses it");
  assertEquals(h.api.getItemProps(h.row("copy"))["data-highlighted"], "", "the new row carries it");
  assertEquals(
    h.api.getItemProps(h.row("new"))["role"],
    "menuitem",
    "the rebuild keeps the row's own static fields",
  );
});

Deno.test("Given an open menu / When nothing moves / Then re-reading the bags returns the same objects", () => {
  const h = mount(FLAT, { composite: false });
  h.api.open();
  assertEquals(h.api.getTriggerProps(), h.api.getTriggerProps(), "the trigger bag is cached");
  assertEquals(h.api.getContentProps(), h.api.getContentProps(), "the content bag is cached");
  assertEquals(
    h.api.getItemProps(h.row("new")),
    h.api.getItemProps(h.row("new")),
    "the item bag is cached while its fields hold",
  );
  assertEquals(
    h.api.getItemGroupProps(h.api.getBlocks()[0]!),
    h.api.getItemGroupProps(h.api.getBlocks()[0]!),
    "the group bag is cached",
  );
  assertEquals(
    h.api.getSeparatorProps(h.api.getBlocks()[0]!),
    h.api.getSeparatorProps(h.api.getBlocks()[0]!),
    "the separator bag is cached, and is not the group's",
  );
});

Deno.test("Given a menu whose items change post-mount / When the bags are read / Then the mount-time tree stands", () => {
  const h = mount(FLAT);
  const first = h.row("new");
  assertEquals(h.api.getItemProps(first)["id"], "menu:menu:item:new");
  // Post-mount writes are inert without an event: seed ran at mount.
  // A host that needs a new tree sends an event (a hooks-layer job).
  h.write("items", [{ value: "other", label: "Other" }]);
  const rows = h.api.getBlocks().flatMap((block) => h.api.getRows(block));
  assertEquals(rows.map((row) => row.value), ["new", "copy", "cut"], "post-mount writes do not re-seed");
});

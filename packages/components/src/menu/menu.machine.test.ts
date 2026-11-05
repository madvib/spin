import { test } from "bun:test";
import { deepStrictEqual } from "node:assert/strict";
import { parseHTML } from "@spinjs/runtime/testing";
import { signal } from "@spinjs/runtime";
import { menu } from "./menu.presentation.ts";
const createMenuBridge = menu.createBridge;
import type { MenuApi } from "./menu.presentation.ts";
import type { MenuBlock, MenuEntry, MenuRow } from "./menu.state.ts";
import type {
  MenuHighlightChange,
  MenuOpenChange,
  MenuSelect,
} from "./menu.events.ts";

/** A live writable read, as the element's prop store exposes one. */
type WriteSignal = { (): unknown; (value: unknown): void };

const win = parseHTML(
  "<!doctype html><html><body></body></html>",
) as unknown as Record<string, unknown>;
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
function callback<H>(
  bag: Record<string, unknown>,
  action: string,
  name: string,
): H {
  const params: unknown = bag[action];
  if (typeof params !== "object" || params === null) {
    throw new Error(`no action param at ${action}`);
  }
  return handler<H>(params as Record<string, unknown>, name);
}

/**
 * linkedom ships no KeyboardEvent/MouseEvent/PointerEvent constructors, so the
 * events the handlers need are synthesized here — one place, with the minimal
 * field set each handler reads.
 */
const keyboard = (key: string): KeyboardEvent =>
  ({
    key,
    defaultPrevented: false,
    preventDefault: () => {},
  }) as unknown as KeyboardEvent;
const pointer = (pointerType: string): PointerEvent =>
  ({ pointerType }) as PointerEvent;
const mouse = (): MouseEvent =>
  ({ currentTarget: null }) as unknown as MouseEvent;

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
  write(
    "onOpenChange",
    (change: MenuOpenChange) => events.openChange.push(change),
  );
  write("onSelect", (change: MenuSelect) => events.select.push(change));
  write(
    "onHighlightChange",
    (change: MenuHighlightChange) => events.highlightChange.push(change),
  );
  const bridge = createMenuBridge(
    () => {
      const record: Record<string, unknown> = {};
      for (const [name, source] of Object.entries(values)) {
        record[name] = source();
      }
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
      const found = bridge.api.getBlocks().flatMap((block) =>
        bridge.api.getRows(block)
      )
        .find((row) => row.value === value);
      if (found === undefined) throw new Error(`no row ${value}`);
      return found;
    },
    state: () => bridge.api.getContentProps()["data-state"],
    write,
  };
}

test("Given a fresh menu / When nothing is authored / Then closed is the reachable start state", () => {
  const h = mount(FLAT);
  deepStrictEqual(h.state(), "closed", "closed is the initial state");
  deepStrictEqual(h.api.isOpen, false, "the api reports closed");
  deepStrictEqual(
    h.api.getTriggerProps()["aria-expanded"],
    false,
    "the trigger reports collapsed",
  );
  h.api.close();
  deepStrictEqual(h.state(), "closed", "a close from closed is a no-op");
});

test("Given defaultOpen true / When the menu mounts / Then the open state is the reachable start", () => {
  const h = mount(FLAT, { defaultOpen: true });
  deepStrictEqual(h.state(), "open", "defaultOpen seeds the open state");
  deepStrictEqual(h.api.isOpen, true, "the api reports open");
  deepStrictEqual(
    h.api.getTriggerProps()["aria-expanded"],
    true,
    "the trigger reports expanded",
  );
});

test("Given a closed menu / When the trigger is clicked / Then it opens and reports open-change", () => {
  const h = mount(FLAT);
  handler<() => void>(h.api.getTriggerProps(), "onClick")();
  deepStrictEqual(h.state(), "open", "the click opens the menu");
  deepStrictEqual(
    h.events.openChange,
    [{ open: true }],
    "open-change fires once on the way open",
  );
});

test("Given an open menu / When the trigger is clicked again / Then it closes and reports open-change", () => {
  const h = mount(FLAT);
  handler<() => void>(h.api.getTriggerProps(), "onClick")();
  handler<() => void>(h.api.getTriggerProps(), "onClick")();
  deepStrictEqual(h.state(), "closed", "the toggle closes the menu");
  deepStrictEqual(
    h.events.openChange,
    [{ open: true }, { open: false }],
    "both directions report",
  );
});

test("Given a closed menu / When the open command runs / Then the machine takes the open state", () => {
  const h = mount(FLAT);
  h.api.open();
  deepStrictEqual(h.state(), "open", "the command moves to open");
  deepStrictEqual(
    h.events.openChange,
    [{ open: true }],
    "open-change reports the command",
  );
});

test("Given an open menu / When the close command runs / Then the machine returns to closed", () => {
  const h = mount(FLAT);
  h.api.open();
  h.api.close();
  deepStrictEqual(h.state(), "closed", "the command returns to closed");
  deepStrictEqual(
    h.events.openChange,
    [{ open: true }, { open: false }],
    "open-change reports both moves",
  );
});

test("Given an open menu / When the dismissable action reports Escape / Then it closes", () => {
  const h = mount(FLAT);
  h.api.open();
  callback<() => void>(
    h.api.getContentProps(),
    "use:dismissable",
    "onEscape",
  )();
  deepStrictEqual(h.state(), "closed", "escape closes the menu");
  deepStrictEqual(
    h.events.openChange,
    [{ open: true }, { open: false }],
    "the close reports once",
  );
});

test("Given an open menu / When a press outside is reported / Then it closes", () => {
  const h = mount(FLAT);
  h.api.open();
  callback<(event: PointerEvent) => void>(
    h.api.getContentProps(),
    "use:dismissable",
    "onOutside",
  )({
    target: document.createElement("div"),
  } as unknown as PointerEvent);
  deepStrictEqual(h.state(), "closed", "an outside press closes the menu");
});

test("Given an open menu / When the trigger id is excluded / Then the content passes it to dismissable", () => {
  const h = mount(FLAT);
  h.api.open();
  const params = h.api.getContentProps()["use:dismissable"] as {
    excludeId?: unknown;
  };
  deepStrictEqual(
    params.excludeId,
    h.api.getTriggerProps()["id"],
    "the trigger exclusion travels in the action param, not a def query",
  );
});

test("Given an authored open prop at mount / When the menu starts / Then it opens without an event", () => {
  const h = mount(FLAT, { open: true });
  // mount() authors every override: here `open` is authored at seed time,
  // which is the only moment outer writes reach the machine. Post-mount
  // writes travel as events (a hooks-layer job), never channels.
  deepStrictEqual(h.state(), "open", "authored open at seed opens the menu");
});

test("Given defaultOpen at mount / When the menu starts / Then it opens", () => {
  const h = mount(FLAT, { defaultOpen: true });
  deepStrictEqual(h.state(), "open", "uncontrolled default opens the menu");
});

test("Given a closed menu / When the context menu event carries a point / Then it opens at that point", () => {
  const h = mount(FLAT);
  let prevented = false;
  handler<(event: MouseEvent) => void>(
    h.api.getContextTriggerProps(),
    "onContextMenu",
  )({
    clientX: 120,
    clientY: 64,
    preventDefault: () => {
      prevented = true;
    },
  } as unknown as MouseEvent);
  deepStrictEqual(h.state(), "open", "the context menu opens the menu");
  deepStrictEqual(prevented, true, "the native context menu is prevented");
});

test("Given a closed menu / When the positioner props are read / Then the anchor action carries placement and no vars", () => {
  const h = mount(FLAT);
  const bag = h.api.getPositionerProps() as Record<string, unknown>;
  deepStrictEqual(
    bag["style"],
    undefined,
    "coordinates are the action's writes, not bag styles",
  );
  deepStrictEqual(
    bag["use:anchor"],
    { placement: "bottom", offset: 8 },
    "the bag declares behavior; the action positions",
  );
  deepStrictEqual(bag["hidden"], true, "a closed menu is out of layout");
});

test("Given a closed menu / When the long-press action fires / Then the context menu opens", () => {
  const h = mount(FLAT);
  callback<(point: { x: number; y: number }) => void>(
    h.api.getContextTriggerProps(),
    "use:long-press",
    "onPress",
  )({ x: 40, y: 30 });
  deepStrictEqual(h.state(), "open", "the long press opens the menu");
});

test("Given a closed menu / When ArrowDown arrives on the trigger / Then it opens with the first item highlighted", () => {
  const h = mount(FLAT);
  handler<(event: KeyboardEvent) => void>(h.api.getTriggerProps(), "onKeydown")(
    keyboard("ArrowDown"),
  );
  deepStrictEqual(h.state(), "open", "arrow down opens the menu");
  deepStrictEqual(
    h.api.highlightedValue,
    "new",
    "the first enabled item is highlighted",
  );
});

test("Given a closed menu / When ArrowUp arrives on the trigger / Then it opens with the last item highlighted", () => {
  const h = mount(FLAT);
  handler<(event: KeyboardEvent) => void>(h.api.getTriggerProps(), "onKeydown")(
    keyboard("ArrowUp"),
  );
  deepStrictEqual(h.state(), "open", "arrow up opens the menu");
  deepStrictEqual(
    h.api.highlightedValue,
    "copy",
    "the last enabled item is highlighted, the disabled one skipped",
  );
});

test("Given an open menu / When the setHighlighted command runs / Then the highlight moves and reports", () => {
  const h = mount(FLAT);
  h.api.open();
  h.api.setHighlighted("copy");
  deepStrictEqual(
    h.api.highlightedValue,
    "copy",
    "the highlight follows the command",
  );
  deepStrictEqual(
    h.events.highlightChange,
    [{ highlightedValue: "copy" }],
    "highlight-change reports the move",
  );
  deepStrictEqual(
    h.api.getItemProps(h.row("copy"))["data-highlighted"],
    "",
    "the row carries data-highlighted",
  );
  deepStrictEqual(
    h.api.getItemProps(h.row("new"))["data-highlighted"],
    undefined,
    "other rows do not",
  );
});

test("Given an open menu / When arrows move the highlight / Then navigation walks the enabled rows", () => {
  const h = mount(FLAT);
  h.api.open();
  const onKeydown = handler<(event: KeyboardEvent) => void>(
    h.api.getContentProps(),
    "onKeydown",
  );
  onKeydown(keyboard("ArrowDown"));
  deepStrictEqual(
    h.api.highlightedValue,
    "new",
    "the first arrow lands on the first item",
  );
  onKeydown(keyboard("ArrowDown"));
  deepStrictEqual(
    h.api.highlightedValue,
    "copy",
    "the next arrow skips the separator and the disabled item",
  );
  onKeydown(keyboard("ArrowDown"));
  deepStrictEqual(
    h.api.highlightedValue,
    "copy",
    "without loopFocus the last enabled item is the boundary",
  );
  onKeydown(keyboard("ArrowUp"));
  deepStrictEqual(h.api.highlightedValue, "new", "arrow up walks back");
});

test("Given loopFocus / When the highlight runs past the last item / Then it wraps to the first", () => {
  const h = mount(FLAT, { loopFocus: true });
  h.api.open();
  const onKeydown = handler<(event: KeyboardEvent) => void>(
    h.api.getContentProps(),
    "onKeydown",
  );
  onKeydown(keyboard("ArrowDown"));
  onKeydown(keyboard("ArrowDown"));
  onKeydown(keyboard("ArrowDown"));
  deepStrictEqual(
    h.api.highlightedValue,
    "new",
    "the wrap returns to the first item",
  );
});

test("Given an open menu / When Home and End arrive / Then the highlight jumps to the edges", () => {
  const h = mount(FLAT);
  h.api.open();
  const onKeydown = handler<(event: KeyboardEvent) => void>(
    h.api.getContentProps(),
    "onKeydown",
  );
  onKeydown(keyboard("End"));
  deepStrictEqual(
    h.api.highlightedValue,
    "copy",
    "End lands on the last enabled item",
  );
  onKeydown(keyboard("Home"));
  deepStrictEqual(
    h.api.highlightedValue,
    "new",
    "Home lands on the first enabled item",
  );
});

const SHARED_PREFIX: MenuEntry[] = [
  { value: "send", label: "Send to chat" },
  { value: "settings", label: "Settings" },
];

/** pressing more keys walks the matches: the buffer accumulates inside 500ms. */
test("Given an open menu / When a printable key arrives / Then typeahead jumps to the matching label", () => {
  const h = mount(SHARED_PREFIX);
  h.api.open();
  const onKeydown = handler<(event: KeyboardEvent) => void>(
    h.api.getContentProps(),
    "onKeydown",
  );
  onKeydown(keyboard("s"));
  deepStrictEqual(
    h.api.highlightedValue,
    "send",
    "the first label starting with s wins",
  );
  onKeydown(keyboard("e"));
  deepStrictEqual(
    h.api.highlightedValue,
    "send",
    "the accumulated buffer still matches Send to chat",
  );
  onKeydown(keyboard("t"));
  deepStrictEqual(
    h.api.highlightedValue,
    "settings",
    "the longer buffer matches Settings",
  );
});

test("Given an open menu with a highlighted item / When Enter arrives / Then it selects and closes", () => {
  const h = mount(FLAT);
  h.api.open();
  h.api.setHighlighted("copy");
  handler<(event: KeyboardEvent) => void>(h.api.getContentProps(), "onKeydown")(
    keyboard("Enter"),
  );
  deepStrictEqual(
    h.events.select,
    [{ value: "copy" }],
    "select carries the highlighted value",
  );
  deepStrictEqual(h.state(), "closed", "closeOnSelect closes the menu");
  deepStrictEqual(
    h.events.openChange,
    [{ open: true }, { open: false }],
    "the close reports once",
  );
});

test("Given an open menu / When an item is clicked / Then it selects, closes, and clears the highlight", () => {
  const h = mount(FLAT);
  h.api.open();
  handler<(event: MouseEvent) => void>(
    h.api.getItemProps(h.row("new")),
    "onClick",
  )(mouse());
  deepStrictEqual(
    h.events.select,
    [{ value: "new" }],
    "select carries the clicked value",
  );
  deepStrictEqual(h.state(), "closed", "the menu closes after a select");
  deepStrictEqual(h.api.highlightedValue, null, "the highlight clears on close");
});

test("Given closeOnSelect false / When an item is clicked / Then it selects but the menu stays open", () => {
  const h = mount(FLAT, { closeOnSelect: false });
  h.api.open();
  handler<(event: MouseEvent) => void>(
    h.api.getItemProps(h.row("copy")),
    "onClick",
  )(mouse());
  deepStrictEqual(h.events.select, [{ value: "copy" }], "select still fires");
  deepStrictEqual(h.state(), "open", "the menu stays open");
});

test("Given a disabled item / When it is clicked / Then nothing is selected", () => {
  const h = mount(FLAT);
  h.api.open();
  handler<(event: MouseEvent) => void>(
    h.api.getItemProps(h.row("cut")),
    "onClick",
  )(mouse());
  deepStrictEqual(h.events.select, [], "a disabled item selects nothing");
  deepStrictEqual(h.state(), "open", "the menu stays open");
});

test("Given an open menu / When a pointer moves over an item / Then the highlight follows", () => {
  const h = mount(FLAT);
  h.api.open();
  const onPointerMove = handler<(event: PointerEvent) => void>(
    h.api.getItemProps(h.row("copy")),
    "onPointerMove",
  );
  onPointerMove(pointer("mouse"));
  deepStrictEqual(
    h.api.highlightedValue,
    "copy",
    "the mouse pointer highlights the row",
  );
  onPointerMove(pointer("touch"));
  deepStrictEqual(
    h.api.highlightedValue,
    "copy",
    "a non-mouse pointer is ignored",
  );
});

test("Given a submenu row / When it is clicked / Then the submenu opens on the parent context", () => {
  const h = mount(NESTED);
  h.api.open();
  const row = h.row("share");
  deepStrictEqual(row.children.length, 2, "the row carries its submenu rows");
  handler<(event: MouseEvent) => void>(h.api.getItemProps(row), "onClick")(
    mouse(),
  );
  deepStrictEqual(
    h.api.openSubmenu,
    "share",
    "the submenu level is marked open",
  );
  deepStrictEqual(
    h.api.getItemProps(row)["aria-expanded"],
    true,
    "the trigger row reports expanded",
  );
  deepStrictEqual(
    h.api.getItemProps(row)["aria-haspopup"],
    "menu",
    "the trigger row declares a menu popup",
  );
});

test("Given a submenu row / When the hover-delay action opens it / Then the parent context opens it too", () => {
  const h = mount(NESTED);
  h.api.open();
  const row = h.row("share");
  callback<() => void>(h.api.getItemProps(row), "use:hover-delay", "onOpen")();
  deepStrictEqual(
    h.api.openSubmenu,
    "share",
    "the hover dwell opens the submenu",
  );
});

test("Given an open submenu / When the hover-delay action reports a close / Then the submenu closes", () => {
  const h = mount(NESTED);
  h.api.open();
  const row = h.row("share");
  const bag = h.api.getItemProps(row);
  callback<() => void>(bag, "use:hover-delay", "onOpen")();
  callback<() => void>(bag, "use:hover-delay", "onClose")();
  deepStrictEqual(
    h.api.openSubmenu,
    null,
    "leaving the row closes the submenu",
  );
  deepStrictEqual(
    h.api.getItemProps(row)["aria-expanded"],
    false,
    "the trigger row reports collapsed",
  );
});

test("Given an open submenu / When the pointer crosses into it / Then the parent's pending close is void and leaving the submenu closes it", () => {
  const h = mount(NESTED);
  h.api.open();
  const row = h.row("share");
  const bag = h.api.getItemProps(row);
  callback<() => void>(bag, "use:hover-delay", "onOpen")();
  const blocks = h.api.getSubmenuBlocks(row);
  const child = h.api.getRows(blocks[0]!)[0]!;
  handler<(event: PointerEvent) => void>(
    h.api.getSubmenuItemProps(child),
    "onPointerMove",
  )(pointer("mouse"));
  callback<() => void>(bag, "use:hover-delay", "onClose")();
  deepStrictEqual(
    h.api.openSubmenu,
    "share",
    "the parent's close fires after the pointer arrived inside, so it is void",
  );
  callback<() => void>(
    h.api.getSubmenuContentProps(row),
    "use:hover-delay",
    "onClose",
  )();
  deepStrictEqual(
    h.api.openSubmenu,
    null,
    "leaving the submenu with the highlight inside closes it",
  );
});

test("Given an open submenu / When a move inside it bubbles to the parent row / Then the parent ignores it and the level stays open", () => {
  const h = mount(NESTED);
  h.api.open();
  const row = h.row("share");
  const bag = h.api.getItemProps(row);
  callback<() => void>(bag, "use:hover-delay", "onOpen")();
  const blocks = h.api.getSubmenuBlocks(row);
  const child = h.api.getRows(blocks[0]!)[0]!;
  handler<(event: PointerEvent) => void>(
    h.api.getSubmenuItemProps(child),
    "onPointerMove",
  )(pointer("mouse"));
  const inside = {
    closest: (selector: string): object | null =>
      selector === '[data-part="submenu-content"]' ? {} : null,
  };
  handler<(event: PointerEvent) => void>(bag, "onPointerMove")({
    pointerType: "mouse",
    target: new Proxy(inside, {
      getPrototypeOf: () => Element.prototype,
    }),
  } as unknown as PointerEvent);
  deepStrictEqual(
    h.api.openSubmenu,
    "share",
    "the bubbled move does not re-highlight the parent",
  );
  deepStrictEqual(
    h.api.highlightedValue,
    "mail",
    "the highlight stays on the child",
  );
});

test("Given an open submenu / When another row is highlighted / Then the submenu closes", () => {
  const h = mount(NESTED);
  h.api.open();
  const row = h.row("share");
  callback<() => void>(h.api.getItemProps(row), "use:hover-delay", "onOpen")();
  h.api.setHighlighted("new");
  deepStrictEqual(
    h.api.openSubmenu,
    null,
    "highlighting another row closes the submenu",
  );
});

test("Given an open menu on a submenu trigger / When ArrowRight arrives / Then the submenu opens", () => {
  const h = mount(NESTED);
  h.api.open();
  h.api.setHighlighted("share");
  handler<(event: KeyboardEvent) => void>(h.api.getContentProps(), "onKeydown")(
    keyboard("ArrowRight"),
  );
  deepStrictEqual(
    h.api.openSubmenu,
    "share",
    "arrow right enters the submenu",
  );
});

test("Given an open submenu / When a pointer moves over its item / Then the highlight moves and the level stays open", () => {
  const h = mount(NESTED);
  h.api.open();
  const row = h.row("share");
  callback<() => void>(h.api.getItemProps(row), "use:hover-delay", "onOpen")();
  const blocks = h.api.getSubmenuBlocks(row);
  deepStrictEqual(blocks.length, 1, "the children shape into one block");
  const child = h.api.getRows(blocks[0]!)[0]!;
  handler<(event: PointerEvent) => void>(
    h.api.getSubmenuItemProps(child),
    "onPointerMove",
  )(pointer("mouse"));
  deepStrictEqual(
    h.api.highlightedValue,
    "mail",
    "the child's row highlights",
  );
  deepStrictEqual(
    h.api.openSubmenu,
    "share",
    "highlighting within the level keeps it open",
  );
});

test("Given an open submenu / When arrows arrive on its content / Then the highlight walks the level", () => {
  const h = mount(NESTED);
  h.api.open();
  const row = h.row("share");
  callback<() => void>(h.api.getItemProps(row), "use:hover-delay", "onOpen")();
  const onKeydown = handler<(event: KeyboardEvent) => void>(
    h.api.getSubmenuContentProps(row),
    "onKeydown",
  );
  onKeydown(keyboard("ArrowDown"));
  deepStrictEqual(h.api.highlightedValue, "mail", "down takes the first child");
  onKeydown(keyboard("ArrowDown"));
  deepStrictEqual(h.api.highlightedValue, "chat", "down walks to the second child");
  deepStrictEqual(h.api.openSubmenu, "share", "walking the level keeps it open");
});

test("Given an open submenu / When arrows arrive on the parent content / Then the parent routes them to the level", () => {
  const h = mount(NESTED);
  h.api.open();
  h.api.setHighlighted("share");
  handler<(event: KeyboardEvent) => void>(h.api.getContentProps(), "onKeydown")(
    keyboard("ArrowRight"),
  );
  // DOM focus stays on the parent content (the level mounts after settled),
  // so the arrows land on the parent's handler and must reach the level.
  handler<(event: KeyboardEvent) => void>(h.api.getContentProps(), "onKeydown")(
    keyboard("ArrowDown"),
  );
  deepStrictEqual(
    h.api.highlightedValue,
    "mail",
    "the parent routes arrows into the open level",
  );
  deepStrictEqual(
    h.api.getContentProps()["aria-activedescendant"],
    "menu:menu:submenu-item:mail",
    "the active descendant points at the level's row",
  );
});

test("Given an open submenu / When ArrowLeft arrives on its content / Then the level closes onto its parent", () => {
  const h = mount(NESTED);
  h.api.open();
  const row = h.row("share");
  callback<() => void>(h.api.getItemProps(row), "use:hover-delay", "onOpen")();
  handler<(event: KeyboardEvent) => void>(
    h.api.getSubmenuContentProps(row),
    "onKeydown",
  )(keyboard("ArrowLeft"));
  deepStrictEqual(h.api.openSubmenu, null, "the submenu level closes");
  deepStrictEqual(
    h.api.highlightedValue,
    "share",
    "the highlight returns to the parent row",
  );
  deepStrictEqual(h.api.isOpen, true, "the parent menu stays open");
});

test("Given an open submenu / When its item is clicked / Then it selects and the menu closes", () => {
  const h = mount(NESTED);
  h.api.open();
  const row = h.row("share");
  callback<() => void>(h.api.getItemProps(row), "use:hover-delay", "onOpen")();
  const blocks = h.api.getSubmenuBlocks(row);
  const child = h.api.getRows(blocks[0]!)[1]!;
  handler<(event: MouseEvent) => void>(
    h.api.getSubmenuItemProps(child),
    "onClick",
  )(mouse());
  deepStrictEqual(h.events.select.length, 1, "the child's select reports");
  deepStrictEqual(h.events.select[0]?.value, "chat", "the child's value selects");
  deepStrictEqual(h.api.isOpen, false, "a submenu select closes the menu");
});

test("Given items with groups and separators / When the blocks are read / Then rows are grouped and divided", () => {
  const h = mount([
    { group: "File", items: [{ value: "new", label: "New file" }] },
    { separator: true },
    { value: "copy", label: "Copy" },
  ]);
  const blocks: readonly MenuBlock[] = h.api.getBlocks();
  deepStrictEqual(
    blocks.map((block) => block.label),
    ["File", null],
    "a separator splits the list into blocks",
  );
  deepStrictEqual(
    blocks.map((block) => block.separator),
    [true, false],
    "only the block before a separator knows it",
  );
  deepStrictEqual(blocks.map((block) => block.rows.map((row) => row.value)), [[
    "new",
  ], ["copy"]], "rows land in their own block");
  deepStrictEqual(
    blocks.map((block) => h.api.getSeparatorProps(block)["hidden"]),
    [false, true],
    "a separator block shows, the last block hides it",
  );
  deepStrictEqual(
    blocks.map((block) => h.api.getItemGroupProps(block)["role"]),
    ["group", "group"],
    "each block is a group",
  );
  deepStrictEqual(
    blocks.map((block) => h.api.getItemGroupProps(block)["aria-labelledby"]),
    [h.api.getItemGroupLabelProps(blocks[0] as MenuBlock)["id"], undefined],
    "a labeled group points at its label, an unlabeled one does not",
  );
  deepStrictEqual(
    blocks.map((block) => h.api.getItemGroupLabelProps(block)["hidden"]),
    [false, true],
    "a labeled block shows its label, an unlabeled one hides it",
  );
});

test("Given a checkable item / When its props are read / Then the checkbox semantics follow the data", () => {
  const h = mount([
    { value: "view", label: "Can view", checked: true },
    { value: "edit", label: "Can edit" },
  ]);
  deepStrictEqual(
    h.api.getItemProps(h.row("view"))["role"],
    "menuitemcheckbox",
    "a checkable item uses the checkbox role",
  );
  deepStrictEqual(
    h.api.getItemProps(h.row("view"))["aria-checked"],
    true,
    "the checked state is exposed",
  );
  deepStrictEqual(
    h.api.getItemIndicatorProps(h.row("view"))["data-checked"],
    "",
    "the indicator reports the check",
  );
  deepStrictEqual(
    h.api.getItemProps(h.row("edit"))["role"],
    "menuitem",
    "a plain item uses the item role",
  );
});

test("Given an item with a shortcut or children / When its props are read / Then the trailing affordances are exposed", () => {
  const h = mount([
    { value: "new", label: "New file", shortcut: "Ctrl N" },
    {
      value: "share",
      label: "Share",
      children: [{ value: "mail", label: "Email link" }],
    },
  ]);
  deepStrictEqual(
    h.api.getItemShortcutProps(h.row("new"))["hidden"],
    false,
    "a row with a shortcut shows the part",
  );
  deepStrictEqual(
    h.api.getItemSubmenuIndicatorProps(h.row("new"))["hidden"],
    true,
    "a leaf hides the submenu chevron",
  );
  deepStrictEqual(
    h.api.getItemSubmenuIndicatorProps(h.row("share"))["hidden"],
    false,
    "a submenu row shows the chevron",
  );
  const props = h.api.getSubmenuContentProps(h.row("share"));
  deepStrictEqual(
    props["data-state"],
    "closed",
    "the inline level starts closed",
  );
  deepStrictEqual(
    props["role"],
    "menu",
    "the inline level is a menu surface",
  );
});

test("Given items the transport could not shape / When the rows are read / Then nothing renders", () => {
  const h = mount(FLAT);
  h.write("items", "{not shaped}" as unknown as readonly MenuEntry[]);
  deepStrictEqual(
    h.api.getBlocks().flatMap((block) => block.rows).map((row) => row.value),
    [],
    "unshaped items coerce to an empty tree",
  );
});

test("Given composite false / When the content props are read / Then the surface is a dialog", () => {
  const h = mount(FLAT, { composite: false });
  deepStrictEqual(
    h.api.getContentProps()["role"],
    "dialog",
    "composite false demotes the menu to a dialog",
  );
  deepStrictEqual(
    h.api.getTriggerProps()["aria-haspopup"],
    "dialog",
    "the trigger declares a dialog popup",
  );
  deepStrictEqual(
    h.api.getItemProps(h.row("new"))["role"],
    "menuitem",
    "items keep the menu item role",
  );
});

test("Given typeahead false / When a printable key arrives / Then the highlight does not move", () => {
  const h = mount(FLAT, { typeahead: false });
  h.api.open();
  handler<(event: KeyboardEvent) => void>(h.api.getContentProps(), "onKeydown")(
    keyboard("n"),
  );
  deepStrictEqual(h.api.highlightedValue, null, "typeahead is off");
});

test("Given a submenu trigger row / When the inline level ids are read / Then aria-controls points at the submenu content", () => {
  const h = mount(NESTED);
  const row = h.row("share");
  const contentId = String(h.api.getSubmenuContentProps(row)["id"]);
  deepStrictEqual(
    contentId,
    "menu:menu:submenu-content:share",
    "the inline level carries the row's id",
  );
  deepStrictEqual(
    String(h.api.getItemProps(row)["aria-controls"]),
    contentId,
    "the trigger row points at the inline level's content",
  );
});

test("Given a submenu level / When its props are read / Then the part carries no placement of its own", () => {
  const h = mount(NESTED);
  const bag = h.api.getSubmenuContentProps(h.row("share")) as Record<string, unknown>;
  deepStrictEqual(
    "class" in bag,
    false,
    "the level's placement lives in the markup that renders it, where the content scan reads it",
  );
});

test("Given a submenu row is opened by keyboard / When the level is focused / Then the focus target resolves in the document", () => {
  const h = mount(NESTED);
  const row = h.row("share");
  const contentId = String(h.api.getSubmenuContentProps(row)["id"]);
  const level = document.createElement("div");
  level.id = contentId;
  level.tabIndex = 0;
  h.root.appendChild(level);

  h.api.open();
  h.api.setHighlighted("share");
  handler<(event: KeyboardEvent) => void>(h.api.getContentProps(), "onKeydown")(
    keyboard("ArrowRight"),
  );
  const reachable = document.getElementById(
    `${String(h.api.getItemProps(row)["aria-controls"])}`,
  );

  deepStrictEqual(
    reachable,
    level,
    "the row's aria-controls and the inline level are the same element",
  );
  level.remove();
});

// ---- bug: rows were re-created on every highlight move ---------------------
//
// The api proxy rebuilt the connect per tick, so getBlocks handed out a fresh
// array (and fresh rows) on every read. The `for` directive re-ran, replaced
// the row nodes, and each replacement orphaned the previous use:hover-delay
// timer — one firing after a reopen re-highlighted a row and re-opened its
// submenu with no pointer event. Rows must be stable objects, and the bags must
// be cached against the context fields they read.

test("Given an open menu / When the highlight moves / Then the rows are the same object across reads", () => {
  const h = mount(FLAT);
  h.api.open();
  const before = h.api.getBlocks();
  const onKeydown = handler<(event: KeyboardEvent) => void>(
    h.api.getContentProps(),
    "onKeydown",
  );
  onKeydown(keyboard("ArrowDown"));
  const after = h.api.getBlocks();
  deepStrictEqual(
    after,
    before,
    "the block list is the same array across a machine move",
  );
  deepStrictEqual(
    after.flatMap((block) => h.api.getRows(block)),
    before.flatMap((block) => h.api.getRows(block)),
    "the rows are the same objects across a machine move",
  );
  deepStrictEqual(
    before.find((block) => block.rows[0]?.value === "new")?.rows[0],
    after.find((block) => block.rows[0]?.value === "new")?.rows[0],
    "a given row keeps its identity",
  );
});

test("Given an open menu / When the highlight moves / Then the row handlers keep their identity", () => {
  const h = mount(FLAT);
  h.api.open();
  const onKeydown = handler<(event: KeyboardEvent) => void>(
    h.api.getContentProps(),
    "onKeydown",
  );
  onKeydown(keyboard("ArrowDown"));
  const first = h.api.getItemProps(h.row("new"));
  const before = {
    onClick: first["onClick"],
    onPointerMove: first["onPointerMove"],
  };
  onKeydown(keyboard("ArrowDown"));
  const second = h.api.getItemProps(h.row("new"));
  deepStrictEqual(
    second["onClick"],
    before.onClick,
    "the click handler is not rebuilt per move",
  );
  deepStrictEqual(
    second["onPointerMove"],
    before.onPointerMove,
    "the pointer handler is not rebuilt per move",
  );
});

test("Given an open menu / When the highlight moves / Then the item bag is rebuilt with the new fields", () => {
  const h = mount(FLAT);
  h.api.open();
  const onKeydown = handler<(event: KeyboardEvent) => void>(
    h.api.getContentProps(),
    "onKeydown",
  );
  onKeydown(keyboard("ArrowDown"));
  deepStrictEqual(
    h.api.getItemProps(h.row("new"))["data-highlighted"],
    "",
    "the highlighted row carries the attribute",
  );
  onKeydown(keyboard("ArrowDown"));
  deepStrictEqual(
    h.api.getItemProps(h.row("new"))["data-highlighted"],
    undefined,
    "the previous row loses it",
  );
  deepStrictEqual(
    h.api.getItemProps(h.row("copy"))["data-highlighted"],
    "",
    "the new row carries it",
  );
  deepStrictEqual(
    h.api.getItemProps(h.row("new"))["role"],
    "menuitem",
    "the rebuild keeps the row's own static fields",
  );
});

test("Given an open menu / When nothing moves / Then re-reading the bags returns the same objects", () => {
  const h = mount(FLAT, { composite: false });
  h.api.open();
  deepStrictEqual(
    h.api.getTriggerProps(),
    h.api.getTriggerProps(),
    "the trigger bag is cached",
  );
  deepStrictEqual(
    h.api.getContentProps(),
    h.api.getContentProps(),
    "the content bag is cached",
  );
  deepStrictEqual(
    h.api.getItemProps(h.row("new")),
    h.api.getItemProps(h.row("new")),
    "the item bag is cached while its fields hold",
  );
  deepStrictEqual(
    h.api.getItemGroupProps(h.api.getBlocks()[0]!),
    h.api.getItemGroupProps(h.api.getBlocks()[0]!),
    "the group bag is cached",
  );
  deepStrictEqual(
    h.api.getSeparatorProps(h.api.getBlocks()[0]!),
    h.api.getSeparatorProps(h.api.getBlocks()[0]!),
    "the separator bag is cached, and is not the group's",
  );
});

test("Given a closed menu / When the host writes new items / Then opening lists the new tree", () => {
  const h = mount(FLAT);
  h.write("items", [{ value: "other", label: "Other" }]);
  const rows = h.api.getBlocks().flatMap((block) => h.api.getRows(block));
  deepStrictEqual(
    rows.map((row) => row.value),
    ["other"],
    "host-written items land while closed",
  );
});

test("Given the menu component / When the compiler reads its fields / Then items is host-writable", () => {
  deepStrictEqual(
    (menu.fields as readonly string[]).includes("items"),
    true,
    "items is a declared element prop",
  );
});

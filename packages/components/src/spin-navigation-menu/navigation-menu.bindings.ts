import {
  coerceJsonArray,
  dataAttr,
  defineComponent,
  resolveTwins,
  type ComponentDef,
  type PartScope,
  type SlotScope,
} from "@spin/runtime";
import {
  navigationMenu as navigationMenuMachine,
  startState,
  type NavigationMenuArgs,
  type NavigationMenuContext,
  type NavigationMenuEvents,
  type NavigationMenuValueChange,
  type NavItemRecord,
} from "./navigation-menu.machine.ts";

/**
 * Navigation-menu definition: the DOM contract as data. The machine owns
 * the modes (idle/open) and the value moves; this file maps props to
 * channels, parts to attribute bags, commands to sends, and value
 * transitions to their event.
 *
 * The item bag carries one `hover-delay` action: the open report enters
 * (after the dwell), the close report closes (after the grace). The panel
 * renders INSIDE the item's row, so the item's hover-delay covers both:
 * moving from the link into the panel never leaves the subtree. The panel
 * positions against its row through the `anchor` action, whose geometry
 * rides the custom-property channel; the shared viewport Zag slides
 * between panels is deferred (panels open in place).
 */

export type { NavigationMenuValueChange, NavItemRecord };

export interface NavigationMenuApi {
  readonly value: string;
  readonly items: readonly NavItemRecord[];
  readonly open: boolean;
  show(value: string): void;
  hide(): void;
  toggle(value: string): void;
  getRootProps(): Record<string, unknown>;
  getItems(): readonly NavItemRecord[];
  getListProps(): Record<string, unknown>;
  getItemProps(item: NavItemRecord): Record<string, unknown>;
  getLinkProps(item: NavItemRecord): Record<string, unknown>;
  getItemContentProps(item: NavItemRecord): Record<string, unknown>;
}

/** The host's typed array never reaches here: the grammar coerces the
 * text to an array, and only well-shaped entries survive. */
const parseItems = (raw: unknown): readonly NavItemRecord[] => {
  const list: readonly unknown[] = Array.isArray(raw)
    ? raw
    : (typeof raw === "string" && raw.length > 0 ? coerceJsonArray(raw, []) : []);
  const items: NavItemRecord[] = [];
  for (const entry of list) {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) continue;
    const bag: Record<string, unknown> = { ...entry };
    const value: unknown = bag["value"];
    const label: unknown = bag["label"];
    if (typeof value !== "string" || typeof label !== "string") continue;
    items.push({ value, label });
  }
  return items;
};

interface ScopeLike extends PartScope<unknown, NavigationMenuContext> {}

interface SlotLike<R> extends SlotScope<R, NavigationMenuContext> {}

const itemsOf = (parsed: Record<string, unknown>): readonly NavItemRecord[] =>
  parseItems(parsed["items"]);

const def: ComponentDef<NavigationMenuContext, NavigationMenuEvents> = {
  name: "navigation-menu",
  machine: (props, authored) => navigationMenuMachine(props as NavigationMenuArgs, authored),
  start: (props, authored) =>
    startState(resolveTwins(props, authored) as NavigationMenuArgs),
  parts: {
    root: {
      sig: (scope) => [scope.state, scope.props["orientation"], scope.props["disabled"]].join(" "),
      attrs: (scope) => ({
        id: scope.id(""),
        "data-orientation": scope.props["orientation"],
        "data-state": scope.state === "open" ? "open" : "closed",
        "data-disabled": dataAttr(scope.props["disabled"] === true),
      }),
    },
    list: {
      sig: (scope) => [`${scope.props["orientation"]}`].join(" "),
      attrs: (scope) => ({
        id: scope.id("list"),
        role: "menubar",
        "data-orientation": scope.props["orientation"],
      }),
    },
  },
  slots: {
    item: {
      indexes: (_context, props: Record<string, unknown>) => itemsOf(props),
      sig: (scope: SlotLike<NavItemRecord>) => {
        const item = scope.slot;
        return [scope.context.value === item.value, scope.props["disabled"]].join(" ");
      },
      attrs: (scope: SlotLike<NavItemRecord>) => {
        const item = scope.slot;
        const ctx = scope.context;
        const open = ctx.value === item.value;
        return {
          id: scope.id("item", item.value),
          role: "menuitem",
          "aria-expanded": open,
          "aria-haspopup": "menu",
          "data-state": open ? "open" : "closed",
          "data-disabled": dataAttr(scope.props["disabled"] === true),
          "use:hover-delay": {
            openDelay: ctx.openDelay,
            closeDelay: ctx.closeDelay,
            onOpen: (): void => scope.send({ type: "ITEM.ENTER", value: item.value }),
            // A close report is stale the moment another item takes over:
            // the swap already moved the value, and this timer belongs to
            // the item the pointer left.
            onClose: (): void => {
              if (scope.context.value === item.value) scope.send({ type: "CLOSE" });
            },
          },
          onClick: (): void => {
            if (scope.props["disabled"] === true) return;
            scope.send({ type: "ITEM.TOGGLE", value: item.value });
          },
        };
      },
    },
    link: {
      indexes: (_context, props: Record<string, unknown>) => itemsOf(props),
      sig: (scope: SlotLike<NavItemRecord>) => {
        const item = scope.slot;
        return [scope.context.value === item.value, scope.props["disabled"]].join(" ");
      },
      attrs: (scope: SlotLike<NavItemRecord>) => {
        const item = scope.slot;
        const open = scope.context.value === item.value;
        return {
          id: scope.id("link", item.value),
          href: `#${item.value}`,
          "data-state": open ? "open" : "closed",
          "data-disabled": dataAttr(scope.props["disabled"] === true),
        };
      },
    },
    itemContent: {
      id: "content",
      indexes: (_context, props: Record<string, unknown>) => itemsOf(props),
      sig: (scope: SlotLike<NavItemRecord>) => {
        const item = scope.slot;
        return [scope.context.value === item.value, scope.props["orientation"]].join(" ");
      },
      attrs: (scope: SlotLike<NavItemRecord>) => {
        const item = scope.slot;
        const open = scope.context.value === item.value;
        return {
          id: scope.id("content", item.value),
          role: "menu",
          "aria-label": `${item.label} sub menu`,
          "data-state": open ? "open" : "closed",
          hidden: !open,
          // positioning owned by use:anchor (direct writes)
          "use:anchor": { placement: "bottom" },
        };
      },
    },
  },
  commands: {
    show: { event: (args) => ({ type: "ITEM.ENTER", value: typeof args[0] === "string" ? args[0] : "" }) },
    hide: { event: () => ({ type: "CLOSE" }) },
    toggle: { event: (args) => ({ type: "ITEM.TOGGLE", value: typeof args[0] === "string" ? args[0] : "" }) },
  },
  readers: {
    value: { read: (context) => context.value },
    items: { read: (_context, _state, props) => itemsOf(props) },
    open: { read: (_context, state) => state === "open" },
  },
  methods: {
    getItems: {
      call: (_context, _state, _args, props) => itemsOf(props),
    },
  },
  events: {
    "value-change": {
      prop: "onValueChange",
      watch: (context) => [context.value, context.previousValue],
      detail: (watched: readonly unknown[]) => {
        const value = watched[0];
        const previousValue = watched[1];
        return {
          value: typeof value === "string" ? value : "",
          previousValue: typeof previousValue === "string" ? previousValue : "",
        };
      },
    },
  },
};

export const navigationMenu = defineComponent<NavigationMenuContext, NavigationMenuEvents, NavigationMenuApi>(def);

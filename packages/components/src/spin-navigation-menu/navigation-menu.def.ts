import {
  dataAttr,
  defineComponent,
  textProp,
  type ComponentDef,
  type PartScope as ScopeLike,
} from "@spin/runtime";
import type { AnchorGeometry } from "@spin/runtime/actions";
import {
  config,
  implementations,
  type NavigationMenuContext,
  type NavigationMenuEvent,
  type NavigationMenuValueChange,
  type NavItemRecord,
} from "./navigation-menu.machine.ts";

/**
 * Navigation-menu definition: the DOM contract as data. The machine owns
 * the modes (idle/open) and the value moves; this file maps props to
 * channels, parts to attribute bags, commands to sends, and value
 * transitions to their event.
 *
 * Each item bag carries one `hover-delay` action whose open report enters
 * (after the dwell) and whose close report closes (after the grace). The
 * panel renders INSIDE the item's row, so the item's hover-delay covers
 * both: moving from the link into the panel never leaves the subtree.
 * The panel positions against its row through the `anchor` action, whose
 * geometry rides the custom-property channel; the shared viewport Zag
 * slides between panels is deferred (panels open in place).
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
  /** The item collection, for the recipe's row iteration. */
  getItems(): readonly NavItemRecord[];
  getListProps(): Record<string, unknown>;
  getItemProps(item: NavItemRecord): Record<string, unknown>;
  getLinkProps(item: NavItemRecord): Record<string, unknown>;
  getItemContentProps(item: NavItemRecord): Record<string, unknown>;
}

/** The JSON transport for the item collection. */
const parseItems = (raw: unknown): readonly NavItemRecord[] => {
  if (typeof raw !== "string" || raw.length === 0) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const items: NavItemRecord[] = [];
  for (const entry of parsed) {
    if (typeof entry !== "object" || entry === null) continue;
    const bag = entry as Record<string, unknown>;
    const value = bag["value"];
    const label = bag["label"];
    if (typeof value !== "string" || typeof label !== "string") continue;
    items.push({ value, label });
  }
  return items;
};

type Ctx = NavigationMenuContext;

const asCtx = (context: Record<string, unknown>): Ctx => context as unknown as Ctx;

const itemsOf = (parsed: Record<string, unknown>): readonly NavItemRecord[] =>
  parsed["items"] as readonly NavItemRecord[];

/** One geometry snapshot per item, keyed by bridge send: the anchor action
 * writes the measurement, and the content bag's signature reads it back. */
const geometryByBridge = new WeakMap<
  (event: { type: string } & Record<string, unknown>) => void,
  Map<string, AnchorGeometry>
>();
const geometryOf = (scope: ScopeLike, value: string): AnchorGeometry => {
  let byItem = geometryByBridge.get(scope.send);
  if (byItem === undefined) {
    byItem = new Map();
    geometryByBridge.set(scope.send, byItem);
  }
  const hit = byItem.get(value);
  if (hit !== undefined) return hit;
  const fresh: AnchorGeometry = { x: 0, y: 0, w: 0, h: 0, placement: "bottom" };
  byItem.set(value, fresh);
  return fresh;
};

const setGeometry = (
  scope: ScopeLike,
  value: string,
  next: AnchorGeometry,
): void => {
  let byItem = geometryByBridge.get(scope.send);
  if (byItem === undefined) {
    byItem = new Map();
    geometryByBridge.set(scope.send, byItem);
  }
  byItem.set(value, next);
};

const def: ComponentDef<NavigationMenuContext, NavigationMenuEvent> = {
  name: "navigation-menu",
  config,
  implementations,
  start: (props, authored) => {
    const seeded = authored("value") ? props["value"] : props["defaultValue"];
    return typeof seeded === "string" && seeded.length > 0 ? "open" : "idle";
  },
  seed: (props, authored) => {
    const seeded = authored("value") ? props["value"] : props["defaultValue"];
    const value = typeof seeded === "string" ? seeded : "";
    return {
      value,
      previousValue: "",
      openDelay: typeof props["openDelay"] === "number" ? props["openDelay"] : 200,
      closeDelay: typeof props["closeDelay"] === "number" ? props["closeDelay"] : 300,
      orientation: props["orientation"] === "vertical" ? "vertical" : "horizontal",
      disabled: props["disabled"] === true,
    };
  },
  channels: {
    items: { parse: parseItems },
    value: {
      controlled: true,
      parse: (raw) => (typeof raw === "string" ? raw : ""),
      // The toggle rides along: a non-empty write opens the panel, an
      // empty one closes it — exactly the bridge's two-send alternation.
      event: (value: string) => ({ type: "VALUE.SET", value }),
    },
    defaultValue: { parse: (raw) => (typeof raw === "string" ? raw : "") },
    openDelay: { parse: (raw) => (typeof raw === "number" ? raw : 200) },
    closeDelay: { parse: (raw) => (typeof raw === "number" ? raw : 300) },
    orientation: { parse: (raw) => (raw === "vertical" ? "vertical" : "horizontal") },
    disabled: { parse: (raw) => raw === true },
  },
  scalars: ["openDelay", "closeDelay", "orientation", "disabled"],
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
      indexes: (_context, props) => itemsOf(props),
      sig: (scope) => {
        const item = scope.slot as unknown as NavItemRecord;
        return [asCtx(scope.context).value === item.value, scope.props["disabled"]].join(" ");
      },
      attrs: (scope) => {
        const item = scope.slot as unknown as NavItemRecord;
        const ctx = asCtx(scope.context);
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
              if (asCtx(scope.context).value === item.value) scope.send({ type: "CLOSE" });
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
      indexes: (_context, props) => itemsOf(props),
      sig: (scope) => {
        const item = scope.slot as unknown as NavItemRecord;
        return [asCtx(scope.context).value === item.value, scope.props["disabled"]].join(" ");
      },
      attrs: (scope) => {
        const item = scope.slot as unknown as NavItemRecord;
        const open = asCtx(scope.context).value === item.value;
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
      indexes: (_context, props) => itemsOf(props),
      sig: (scope) => {
        const item = scope.slot as unknown as NavItemRecord;
        return [asCtx(scope.context).value === item.value, geometryOf(scope, item.value).placement].join(" ");
      },
      attrs: (scope) => {
        const item = scope.slot as unknown as NavItemRecord;
        const open = asCtx(scope.context).value === item.value;
        const geo = geometryOf(scope, item.value);
        return {
          id: scope.id("content", item.value),
          role: "menu",
          "aria-label": `${item.label} sub menu`,
          "data-state": open ? "open" : "closed",
          hidden: !open,
          style: {
            "--anchor-x": `${geo.x}px`,
            "--anchor-y": `${geo.y}px`,
            "--anchor-w": `${geo.w}px`,
          },
          "use:anchor": {
            onGeometry: (next: AnchorGeometry): void => setGeometry(scope, item.value, next),
          },
        };
      },
    },
  },
  commands: {
    show: { event: (args) => ({ type: "ITEM.ENTER", value: args[0] as string }) },
    hide: { event: () => ({ type: "CLOSE" }) },
    toggle: { event: (args) => ({ type: "ITEM.TOGGLE", value: args[0] as string }) },
  },
  readers: {
    value: { read: (context) => asCtx(context).value },
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
      watch: (context) => [asCtx(context).value, asCtx(context).previousValue],
      detail: (watched) => ({
        value: watched[0] as string,
        previousValue: watched[1] as string,
      }),
    },
  },
};

export const navigationMenu = defineComponent<NavigationMenuContext, NavigationMenuEvent, NavigationMenuApi>(def);

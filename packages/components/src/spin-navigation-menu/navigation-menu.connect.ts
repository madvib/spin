/**
 * Navigation-menu connect: the DOM contract and the item bags.
 *
 * The machine owns the modes (idle/open) and the value moves. Everything
 * that needs the DOM lives here: the item bags, each carrying one
 * `hover-delay` action whose open report enters (after the dwell) and
 * whose close report closes (after the grace), and the link bags.
 *
 * The panel renders INSIDE the item's row, so the item's hover-delay
 * covers both: moving from the link into the panel never leaves the
 * subtree, and the close clock starts only when the pointer leaves them
 * together — the hover-card pattern, which is why the delayed close
 * needs no separate timer owner.
 *
 * The panel positions against its row through the `anchor` action, whose
 * geometry rides the custom-property channel. The shared viewport Zag
 * slides between panels is deferred: panels open in place, and the
 * parity table records it.
 */

import type { AnchorGeometry } from "@spin/runtime/actions";
import { signal } from "@spin/runtime";
import type {
  NavItemRecord,
  NavigationMenuContext,
  NavigationMenuEvent,
} from "./navigation-menu.machine.ts";

export interface NavigationMenuConnectProps {
  readonly items: readonly NavItemRecord[];
  readonly orientation: "horizontal" | "vertical";
  readonly disabled: boolean;
}

export interface NavItemCommands {
  show(value: string): void;
  hide(): void;
  toggle(value: string): void;
}

export interface NavigationMenuApi extends NavItemCommands {
  readonly value: string;
  readonly items: readonly NavItemRecord[];
  readonly open: boolean;
  getRootProps(): Record<string, unknown>;
  /** The item collection, for the recipe's row iteration. */
  getItems(): readonly NavItemRecord[];
  getListProps(): Record<string, unknown>;
  getItemProps(item: NavItemRecord): Record<string, unknown>;
  getLinkProps(item: NavItemRecord): Record<string, unknown>;
  getItemContentProps(item: NavItemRecord): Record<string, unknown>;
}

export interface NavigationMenuService {
  readonly context: NavigationMenuContext;
  readonly isOpen: boolean;
  send(event: NavigationMenuEvent): void;
}

export type ReadNavigationMenuProps = () => NavigationMenuConnectProps;

export type { NavItemRecord };

const NAMESPACE = "navigation-menu";

function dataAttr(value: boolean): string | undefined {
  return value ? "" : undefined;
}

export function connectRobotNavigationMenu(
  service: NavigationMenuService,
  readProps: ReadNavigationMenuProps,
  id: string,
): NavigationMenuApi {
  const ownerId = id.startsWith(`${NAMESPACE}:`) ? id : `${NAMESPACE}:${id}`;

  const ctx = (): NavigationMenuContext => service.context;
  const props = (): NavigationMenuConnectProps => readProps();

  const send = (event: NavigationMenuEvent): void => service.send(event);

  /** One geometry signal per item, keyed by value. */
  const geometry = new Map<string, ReturnType<typeof signal<AnchorGeometry>>>();
  const geometryFor = (value: string): ReturnType<typeof signal<AnchorGeometry>> => {
    const hit = geometry.get(value);
    if (hit !== undefined) return hit;
    const made = signal<AnchorGeometry>({ x: 0, y: 0, w: 0, h: 0, placement: "bottom" });
    geometry.set(value, made);
    return made;
  };

  const caches = new Map<string, { sig: string; bag: Record<string, unknown> }>();
  const cached = (key: string, sig: string, build: () => Record<string, unknown>): Record<string, unknown> => {
    const hit = caches.get(key);
    if (hit !== undefined && hit.sig === sig) return hit.bag;
    const bag = build();
    caches.set(key, { sig, bag });
    return bag;
  };

  const api: NavigationMenuApi = {
    get value(): string {
      return ctx().value;
    },
    get items(): readonly NavItemRecord[] {
      return props().items;
    },
    get open(): boolean {
      return service.isOpen;
    },
    show: (value: string) => send({ type: "ITEM.ENTER", value }),
    hide: () => send({ type: "CLOSE" }),
    toggle: (value: string) => send({ type: "ITEM.TOGGLE", value }),
    getRootProps: () =>
      cached("root", `${service.isOpen}\u0000${props().orientation}\u0000${props().disabled}`, () => ({
        id: ownerId,
        "data-orientation": props().orientation,
        "data-state": service.isOpen ? "open" : "closed",
        "data-disabled": dataAttr(props().disabled),
      })),
    getItems: () => props().items,
    getListProps: () =>
      cached("list", `${props().orientation}`, () => ({
        id: `${ownerId}:list`,
        role: "menubar",
        "data-orientation": props().orientation,
      })),
    getItemProps: (item: NavItemRecord) => {
      const at = ctx();
      const open = at.value === item.value;
      return cached(`item:${item.value}`, `${open}\u0000${props().disabled}`, () => ({
        id: `${ownerId}:item:${item.value}`,
        role: "menuitem",
        "aria-expanded": open,
        "aria-haspopup": "menu",
        "data-state": open ? "open" : "closed",
        "data-disabled": dataAttr(props().disabled),
        "use:hover-delay": {
          openDelay: at.openDelay,
          closeDelay: at.closeDelay,
          onOpen: () => send({ type: "ITEM.ENTER", value: item.value }),
          // A close report is stale the moment another item takes over:
          // the swap already moved the value, and this timer belongs to
          // the item the pointer left.
          onClose: () => {
            if (at.value === item.value) send({ type: "CLOSE" });
          },
        },
        onClick: () => {
          if (props().disabled) return;
          send({ type: "ITEM.TOGGLE", value: item.value });
        },
      }));
    },
    getLinkProps: (item: NavItemRecord) =>
      cached(`link:${item.value}`, `${ctx().value === item.value}\u0000${props().disabled}`, () => ({
        id: `${ownerId}:link:${item.value}`,
        href: `#${item.value}`,
        "data-state": ctx().value === item.value ? "open" : "closed",
        "data-disabled": dataAttr(props().disabled),
      })),
    getItemContentProps: (item: NavItemRecord) => {
      const at = ctx();
      const open = at.value === item.value;
      const geo = geometryFor(item.value);
      return cached(`content:${item.value}`, `${open}\u0000${geo().placement}`, () => ({
        id: `${ownerId}:content:${item.value}`,
        role: "menu",
        "aria-label": `${item.label} sub menu`,
        "data-state": open ? "open" : "closed",
        hidden: !open,
        style: {
          "--anchor-x": `${geo().x}px`,
          "--anchor-y": `${geo().y}px`,
          "--anchor-w": `${geo().w}px`,
        },
        "use:anchor": {
          onGeometry: (next: AnchorGeometry) => geo(next),
        },
      }));
    },
  };

  return api;
}

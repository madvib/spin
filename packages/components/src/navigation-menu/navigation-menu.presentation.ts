import {
  type ApiOf,
  type ComponentDef,
  defineComponent,
  disclosureTrigger,
  resolveTwins,
  type ViewFor,
} from "@spinjs/runtime";
import { navigationMenu as navigationMenuMachine } from "./navigation-menu.machine.ts";
import { startState } from "./navigation-menu.state.ts";
import type {
  NavigationMenuArgs,
  NavigationMenuContext,
  NavigationMenuState,
} from "./navigation-menu.state.ts";
import type {
  NavigationMenuEvents,
  NavigationMenuValueChange,
} from "./navigation-menu.events.ts";
import type { NavItemRecord } from "./navigation-menu.state.ts";
export type { NavigationMenuArgs, NavigationMenuState };
export type { NavigationMenuValueChange, NavItemRecord };

type ScopeLike = ViewFor<
  NavigationMenuContext,
  NavigationMenuEvents,
  NavigationMenuState
>;

type ItemScope = ScopeLike & { readonly slot: NavItemRecord };

function neighbor(
  items: readonly NavItemRecord[],
  value: string,
  step: 1 | -1,
): NavItemRecord | null {
  const at = items.findIndex((item) => item.value === value);
  if (at < 0 || items.length === 0) return null;
  const next = items[(at + step + items.length) % items.length];
  return next === undefined ? null : next;
}

function onItemKeydown(scope: ItemScope, event: KeyboardEvent): void {
  const ctx = scope.context;
  if (ctx.disabled) return;
  const vertical = ctx.orientation === "vertical";
  const forward = vertical ? "ArrowDown" : "ArrowRight";
  const back = vertical ? "ArrowUp" : "ArrowLeft";
  if (event.key === "Escape") {
    if (ctx.value !== "") scope.send({ type: "CLOSE" });
    return;
  }
  if (event.key !== forward && event.key !== back) return;
  event.preventDefault();
  const next = neighbor(
    ctx.items,
    scope.slot.value,
    event.key === forward ? 1 : -1,
  );
  if (next !== null) scope.send({ type: "ITEM.ENTER", value: next.value });
}

export const def = {
  name: "navigation-menu",
  machine: (args: NavigationMenuArgs, authored: (name: string) => boolean) =>
    navigationMenuMachine(args, authored),
  args: (props: Record<string, unknown>) => props as NavigationMenuArgs,
  start: (
    props: Record<string, unknown>,
    authored: (name: string) => boolean,
  ) => startState(resolveTwins(props, authored) as NavigationMenuArgs),
  parts: {
    root: {
      attrs: () => ({}),
    },
    list: {
      attrs: () => ({
        role: "menubar",
      }),
    },
  },
  slots: {
    item: {
      indexes: (context: NavigationMenuContext) => context.items,
      attrs: (scope: ItemScope) => {
        const item = scope.slot;
        const ctx = scope.context;
        const open = ctx.value === item.value;
        return {
          id: scope.id("item", item.value),
          role: "menuitem",
          ...disclosureTrigger(scope, {
            expanded: open,
            hasPopup: "menu",
            controls: { part: "content", slot: item.value },
          }),
          "use:hover-delay": {
            openDelay: ctx.openDelay,
            closeDelay: ctx.closeDelay,
            onOpen: (): void =>
              scope.send({ type: "ITEM.ENTER", value: item.value }),
            onClose: (): void => {
              if (scope.context.value === item.value) {
                scope.send({ type: "CLOSE" });
              }
            },
          },
          onClick: (): void => {
            if (ctx.disabled) return;
            scope.send({ type: "ITEM.TOGGLE", value: item.value });
          },
          onKeydown: (event: KeyboardEvent): void =>
            onItemKeydown(scope, event),
        };
      },
    },
    link: {
      indexes: (context: NavigationMenuContext) => context.items,
      attrs: (scope: ScopeLike & { readonly slot: NavItemRecord }) => {
        const item = scope.slot;
        const selected = scope.context.value === item.value;
        return {
          id: scope.id("link", item.value),
          href: typeof item["href"] === "string" ? item["href"] : `#${item.value}`,
          "aria-current": selected ? "page" : undefined,
          "data-selected": selected ? "" : undefined,
        };
      },
    },
    itemContent: {
      id: "content",
      indexes: (context: NavigationMenuContext) => context.items,
      attrs: (scope: ScopeLike & { readonly slot: NavItemRecord }) => {
        const item = scope.slot;
        const open = scope.context.value === item.value;
        return {
          id: scope.id("content", item.value),
          role: "menu",
          "aria-label": `${item.label} sub menu`,
          hidden: !open,
          "use:anchor": { placement: "bottom" },
        };
      },
    },
  },
  commands: {
    show: {
      event: ([value]: [value: string]) => ({ type: "ITEM.ENTER", value }),
    },
    hide: { event: () => ({ type: "CLOSE" }) },
    toggle: {
      event: ([value]: [value: string]) => ({ type: "ITEM.TOGGLE", value }),
    },
  },
  readers: {
    value: { read: (context: NavigationMenuContext) => context.value },
    items: { read: (context: NavigationMenuContext) => context.items },
    open: {
      read: (_context: NavigationMenuContext, state: NavigationMenuState) =>
        state === "open",
    },
  },
  methods: {
    getItems: {
      call: (context: NavigationMenuContext) => context.items,
    },
  },
  events: {
    "value-change": {
      prop: "onValueChange",
      watch: (
        context: NavigationMenuContext,
      ) => [context.value, context.previousValue],
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
  settled: ({ after, event, focus, root }) => {
    if (typeof document === "undefined") return;
    if (!root().contains(document.activeElement)) return;
    if (event.type === "ITEM.ENTER" || event.type === "ITEM.TOGGLE") {
      const value = event["value"];
      if (typeof value === "string" && value !== "") focus("link", value);
    } else if (event.type === "CLOSE") {
      const previous = after.context.previousValue;
      if (previous !== "") focus("link", previous);
    }
  },
} satisfies ComponentDef<
  NavigationMenuContext,
  NavigationMenuEvents,
  Record<string, unknown>,
  NavigationMenuArgs,
  NavigationMenuState
>;

export type NavigationMenuApi = ApiOf<typeof def>;
export const navigationMenu = defineComponent<
  NavigationMenuContext,
  NavigationMenuEvents,
  NavigationMenuApi,
  NavigationMenuArgs,
  NavigationMenuState
>(def);

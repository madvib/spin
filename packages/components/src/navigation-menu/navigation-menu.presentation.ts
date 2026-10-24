import {
  type ApiOf,
  type ComponentDef,
  defineComponent,
  disclosureTrigger,
  resolveTwins,
  type ScopeFor,
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

type ScopeLike = ScopeFor<
  NavigationMenuContext,
  NavigationMenuEvents,
  NavigationMenuState
>;

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
      attrs: (scope: ScopeLike) => ({
        "data-state": scope.state === "open" ? "open" : "closed",
        "data-orientation": scope.context.orientation,
        "data-disabled": scope.attr(scope.context.disabled),
      }),
    },
    list: {
      attrs: (scope: ScopeLike) => ({
        role: "menubar",
        "data-orientation": scope.context.orientation,
      }),
    },
  },
  slots: {
    item: {
      indexes: (context: NavigationMenuContext) => context.items,
      attrs: (scope: ScopeLike & { readonly slot: NavItemRecord }) => {
        const item = scope.slot;
        const ctx = scope.context;
        const open = ctx.value === item.value;
        return {
          id: scope.id("item", item.value),
          role: "menuitem",
          ...disclosureTrigger(scope, {
            expanded: open,
            hasPopup: "menu",
          }),
          "data-state": open ? "open" : "closed",
          "data-disabled": scope.attr(scope.context.disabled),
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
        };
      },
    },
    link: {
      indexes: (context: NavigationMenuContext) => context.items,
      attrs: (scope: ScopeLike & { readonly slot: NavItemRecord }) => {
        const item = scope.slot;
        const open = scope.context.value === item.value;
        return {
          id: scope.id("link", item.value),
          href: `#${item.value}`,
          "data-state": open ? "open" : "closed",
          "data-disabled": scope.attr(scope.context.disabled),
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
          "data-state": open ? "open" : "closed",
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

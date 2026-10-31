import {
  type ApiOf,
  ariaHidden,
  type ComponentDef,
  defineComponent,
  disclosureTrigger,
  listSurface,
  optionRow,
  type ViewFor,
  type SlotViewFor,
} from "@spinjs/runtime";
import { themePicker as themePickerMachine } from "./theme-picker.machine.ts";
import type {
  ThemePickerEvents,
  ThemePickerOpenChange,
  ThemePickerValueChange,
} from "./theme-picker.events.ts";
import type {
  ThemePickerArgs,
  ThemePickerContext,
  ThemePickerItem,
  ThemePickerState,
} from "./theme-picker.state.ts";
import { discoverRuntimeThemes, parseThemes } from "./theme-picker.state.ts";
export type {
  ThemePickerArgs,
  ThemePickerItem,
  ThemePickerOpenChange,
  ThemePickerState,
  ThemePickerValueChange,
};

type Ctx = ThemePickerContext;
type ScopeLike = ViewFor<ThemePickerContext, ThemePickerEvents, ThemePickerState>;
type SlotLike = SlotViewFor<ThemePickerItem, ThemePickerContext, ThemePickerEvents, ThemePickerState>;

function selectedItem(ctx: Ctx): ThemePickerItem {
  const found = ctx.themes.find((item) => item.value === ctx.value);
  if (found !== undefined) return found;
  const first = ctx.themes[0];
  if (first !== undefined) return first;
  return {
    value: ctx.value,
    label: ctx.value,
    modes: ["light", "dark"],
    disabled: false,
    index: 0,
  };
}

function onTriggerKeydown(scope: ScopeLike, event: KeyboardEvent): void {
  switch (event.key) {
    case "ArrowDown":
    case "Enter":
    case " ":
      event.preventDefault();
      scope.send({ type: "OPEN" });
      break;
    case "ArrowUp":
      event.preventDefault();
      scope.send({ type: "OPEN" });
      scope.send({ type: "HIGHLIGHT.LAST" });
      break;
    default:
      break;
  }
}

function onContentKeydown(scope: ScopeLike, event: KeyboardEvent): void {
  switch (event.key) {
    case "ArrowDown":
      event.preventDefault();
      scope.send({ type: "HIGHLIGHT.NEXT" });
      break;
    case "ArrowUp":
      event.preventDefault();
      scope.send({ type: "HIGHLIGHT.PREV" });
      break;
    case "Home":
      event.preventDefault();
      scope.send({ type: "HIGHLIGHT.FIRST" });
      break;
    case "End":
      event.preventDefault();
      scope.send({ type: "HIGHLIGHT.LAST" });
      break;
    case "Enter":
      event.preventDefault();
      scope.send({ type: "ITEM.SELECT", value: scope.context.highlightedValue });
      break;
    case "Escape":
      event.preventDefault();
      scope.send({ type: "CLOSE" });
      break;
    default:
      break;
  }
}

export const def = {
  name: "theme-picker",
  machine: (args: ThemePickerArgs, authored) =>
    themePickerMachine(args, authored),
  start: "closed",
  scalars: ["storageKey", "syncDocument"],
  reconcile: ({ context, parsed, send }) => {
    if (parsed["themes"] === undefined) {
      if (context.themes.length > 0) return false;
      const discovered = discoverRuntimeThemes();
      if (discovered.length === 0) return false;
      send({
        type: "THEMES.SET",
        themes: discovered.map((item) => ({
          value: item.value,
          label: item.label,
          modes: [...item.modes],
          disabled: item.disabled,
        })),
      });
      return true;
    }
    const next = parseThemes(parsed["themes"]);
    if (next === null) return false;
    const same = next.length === context.themes.length &&
      next.every((item, index) => {
        const current = context.themes[index];
        return current !== undefined && current.value === item.value &&
          current.label === item.label && current.disabled === item.disabled;
      });
    if (same) return false;
    // A send, not a silent write: the transmit is the invalidation bus
    // the bridge's effect answers to, so a host write that lands between
    // runs is picked up on the next one — the same pump the listbox's
    // SELECTED_ITEMS.SYNC gives its collection.
    send({
      type: "THEMES.SET",
      themes: next.map((item) => ({
        value: item.value,
        label: item.label,
        modes: [...item.modes],
        disabled: item.disabled,
      })),
    });
    return true;
  },
  parts: {
    root: {
      attrs: () => ({}),
    },
    trigger: {
      attrs: (scope: ScopeLike) => {
        const open = scope.state === "open";
        return {
          type: "button",
          ...disclosureTrigger(scope, {
            expanded: open,
            hasPopup: "listbox",
            controls: { part: "content" },
          }),
          onClick: (): void => scope.send({ type: "TRIGGER.CLICK" }),
          onKeyDown: (event: KeyboardEvent): void =>
            onTriggerKeydown(scope, event),
        };
      },
    },
    triggerLabel: {
      attrs: () => ({}),
    },
    triggerSwatch: {
      attrs: (scope: ScopeLike) => ({
        "data-swatch-theme": scope.context.value,
      }),
    },
    triggerIndicator: {
      attrs: () => ({
        ...ariaHidden(true),
      }),
    },
    positioner: {
      attrs: (scope: ScopeLike) => {
        const open = scope.state === "open";
        return {
          // Positioning is the anchor action's job: it measures the trigger,
          // flips on viewport veto, writes literals, and re-runs on
          // resize/scroll. Same call as the menu positioner.
          "use:anchor": { placement: "bottom", offset: 8 },
          hidden: !open ? true : undefined,
        };
      },
    },
    content: {
      attrs: (scope: ScopeLike) => {
        const open = scope.state === "open";
        const ctx = scope.context;
        return {
          role: "listbox",
          ...listSurface(scope, {
            activeDescendant: ctx.highlightedValue.length > 0
              ? { part: "item", slot: ctx.highlightedValue }
              : undefined,
          }),
          hidden: !open ? true : undefined,
          tabIndex: 0,
          onKeyDown: (event: KeyboardEvent): void =>
            onContentKeydown(scope, event),
          "use:dismissable": {
            onOutside: (): void => scope.send({ type: "CLOSE" }),
            onEscape: (): void => scope.send({ type: "CLOSE" }),
          },
        };
      },
    },
    list: {
      attrs: () => ({
        role: "group",
      }),
    },
  },
  slots: {
    item: {
      indexes: (context: Ctx) => context.themes,
      attrs: (scope: SlotLike) => {
        const row = scope.slot;
        const ctx = scope.context;
        const selected = ctx.value === row.value;
        return {
          id: scope.id("item", row.value),
          role: "option",
          ...optionRow({
            selected: selected ? "true" : "false",
          }),
          "data-value": row.value,
          "aria-disabled": row.disabled ? "true" : undefined,
          onClick: (): void => {
            if (row.disabled) return;
            scope.send({ type: "ITEM.SELECT", value: row.value });
          },
          onPointermove: (): void => {
            if (row.disabled) return;
            scope.send({ type: "HIGHLIGHT.SET", value: row.value });
          },
        };
      },
    },
    itemLabel: {
      indexes: (context: Ctx) => context.themes,
      attrs: () => ({}),
    },
    itemSwatch: {
      indexes: (context: Ctx) => context.themes,
      attrs: (scope: SlotLike) => ({
        "data-swatch-theme": scope.slot.value,
      }),
    },
    itemIndicator: {
      indexes: (context: Ctx) => context.themes,
      attrs: () => ({
        ...ariaHidden(true),
      }),
    },
  },
  commands: {
    select: {
      event: ([value]: [value: string]) => ({
        type: "ITEM.SELECT",
        value,
      }),
    },
    setValue: {
      event: ([value]: [value: string]) => ({
        type: "VALUE.SET",
        value,
      }),
    },
    setThemes: {
      event: ([themes]: [themes: readonly unknown[] | string]) => ({
        type: "THEMES.SET",
        themes,
      }),
    },
  },
  readers: {
    open: { read: (_context: Ctx, state: ThemePickerState) => state === "open" },
    value: { read: (context: Ctx) => context.value },
    highlightedValue: { read: (context: Ctx) => context.highlightedValue },
    items: { read: (context: Ctx) => context.themes },
    selectedItem: { read: (context: Ctx) => selectedItem(context) },
    empty: { read: (context: Ctx) => context.themes.length === 0 },
  },
  methods: {
    getItemState: {
      call: (context: Ctx, _state, [item]: [item: ThemePickerItem]) => {
        const row = item ?? {
          value: "",
          label: "",
          modes: [],
          disabled: true,
          index: -1,
        };
        return {
          value: row.value,
          selected: context.value === row.value,
          highlighted: context.highlightedValue === row.value,
          disabled: row.disabled,
          dualMode: row.modes.length > 1,
        };
      },
    },
    getItems: {
      call: (context: Ctx) => context.themes,
    },
  },
  events: {
    "value-change": {
      prop: "onValueChange",
      watch: (context: Ctx) => [context.value],
      detail: (watched: readonly unknown[], _event, _props, context?: Ctx) => ({
        value: watched[0] as string,
        item: context === undefined
          ? { value: watched[0] as string, label: watched[0] as string, modes: ["light", "dark"] as readonly string[], disabled: false, index: 0 }
          : selectedItem(context),
      }),
    },
    "open-change": {
      prop: "onOpenChange",
      watch: (_context: Ctx, state: ThemePickerState) => [state],
      detail: (watched: readonly unknown[]) => ({
        open: (watched[0] as ThemePickerState) === "open",
      }),
    },
  },
  establish: (props) => {
    const out: ({ type: string } & Record<string, unknown>)[] = [];
    const sync = props["syncDocument"] !== false;
    if (sync && typeof localStorage !== "undefined") {
      const key = typeof props["storageKey"] === "string" &&
          (props["storageKey"] as string).length > 0
        ? (props["storageKey"] as string)
        : "spin:theme";
      try {
        const stored = localStorage.getItem(key);
        if (typeof stored === "string" && stored.length > 0) {
          out.push({ type: "VALUE.SET", value: stored });
        }
      } catch {
        // Private mode: the session keeps it.
      }
    }
    return out;
  },
  settled: ({ after, before, event, focus, id, props, root, send }) => {
    const node = root();
    if (props["themes"] === undefined && after.context.themes.length === 0) {
      const discovered = discoverRuntimeThemes(node);
      if (discovered.length > 0) {
        send({ type: "THEMES.SET", themes: discovered });
      }
    }
    if (before.state !== after.state) {
      if (after.state === "open") {
        focus("content");
      } else {
        const doc = node.ownerDocument ?? undefined;
        const active = doc?.activeElement ?? null;
        if (
          event.type === "ITEM.SELECT" ||
          (active instanceof Element &&
            active.id !== id("trigger") &&
            node.contains(active))
        ) {
          focus("trigger");
        }
      }
    }
    if (props["syncDocument"] === false) {
      return;
    }
    try {
      const doc = node.ownerDocument ?? undefined;
      const rootEl = doc?.documentElement;
      if (rootEl !== undefined) {
        const stored = localStorage.getItem(after.context.storageKey);
        if (after.context.value.length > 0) {
          rootEl.dataset["theme"] = after.context.value;
        } else if (stored !== null && stored.length > 0) {
          send({ type: "VALUE.SET", value: stored });
        } else {
          const documented = rootEl.dataset["theme"];
          if (typeof documented === "string" && documented.length > 0) {
            send({ type: "VALUE.SET", value: documented });
          }
        }
        localStorage.setItem(after.context.storageKey, after.context.value);
      }
    } catch {
      // Private mode: the session keeps it.
    }
  },
} satisfies ComponentDef<
  ThemePickerContext,
  ThemePickerEvents,
  Record<string, unknown>,
  ThemePickerArgs,
  "open" | "closed"
>;

export type ThemePickerApi = ApiOf<typeof def>;
export const themePicker = defineComponent<
  ThemePickerContext,
  ThemePickerEvents,
  ThemePickerApi,
  ThemePickerArgs,
  "open" | "closed"
>(def);

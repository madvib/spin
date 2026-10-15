import {
  defineComponent,
  isComposing,
  textProp,
  type ComponentDef,
} from "@spin/runtime";
import {
  config,
  implementations,
  isInteractive,
  isPressed,
  type ToggleGroupContext,
  type ToggleGroupEvent,
  type ToggleGroupItem,
  type ToggleGroupValueChange,
} from "./toggle-group.machine.ts";

/**
 * Toggle-group definition: the DOM contract as data. The machine owns the
 * two phases, the selection, the focused id, and the click/tab
 * disambiguation; this file maps props to channels, parts to attribute bags,
 * commands to sends, and selection moves to their event. Neighbor resolution
 * runs against the item order in the view (the machine records the resolved
 * id, exactly as combobox arrows do); DOM focus moves are a reflex.
 */

export interface ToggleGroupApi {
  setValue(value: readonly string[]): void;
  readonly value: readonly string[];
  readonly multiple: boolean;
  isPressed(value: string): boolean;
  getItemState(slot: { readonly value: string }): {
    readonly pressed: boolean;
    readonly focused: boolean;
    readonly disabled: boolean;
  };
  getItems(): readonly ToggleGroupItem[];
  getRootProps(): Record<string, unknown>;
  getItemProps(slot: { readonly value: string }): Record<string, unknown>;
}

const parseItems = (raw: unknown): readonly ToggleGroupItem[] => {
  const list: unknown = typeof raw === "string"
    ? ((): unknown => {
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    })()
    : raw;
  if (!Array.isArray(list)) return [];
  const items: ToggleGroupItem[] = [];
  for (const entry of list) {
    if (typeof entry === "object" && entry !== null) {
      const record = entry as Record<string, unknown>;
      const value = record["value"];
      if (typeof value !== "string" || value.length === 0) continue;
      const label = record["label"];
      items.push({
        value,
        label: typeof label === "string" && label.length > 0 ? label : value,
        ...(record["disabled"] === true ? { disabled: true as const } : {}),
      });
    } else if (typeof entry === "string" && entry.length > 0) {
      items.push({ value: entry, label: entry });
    }
  }
  return items;
};

/** Values travel the prop channel as JSON text (see the slider bridge:
 * the grammar coerces `= []` to `["[]"]`). */
const valuesProp = (raw: unknown): string[] | null => {
  const list: unknown = typeof raw === "string"
    ? ((): unknown => {
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    })()
    : raw;
  if (!Array.isArray(list)) return null;
  return list.every((item) => typeof item === "string") ? [...(list as string[])] : null;
};

const sameValues = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((value, index) => value === b[index]);

type Ctx = ToggleGroupContext;

const asCtx = (context: Record<string, unknown>): Ctx => context as unknown as Ctx;

type ScopeLike = {
  readonly props: Record<string, unknown>;
  readonly context: Record<string, unknown>;
  readonly state: string;
  readonly id: (part: string, slot?: unknown) => string;
  readonly send: (event: { type: string } & Record<string, unknown>) => void;
  readonly attr: (value: boolean) => string | undefined;
};

/** The view reflex: after a roving move the newly focused item takes DOM focus. */
const focusItem = (id: (part: string, slot?: unknown) => string, value: string): void => {
  if (typeof document === "undefined") return;
  document.getElementById(id("item", value))?.focus({ preventScroll: true });
};

const orderOf = (scope: ScopeLike): readonly ToggleGroupItem[] =>
  (scope.props["items"] as readonly ToggleGroupItem[]).filter(
    (item) => !(item.disabled === true || asCtx(scope.context).disabled),
  );

/** Neighbor resolution against the enabled order, with loop wrap. */
const neighbor = (scope: ScopeLike, value: string, direction: 1 | -1): string | null => {
  const enabled = orderOf(scope);
  const at = enabled.findIndex((item) => item.value === value);
  if (at < 0 || enabled.length === 0) return null;
  const next = at + direction;
  if (next < 0 || next >= enabled.length) {
    if (asCtx(scope.context).loopFocus !== true) return null;
    return enabled[(next + enabled.length) % enabled.length]?.value ?? null;
  }
  return enabled[next]?.value ?? null;
};

const def: ComponentDef<ToggleGroupContext, ToggleGroupEvent> = {
  name: "toggle-group",
  config,
  implementations,
  start: "idle",
  seed: (props) => ({
    value: valuesProp(props["value"]) ?? [],
    multiple: props["multiple"] === true,
    deselectable: props["deselectable"] !== false,
    rovingFocus: props["rovingFocus"] !== false,
    loopFocus: props["loopFocus"] !== false,
    orientation: props["orientation"] === "vertical" ? "vertical" : "horizontal",
    disabled: props["disabled"] === true,
  }),
  channels: {
    items: { parse: parseItems },
    value: {
      controlled: true,
      parse: valuesProp,
      event: (value: readonly string[]) => ({ type: "VALUE.SET", value: [...value] }),
      equal: (current, outer) =>
        Array.isArray(current) && Array.isArray(outer) && sameValues(current as string[], outer as string[]),
    },
    defaultValue: { parse: valuesProp },
    multiple: { parse: (raw) => raw === true },
    deselectable: { parse: (raw) => raw !== false },
    rovingFocus: { parse: (raw) => raw !== false },
    loopFocus: { parse: (raw) => raw !== false },
    orientation: { parse: (raw) => (raw === "vertical" ? "vertical" : "horizontal") },
    disabled: { parse: (raw) => raw === true },
    dir: { parse: (raw) => (raw === "rtl" ? "rtl" : "ltr") },
    label: { parse: textProp },
  },
  scalars: ["multiple", "deselectable", "rovingFocus", "loopFocus", "orientation", "disabled"],
  parts: {
    root: {
      sig: (scope) => [scope.props["orientation"], scope.props["dir"], scope.props["disabled"], asCtx(scope.context).focusedId].join("|"),
      attrs: (scope) => {
        const context = asCtx(scope.context);
        return {
          id: scope.id("root"),
          dir: scope.props["dir"],
          role: scope.props["multiple"] === true ? "group" : "radiogroup",
          "aria-label": (scope.props["label"] as string).length > 0 ? scope.props["label"] : undefined,
          tabindex: (context.tabbingBackward as boolean) ? "-1" : "0",
          "data-scope": "toggle-group",
          "data-part": "root",
          "data-disabled": scope.attr(scope.props["disabled"] === true),
          "data-orientation": scope.props["orientation"],
          "data-focus": scope.attr(context.focusedId !== null),
          style: { outline: "none" },
          onMousedown: () => {
            if (!isInteractive(context)) return;
            scope.send({ type: "ROOT.MOUSE_DOWN" });
          },
          onFocus: (event: FocusEvent) => {
            const ctx = asCtx(scope.context);
            if (!isInteractive(ctx)) return;
            if (event.currentTarget !== event.target) return;
            if ((ctx.clickFocus as boolean)) return;
            if ((ctx.tabbingBackward as boolean)) return;
            scope.send({ type: "ROOT.FOCUS" });
            // Steal to the first enabled item, as Zag's focusFirstToggle.
            const first = orderOf(scope)[0]?.value;
            if (first !== undefined) focusItem(scope.id, first);
          },
          onBlur: (event: FocusEvent) => {
            const related = event.relatedTarget as HTMLElement | null;
            if (
              related !== null &&
              event.currentTarget instanceof Element &&
              event.currentTarget.contains(related)
            ) {
              return;
            }
            if (!isInteractive(asCtx(scope.context))) return;
            scope.send({ type: "ROOT.BLUR" });
          },
        };
      },
    },
  },
  slots: {
    item: {
      indexes: (_context, props) => props["items"] as readonly ToggleGroupItem[],
      sig: (scope) => {
        const stub = scope.slot as unknown as { readonly value: string };
        const row: ToggleGroupItem = (scope.props["items"] as readonly ToggleGroupItem[]).find(
          (candidate) => candidate.value === stub.value,
        ) ?? { value: stub.value, label: stub.value };
        const context = asCtx(scope.context);
        const pressed = isPressed(context, row.value);
        const focused = context.focusedId === scope.id("item", row.value);
        const itemDisabled = row.disabled === true || scope.props["disabled"] === true;
        return [pressed, focused, itemDisabled, scope.props["orientation"], scope.props["dir"], scope.state].join("|");
      },
      attrs: (scope) => {
        const stub = scope.slot as unknown as { readonly value: string };
        const row: ToggleGroupItem = (scope.props["items"] as readonly ToggleGroupItem[]).find(
          (candidate) => candidate.value === stub.value,
        ) ?? { value: stub.value, label: stub.value };
        const context = asCtx(scope.context);
        const pressed = isPressed(context, row.value);
        const focused = context.focusedId === scope.id("item", row.value);
        const itemDisabled = row.disabled === true || scope.props["disabled"] === true;
        const horizontal = scope.props["orientation"] === "horizontal";
        const multiple = scope.props["multiple"] === true;
        const roving = scope.props["rovingFocus"] !== false;
        const step = (direction: 1 | -1, type: string): void => {
          const next = neighbor(scope, row.value, direction);
          if (next === null) return;
          scope.send({ type, id: scope.id("item", next) });
          focusItem(scope.id, next);
        };
        return {
          id: scope.id("item", row.value),
          type: "button",
          dir: scope.props["dir"],
          "data-ownedby": scope.id("root"),
          "data-scope": "toggle-group",
          "data-part": "item",
          "data-focus": scope.attr(focused),
          disabled: itemDisabled ? true : undefined,
          tabindex: roving ? (focused ? "0" : "-1") : undefined,
          role: multiple ? undefined : "radio",
          "aria-checked": multiple ? undefined : pressed ? "true" : "false",
          "aria-pressed": multiple ? (pressed ? "true" : "false") : undefined,
          "data-disabled": scope.attr(itemDisabled),
          "data-orientation": scope.props["orientation"],
          "data-state": pressed ? "on" : "off",
          onFocus: () => {
            if (itemDisabled) return;
            scope.send({ type: "TOGGLE.FOCUS", id: scope.id("item", row.value) });
          },
          onClick: (event: MouseEvent) => {
            if (itemDisabled) return;
            if (event.defaultPrevented) return;
            scope.send({ type: "TOGGLE.CLICK", id: scope.id("item", row.value), value: row.value });
          },
          onKeydown: (event: KeyboardEvent) => {
            if (event.defaultPrevented) return;
            if (itemDisabled) return;
            if (isComposing(event)) return;
            const dir = scope.props["dir"] as string;
            const first = (): string => scope.id("item", orderOf(scope)[0]?.value ?? "");
            switch (event.key) {
              case "Tab":
                scope.send({
                  type: "TOGGLE.SHIFT_TAB",
                  isShiftTab: event.shiftKey,
                  firstId: first(),
                });
                break;
              case "ArrowLeft":
                if (roving && horizontal) {
                  const next = neighbor(scope, row.value, -1);
                  if (next !== null) {
                    event.preventDefault();
                    scope.send({ type: "TOGGLE.FOCUS_PREV", id: scope.id("item", next) });
                    focusItem(scope.id, next);
                  }
                }
                break;
              case "ArrowRight":
                if (roving && horizontal) {
                  const next = neighbor(scope, row.value, 1);
                  if (next !== null) {
                    event.preventDefault();
                    scope.send({ type: "TOGGLE.FOCUS_NEXT", id: scope.id("item", next) });
                    focusItem(scope.id, next);
                  }
                }
                break;
              case "ArrowUp":
                if (roving && !horizontal) step(-1, "TOGGLE.FOCUS_PREV");
                break;
              case "ArrowDown":
                if (roving && !horizontal) step(1, "TOGGLE.FOCUS_NEXT");
                break;
              case "Home": {
                const firstValue = orderOf(scope)[0]?.value;
                if (roving && firstValue !== undefined) {
                  event.preventDefault();
                  scope.send({ type: "TOGGLE.FOCUS_FIRST", id: scope.id("item", firstValue) });
                  focusItem(scope.id, firstValue);
                }
                break;
              }
              case "End": {
                const enabled = orderOf(scope);
                const last = enabled[enabled.length - 1]?.value;
                if (roving && last !== undefined) {
                  event.preventDefault();
                  scope.send({ type: "TOGGLE.FOCUS_LAST", id: scope.id("item", last) });
                  focusItem(scope.id, last);
                }
                break;
              }
              default:
                break;
            }
          },
        };
      },
    },
  },
  commands: {
    setValue: { event: (args) => ({ type: "VALUE.SET", value: [...(args[0] as readonly string[])] }) },
  },
  readers: {
    value: { read: (context) => asCtx(context).value },
    multiple: { read: (context) => asCtx(context).multiple },
  },
  methods: {
    isPressed: {
      call: (context, _state, args) => isPressed(asCtx(context), args[0] as string),
    },
    getItemState: {
      call: (context, _state, args, _props, id) => {
        const row = args[0] as { readonly value: string };
        const ctx = asCtx(context);
        return {
          pressed: isPressed(ctx, row.value),
          focused: ctx.focusedId === id("item", row.value),
          disabled: ctx.disabled,
        };
      },
    },
    getItems: {
      call: (_context, _state, _args, props) => props["items"],
    },
  },
  events: {
    "value-change": {
      prop: "onValueChange",
      watch: (context) => [...asCtx(context).value],
      detail: (watched) => ({ value: [...watched] as string[] }),
    },
  },
};

export const toggleGroup = defineComponent<ToggleGroupContext, ToggleGroupEvent, ToggleGroupApi>(def);

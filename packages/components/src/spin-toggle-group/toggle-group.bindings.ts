import { defineComponent, focuser, isComposing, type ComponentDef, type PartScope as ScopeLike, type SlotScope } from "@spin/runtime";
import {
  isInteractive,
  isPressed,
  toggleGroup as toggleGroupMachine,
  type ToggleGroupArgs,
  type ToggleGroupContext,
  type ToggleGroupEvent,
  type ToggleGroupItem,
  type ToggleGroupValueChange,
} from "./toggle-group.machine.ts";

/**
 * Toggle-group definition: the DOM contract as data. The machine owns the
 * two phases, the selection, the focused id, and the click/tab
 * disambiguation; this file maps props to scalars, parts to attribute bags,
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

type Ctx = ToggleGroupContext;
interface SlotLike<R> extends SlotScope<R, ToggleGroupContext> {}

export type { ToggleGroupItem, ToggleGroupValueChange };

/** The view reflex: after a roving move the newly focused item takes DOM focus. */
const focusItem = (scopeId: (part: string, slot?: unknown) => string, value: string): void => {
  focuser(scopeId)("item", value);
};

const orderOf = (scope: ScopeLike<unknown, ToggleGroupContext> | SlotLike<ToggleGroupItem>): readonly ToggleGroupItem[] =>
  scope.context.items.filter(
    (item: ToggleGroupItem) => !(item.disabled === true || scope.context.disabled),
  );

/** Neighbor resolution against the enabled order, with loop wrap. */
const neighbor = (scope: ScopeLike<unknown, ToggleGroupContext> | SlotLike<ToggleGroupItem>, value: string, direction: 1 | -1): string | null => {
  const enabled = orderOf(scope);
  const at = enabled.findIndex((item) => item.value === value);
  if (at < 0 || enabled.length === 0) return null;
  const next = at + direction;
  if (next < 0 || next >= enabled.length) {
    if (scope.context.loopFocus !== true) return null;
    return enabled[(next + enabled.length) % enabled.length]?.value ?? null;
  }
  return enabled[next]?.value ?? null;
};

const def: ComponentDef<ToggleGroupContext, ToggleGroupEvent> = {
  name: "toggle-group",
  // The machine: a factory over the element's props. The machine builds
  // its own context from the arguments it wants; the element decides
  // nothing about the machine's state.
  machine: (props, authored) => toggleGroupMachine(props as ToggleGroupArgs, authored),
  start: "idle",
  parts: {
    root: {
      sig: (scope) => [scope.context.orientation, scope.props["dir"], scope.context.disabled, scope.context.focusedId].join("|"),
      attrs: (scope) => {
        const context = scope.context;
        return {
          id: scope.id(""),
          dir: scope.props["dir"],
          role: scope.context.multiple === true ? "group" : "radiogroup",
          "aria-label": (typeof scope.props["label"] === "string" && scope.props["label"].length > 0) ? scope.props["label"] : undefined,
          tabindex: context.tabbingBackward ? "-1" : "0",
          "data-scope": "toggle-group",
          "data-part": "root",
          "data-disabled": scope.attr(scope.props["disabled"] === true),
          "data-orientation": scope.context.orientation,
          "data-focus": scope.attr(context.focusedId !== null),
          style: { outline: "none" },
          onMousedown: () => {
            if (!isInteractive(context)) return;
            scope.send({ type: "ROOT.MOUSE_DOWN" });
          },
          onFocus: (event: FocusEvent) => {
            const ctx = scope.context;
            if (!isInteractive(ctx)) return;
            if (event.currentTarget !== event.target) return;
            if (ctx.clickFocus) return;
            if (ctx.tabbingBackward) return;
            scope.send({ type: "ROOT.FOCUS" });
            // Steal to the first enabled item, as Zag's focusFirstToggle.
            const first = orderOf(scope)[0]?.value;
            if (first !== undefined) focusItem(scope.id, first);
          },
          onBlur: (event: FocusEvent) => {
            const related = event.relatedTarget instanceof HTMLElement ? event.relatedTarget : null;
            if (
              related !== null &&
              event.currentTarget instanceof Element &&
              event.currentTarget.contains(related)
            ) {
              return;
            }
            if (!isInteractive(scope.context)) return;
            scope.send({ type: "ROOT.BLUR" });
          },
        };
      },
    },
  },
  slots: {
    item: {
      indexes: (context, _props) => context.items,
      sig: (scope: SlotLike<ToggleGroupItem>) => {
        const row: ToggleGroupItem = (scope.context.items).find(
          (candidate) => candidate.value === scope.slot.value,
        ) ?? { value: scope.slot.value, label: scope.slot.value };
        const context = scope.context;
        const pressed = isPressed(context, row.value);
        const focused = context.focusedId === scope.id("item", row.value);
        const itemDisabled = row.disabled === true || scope.context.disabled === true;
        return [pressed, focused, itemDisabled, scope.context.orientation, scope.props["dir"], scope.state].join("|");
      },
      attrs: (scope: SlotLike<ToggleGroupItem>) => {
        const row: ToggleGroupItem = (scope.context.items).find(
          (candidate) => candidate.value === scope.slot.value,
        ) ?? { value: scope.slot.value, label: scope.slot.value };
        const context = scope.context;
        const pressed = isPressed(context, row.value);
        const focused = context.focusedId === scope.id("item", row.value);
        const itemDisabled = row.disabled === true || scope.context.disabled === true;
        const horizontal = scope.context.orientation === "horizontal";
        const multiple = scope.context.multiple === true;
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
          "data-orientation": scope.context.orientation,
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
            const dir = typeof scope.props["dir"] === "string" ? scope.props["dir"] : "";
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
    setValue: { event: (args) => ({ type: "VALUE.SET", value: [...(Array.isArray(args[0]) ? args[0] : [])] }) },
  },
  readers: {
    value: { read: (context) => context.value },
    multiple: { read: (context) => context.multiple },
  },
  methods: {
    isPressed: {
      call: (context, _state, args) => isPressed(context, typeof args[0]==="string"?args[0]:""),
    },
    getItemState: {
      call: (context, _state, args, _props, id) => {
        const rawArg = args[0];
        const isRow = (v: unknown): v is { readonly value: string } =>
          v !== null && typeof v === "object" && "value" in v && typeof Reflect.get(v, "value") === "string";
        const row = isRow(rawArg) ? { value: String(Reflect.get(rawArg, "value")) } : { value: "" };
        const ctx = context;
        return {
          pressed: isPressed(ctx, row.value),
          focused: ctx.focusedId === id("item", row.value),
          disabled: ctx.disabled,
        };
      },
    },
    getItems: {
      call: (context, _state, _args, _props) => context.items,
    },
  },
  events: {
    "value-change": {
      prop: "onValueChange",
      watch: (context) => [...context.value],
      detail: (watched) => ({ value: [...watched] }),
    },
  },
};

export const toggleGroup = defineComponent<ToggleGroupContext, ToggleGroupEvent, ToggleGroupApi>(def);

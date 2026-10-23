import { ariaPressed, defineComponent, focuser, isComposing, optionRow, type ApiOf, type ComponentDef, type ScopeFor, type SlotScopeFor } from "@spin/runtime";
import { toggleGroup as toggleGroupMachine } from "./toggle-group.machine.ts";
import {
  isInteractive,
  isPressed,
  type ToggleGroupArgs,
  type ToggleGroupContext,
  type ToggleGroupItem,
} from "./toggle-group.state.ts";
import type { ToggleGroupEvents, ToggleGroupValueChange } from "./toggle-group.events.ts";
export type { ToggleGroupArgs, ToggleGroupItem, ToggleGroupValueChange };

type Ctx = ToggleGroupContext;
type ScopeLike = ScopeFor<ToggleGroupContext, ToggleGroupEvents, "idle" | "focused">;
type SlotLike<R> = SlotScopeFor<R, ToggleGroupContext, ToggleGroupEvents, "idle" | "focused">;

/** The view reflex: a roving move hands DOM focus to the focused item. */
const focusItem = (scopeId: (part: string, slot?: unknown) => string, value: string): void => {
  focuser(scopeId)("item", value);
};

const orderOf = (scope: ScopeLike | SlotLike<ToggleGroupItem>): readonly ToggleGroupItem[] =>
  scope.context.items.filter(
    (item: ToggleGroupItem) => !(item.disabled === true || scope.context.disabled),
  );

const neighbor = (scope: ScopeLike | SlotLike<ToggleGroupItem>, value: string, direction: 1 | -1): string | null => {
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

export const def = {
  name: "toggle-group",
  machine: (args: ToggleGroupArgs, authored) => toggleGroupMachine(args, authored),
  start: "idle",
  parts: {
    root: {
      attrs: (scope: ScopeLike) => {
        const context = scope.context;
        return {
          role: context.multiple === true ? "group" : "radiogroup",
          tabindex: context.tabbingBackward ? "-1" : "0",
          "data-disabled": scope.attr(context.disabled),
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
      indexes: (context: Ctx) => context.items,
      attrs: (scope: SlotLike<ToggleGroupItem>) => {
        const row: ToggleGroupItem = scope.slot;
        const context = scope.context;
        const pressed = isPressed(context, row.value);
        const focused = context.focusedId === scope.id("item", row.value);
        const itemDisabled = row.disabled === true || context.disabled === true;
        const horizontal = context.orientation === "horizontal";
        const multiple = context.multiple === true;
        const roving = context.rovingFocus !== false;
        const step = (direction: 1 | -1, type: "TOGGLE.FOCUS_PREV" | "TOGGLE.FOCUS_NEXT"): void => {
          const next = neighbor(scope, row.value, direction);
          if (next === null) return;
          scope.send({ type, id: scope.id("item", next) });
          focusItem(scope.id, next);
        };
        return {
          id: scope.id("item", row.value),
          type: "button",
          "data-focus": scope.attr(focused),
          disabled: itemDisabled ? true : undefined,
          tabindex: roving ? (focused ? "0" : "-1") : undefined,
          role: multiple ? undefined : "radio",
          ...optionRow({ checked: multiple ? undefined : pressed ? "true" : "false" }),
          ...ariaPressed(multiple ? (pressed ? "true" : "false") : undefined),
          "data-disabled": scope.attr(itemDisabled),
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
    setValue: { event: ([value]: [value: readonly string[]]) => ({ type: "VALUE.SET", value: [...value] }) },
  },
  readers: {
    value: { read: (context: Ctx) => context.value },
    multiple: { read: (context: Ctx) => context.multiple },
    disabled: { read: (context: Ctx) => context.disabled },
    orientation: { read: (context: Ctx) => context.orientation },
  },
  methods: {
    isPressed: {
      call: (context: Ctx, _state, [value]: [value: string]) => isPressed(context, value),
    },
    getItemState: {
      call: (context: Ctx, _state, [slot]: [slot: ToggleGroupItem], _props, id) => {
        const row = slot ?? { value: "", label: "" };
        const ctx = context;
        return {
          pressed: isPressed(ctx, row.value),
          focused: ctx.focusedId === id("item", row.value),
          disabled: ctx.disabled,
        };
      },
    },
    getItems: {
      call: (context: Ctx) => context.items,
    },
  },
  events: {
    "value-change": {
      prop: "onValueChange",
      watch: (context: Ctx) => [...context.value],
      detail: (watched: readonly string[]) => ({ value: [...watched] }),
    },
  },
  settled: ({ event, focus }) => {
    if (event.type !== "TOGGLE.CLICK") return;
    const value = event["value"];
    if (typeof value === "string") focus("item", value);
  },
} satisfies ComponentDef<ToggleGroupContext, ToggleGroupEvents, Record<string, unknown>, ToggleGroupArgs, "idle" | "focused">;

export type ToggleGroupApi = ApiOf<typeof def>;
export const toggleGroup = defineComponent<ToggleGroupContext, ToggleGroupEvents, ToggleGroupApi, ToggleGroupArgs, "idle" | "focused">(def);
import {
  type ApiOf,
  ariaDisabled,
  ariaLabelledBy,
  ariaOrientation,
  ariaReadOnly,
  ariaRoleDescription,
  type ComponentDef,
  defineComponent,
  isComposing,
  optionRow,
  type ScopeFor,
  type SlotScopeFor,
} from "@spin/runtime";
import { ratingGroup as ratingGroupMachine } from "./rating-group.machine.ts";
import type {
  RatingGroupArgs,
  RatingGroupContext,
  RatingGroupState,
} from "./rating-group.state.ts";
import { isHovering, isInteractive, itemState } from "./rating-group.state.ts";
import type {
  RatingGroupEvents,
  RatingGroupValueChange,
} from "./rating-group.events.ts";

export type { RatingGroupArgs, RatingGroupState, RatingGroupValueChange };
export type { RatingGroupHoverChange } from "./rating-group.events.ts";

/** Rating-group definition: the DOM contract as data. */

type _Ctx = RatingGroupContext;
type ScopeLike = ScopeFor<
  RatingGroupContext,
  RatingGroupEvents,
  RatingGroupState
>;
type SlotLike = SlotScopeFor<
  number,
  RatingGroupContext,
  RatingGroupEvents,
  RatingGroupState
>;

const itemIndexCache = new Map<number, readonly number[]>();
const itemIndexes = (length: number): readonly number[] => {
  const hit = itemIndexCache.get(length);
  if (hit !== undefined) return hit;
  const made = Array.from({ length }, (_, index) => index + 1);
  itemIndexCache.set(length, made);
  return made;
};

// (Api derived from def)

export const def = {
  name: "rating-group",
  machine: (args: RatingGroupArgs, authored) =>
    ratingGroupMachine(args, authored),
  start: "idle",
  parts: {
    root: {},
    label: {
      attrs: (scope: ScopeLike) => ({
        "for": scope.id("hiddenInput"),
        "data-disabled": scope.attr(scope.context.disabled),
        "data-required": scope.attr(scope.context.required),
        onClick: (event: MouseEvent) => {
          if (event.defaultPrevented) return;
          if (!isInteractive(scope.context)) return;
          event.preventDefault();
        },
      }),
    },
    control: {
      attrs: (scope: ScopeLike) => ({
        role: "radiogroup",
        "data-disabled": scope.attr(scope.context.disabled),
        "data-readonly": scope.attr(scope.context.readOnly),
        ...ariaOrientation("horizontal"),
        ...ariaLabelledBy(scope, { part: "label" }),
        ...ariaReadOnly(scope.context.readOnly ? "true" : undefined),
        onPointermove: (event: PointerEvent) => {
          if (!isInteractive(scope.context)) return;
          if (event.pointerType === "touch") return;
          scope.send({ type: "GROUP_POINTER_OVER" });
        },
        onPointerleave: () => {
          if (!isInteractive(scope.context)) return;
          const radioFocused = scope.state === "focus";
          scope.send({ type: "GROUP_POINTER_LEAVE", radioFocused });
        },
      }),
    },
    hiddenInput: {
      id: "input",
      attrs: (scope: ScopeLike) => {
        const name = scope.context.name;
        return {
          id: scope.id("hiddenInput"),
          name: name.length > 0 ? name : undefined,
          form: undefined,
          type: "text",
          hidden: true,
          disabled: scope.context.disabled ? true : undefined,
          readonly: scope.context.readOnly ? true : undefined,
          required: scope.context.required ? true : undefined,
          value: String(scope.context.value),
        };
      },
    },
  },
  slots: {
    item: {
      indexes: (context: RatingGroupContext) => itemIndexes(context.count),
      attrs: (scope: SlotLike) => {
        const index = scope.slot;
        const context = scope.context;
        const state = itemState(context, index);
        const interactive = isInteractive(context);
        const rtl = (eventTarget: EventTarget | null): boolean =>
          eventTarget instanceof Element &&
          eventTarget.ownerDocument?.defaultView?.getComputedStyle(eventTarget)
              .direction === "rtl";
        return {
          id: scope.id("item", index),
          role: "radio",
          "data-disabled": scope.attr(scope.context.disabled),
          "data-readonly": scope.attr(scope.context.readOnly),
          tabindex: context.readOnly || context.disabled
            ? (state.checked ? "0" : undefined)
            : (state.checked ? "0" : "-1"),
          ...ariaRoleDescription("rating"),
          "aria-label": `${index} stars`,
          ...ariaDisabled(context.disabled ? "true" : undefined),
          ...optionRow({
            setSize: String(context.count),
            checked: state.checked ? "true" : "false",
            posInSet: String(index),
          }),
          "data-checked": scope.attr(state.checked),
          "data-highlighted": scope.attr(state.highlighted),
          "data-half": scope.attr(state.half),
          onPointerdown: (event: PointerEvent) => {
            if (!interactive) return;
            if (event.pointerType === "mouse" && event.button !== 0) return;
            event.preventDefault();
          },
          onPointermove: (event: PointerEvent) => {
            if (!isInteractive(scope.context)) return;
            const rect = scope.measure("item", index);
            if (rect === null) return;
            const isRtl = rtl(event.target);
            const x = isRtl
              ? rect.right - event.clientX
              : event.clientX - rect.left;
            const isMidway = rect.width > 0 && x / rect.width < 0.5;
            scope.send({ type: "POINTER_OVER", index, isMidway });
          },
          onKeydown: (event: KeyboardEvent) => {
            if (event.defaultPrevented) return;
            if (!isInteractive(scope.context)) return;
            if (isComposing(event)) return;
            const isRtl = rtl(event.target);
            const move = (
              type: "ARROW_LEFT" | "ARROW_RIGHT" | "HOME" | "END",
            ): boolean => {
              event.preventDefault();
              scope.send({ type });
              return true;
            };
            switch (event.key) {
              case "ArrowLeft":
              case "ArrowUp":
                move(isRtl ? "ARROW_RIGHT" : "ARROW_LEFT");
                break;
              case "ArrowRight":
              case "ArrowDown":
                move(isRtl ? "ARROW_LEFT" : "ARROW_RIGHT");
                break;
              case " ":
                event.preventDefault();
                scope.send({ type: "SPACE", value: index });
                break;
              case "Home":
                move("HOME");
                break;
              case "End":
                move("END");
                break;
              default:
                break;
            }
          },
          onClick: () => {
            if (!isInteractive(scope.context)) return;
            scope.send({ type: "CLICK", value: index });
          },
          onFocus: () => {
            if (!isInteractive(scope.context)) return;
            scope.send({ type: "FOCUS" });
          },
          onBlur: () => {
            if (!isInteractive(scope.context)) return;
            scope.send({ type: "BLUR" });
          },
        };
      },
    },
  },
  commands: {
    setValue: {
      event: ([value]: [value: number]) => ({ type: "SET_VALUE", value }),
    },
    clearValue: { event: () => ({ type: "CLEAR_VALUE" }) },
  },
  readers: {
    value: { read: (context) => context.value },
    hoveredValue: { read: (context) => context.hoveredValue },
    hovering: { read: (context) => isHovering(context) },
    count: { read: (context) => context.count },
    disabled: { read: (context) => context.disabled },
    readOnly: { read: (context) => context.readOnly },
  },
  methods: {
    getItems: { call: (context) => itemIndexes(context.count) },
    getItemState: {
      call: (context, _state, [index]: [index: number]) =>
        itemState(context, index),
    },
  },
  events: {
    "value-change": {
      prop: "onValueChange",
      watch: (context) => [context.value],
      detail: (watched: readonly unknown[]) => ({
        value: typeof watched[0] === "number" ? watched[0] : 0,
      }),
    },
    "hover-change": {
      prop: "onHoverChange",
      watch: (context) => [context.hoveredValue],
      detail: (watched: readonly unknown[]) => ({
        hoveredValue: typeof watched[0] === "number" ? watched[0] : 0,
      }),
    },
  },
  settled: ({ event, after, focus }) => {
    const types: Record<string, true> = {
      ARROW_LEFT: true,
      ARROW_RIGHT: true,
      HOME: true,
      END: true,
      SPACE: true,
    };
    if (types[event.type] !== true) return;
    const afterRecord = (after && typeof after === "object")
      ? after as Record<string, unknown>
      : {};
    const ctx = afterRecord["context"];
    if (!ctx || typeof ctx !== "object" || !("value" in ctx)) return;
    const value = ctx.value;
    if (typeof value === "number" && value > 0) {
      focus("item", Math.max(1, Math.ceil(value)));
    }
  },
} satisfies ComponentDef<
  RatingGroupContext,
  RatingGroupEvents,
  Record<string, unknown>,
  RatingGroupArgs,
  RatingGroupState
>;

export type RatingGroupApi = ApiOf<typeof def>;
export const ratingGroup = defineComponent<
  RatingGroupContext,
  RatingGroupEvents,
  RatingGroupApi,
  RatingGroupArgs,
  RatingGroupState
>(def);

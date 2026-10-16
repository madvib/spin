import {
  defineComponent,
  isComposing,
  textProp,
  type ComponentDef,
} from "@spin/runtime";
import {
  config,
  implementations,
  isHovering,
  isInteractive,
  itemState,
  type RatingGroupContext,
  type RatingGroupEvent,
  type RatingGroupValueChange,
  type RatingItemState,
} from "./rating-group.machine.ts";

/**
 * Rating-group definition: the DOM contract as data. The machine owns the
 * three phases, the value, the hover preview, and the half-step math; this
 * file maps props to channels, parts to attribute bags, commands to sends,
 * and value/hover transitions to their events. The halfway hover flag is
 * measured against the item node and sent in with the event; the
 * checked-radio focus after a keyboard move is a view reflex.
 */

export interface RatingGroupHoverChange {
  readonly hoveredValue: number;
}

export interface RatingGroupApi {
  setValue(value: number): void;
  clearValue(): void;
  readonly value: number;
  readonly hoveredValue: number;
  readonly hovering: boolean;
  readonly count: number;
  getItems(): readonly number[];
  getItemState(slot: { readonly index: number }): RatingItemState;
  getRootProps(): Record<string, unknown>;
  getLabelProps(): Record<string, unknown>;
  getControlProps(): Record<string, unknown>;
  getItemProps(slot: { readonly index: number }): Record<string, unknown>;
  getHiddenInputProps(): Record<string, unknown>;
}

// Scope props arrive as strings; hooks write numbers. Accept both — a
// string-authored `defaultValue="45"` seeds 45, not 0.
const numProp = (raw: unknown): number | null => {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  if (typeof raw === "string" && raw.trim().length > 0) {
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

const countProp = (raw: unknown): number => {
  const count = numProp(raw);
  return count === null ? 5 : Math.max(1, Math.floor(count));
};

type Ctx = RatingGroupContext;

const asCtx = (context: Record<string, unknown>): Ctx => context as unknown as Ctx;

const slotIndex = (slot: unknown): number => (slot as { readonly index: number }).index;

/** The view reflex: after a keyboard move the checked radio takes focus. */
const focusActiveRadio = (id: (part: string, slot?: unknown) => string, value: number): void => {
  if (typeof document === "undefined") return;
  document.getElementById(id("item", Math.max(1, Math.ceil(value))))?.focus({ preventScroll: true });
};

/** Thumb slots are a pure function of the count: cache per length so the
 * recipe's iteration never re-stamps. */
const itemIndexCache = new Map<number, readonly number[]>();
const itemIndexes = (length: number): readonly number[] => {
  const hit = itemIndexCache.get(length);
  if (hit !== undefined) return hit;
  const made = Array.from({ length }, (_, index) => index + 1);
  itemIndexCache.set(length, made);
  return made;
};

const def: ComponentDef<RatingGroupContext, RatingGroupEvent> = {
  name: "rating-group",
  config,
  implementations,
  start: "idle",
  seed: (props, authored) => ({
    count: countProp(props["count"]),
    allowHalf: props["allowHalf"] === true,
    disabled: props["disabled"] === true,
    readOnly: props["readOnly"] === true,
    value: numProp(authored("value") ? props["value"] : props["defaultValue"]) ?? -1,
  }),
  channels: {
    value: {
      controlled: true,
      parse: numProp,
      event: (value: number) => ({ type: "SET_VALUE", value }),
    },
    defaultValue: { parse: numProp },
    count: { parse: countProp },
    allowHalf: { parse: (raw) => raw === true },
    disabled: { parse: (raw) => raw === true },
    readOnly: { parse: (raw) => raw === true },
    required: { parse: (raw) => raw === true },
    name: { parse: textProp },
    form: { parse: textProp },
    dir: { parse: (raw) => (raw === "rtl" ? "rtl" : "ltr") },
    label: { parse: textProp },
  },
  scalars: ["count", "allowHalf", "disabled", "readOnly"],
  parts: {
    root: {
      sig: (scope) => [scope.props["dir"]].join("|"),
      attrs: (scope) => ({
        id: scope.id("root"),
        dir: scope.props["dir"],
        "data-scope": "rating-group",
        "data-part": "root",
      }),
    },
    label: {
      sig: (scope) => [scope.props["label"], scope.props["disabled"]].join("|"),
      attrs: (scope) => ({
        id: scope.id("label"),
        dir: scope.props["dir"],
        "data-scope": "rating-group",
        "data-part": "label",
        "data-disabled": scope.attr(scope.props["disabled"] === true),
        "data-required": scope.attr(scope.props["required"] === true),
        for: scope.id("hiddenInput"),
        onClick: (event: MouseEvent) => {
          if (event.defaultPrevented) return;
          if (!isInteractive(asCtx(scope.context))) return;
          event.preventDefault();
          focusActiveRadio(scope.id, asCtx(scope.context).value as number);
        },
      }),
    },
    control: {
      sig: (scope) => [scope.state, scope.props["disabled"], scope.props["readOnly"]].join("|"),
      attrs: (scope) => ({
        id: scope.id("control"),
        role: "radiogroup",
        "aria-orientation": "horizontal",
        "aria-labelledby": scope.id("label"),
        "aria-readonly": scope.props["readOnly"] === true ? "true" : undefined,
        "data-scope": "rating-group",
        "data-part": "control",
        "data-readonly": scope.attr(scope.props["readOnly"] === true),
        "data-disabled": scope.attr(scope.props["disabled"] === true),
        onPointermove: (event: PointerEvent) => {
          if (!isInteractive(asCtx(scope.context))) return;
          if (event.pointerType === "touch") return;
          scope.send({ type: "GROUP_POINTER_OVER" });
        },
        onPointerleave: () => {
          if (!isInteractive(asCtx(scope.context))) return;
          if (typeof document === "undefined") return;
          const radioFocused = document.getElementById(scope.id("control"))?.contains(document.activeElement) === true;
          scope.send({ type: "GROUP_POINTER_LEAVE", radioFocused });
        },
      }),
    },
    hiddenInput: {
      id: "input",
      sig: (scope) => [scope.props["name"], asCtx(scope.context).value, scope.props["disabled"]].join("|"),
      attrs: (scope) => {
        const name = scope.props["name"] as string;
        return {
          id: scope.id("hiddenInput"),
          name: name.length > 0 ? name : undefined,
          form: undefined,
          type: "text",
          hidden: true,
          disabled: scope.props["disabled"] === true ? true : undefined,
          readonly: scope.props["readOnly"] === true ? true : undefined,
          required: scope.props["required"] === true ? true : undefined,
          value: String(asCtx(scope.context).value),
        };
      },
    },
  },
  slots: {
    item: {
      indexes: (context) => itemIndexes(asCtx(context).count),
      sig: (scope) => {
        const state = itemState(asCtx(scope.context), slotIndex(scope.slot));
        return [scope.state, state.highlighted, state.half, state.checked, scope.props["disabled"], scope.props["readOnly"], scope.props["dir"]].join("|");
      },
      attrs: (scope) => {
        const index = slotIndex(scope.slot);
        const context = asCtx(scope.context);
        const state = itemState(context, index);
        const interactive = isInteractive(context);
        return {
          id: scope.id("item", index),
          role: "radio",
          tabindex: scope.props["readOnly"] === true || scope.props["disabled"] === true
            ? (state.checked ? "0" : undefined)
            : (state.checked ? "0" : "-1"),
          "aria-roledescription": "rating",
          "aria-label": `${index} stars`,
          "aria-disabled": scope.props["disabled"] === true ? "true" : undefined,
          "data-scope": "rating-group",
          "data-part": "item",
          "data-disabled": scope.attr(scope.props["disabled"] === true),
          "data-readonly": scope.attr(scope.props["readOnly"] === true),
          "aria-setsize": String(context.count),
          "aria-checked": state.checked ? "true" : "false",
          "data-checked": scope.attr(state.checked),
          "aria-posinset": String(index),
          "data-highlighted": scope.attr(state.highlighted),
          "data-half": scope.attr(state.half),
          onPointerdown: (event: PointerEvent) => {
            if (!interactive) return;
            if (event.pointerType === "mouse" && event.button !== 0) return;
            event.preventDefault();
          },
          onPointermove: (event: PointerEvent) => {
            if (!isInteractive(asCtx(scope.context))) return;
            const target = event.currentTarget as Element | null;
            if (target === null || typeof target.getBoundingClientRect !== "function") return;
            const rect = target.getBoundingClientRect();
            const dir = scope.props["dir"] as string;
            const x = dir === "rtl" ? rect.right - event.clientX : event.clientX - rect.left;
            const isMidway = rect.width > 0 && x / rect.width < 0.5;
            scope.send({ type: "POINTER_OVER", index, isMidway });
          },
          onKeydown: (event: KeyboardEvent) => {
            if (event.defaultPrevented) return;
            if (!isInteractive(asCtx(scope.context))) return;
            if (isComposing(event)) return;
            const dir = scope.props["dir"] as string;
            const move = (type: string): boolean => {
              event.preventDefault();
              scope.send({ type });
              focusActiveRadio(scope.id, asCtx(scope.context).value as number);
              return true;
            };
            switch (event.key) {
              case "ArrowLeft":
              case "ArrowUp":
                move(dir === "rtl" ? "ARROW_RIGHT" : "ARROW_LEFT");
                break;
              case "ArrowRight":
              case "ArrowDown":
                move(dir === "rtl" ? "ARROW_LEFT" : "ARROW_RIGHT");
                break;
              case " ":
                event.preventDefault();
                scope.send({ type: "SPACE", value: index });
                focusActiveRadio(scope.id, asCtx(scope.context).value as number);
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
            if (!isInteractive(asCtx(scope.context))) return;
            scope.send({ type: "CLICK", value: index });
          },
          onFocus: () => {
            if (!isInteractive(asCtx(scope.context))) return;
            scope.send({ type: "FOCUS" });
          },
          onBlur: () => {
            if (!isInteractive(asCtx(scope.context))) return;
            scope.send({ type: "BLUR" });
          },
        };
      },
    },
  },
  commands: {
    setValue: { event: (args) => ({ type: "SET_VALUE", value: args[0] as number }) },
    clearValue: { event: () => ({ type: "CLEAR_VALUE" }) },
  },
  readers: {
    value: { read: (context) => asCtx(context).value },
    hoveredValue: { read: (context) => asCtx(context).hoveredValue },
    hovering: { read: (context) => isHovering(asCtx(context)) },
    count: { read: (context) => asCtx(context).count },
  },
  methods: {
    getItems: {
      call: (context) => itemIndexes(asCtx(context).count),
    },
    getItemState: {
      call: (context, _state, args) => itemState(asCtx(context), (args[0] as { readonly index: number }).index),
    },
  },
  events: {
    "value-change": {
      prop: "onValueChange",
      watch: (context) => [asCtx(context).value],
      detail: (watched) => ({ value: watched[0] as number }),
    },
    "hover-change": {
      prop: "onHoverChange",
      watch: (context) => [asCtx(context).hoveredValue],
      detail: (watched) => ({ hoveredValue: watched[0] as number }),
    },
  },
};

export const ratingGroup = defineComponent<RatingGroupContext, RatingGroupEvent, RatingGroupApi>(def);

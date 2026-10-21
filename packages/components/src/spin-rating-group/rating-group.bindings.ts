import {
  type ComponentDef,
  defaultTwin,
  defineComponent,
  isComposing,
} from "@spin/runtime";
import {
  isHovering,
  isInteractive,
  itemState,
  ratingGroup as ratingGroupMachine,
  type RatingGroupArgs,
  type RatingGroupContext,
  type RatingGroupEvents,
  type RatingGroupValueChange,
  type RatingItemState,
} from "./rating-group.machine.ts";

/**
 * Rating-group definition: the DOM contract as data. The halfway hover flag
 * is measured against the item node and sent in with the event.
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

export type { RatingGroupValueChange };

const slotIndex = (slot: unknown): number =>
  (typeof slot === "object" && slot !== null && "index" in slot &&
      typeof Reflect.get(slot, "index") === "number")
    ? (Number(Reflect.get(slot, "index")))
    : 0;
const isIndexArg = (value: unknown): value is { readonly index: number } =>
  typeof value === "object" && value !== null && "index" in value &&
  typeof Reflect.get(value, "index") === "number";

const itemIndexCache = new Map<number, readonly number[]>();
const itemIndexes = (length: number): readonly number[] => {
  const hit = itemIndexCache.get(length);
  if (hit !== undefined) return hit;
  const made = Array.from({ length }, (_, index) => index + 1);
  itemIndexCache.set(length, made);
  return made;
};

const seedOf = (
  props: Readonly<Record<string, unknown>>,
  authored: (name: string) => boolean,
  field: string,
): unknown => {
  const twin = defaultTwin(field);
  return authored(field) ? props[field] : props[twin];
};

const countOf = (raw: unknown): number => {
  const n = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(n) ? Math.max(1, Math.floor(n)) : 5;
};

const valueOf = (raw: unknown): number => {
  const n = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(n) ? n : -1;
};

const def: ComponentDef<RatingGroupContext, RatingGroupEvents> = {
  name: "rating-group",
  machine: (props, authored) => ratingGroupMachine(props as RatingGroupArgs, authored),
  start: "idle",
  parts: {
    root: {
      attrs: (scope) => ({
        id: scope.id(""),
        dir: scope.props["dir"],
        "data-scope": "rating-group",
        "data-part": "root",
      }),
    },
    label: {
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
          if (!isInteractive(scope.context)) return;
          event.preventDefault();
        },
      }),
    },
    control: {
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
      attrs: (scope) => {
        const rawName = scope.props["name"];
        const name = typeof rawName === "string" ? rawName : "";
        return {
          id: scope.id("hiddenInput"),
          name: name.length > 0 ? name : undefined,
          form: undefined,
          type: "text",
          hidden: true,
          disabled: scope.props["disabled"] === true ? true : undefined,
          readonly: scope.props["readOnly"] === true ? true : undefined,
          required: scope.props["required"] === true ? true : undefined,
          value: String(scope.context.value),
        };
      },
    },
  },
  slots: {
    item: {
      indexes: (context) => itemIndexes(context.count),
      attrs: (scope) => {
        const index = slotIndex(scope.slot);
        const context = scope.context;
        const state = itemState(context, index);
        const interactive = isInteractive(context);
        return {
          id: scope.id("item", index),
          role: "radio",
          tabindex:
            scope.props["readOnly"] === true || scope.props["disabled"] === true
              ? (state.checked ? "0" : undefined)
              : (state.checked ? "0" : "-1"),
          "aria-roledescription": "rating",
          "aria-label": `${index} stars`,
          "aria-disabled": scope.props["disabled"] === true
            ? "true"
            : undefined,
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
            if (!isInteractive(scope.context)) return;
            const rect = scope.measure("item", index);
            if (rect === null) return;
            const dir = typeof scope.props["dir"] === "string"
              ? scope.props["dir"]
              : "ltr";
            const x = dir === "rtl"
              ? rect.right - event.clientX
              : event.clientX - rect.left;
            const isMidway = rect.width > 0 && x / rect.width < 0.5;
            scope.send({ type: "POINTER_OVER", index, isMidway });
          },
          onKeydown: (event: KeyboardEvent) => {
            if (event.defaultPrevented) return;
            if (!isInteractive(scope.context)) return;
            if (isComposing(event)) return;
            const dir = typeof scope.props["dir"] === "string"
              ? scope.props["dir"]
              : "ltr";
            const move = (type: string): boolean => {
              event.preventDefault();
              scope.send({ type });
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
      event: (args) => ({
        type: "SET_VALUE",
        value: typeof args[0] === "number" ? args[0] : 0,
      }),
    },
    clearValue: { event: () => ({ type: "CLEAR_VALUE" }) },
  },
  readers: {
    value: { read: (context) => context.value },
    hoveredValue: { read: (context) => context.hoveredValue },
    hovering: { read: (context) => isHovering(context) },
    count: { read: (context) => context.count },
  },
  methods: {
    getItems: {
      call: (context) => itemIndexes(context.count),
    },
    getItemState: {
      call: (context, _state, args) => {
        const a = args[0];
        const i = isIndexArg(a) ? a.index : 0;
        return itemState(context, i);
      },
    },
  },
  events: {
    "value-change": {
      prop: "onValueChange",
      watch: (context) => [context.value],
      detail: (watched) => ({
        value: typeof watched[0] === "number" ? watched[0] : 0,
      }),
    },
    "hover-change": {
      prop: "onHoverChange",
      watch: (context) => [context.hoveredValue],
      detail: (watched) => ({
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
    const afterRecord: Record<string, unknown> = Object.assign(
      {},
      (after && typeof after === "object") ? after : {},
    );
    const ctx = afterRecord["context"];
    if (!ctx || typeof ctx !== "object" || !("value" in ctx)) return;
    const value = ctx.value;
    if (typeof value === "number" && value > 0) {
      focus("item", Math.max(1, Math.ceil(value)));
    }
  },
};

export const ratingGroup = defineComponent<
  RatingGroupContext,
  RatingGroupEvents,
  RatingGroupApi
>(def);

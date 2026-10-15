import { dataAttr } from "../spin-select/select.shared.ts";
import {
  isHovering,
  isInteractive,
  itemState,
  type RatingGroupContext,
  type RatingItemState,
} from "./rating-group.machine.ts";

/**
 * Rating-group connect: the DOM contract, the view-owned geometry, and the
 * reflexes the parts carry.
 *
 * What the machine owns stays there: the three phases, the value, the hover
 * preview, the half-step math. Everything that needs a node lives here —
 * the halfway hover flag (measured against the item node and sent in with
 * the event), the checked-radio focus after a keyboard move (a view reflex),
 * and the label click that focuses the active radio.
 */

export interface RatingGroupConnectProps {
  readonly disabled: boolean;
  readonly readOnly: boolean;
  readonly required: boolean;
  readonly name: string;
  readonly form: string;
  readonly dir: "ltr" | "rtl";
  readonly label: string;
}

export interface RatingItemSlotProps {
  readonly index: number;
}

/** Zag's api methods, narrowed to the command surface the element exposes. */
export interface RatingGroupCommands {
  setValue(value: number): void;
  clearValue(): void;
}

export interface RatingGroupApi extends RatingGroupCommands {
  readonly value: number;
  readonly hoveredValue: number;
  readonly hovering: boolean;
  readonly count: number;
  /** The item indexes, for the recipe's iteration. */
  getItems(): readonly number[];
  getItemState(slot: RatingItemSlotProps): RatingItemState;
  getRootProps(): Record<string, unknown>;
  getLabelProps(): Record<string, unknown>;
  getControlProps(): Record<string, unknown>;
  getItemProps(slot: RatingItemSlotProps): Record<string, unknown>;
  getHiddenInputProps(): Record<string, unknown>;
}

/** The service the connect reads: the fork's, narrowed to what it needs. */
export interface RatingGroupService {
  readonly context: RatingGroupContext;
  /** The machine's state: idle, focus, or hover. */
  readonly state: string;
  send(event: { type: string } & Record<string, unknown>): void;
}

export interface BagMemo {
  sig: string;
  bag: Record<string, unknown>;
}

/** A bag cached until the signature of the fields it reads moves. One memo
 * holds the single bag of one part (there is one root, one control per
 * element), so a single slot is the whole cache. */
function memo(): (
  sig: string,
  build: () => Record<string, unknown>,
) => Record<string, unknown> {
  let sig = "";
  let bag: Record<string, unknown> | undefined;
  return (next, build) => {
    if (bag !== undefined && sig === next) return bag;
    sig = next;
    bag = build();
    return bag;
  };
}

/** Items are stable slots, so the memo dies with the slot it came from. */
function keyed<K extends object>(
  store: WeakMap<K, BagMemo>,
  owner: K,
  sig: string,
  build: () => Record<string, unknown>,
): Record<string, unknown> {
  const hit = store.get(owner);
  if (hit !== undefined && hit.sig === sig) return hit.bag;
  const bag = build();
  store.set(owner, { sig, bag });
  return bag;
}

/** Zag's `isComposingEvent`: a composing keystroke is not a navigation. */
const isComposing = (event: KeyboardEvent): boolean =>
  event.isComposing === true || event.keyCode === 229;

export function connectRatingGroup(
  service: RatingGroupService,
  readProps: () => RatingGroupConnectProps,
  id: string,
): RatingGroupApi {
  // Live accessor, never a snapshot: the fork replaces the context object
  // on every assign, so a destructured copy would freeze the first read.
  const ctx = (): RatingGroupContext => service.context;
  const send = service.send;
  const rootId = `rating-group:${id}`;
  const controlId = `rating-group:${id}:control`;
  const labelId = `rating-group:${id}:label`;
  const hiddenInputId = `rating-group:${id}:input`;
  const itemId = (index: number): string => `rating-group:${id}:item:${index}`;

  const rootBag = memo();
  const labelBag = memo();
  const controlBag = memo();
  const itemBags = new WeakMap<{ index: number }, BagMemo>();
  const hiddenInputBag = memo();

  /** The view reflex: after a keyboard move the checked radio takes focus. */
  const focusActiveRadio = (): void => {
    if (typeof document === "undefined") return;
    const checked = document.getElementById(itemId(Math.max(1, Math.ceil(ctx().value))));
    checked?.focus({ preventScroll: true });
  };

  return {
    get value() {
      return ctx().value;
    },
    get hoveredValue() {
      return ctx().hoveredValue;
    },
    get hovering() {
      return isHovering(ctx());
    },
    get count() {
      return ctx().count;
    },
    setValue: (value: number) => {
      send({ type: "SET_VALUE", value });
    },
    clearValue: () => {
      send({ type: "CLEAR_VALUE" });
    },
    getItems: () => Array.from({ length: ctx().count }, (_, index) => index + 1),
    getItemState: (slot: RatingItemSlotProps) => itemState(ctx(), slot.index),
    getRootProps: () => {
      const props = readProps();
      return rootBag([props.dir].join("|"), () => ({
        id: rootId,
        dir: props.dir,
        "data-scope": "rating-group",
        "data-part": "root",
      }));
    },
    getLabelProps: () => {
      const props = readProps();
      return labelBag([props.label, props.disabled].join("|"), () => ({
        id: labelId,
        dir: props.dir,
        "data-scope": "rating-group",
        "data-part": "label",
        "data-disabled": dataAttr(props.disabled),
        "data-required": dataAttr(props.required),
        for: hiddenInputId,
        onClick: (event: MouseEvent) => {
          if (event.defaultPrevented) return;
          if (!isInteractive(ctx())) return;
          event.preventDefault();
          focusActiveRadio();
        },
      }));
    },
    getControlProps: () => {
      const props = readProps();
      return controlBag(
        [service.state, props.disabled, props.readOnly].join("|"),
        () => ({
          id: controlId,
          role: "radiogroup",
          "aria-orientation": "horizontal",
          "aria-labelledby": labelId,
          "aria-readonly": props.readOnly ? "true" : undefined,
          "data-scope": "rating-group",
          "data-part": "control",
          "data-readonly": dataAttr(props.readOnly),
          "data-disabled": dataAttr(props.disabled),
          onPointermove: (event: PointerEvent) => {
            if (!isInteractive(ctx())) return;
            if (event.pointerType === "touch") return;
            send({ type: "GROUP_POINTER_OVER" });
          },
          onPointerleave: (event: PointerEvent) => {
            if (!isInteractive(ctx())) return;
            if (event.pointerType === "touch") return;
            const radioFocused = typeof document !== "undefined" &&
              document.getElementById(controlId)?.contains(document.activeElement) === true;
            send({ type: "GROUP_POINTER_LEAVE", radioFocused });
          },
        }),
      );
    },
    getItemProps: (slot: RatingItemSlotProps) => {
      const props = readProps();
      const state = itemState(ctx(), slot.index);
      return keyed(
        itemBags,
        slot,
        [
          service.state,
          state.highlighted,
          state.half,
          state.checked,
          props.disabled,
          props.readOnly,
          props.dir,
        ].join("|"),
        () => ({
          id: itemId(slot.index),
          role: "radio",
          tabindex: props.readOnly || props.disabled
            ? (state.checked ? "0" : undefined)
            : (state.checked ? "0" : "-1"),
          "aria-roledescription": "rating",
          "aria-label": `${slot.index} stars`,
          "aria-disabled": props.disabled ? "true" : undefined,
          "data-scope": "rating-group",
          "data-part": "item",
          "data-disabled": dataAttr(props.disabled),
          "data-readonly": dataAttr(props.readOnly),
          "aria-setsize": String(ctx().count),
          "aria-checked": state.checked ? "true" : "false",
          "data-checked": dataAttr(state.checked),
          "aria-posinset": String(slot.index),
          "data-highlighted": dataAttr(state.highlighted),
          "data-half": dataAttr(state.half),
          onPointerdown: (event: PointerEvent) => {
            if (!isInteractive(ctx())) return;
            if (event.pointerType === "mouse" && event.button !== 0) return;
            event.preventDefault();
          },
          onPointermove: (event: PointerEvent) => {
            if (!isInteractive(ctx())) return;
            const target = event.currentTarget as Element | null;
            if (target === null || typeof target.getBoundingClientRect !== "function") return;
            const rect = target.getBoundingClientRect();
            const x = props.dir === "rtl" ? rect.right - event.clientX : event.clientX - rect.left;
            const isMidway = rect.width > 0 && x / rect.width < 0.5;
            send({ type: "POINTER_OVER", index: slot.index, isMidway });
          },
          onKeydown: (event: KeyboardEvent) => {
            if (event.defaultPrevented) return;
            if (!isInteractive(ctx())) return;
            if (isComposing(event)) return;
            const move = (type: string): boolean => {
              event.preventDefault();
              send({ type });
              focusActiveRadio();
              return true;
            };
            switch (event.key) {
              case "ArrowLeft":
              case "ArrowUp":
                move(props.dir === "rtl" ? "ARROW_RIGHT" : "ARROW_LEFT");
                break;
              case "ArrowRight":
              case "ArrowDown":
                move(props.dir === "rtl" ? "ARROW_LEFT" : "ARROW_RIGHT");
                break;
              case " ":
                event.preventDefault();
                send({ type: "SPACE", value: slot.index });
                focusActiveRadio();
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
            if (!isInteractive(ctx())) return;
            send({ type: "CLICK", value: slot.index });
          },
          onFocus: () => {
            if (!isInteractive(ctx())) return;
            send({ type: "FOCUS" });
          },
          onBlur: () => {
            if (!isInteractive(ctx())) return;
            send({ type: "BLUR" });
          },
        }),
      );
    },
    getHiddenInputProps: () => {
      const props = readProps();
      return hiddenInputBag([props.name, ctx().value, props.disabled].join("|"), () => ({
        id: hiddenInputId,
        name: props.name.length > 0 ? props.name : undefined,
        form: undefined,
        type: "text",
        hidden: true,
        disabled: props.disabled ? true : undefined,
        readonly: props.readOnly ? true : undefined,
        required: props.required ? true : undefined,
        value: String(ctx().value),
      }));
    },
  };
}

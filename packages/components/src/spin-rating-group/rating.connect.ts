/**
 * Rating connect: the DOM contract, the keyboard map and the pointer flows.
 *
 * The machine owns the value, the hover preview and the three states; this
 * owns everything the rest of the page can see — part ids, the radiogroup
 * semantics, the arrow/Space/Home/End map, the pointer-per-item halfway
 * split that `allowHalf` rides on, and the two reflexes that are really
 * form-control concerns (a disabled ancestor fieldset, a form reset).
 *
 * Continuous values leave through the geometry channel: the fill percent is
 * one custom property on the item, `--rating-fill`, and the recipe's
 * bracketed utility decides what it feeds. No concrete property is ever
 * written from here.
 */

import type { RatingContext, RatingEvent } from "./rating.machine.ts";

export interface RatingItem {
  readonly index: number;
}

export interface RatingItemState {
  readonly highlighted: boolean;
  readonly half: boolean;
  readonly checked: boolean;
}

export interface RatingFsmConnectProps {
  readonly count: number;
  readonly allowHalf: boolean;
  readonly disabled: boolean;
  readonly readOnly: boolean;
  readonly required: boolean;
  readonly name: string | undefined;
  readonly form: string | undefined;
  readonly dir: string;
  /** The aria-label text for one item; defaults to `${index} stars`. */
  readonly translate: (index: number) => string;
  /** A host form reset puts the value back to the seeded default. */
  readonly onFormReset: () => void;
  /** A disabled ancestor fieldset makes the group inert. */
  readonly onDisabledChange: (disabled: boolean) => void;
}

export interface RatingFsmApi {
  readonly value: number;
  readonly hoveredValue: number;
  readonly hovering: boolean;
  readonly count: number;
  getItems(): readonly RatingItem[];
  getItemState(item: RatingItem): RatingItemState;
  getRootProps(): Record<string, unknown>;
  getLabelProps(): Record<string, unknown>;
  getControlProps(): Record<string, unknown>;
  getItemProps(item: RatingItem): Record<string, unknown>;
  getHiddenInputProps(): Record<string, unknown>;
}

type Send = (event: { type: string } & Record<string, unknown>) => void;

/** The part-id namespace, so `aria-controls`/`aria-labelledby` point at ours. */
const NAMESPACE = "rating";

export interface RatingService {
  readonly context: RatingContext;
  readonly state: string;
  send(event: { type: string } & Record<string, unknown>): void;
}

/** A cached bag plus the signature of what it read. */
interface BagMemo {
  sig: string;
  bag: Record<string, unknown>;
}

/**
 * A bag cached until the signature of the fields it reads moves. Bindings
 * re-read the bag on every machine move, so a fresh bag per read would
 * detach and re-attach every listener each move.
 */
function cached(): (sig: string, build: () => Record<string, unknown>) => Record<string, unknown> {
  let sig = "";
  let bag: Record<string, unknown> | undefined;
  return (next: string, build: () => Record<string, unknown>): Record<string, unknown> => {
    if (bag !== undefined && sig === next) return bag;
    sig = next;
    bag = build();
    return bag;
  };
}

/** `cached` per owner: items are stable objects, so the memo dies with the
 * count that produced them. */
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

/** Where one star sits in the tab order, as a bag fragment. The key is absent
 * when there is no tab stop: the binding assigns ASSIGNABLE props, and an
 * undefined long lands as 0, which would put a disabled star back in the tab
 * order. */
function tabIndexSpread(
  disabled: boolean,
  readOnly: boolean,
  checked: boolean,
): { readonly tabIndex?: number } {
  if (disabled) return {};
  if (checked) return { tabIndex: 0 };
  return readOnly ? {} : { tabIndex: -1 };
}

export function connectRobotRating(
  service: RatingService,
  readProps: () => RatingFsmConnectProps,
  id: string,
  send: Send,
): RatingFsmApi {
  const ownerId = id.startsWith(`${NAMESPACE}:`) ? id : `${NAMESPACE}:${id}`;
  const rootId = ownerId;
  const labelId = `${ownerId}:label`;
  const controlId = `${ownerId}:control`;
  const hiddenInputId = `${ownerId}:input`;
  const itemId = (index: number): string => `${ownerId}:item:${index}`;
  const ctx = (): RatingContext => service.context;

  const interactive = (): boolean => {
    const props = readProps();
    return !(props.disabled || props.readOnly);
  };

  /** The value the group displays: the preview while the pointer is over it. */
  const preview = (): number => {
    const hovered = ctx().hoveredValue;
    return hovered > -1 ? hovered : ctx().value;
  };

  const itemState = (index: number): RatingItemState => {
    const current = preview();
    const equal = Math.ceil(current) === index;
    return {
      highlighted: index <= current || equal,
      half: equal && Math.abs(current - index) === 0.5,
      // A radio group with nothing selected still checks its first radio:
      // that is the item the keyboard starts from.
      checked: equal || (ctx().value <= 0 && index === 1),
    };
  };

  // ---- items --------------------------------------------------------------

  /** Stable per count: the markup's `for` keys on the index, and the bags
   * are cached per item object. */
  let itemSource = -1;
  let itemCache: readonly RatingItem[] = [];
  const items = (): readonly RatingItem[] => {
    const { count } = readProps();
    if (count !== itemSource) {
      itemSource = count;
      const built: RatingItem[] = [];
      for (let index = 1; index <= count; index++) built.push({ index });
      itemCache = built;
    }
    return itemCache;
  };

  // ---- reflexes -----------------------------------------------------------

  /**
   * Zag's `focusActiveRadio`, which is a focus call rather than a context
   * write, so it lives with the DOM that performs it. The send is
   * synchronous: the value it reads is the one the machine just took.
   */
  const focusActiveRadio = (): void => {
    const index = Math.ceil(ctx().value);
    if (index >= 1) document.getElementById(itemId(index))?.focus();
  };

  const commit = (event: RatingEvent): void => {
    send(event);
    focusActiveRadio();
  };

  /** A press that starts on an item must not move focus natively: the radio
   * group owns which item is active, and a native focus jump would race the
   * machine's own move. */
  const onItemPointerDown = (event: PointerEvent): void => {
    if (!interactive() || event.button !== 0) return;
    event.preventDefault();
  };

  /** Where in the item the pointer sits decides a half pick. */
  const isMidway = (event: PointerEvent, dir: string): boolean => {
    const node = event.currentTarget;
    if (!(node instanceof Element)) return false;
    const rect = node.getBoundingClientRect();
    if (rect.width === 0) return false;
    const percent = Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1);
    return (dir === "rtl" ? 1 - percent : percent) < 0.5;
  };

  /** Zag's shared key normalization, as far as this map consumes it. */
  const normalizeKey = (event: KeyboardEvent, dir: string): string => {
    let key = event.key;
    if (key === " ") key = "Space";
    else if (key === "Up") key = "ArrowUp";
    else if (key === "Down") key = "ArrowDown";
    if (dir !== "rtl") return key;
    if (key === "ArrowLeft") return "ArrowRight";
    if (key === "ArrowRight") return "ArrowLeft";
    return key;
  };

  interface ItemHandlers {
    readonly onPointerDown: (event: PointerEvent) => void;
    readonly onPointerMove: (event: PointerEvent) => void;
    readonly onKeyDown: (event: KeyboardEvent) => void;
    readonly onClick: () => void;
    readonly onFocus: () => void;
    readonly onBlur: () => void;
  }
  const itemHandlers = new WeakMap<RatingItem, ItemHandlers>();
  const handlersFor = (item: RatingItem): ItemHandlers => {
    const hit = itemHandlers.get(item);
    if (hit !== undefined) return hit;
    const made: ItemHandlers = {
      onPointerDown: onItemPointerDown,
      onPointerMove: (event: PointerEvent) => {
        if (!interactive()) return;
        send({ type: "POINTER_OVER", index: item.index, isMidway: isMidway(event, readProps().dir) });
      },
      onKeyDown: (event: KeyboardEvent) => {
        if (event.defaultPrevented || !interactive()) return;
        switch (normalizeKey(event, readProps().dir)) {
          case "ArrowLeft":
          case "ArrowUp":
            commit({ type: "ARROW_LEFT" });
            break;
          case "ArrowRight":
          case "ArrowDown":
            commit({ type: "ARROW_RIGHT" });
            break;
          case "Space":
            commit({ type: "SPACE", value: item.index });
            break;
          case "Home":
            commit({ type: "HOME" });
            break;
          case "End":
            commit({ type: "END" });
            break;
          default:
            return;
        }
        event.preventDefault();
      },
      onClick: () => {
        if (!interactive()) return;
        commit({ type: "CLICK", value: item.index });
      },
      onFocus: () => {
        if (!interactive()) return;
        send({ type: "FOCUS" });
      },
      onBlur: () => {
        if (!interactive()) return;
        send({ type: "BLUR" });
      },
    };
    itemHandlers.set(item, made);
    return made;
  };

  // ---- cached bags --------------------------------------------------------

  const rootBag = cached();
  const labelBag = cached();
  const controlBag = cached();
  const hiddenInputBag = cached();
  const itemBags = new WeakMap<RatingItem, BagMemo>();

  /** The stdlib action's params, built once: a fresh object per read would
   * re-attach the observers on every machine move. */
  const formControl = {
    onDisabledChange: readProps().onDisabledChange,
    onFormReset: readProps().onFormReset,
  };

  return {
    // Live, not a snapshot: this connect outlives the machine move that
    // changes either field, and a host reads it between moves.
    get value(): number {
      return ctx().value;
    },
    get hoveredValue(): number {
      return ctx().hoveredValue;
    },
    get hovering(): boolean {
      return ctx().hoveredValue > -1;
    },
    get count(): number {
      return readProps().count;
    },
    getItems: items,
    getItemState: (item: RatingItem): RatingItemState => itemState(item.index),
    getRootProps: () => {
      const props = readProps();
      return rootBag(`${props.dir}`, () => ({
        id: rootId,
        dir: props.dir,
        "use:form-control": formControl,
      }));
    },
    getLabelProps: () => {
      const props = readProps();
      return labelBag(`${props.disabled}\u0000${props.required}`, () => ({
        id: labelId,
        for: hiddenInputId,
        "data-disabled": props.disabled ? "" : undefined,
        "data-required": props.required ? "" : undefined,
        onClick: (event: MouseEvent) => {
          if (event.defaultPrevented || !interactive()) return;
          event.preventDefault();
          const index = Math.max(1, ctx().value);
          document.getElementById(itemId(index))?.focus({ preventScroll: true });
        },
      }));
    },
    getControlProps: () => {
      const props = readProps();
      return controlBag(`${props.dir}\u0000${props.readOnly}\u0000${props.disabled}\u0000${service.state}`, () => ({
        id: controlId,
        dir: props.dir,
        role: "radiogroup",
        "aria-orientation": "horizontal",
        "aria-labelledby": labelId,
        "aria-readonly": props.readOnly,
        "data-readonly": props.readOnly ? "" : undefined,
        "data-disabled": props.disabled ? "" : undefined,
        // The machine's state, as the utility layer reads it: a preview
        // paints the group differently from a settled value.
        "data-state": service.state,
        onPointerMove: (event: PointerEvent) => {
          if (!interactive() || event.pointerType === "touch") return;
          // Only the idle-to-hover crossing matters: every later move is a
          // no-op in hover, and re-sending it would bump the tick — and so
          // every binding — on each pointer sample.
          if (service.state !== "idle") return;
          send({ type: "GROUP_POINTER_OVER" });
        },
        onPointerLeave: (event: PointerEvent) => {
          if (!interactive() || event.pointerType === "touch") return;
          send({ type: "GROUP_POINTER_LEAVE" });
        },
      }));
    },
    getItemProps: (item: RatingItem) => {
      const props = readProps();
      const state = itemState(item.index);
      const label = props.translate(item.index);
      return keyed(
        itemBags,
        item,
        `${ctx().value}\u0000${ctx().hoveredValue}\u0000${state.checked}\u0000${state.half}\u0000${props.disabled}\u0000${props.readOnly}\u0000${props.count}\u0000${label}`,
        () => {
          const bag: Record<string, unknown> = {
            id: itemId(item.index),
            role: "radio",
            "aria-roledescription": "rating",
            "aria-label": label,
            "aria-setsize": props.count,
            "aria-posinset": item.index,
            "aria-checked": state.checked,
            "aria-disabled": props.disabled,
            "data-checked": state.checked ? "" : undefined,
            "data-highlighted": state.highlighted ? "" : undefined,
            "data-half": state.half ? "" : undefined,
            ...(props.disabled ? { "data-disabled": "" } : {}),
            ...(props.readOnly ? { "data-readonly": "" } : {}),
            // The item leaves the tab order entirely when the group is
            // disabled; readOnly keeps the checked one focusable. The key is
            // omitted rather than written undefined: the binding assigns
            // ASSIGNABLE props, and an undefined long lands as 0 — which
            // would put a disabled star back in the tab order.
            ...tabIndexSpread(props.disabled, props.readOnly, state.checked),
            // The geometry channel: the fill percent is data, and the
            // recipe's bracket decides what it feeds.
            style: {
              "--rating-fill": `${state.half ? 50 : state.highlighted ? 100 : 0}%`,
            },
            ...handlersFor(item),
          };
          return bag;
        },
      );
    },
    getHiddenInputProps: () => {
      const props = readProps();
      const value = ctx().value;
      return hiddenInputBag(
        `${value}\u0000${props.disabled}\u0000${props.readOnly}\u0000${props.required}\u0000${props.name}\u0000${props.form}`,
        () => ({
          id: hiddenInputId,
          name: props.name,
          form: props.form,
          type: "text",
          hidden: true,
          disabled: props.disabled,
          readOnly: props.readOnly,
          required: props.required,
          defaultValue: value,
          value: value,
        }),
      );
    },
  };
}

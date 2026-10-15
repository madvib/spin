import { dataAttr } from "../spin-select/select.shared.ts";
import {
  isInteractive,
  isPressed,
  type ToggleGroupContext,
  type ToggleGroupItem,
} from "./toggle-group.machine.ts";

/**
 * Toggle-group connect: the DOM contract, the view-owned order, and the
 * reflexes the parts carry.
 *
 * What the machine owns stays there: the two phases, the selection, the
 * focused id, the click/tab disambiguation. Everything that needs nodes
 * lives here — neighbor resolution against the item order (the machine
 * records the resolved id, exactly as combobox arrows do), DOM focus moves
 * as a reflex, and the root focus/blur shape that tells clicks from tabs.
 */

export interface ToggleGroupConnectProps {
  readonly disabled: boolean;
  readonly multiple: boolean;
  readonly rovingFocus: boolean;
  readonly loopFocus: boolean;
  readonly orientation: "horizontal" | "vertical";
  readonly deselectable: boolean;
  readonly dir: "ltr" | "rtl";
  readonly label: string;
}

export interface ToggleGroupItemSlotProps {
  readonly value: string;
}

/** Zag's api methods, narrowed to the command surface the element exposes. */
export interface ToggleGroupCommands {
  setValue(value: readonly string[]): void;
}

export interface ToggleGroupApi extends ToggleGroupCommands {
  readonly value: readonly string[];
  readonly multiple: boolean;
  isPressed(value: string): boolean;
  getItemState(slot: ToggleGroupItemSlotProps): {
    readonly pressed: boolean;
    readonly focused: boolean;
    readonly disabled: boolean;
  };
  /** The items in order, for the recipe's iteration. */
  getItems(): readonly ToggleGroupItem[];
  getRootProps(): Record<string, unknown>;
  getItemProps(slot: ToggleGroupItemSlotProps): Record<string, unknown>;
}

/** The service the connect reads: the fork's, narrowed to what it needs. */
export interface ToggleGroupService {
  readonly context: ToggleGroupContext;
  /** The machine's state: idle or focused. */
  readonly state: string;
  send(event: { type: string } & Record<string, unknown>): void;
}

export interface BagMemo {
  sig: string;
  bag: Record<string, unknown>;
}

/** A bag cached until the signature of the fields it reads moves. One memo
 * holds the single bag of one part (there is one root per element), so a
 * single slot is the whole cache. */
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

export function connectToggleGroup(
  service: ToggleGroupService,
  readProps: () => ToggleGroupConnectProps,
  readItems: () => readonly ToggleGroupItem[],
  id: string,
): ToggleGroupApi {
  // Live accessor, never a snapshot: the fork replaces the context object
  // on every assign, so a destructured copy would freeze the first read.
  const ctx = (): ToggleGroupContext => service.context;
  const send = service.send;
  const rootId = `toggle-group:${id}`;
  const itemId = (value: string): string => `toggle-group:${id}:item:${value}`;

  const rootBag = memo();
  const itemBags = new WeakMap<{ value: string }, BagMemo>();

  /** Stable item-array identity: the recipe's `for` re-stamps rows when
   * the source identity moves (the slider's focus-loss lesson). */
  const items = (() => {
    let source: readonly ToggleGroupItem[] = [];
    let cached: readonly ToggleGroupItem[] = [];
    return () => {
      const next = readItems();
      if (next !== source) {
        source = next;
        cached = [...next];
      }
      return cached;
    };
  })();

  const order = (): readonly ToggleGroupItem[] =>
    items().filter((item) => !(item.disabled === true || ctx().disabled));

  /** Neighbor resolution against the enabled order, with loop wrap. */
  const neighbor = (value: string, direction: 1 | -1): string | null => {
    const enabled = order();
    const at = enabled.findIndex((item) => item.value === value);
    if (at < 0 || enabled.length === 0) return null;
    const next = at + direction;
    if (next < 0 || next >= enabled.length) {
      if (!ctx().loopFocus) return null;
      return enabled[(next + enabled.length) % enabled.length]?.value ?? null;
    }
    return enabled[next]?.value ?? null;
  };

  /** The view reflex: after a roving move the newly focused item takes DOM
   * focus. */
  const focusItem = (value: string): void => {
    if (typeof document === "undefined") return;
    document.getElementById(itemId(value))?.focus({ preventScroll: true });
  };

  return {
    get value() {
      return ctx().value;
    },
    get multiple() {
      return ctx().multiple;
    },
    setValue: (value: readonly string[]) => {
      send({ type: "VALUE.SET", value: [...value] });
    },
    isPressed: (value: string) => isPressed(ctx(), value),
    getItemState: (slot: ToggleGroupItemSlotProps) => ({
      pressed: isPressed(ctx(), slot.value),
      focused: ctx().focusedId === itemId(slot.value),
      disabled: ctx().disabled,
    }),
    getItems: () => items(),
    getRootProps: () => {
      const props = readProps();
      return rootBag(
        [props.orientation, props.dir, props.disabled, ctx().focusedId].join("|"),
        () => ({
          id: rootId,
          dir: props.dir,
          role: props.multiple ? "group" : "radiogroup",
          "aria-label": props.label.length > 0 ? props.label : undefined,
          tabindex: ctx().tabbingBackward ? "-1" : "0",
          "data-scope": "toggle-group",
          "data-part": "root",
          "data-disabled": dataAttr(props.disabled),
          "data-orientation": props.orientation,
          "data-focus": dataAttr(ctx().focusedId !== null),
          style: { outline: "none" },
          onMousedown: () => {
            if (!isInteractive(ctx())) return;
            send({ type: "ROOT.MOUSE_DOWN" });
          },
          onFocus: (event: FocusEvent) => {
            if (!isInteractive(ctx())) return;
            if (event.currentTarget !== event.target) return;
            if (ctx().clickFocus) return;
            if (ctx().tabbingBackward) return;
            send({ type: "ROOT.FOCUS" });
            // Steal to the first enabled item, as Zag's focusFirstToggle.
            const first = order()[0]?.value;
            if (first !== undefined) focusItem(first);
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
            if (!isInteractive(ctx())) return;
            send({ type: "ROOT.BLUR" });
          },
        }),
      );
    },
    getItemProps: (slot: ToggleGroupItemSlotProps) => {
      const props = readProps();
      const pressed = isPressed(ctx(), slot.value);
      const focused = ctx().focusedId === itemId(slot.value);
      const item = items().find((candidate) => candidate.value === slot.value);
      const itemDisabled = item?.disabled === true || props.disabled;
      const horizontal = props.orientation === "horizontal";
      return keyed(
        itemBags,
        slot,
        [pressed, focused, itemDisabled, props.orientation, props.dir, service.state].join("|"),
        () => ({
          id: itemId(slot.value),
          type: "button",
          dir: props.dir,
          "data-ownedby": rootId,
          "data-scope": "toggle-group",
          "data-part": "item",
          "data-focus": dataAttr(focused),
          disabled: itemDisabled ? true : undefined,
          tabindex: props.rovingFocus ? (focused ? "0" : "-1") : undefined,
          role: props.multiple ? undefined : "radio",
          "aria-checked": props.multiple ? undefined : pressed ? "true" : "false",
          "aria-pressed": props.multiple ? (pressed ? "true" : "false") : undefined,
          "data-disabled": dataAttr(itemDisabled),
          "data-orientation": props.orientation,
          "data-state": pressed ? "on" : "off",
          onFocus: () => {
            if (itemDisabled) return;
            send({ type: "TOGGLE.FOCUS", id: itemId(slot.value) });
          },
          onClick: (event: MouseEvent) => {
            if (itemDisabled) return;
            if (event.defaultPrevented) return;
            send({ type: "TOGGLE.CLICK", id: itemId(slot.value), value: slot.value });
          },
          onKeydown: (event: KeyboardEvent) => {
            if (event.defaultPrevented) return;
            if (itemDisabled) return;
            if (isComposing(event)) return;
            const firstId = (): string => itemId(order()[0]?.value ?? "");
            switch (event.key) {
              case "Tab":
                send({
                  type: "TOGGLE.SHIFT_TAB",
                  isShiftTab: event.shiftKey,
                  firstId: firstId(),
                });
                break;
              case "ArrowLeft":
                if (props.rovingFocus && horizontal) {
                  const next = neighbor(slot.value, -1);
                  if (next !== null) {
                    event.preventDefault();
                    send({ type: "TOGGLE.FOCUS_PREV", id: itemId(next) });
                    focusItem(next);
                  }
                }
                break;
              case "ArrowRight":
                if (props.rovingFocus && horizontal) {
                  const next = neighbor(slot.value, 1);
                  if (next !== null) {
                    event.preventDefault();
                    send({ type: "TOGGLE.FOCUS_NEXT", id: itemId(next) });
                    focusItem(next);
                  }
                }
                break;
              case "ArrowUp":
                if (props.rovingFocus && !horizontal) {
                  const next = neighbor(slot.value, -1);
                  if (next !== null) {
                    event.preventDefault();
                    send({ type: "TOGGLE.FOCUS_PREV", id: itemId(next) });
                    focusItem(next);
                  }
                }
                break;
              case "ArrowDown":
                if (props.rovingFocus && !horizontal) {
                  const next = neighbor(slot.value, 1);
                  if (next !== null) {
                    event.preventDefault();
                    send({ type: "TOGGLE.FOCUS_NEXT", id: itemId(next) });
                    focusItem(next);
                  }
                }
                break;
              case "Home": {
                const first = order()[0]?.value;
                if (props.rovingFocus && first !== undefined) {
                  event.preventDefault();
                  send({ type: "TOGGLE.FOCUS_FIRST", id: itemId(first) });
                  focusItem(first);
                }
                break;
              }
              case "End": {
                const enabled = order();
                const last = enabled[enabled.length - 1]?.value;
                if (props.rovingFocus && last !== undefined) {
                  event.preventDefault();
                  send({ type: "TOGGLE.FOCUS_LAST", id: itemId(last) });
                  focusItem(last);
                }
                break;
              }
              default:
                break;
            }
          },
        }),
      );
    },
  };
}

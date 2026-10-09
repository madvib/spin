import type { AccordionRobotContext, AccordionRobotService } from "./accordion.robot-machine.ts";

/**
 * The robot3 accordion's `connect`: same API shape as Zag's, plain data.
 *
 * Zag's connect takes `(service, normalize)` and reads through
 * `context.get`/`prop`/`computed`/`scope`. This one takes the robot service,
 * a props snapshot, and the element root — and returns the same six getters
 * the markup spreads. The bridge re-runs it per signal read (see
 * `accordion.robot-def.ts`), so `value`/`focusedValue` below are always the
 * latest transition's context, never a pinned snapshot.
 *
 * The DOM contract is semantics and function only: ids and aria wiring, and
 * `data-controls`/`data-ownedby`, which the focus queries read. No
 * `data-part`/`data-scope`: styling flows through utility classes and
 * `data-state` variants, so the anatomy attributes zag's connect emits have
 * no consumer here — part identity lives in the machine-def contract and the
 * studio introspects that, not the DOM.
 */

export interface RobotItemProps {
  readonly value: string;
  readonly disabled?: boolean | undefined;
}

export interface RobotItemState {
  readonly expanded: boolean;
  readonly focused: boolean;
  readonly disabled: boolean;
}

export interface RobotAccordionApi {
  readonly focusedValue: string | null;
  readonly value: string[];
  setValue(value: string[]): void;
  getItemState(props: RobotItemProps): RobotItemState;
  getRootProps(): Record<string, unknown>;
  getItemProps(props: RobotItemProps): Record<string, unknown>;
  getItemContentProps(props: RobotItemProps): Record<string, unknown>;
  getItemIndicatorProps(props: RobotItemProps): Record<string, unknown>;
  getItemTriggerProps(props: RobotItemProps): Record<string, unknown>;
}

export interface RobotConnectProps {
  readonly collapsible: boolean;
  readonly disabled: boolean;
  readonly orientation: "horizontal" | "vertical";
}

/**
 * Zag's `normalize.element` without Zag: React-shaped handler names become
 * lowercase DOM event names (`onFocus` → `focusin`, since `focus` doesn't
 * bubble), `undefined` values drop, everything else lowercases. The one
 * function `createNormalizer`'s Proxy dispatches to — ten lines, zero
 * packages. `bindSpread` slices `on*` into listener types, so `onFocusin`
 * attaches as a `focusin` listener exactly as the Zag path does.
 */
function normalize(bag: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(bag)) {
    if (value === undefined) continue;
    const mapped = key === "onFocus" ? "onFocusin" : key === "onBlur" ? "onFocusout" : key;
    out[mapped.toLowerCase()] = value;
  }
  return out;
}

export function connectRobotAccordion(
  service: AccordionRobotService,
  props: RobotConnectProps,
  root: Element,
  id: string,
): RobotAccordionApi {
  const ctx = service.context as AccordionRobotContext;
  const ownerId = `accordion:${id}`;
  const triggerPrefix = `${ownerId}:trigger:`;

  const getItemState = (item: RobotItemProps): RobotItemState => ({
    expanded: ctx.value.includes(item.value),
    focused: ctx.focusedValue === item.value,
    disabled: Boolean(item.disabled ?? props.disabled),
  });

  const siblingTriggers = (): HTMLElement[] => [
    ...root.querySelectorAll<HTMLElement>(`[data-controls][data-ownedby="${ownerId}"]:not([disabled])`),
  ];

  const valueOf = (el: HTMLElement): string =>
    el.id.startsWith(triggerPrefix) ? el.id.slice(triggerPrefix.length) : "";

  /** Move real focus, then tell the machine so `focusedValue` follows. */
  const moveFocus = (value: string, delta: 1 | -1): void => {
    const triggers = siblingTriggers();
    if (triggers.length === 0) return;
    const ids = triggers.map((el) => el.id);
    const at = ids.indexOf(`${triggerPrefix}${value}`);
    const next = triggers[(at + delta + triggers.length) % triggers.length]!;
    next.focus();
    service.send({ type: "FOCUS.SET", value: valueOf(next) });
  };

  const focusEdge = (at: 0 | -1): void => {
    const triggers = siblingTriggers();
    if (triggers.length === 0) return;
    const el = at === 0 ? triggers[0]! : triggers[triggers.length - 1]!;
    el.focus();
    service.send({ type: "FOCUS.SET", value: valueOf(el) });
  };

  return {
    focusedValue: ctx.focusedValue,
    value: ctx.value,
    setValue: (value: string[]) => {
      service.send({ type: "VALUE.SET", value });
    },
    getItemState,
    getRootProps: () =>
      normalize({
        dir: "ltr",
        id: ownerId,
        "data-orientation": props.orientation,
      }),
    getItemProps: (item) => {
      const itemState = getItemState(item);
      return normalize({
        dir: "ltr",
        id: `${ownerId}:item:${item.value}`,
        "data-state": itemState.expanded ? "open" : "closed",
        "data-focus": itemState.focused ? "" : undefined,
        "data-disabled": itemState.disabled ? "" : undefined,
        "data-orientation": props.orientation,
      });
    },
    getItemContentProps: (item) => {
      const itemState = getItemState(item);
      return normalize({
        dir: "ltr",
        role: "region",
        id: `${ownerId}:content:${item.value}`,
        "aria-labelledby": `${triggerPrefix}${item.value}`,
        hidden: !itemState.expanded,
        "data-state": itemState.expanded ? "open" : "closed",
        "data-disabled": itemState.disabled ? "" : undefined,
        "data-focus": itemState.focused ? "" : undefined,
        "data-orientation": props.orientation,
      });
    },
    getItemIndicatorProps: (item) => {
      const itemState = getItemState(item);
      return normalize({
        dir: "ltr",
        "aria-hidden": true,
        "data-state": itemState.expanded ? "open" : "closed",
        "data-disabled": itemState.disabled ? "" : undefined,
        "data-focus": itemState.focused ? "" : undefined,
        "data-orientation": props.orientation,
      });
    },
    getItemTriggerProps: (item) => {
      const itemState = getItemState(item);
      return normalize({
        type: "button",
        dir: "ltr",
        id: `${triggerPrefix}${item.value}`,
        "aria-controls": `${ownerId}:content:${item.value}`,
        "data-controls": `${ownerId}:content:${item.value}`,
        "aria-expanded": itemState.expanded,
        disabled: itemState.disabled,
        "data-orientation": props.orientation,
        "data-state": itemState.expanded ? "open" : "closed",
        "data-focus": itemState.focused ? "" : undefined,
        "data-ownedby": ownerId,
        onFocus: () => {
          if (itemState.disabled) return;
          service.send({ type: "TRIGGER.FOCUS", value: item.value });
        },
        onBlur: () => {
          if (itemState.disabled) return;
          service.send({ type: "TRIGGER.BLUR" });
        },
        onClick: () => {
          if (itemState.disabled) return;
          service.send({ type: "TRIGGER.CLICK", value: item.value });
        },
        onKeyDown: (event: KeyboardEvent) => {
          if (event.defaultPrevented) return;
          if (itemState.disabled) return;
          const horizontal = props.orientation === "horizontal";
          switch (event.key) {
            case "ArrowDown":
              if (!horizontal) {
                moveFocus(item.value, 1);
                event.preventDefault();
              }
              break;
            case "ArrowUp":
              if (!horizontal) {
                moveFocus(item.value, -1);
                event.preventDefault();
              }
              break;
            case "ArrowRight":
              if (horizontal) {
                moveFocus(item.value, 1);
                event.preventDefault();
              }
              break;
            case "ArrowLeft":
              if (horizontal) {
                moveFocus(item.value, -1);
                event.preventDefault();
              }
              break;
            case "Home":
              focusEdge(0);
              event.preventDefault();
              break;
            case "End":
              focusEdge(-1);
              event.preventDefault();
              break;
          }
        },
      });
    },
  };
}

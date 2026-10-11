/**
 * Toast connect: the DOM contract, the region's posture, and the geometry.
 *
 * Zag splits this across a group connect and a per-toast connect whose every
 * computed value (`zIndex`, `height`, `frontmost`) reaches back through a
 * `parent` prop into the group's context. Here the queue is one context, so
 * the whole contract is one api: `getGroupProps` for the region,
 * `getToastProps` and the title/description/action/close parts for a row, and
 * `getToasts` as the render source.
 *
 * Three things live here and nowhere else:
 *
 *  1. **Placement.** Zag writes `position: fixed` and four inset declarations
 *     as a style object. Inset is concrete geometry, so it becomes a utility
 *     choice instead: the region carries `data-side`/`data-align` presence
 *     attributes and the recipe's static classes key on them, exactly as the
 *     listbox's column count does.
 *  2. **The stack.** Each row's offset is the measured heights of the rows in
 *     front of it plus the gaps, expressed as CSS custom properties the
 *     recipe's arbitrary-property utilities consume. Overlap mode lifts by
 *     the gap alone and scales the rows behind the front one down.
 *  3. **The clocks.** `use:toast-timer` owns the dismissal clock (with its
 *     pause/remainder report), the remove delay, and the frame after the row
 *     attaches that starts the entry motion; `use:toast-row` owns the measured
 *     height; `use:toast-region` owns the document reflexes. Neither the
 *     machine nor this file keeps a timer.
 */

import type { ToastContext, ToastEntry } from "./toast.machine.ts";
import { machineTick } from "@spin/runtime";
import type { ToastTimerParam, ToastRegionParam } from "./actions/toast-actions.ts";

/** One queue entry as the host authors it. */
export interface ToastItem {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly type: string;
  /** An unset duration (0 or less) is the type's own. */
  readonly duration: number;
  /** An unset priority (0 or less) is the type's own. */
  readonly priority: number;
  /** The action trigger's label; empty is no action trigger. */
  readonly action: string;
}

export interface ToastConnectProps {
  readonly placement: string;
  readonly overlap: boolean;
  readonly max: number;
  readonly removeDelay: number;
  readonly gap: number;
  readonly offsets: string;
  readonly hotkey: string;
  readonly pauseOnPageIdle: boolean;
  readonly label: string;
  readonly closable: boolean;
}

/** The element's imperative surface — every one is a send. */
export interface ToastCommands {
  create(item: ToastItem): void;
  update(id: string, item: Partial<ToastItem>): void;
  dismiss(id: string, src?: string): void;
  remove(id: string): void;
  dismissAll(): void;
  pause(id: string): void;
  resume(id: string): void;
}

export interface ToastApi extends ToastCommands {
  readonly count: number;
  readonly layout: "stack" | "overlap";
  readonly placement: string;
  readonly overlapping: boolean;
  readonly paused: boolean;
  getToasts(): readonly ToastEntry[];
  getGroupProps(): Record<string, unknown>;
  getToastProps(entry: ToastEntry): Record<string, unknown>;
  getTitleProps(entry: ToastEntry): Record<string, unknown>;
  getDescriptionProps(entry: ToastEntry): Record<string, unknown>;
  getActionTriggerProps(entry: ToastEntry): Record<string, unknown>;
  getCloseTriggerProps(entry: ToastEntry): Record<string, unknown>;
}

type Send = (event: { type: string } & Record<string, unknown>) => void;

/** The part-id namespace. */
const NAMESPACE = "toast";

export interface ToastService {
  readonly context: ToastContext;
  /** The machine's own state — `stack` or `overlap`, not the authored prop. */
  readonly state: string;
  send(event: { type: string } & Record<string, unknown>): void;
}

/** The behavioural props, read on demand: the connect lives as long as the
 * element does, so a snapshot would freeze the first read's values inside
 * the handlers it caches. */
export type ReadToastProps = () => ToastConnectProps;

/** A bag cached until the signature of the fields it reads moves. */
interface BagMemo {
  sig: string;
  bag: Record<string, unknown>;
}

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

/** `cached` per owner: rows are stable objects, so the memo dies with the
 * toast it came from. */
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

/** Zag's `dataAttr`: the attribute is present when the condition holds and
 * absent otherwise. */
function dataAttr(value: boolean): string | undefined {
  return value ? "" : undefined;
}

/** `top`/`bottom` plus the alignment the placement's suffix carries. */
function posture(placement: string): { side: "top" | "bottom"; align: "start" | "center" | "end" } {
  const [side, align] = placement.split("-");
  return {
    side: side === "top" ? "top" : "bottom",
    align: align === "start" || align === "end" ? align : "center",
  };
}

export function connectRobotToast(
  service: ToastService,
  readProps: ReadToastProps,
  id: string,
  root: () => Element,
): ToastApi {
  const ownerId = id.startsWith(`${NAMESPACE}:`) ? id : `${NAMESPACE}:${id}`;
  const groupId = `${ownerId}:group`;
  const toastId = (toastId: string): string => `${ownerId}:toast:${toastId}`;
  const titleId = (toastId: string): string => `${ownerId}:toast:${toastId}:title`;
  const descriptionId = (toastId: string): string => `${ownerId}:toast:${toastId}:description`;
  const actionId = (toastId: string): string => `${ownerId}:toast:${toastId}:action`;
  const closeId = (toastId: string): string => `${ownerId}:toast:${toastId}:close`;
  const ctx = (): ToastContext => service.context;
  /** Whether the region is collapsed: the machine's state, so a gesture and
   *  the authored prop both land here. */
  const overlapped = (): boolean => service.state === "overlap";
  /** Every event the view sends, funnelled through the bridge's wrapper —
   * the wrapper is what reports the status callback. */
  const send: Send = (event): void => {
    service.send(event);
  };

  // ---- posture and geometry ----------------------------------------------

  const at = (entry: ToastEntry): number => {
    const index = ctx().toasts.findIndex((candidate) => candidate.id === entry.id);
    return index === -1 ? ctx().toasts.length : index;
  };

  /** The entry as the machine holds it now: assigns replace entries rather
   * than mutating them, so a row closure's captured entry goes stale on the
   * first status move. Dynamic reads resolve live by id; static fields
   * (title, description, action, type) never change after creation. */
  const live = (entry: ToastEntry): ToastEntry =>
    ctx().toasts.find((candidate) => candidate.id === entry.id) ?? entry;

  /** Zag's `heightBefore` plus the gaps: how far behind the front a row sits. */
  const stackOffset = (index: number): number => {
    const props = readProps();
    const list = ctx().toasts;
    let before = index * props.gap;
    for (let position = 0; position < index; position += 1) before += list[position]?.height ?? 0;
    return before;
  };

  /**
   * How far behind the front a row sits, as the transform the recipe reads.
   * A settled row is at its offset: the arrival and the exit are the fade
   * and the scale, exactly the overlay motion the recipe asks for, so a row
   * is never parked outside the viewport waiting for its entry beat.
   */
  const offsetY = (index: number): string => {
    const props = readProps();
    const { side } = posture(props.placement);
    const distance = overlapped() ? index * props.gap : stackOffset(index);
    // A settled front row is at the origin, not at negative zero.
    return `${side === "top" ? distance : -distance || 0}px`;
  };

  /** A row that has not settled into place is slightly small and clear. A
   * paused row holds its clocks but stays put: only the exit clears it. */
  const settled = (entry: ToastEntry): boolean => entry.status !== "dismissing" && entry.mounted;

  const opacityOf = (entry: ToastEntry): string => (settled(entry) ? "1" : "0");

  const scaleOf = (entry: ToastEntry, index: number): string => {
    if (!settled(entry)) return "0.96";
    if (!overlapped() || index === 0) return "1";
    return String(Math.max(0.6, 1 - index * 0.05));
  };

  // ---- region handlers ---------------------------------------------------

  /**
   * Zag's `setLastFocusedEl` / `restoreFocusIfPointerOut`: the element focus
   * came from is remembered, and given back when the region is left by both
   * the pointer and the keyboard. The check that the pointer is out is the
   * machine's, so the restore is the view's half of the same gesture.
   */
  let lastFocused: Element | undefined;

  const onGroupFocus = (event: FocusEvent): void => {
    const related = event.relatedTarget;
    if (related !== null && related instanceof Element && root().contains(related)) return;
    lastFocused = related instanceof Element ? related : undefined;
    send({ type: "REGION.FOCUS" });
  };

  const onGroupBlur = (event: FocusEvent): void => {
    const related = event.relatedTarget;
    const inside = related !== null && related instanceof Element && root().contains(related);
    if (!inside) send({ type: "REGION.BLUR" });
    if (!ctx().pointerWithin && lastFocused instanceof HTMLElement) {
      lastFocused.focus({ preventScroll: true });
      lastFocused = undefined;
    }
  };

  const onGroupPointerEnter = (): void => send({ type: "REGION.POINTER_ENTER" });

  const onGroupPointerLeave = (): void => {
    send({ type: "REGION.POINTER_LEAVE" });
    // Zag's `clearPointerWithin` restores the focus the region borrowed.
    if (!ctx().focusWithin && lastFocused instanceof HTMLElement) {
      lastFocused.focus({ preventScroll: true });
      lastFocused = undefined;
    }
  };

  // ---- cached bags -------------------------------------------------------

  const groupBag = cached();
  const toastBags = new WeakMap<ToastEntry, BagMemo>();
  const titleBags = new WeakMap<ToastEntry, BagMemo>();
  const descriptionBags = new WeakMap<ToastEntry, BagMemo>();
  const actionBags = new WeakMap<ToastEntry, BagMemo>();
  const closeBags = new WeakMap<ToastEntry, BagMemo>();

  return {
    get count(): number {
      return ctx().toasts.length;
    },
    get placement(): string {
      return readProps().placement;
    },
    /** The region's stacking mode, as the machine holds it. */
    get layout(): "stack" | "overlap" {
      return overlapped() ? "overlap" : "stack";
    },
    get overlapping(): boolean {
      return overlapped();
    },
    /** The region is paused while the pointer, a focus, or a hidden page
     * holds it — every toast's clock is held with it. */
    get paused(): boolean {
      const context = ctx();
      return context.pointerWithin || context.focusWithin || context.pageIdle;
    },
    create: (item) =>
      send({
        type: "TOAST.CREATE",
        id: item.id,
        title: item.title,
        description: item.description,
        toastType: item.type,
        duration: item.duration,
        priority: item.priority,
        action: item.action,
      }),
    /** A partial item merges over the entry the queue already holds. */
    update: (id, item) => {
      const current = ctx().toasts.find((entry) => entry.id === id) ?? ctx().queued.find((entry) => entry.id === id);
      if (current === undefined) return;
      send({
        type: "TOAST.UPDATE",
        id,
        title: item.title ?? current.title,
        description: item.description ?? current.description,
        toastType: item.type ?? current.type,
        duration: item.duration ?? 0,
        priority: item.priority ?? 0,
        action: item.action ?? current.action,
      });
    },
    dismiss: (id, src = "programmatic") => send({ type: "TOAST.DISMISS", id, src }),
    remove: (id) => send({ type: "TOAST.REMOVE", id }),
    dismissAll: () => {
      for (const entry of ctx().toasts) send({ type: "TOAST.DISMISS", id: entry.id, src: "programmatic" });
    },
    pause: (id) =>
      send({
        type: "TOAST.PAUSE",
        id,
        remaining: ctx().toasts.find((entry) => entry.id === id)?.remaining ?? 0,
      }),
    resume: (id) => send({ type: "TOAST.RESUME", id }),
    getToasts: (): readonly ToastEntry[] => {
      // The `for` effect re-runs only on signals its source reads: the
      // tick is the subscription that re-reads the queue after a move.
      machineTick();
      return [...ctx().toasts];
    },
    getGroupProps: () => {
      const props = readProps();
      const { side, align } = posture(props.placement);
      const count = ctx().toasts.length;
      return groupBag(
        [
          props.placement,
          side,
          align,
          props.gap,
          props.offsets,
          props.label,
          count,
          overlapped(),
          service.state,
        ].join("\u0000"),
        () => ({
          id: groupId,
          role: "region",
          tabindex: -1,
          "aria-label": props.hotkey.length > 0
            ? `${props.label}, ${props.placement} (${props.hotkey})`
            : `${props.label}, ${props.placement}`,
          "aria-live": "polite",
          "aria-relevant": "additions text",
          "aria-atomic": "false",
          "data-placement": props.placement,
          "data-side": side,
          "data-align": align,
          "data-count": String(count),
          "data-empty": dataAttr(count === 0),
          "data-overlap": dataAttr(overlapped()),
          "data-stack": dataAttr(!overlapped()),
          // Geometry: the region's own inset and gaps are data; where they
          // land is the recipe's decision.
          style: {
            "--toast-gap": `${props.gap}px`,
            "--toast-offset": props.offsets,
          },
          "use:toast-region": {
            hotkey: props.hotkey.split(",").map((key) => key.trim()).filter((key) => key.length > 0),
            pauseOnPageIdle: props.pauseOnPageIdle,
            onIdleChange: (idle: boolean) => send({ type: idle ? "PAGE.IDLE" : "PAGE.ACTIVE" }),
          } satisfies ToastRegionParam,
          onMouseEnter: onGroupPointerEnter,
          onMouseMove: onGroupPointerEnter,
          onMouseLeave: onGroupPointerLeave,
          onFocus: onGroupFocus,
          onBlur: onGroupBlur,
        }),
      );
    },
    getToastProps: (entry) => {
      const props = readProps();
      const { side, align } = posture(props.placement);
      const index = at(entry);
      const frontmost = index === 0;
      const current = live(entry);
      const visible = current.status !== "dismissing";
      const paused = current.status === "persist";
      return keyed(
        toastBags,
        entry,
        [
          current.status,
          current.mounted,
          current.remaining,
          current.height,
          ctx().overlap,
          overlapped(),
          ctx().pointerWithin,
          ctx().focusWithin,
          index,
          ctx().toasts.length,
          side,
          align,
          props.removeDelay,
        ].join("\u0000"),
        () => ({
          id: toastId(entry.id),
          role: "status",
          tabindex: 0,
          "aria-atomic": "true",
          "aria-labelledby": titleId(entry.id),
          "aria-describedby": entry.description.length > 0 ? descriptionId(entry.id) : undefined,
          "data-state": visible ? "open" : "closed",
          "data-type": entry.type,
          "data-placement": props.placement,
          "data-side": side,
          "data-align": align,
          "data-mounted": dataAttr(current.mounted),
          "data-paused": dataAttr(paused),
          "data-first": dataAttr(frontmost),
          "data-sibling": dataAttr(!frontmost),
          "data-stack": dataAttr(!overlapped()),
          "data-overlap": dataAttr(overlapped()),
          style: {
            "--toast-y": offsetY(index),
            "--toast-opacity": opacityOf(current),
            "--toast-scale": scaleOf(current, index),
            "--toast-z": String(ctx().toasts.length - index),
          },
          onKeydown: (event: KeyboardEvent) => {
            if (event.defaultPrevented) return;
            if (event.key === "Escape") {
              event.preventDefault();
              send({ type: "TOAST.DISMISS", id: entry.id, src: "keyboard" });
            }
          },
          "use:toast-timer": {
            remaining: current.remaining,
            paused,
            dismissing: current.status === "dismissing",
            removeDelay: props.removeDelay,
            onTimeout: () => send({ type: "TIMER.ELAPSED", id: entry.id }),
            onRemove: () => send({ type: "TIMER.REMOVED", id: entry.id }),
            onPause: (remaining: number) => send({ type: "TOAST.PAUSE", id: entry.id, remaining }),
            onReady: () => send({ type: "TOAST.MOUNTED", id: entry.id }),
          } satisfies ToastTimerParam,
          "use:toast-row": {
            onHeight: (height: number) => send({ type: "HEIGHT.SET", id: entry.id, height }),
          },
        }),
      );
    },
    getTitleProps: (entry) =>
      keyed(titleBags, entry, `${entry.title}\u0000${entry.type}`, () => ({
        id: titleId(entry.id),
        "data-type": entry.type,
      })),
    getDescriptionProps: (entry) =>
      keyed(descriptionBags, entry, `${entry.description}`, () => ({
        id: descriptionId(entry.id),
      })),
    getActionTriggerProps: (entry) =>
      keyed(actionBags, entry, `${entry.action}`, () => ({
        id: actionId(entry.id),
        type: "button",
        "aria-label": entry.action,
        hidden: entry.action.length === 0,
        onClick: (event: MouseEvent) => {
          if (event.defaultPrevented) return;
          // Zag calls the host's action and then dismisses. An action is data
          // here, so the click is reported as an event the host answers and
          // the dismissal follows either way.
          root().dispatchEvent(new CustomEvent("toast-action", { bubbles: true, detail: { id: entry.id } }));
          send({ type: "TOAST.DISMISS", id: entry.id, src: "user" });
        },
      })),
    getCloseTriggerProps: (entry) =>
      keyed(closeBags, entry, `${entry.id}\u0000${readProps().closable}`, () => ({
        id: closeId(entry.id),
        type: "button",
        "aria-label": "Dismiss notification",
        hidden: !readProps().closable,
        onClick: (event: MouseEvent) => {
          if (event.defaultPrevented) return;
          send({ type: "TOAST.DISMISS", id: entry.id, src: "user" });
        },
      })),
  };
}

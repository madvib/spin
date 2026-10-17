import { signal, type ControllerDef } from "@spin/runtime";
import type { AnchorGeometry } from "@spin/runtime/actions";

/**
 * Hover-card on the platform: the browser owns open/closed, the top layer,
 * light-dismiss, and Escape. There is no machine here — `attach` wires the
 * native popover behavior to the declared commands and events, and the
 * panel is a card surface from utilities.
 *
 * The delays Zag holds as opening/closing states are one `hover-delay`
 * action on the root bag: the trigger and the panel are both inside the
 * root, so moving between them never leaves it, and a single clock pair
 * owns the open/absence handoff with no cross-instance race. Focus opens
 * at once and blur closes — keyboard users never wait out a hover clock.
 * Touch never opens: a card that opens on tap steals the tap the trigger
 * wanted.
 *
 * Delays and disabled are attach-time attribute reads (`open-delay`,
 * `close-delay`, `disabled`): the declarative case works, and post-build
 * writes do not reconfigure — the same staleness class as the popover's
 * frozen data-state.
 *
 * The panel positions against the trigger through the `anchor` action,
 * which reports geometry the bag carries as custom properties. Placement
 * is a suggestion the viewport can veto; the flip reports alongside the
 * geometry so the origin utility can follow.
 */

export interface HoverCardOpenChange {
  readonly open: boolean;
}

/** Authorship surface for recipe-check's reader rule (controllers do
 * not run defineComponent, so there is no synthesized manifest). */
export const hoverCardManifest = {
  parts: [],
  slots: [],
  readers: ["open"],
  methods: ["show", "hide", "getRootProps", "getTriggerProps", "getContentProps"],
  channels: [],
} as const;

export interface HoverCardApi {
  readonly open: boolean;
  show(): void;
  hide(): void;
  getRootProps(): Record<string, unknown>;
  getTriggerProps(): Record<string, unknown>;
  getContentProps(): Record<string, unknown>;
}

function panelOf(el: Element): HTMLElement | null {
  return el.querySelector("[popover]") as HTMLElement | null;
}

function intAttr(el: Element, name: string, fallback: number): number {
  const raw = el.getAttribute(name);
  if (raw === null) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

export function attachHoverCard(el: Element): HoverCardApi {
  const readOpen = (): boolean => panelOf(el)?.matches(":popover-open") ?? false;
  const disabled = el.hasAttribute("disabled");
  const openDelay = intAttr(el, "open-delay", 600);
  const closeDelay = intAttr(el, "close-delay", 300);

  const emit = (open: boolean): void => {
    el.dispatchEvent(new CustomEvent("open-change", { detail: { open }, bubbles: true }));
  };

  // The `toggle` event does not bubble, but a capture listener on the
  // element still sees it on the way down — the popover proof's shape.
  el.addEventListener("toggle", (event) => {
    emit((event as ToggleEvent).newState === "open");
  }, true);

  const show = (): void => {
    if (disabled) return;
    const panel = panelOf(el);
    if (panel === null || panel.matches(":popover-open")) return;
    panel.showPopover();
  };
  const hide = (): void => {
    const panel = panelOf(el);
    if (panel === null || !panel.matches(":popover-open")) return;
    panel.hidePopover();
  };

  const geometry = signal<AnchorGeometry>({ x: 0, y: 0, w: 0, h: 0, placement: "bottom" });

  const triggerId = `${el.id || "hover-card"}:trigger`;
  const panelId = `${el.id || "hover-card"}:panel`;

  return {
    get open(): boolean {
      return readOpen();
    },
    show,
    hide,
    getRootProps: () => ({
      "data-state": readOpen() ? "open" : "closed",
      ...(disabled
        ? {}
        : {
          "use:hover-delay": {
            openDelay,
            closeDelay,
            onOpen: show,
            onClose: hide,
          },
        }),
    }),
    getTriggerProps: () => ({
      id: triggerId,
      "aria-expanded": readOpen(),
      "data-state": readOpen() ? "open" : "closed",
      ...(disabled ? { disabled: true } : {}),
      onFocus: show,
      onBlur: hide,
    }),
    getContentProps: () => ({
      id: panelId,
      popover: "",
      "data-state": readOpen() ? "open" : "closed",
      "data-placement": geometry().placement,
      style: {
        "--anchor-x": `${geometry().x}px`,
        "--anchor-y": `${geometry().y}px`,
        "--anchor-w": `${geometry().w}px`,
      },
      "use:anchor": {
        onGeometry: (next: AnchorGeometry) => geometry(next),
      },
    }),
  };
}

export const hoverCard: ControllerDef = {
  attach: attachHoverCard,
  commands: ["show", "hide"],
  events: {
    "open-change": {
      on: "onOpenChange",
      detail: (change: HoverCardOpenChange) => ({ open: change.open }),
    },
  },
};

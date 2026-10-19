import { signal, type ControllerDef } from "@spin/runtime";
import type { AnchorGeometry, AnchorPlacement } from "@spin/runtime/actions";

/**
 * Tooltip on the platform: the browser owns open/closed, the top layer,
 * light-dismiss, and Escape. There is no machine here — `attach` wires the
 * native popover behavior to the declared commands and events, and the
 * surface comes from the `tooltip` primitive's CSS.
 *
 * The delays Zag holds as opening/closing states are the `hover-delay`
 * action on the trigger bag: dwell opens, absence closes, and the attach
 * maps both reports onto the native methods. Focus opens immediately and
 * blur closes — keyboard users never wait out a hover clock. Touch never
 * opens: a tooltip that opens on tap steals the tap the trigger wanted.
 *
 * The panel positions against the trigger through the `anchor` action,
 * which reports geometry the bag carries as custom properties. Placement
 * is a suggestion the viewport can veto; the flip reports alongside the
 * geometry so the origin utility can follow.
 */

export interface TooltipOpenChange {
  readonly open: boolean;
}

export const tooltipManifest = {
  parts: [],
  slots: [],
  readers: ["open"],
  methods: ["show", "hide", "getTriggerProps", "getContentProps"],
  channels: [],
} as const;

export interface TooltipApi {
  readonly open: boolean;
  show(): void;
  hide(): void;
  getTriggerProps(): Record<string, unknown>;
  getContentProps(): Record<string, unknown>;
  setPlacement(next: AnchorPlacement): void;
}

function panelOf(el: Element): HTMLElement | null {
  return el.querySelector("[popover]") as HTMLElement | null;
}

let instanceCounter = 0;

export function attachTooltip(el: Element): TooltipApi {
  const readOpen = (): boolean => panelOf(el)?.matches(":popover-open") ?? false;

  const emit = (open: boolean): void => {
    el.dispatchEvent(new CustomEvent("open-change", { detail: { open }, bubbles: true }));
  };

  // The `toggle` event does not bubble, but a capture listener on the
  // element still sees it on the way down — the popover proof's shape.
  el.addEventListener("toggle", (event) => {
    emit((event as ToggleEvent).newState === "open");
  }, true);

  const show = (): void => {
    const panel = panelOf(el);
    if (panel === null || panel.matches(":popover-open")) return;
    panel.showPopover();
  };
  const hide = (): void => {
    const panel = panelOf(el);
    if (panel === null || !panel.matches(":popover-open")) return;
    panel.hidePopover();
  };

  let placement: AnchorPlacement = ((): AnchorPlacement => {
    const raw = el.getAttribute("placement");
    return raw === "top" || raw === "bottom" || raw === "left" || raw === "right" ? raw : "bottom";
  })();
  const instance = el.id !== "" ? el.id : `${"tooltip-"}${++instanceCounter}`;
  const triggerId = `${instance}:trigger`;
  const panelId = `${instance}:panel`;
  const geometry = signal<AnchorGeometry>({ x: 0, y: 0, w: 0, h: 0, placement: "bottom" });
  return {
    get open(): boolean {
      return readOpen();
    },
    show,
    hide,
    setPlacement(next: AnchorPlacement): void {
      placement = next;
    },
    getTriggerProps: () => ({
      id: triggerId,
      "data-scope": "tooltip",
      "data-part": "trigger",
      "aria-describedby": panelId,
      "data-state": readOpen() ? "open" : "closed",
      "use:hover-delay": {
        onOpen: show,
        onClose: hide,
      },
      onFocus: show,
      onBlur: hide,
    }),
    getContentProps: () => ({
      id: panelId,
      "data-scope": "tooltip",
      "data-part": "content",
      popover: "",
      role: "tooltip",
      "data-placement": geometry().placement,
      // positioning owned by use:anchor (direct writes)
      "use:anchor": {
        placement,
        onGeometry: (next: AnchorGeometry) => geometry(next),
      },
    }),
  };
}

export const tooltip: ControllerDef = {
  attach: attachTooltip,
  commands: ["show", "hide", "setPlacement"],
  events: {
    "open-change": {
      on: "onOpenChange",
      detail: (change: TooltipOpenChange) => ({ open: change.open }),
    },
  },
};

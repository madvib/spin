import { defineController, type ControllerDef, signal } from "@spinjs/runtime";
import type { AnchorGeometry, AnchorPlacement } from "@spinjs/runtime/actions";

/**
 * Hover-card on the platform: the browser owns open/closed, the top layer,
 * light-dismiss, and Escape. There is no machine here — `attach` wires the
 * native popover behavior to the declared commands and events, and the
 * panel is a card surface from utilities.
 *
 * The delays the upstream holds as opening/closing states are one
 * `hover-delay` action on the root bag: the trigger and the panel are both
 * inside the root, so moving between them never leaves it, and a single clock
 * pair owns the open/absence handoff with no cross-instance race. Focus opens
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
 * which reports geometry the bag carries as style properties. Placement
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
  methods: [
    "show",
    "hide",
    "getRootProps",
    "getTriggerProps",
    "getContentProps",
  ],
} as const;

export interface HoverCardApi {
  readonly open: boolean;
  show(): void;
  hide(): void;
  getRootProps(): Record<string, unknown>;
  getTriggerProps(): Record<string, unknown>;
  getContentProps(): Record<string, unknown>;
  setPlacement(next: "top" | "bottom" | "left" | "right"): void;
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

let instanceCounter = 0;

export function attachHoverCard(el: Element): HoverCardApi {
  const readOpen = (): boolean =>
    panelOf(el)?.matches(":popover-open") ?? false;
  const disabled = el.hasAttribute("disabled");
  const openDelay = intAttr(el, "open-delay", 600);
  const closeDelay = intAttr(el, "close-delay", 300);
  let placement: AnchorPlacement = ((): AnchorPlacement => {
    const raw = el.getAttribute("placement");
    return raw === "top" || raw === "bottom" || raw === "left" ||
        raw === "right"
      ? raw
      : "bottom";
  })();
  const emit = (open: boolean): void => {
    el.dispatchEvent(
      new CustomEvent("open-change", { detail: { open }, bubbles: true }),
    );
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

  const geometry = signal<AnchorGeometry>({
    x: 0,
    y: 0,
    w: 0,
    h: 0,
    placement: "bottom",
  });

  const instance = el.id !== ""
    ? el.id
    : `${"hover-card-"}${++instanceCounter}`;
  const triggerId = `${instance}:trigger`;
  const panelId = `${instance}:panel`;

  return {
    get open(): boolean {
      return readOpen();
    },
    setPlacement(next: "top" | "bottom" | "left" | "right"): void {
      placement = next;
    },
    show,
    hide,
    getRootProps: () => ({
      "data-scope": "hover-card",
      "data-part": "root",
      "data-state": readOpen() ? "open" : "closed",
      ...(disabled ? {} : {
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
      "data-scope": "hover-card",
      "data-part": "trigger",
      "aria-expanded": readOpen(),
      "aria-details": panelId,
      "aria-haspopup": "dialog",
      "data-state": readOpen() ? "open" : "closed",
      ...(disabled ? { disabled: true } : {}),
      onFocus: show,
      onBlur: hide,
    }),
    getContentProps: () => ({
      id: panelId,
      "data-scope": "hover-card",
      "data-part": "content",
      popover: "",
      role: "dialog",
      "data-state": readOpen() ? "open" : "closed",
      get ["data-placement"](): AnchorPlacement {
        return geometry().placement;
      },
      // The measured geometry rides the bag's style object: the anchor
      // action measures, the bag carries the position, and the markup
      // names no property.
      style: {
        left: `${geometry().x}px`,
        top: `${geometry().y}px`,
        minWidth: `${geometry().w}px`,
      },
      // positioning owned by use:anchor (direct writes)
      "use:anchor": {
        placement,
        onGeometry: (next: AnchorGeometry) => geometry(next),
      },
    }),
  };
}

export const hoverCard = defineController({
  attach: attachHoverCard,
  commands: ["show", "hide", "setPlacement"],
  events: {
    "open-change": {
      on: "onOpenChange",
      detail: (change: HoverCardOpenChange) => ({ open: change.open }),
    },
  },
});

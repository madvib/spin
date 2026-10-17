import type { ControllerDef } from "@spin/runtime";

/**
 * Popover on the platform: the browser owns open/closed, the top layer,
 * light-dismiss, and Escape. There is no machine here — the `attach`
 * wires the native popover behavior to the declared commands and events,
 * and the surface, entrance, and backdrop come from the `popover`
 * primitive's CSS.
 *
 * The api is what markup spreads and what the app-controller hook reaches:
 * prop bags for the trigger and the panel, imperative commands that call
 * the native methods, and `open` as a reactive read for hosts that render
 * from state.
 */

export interface PopoverOpenChange {
  readonly open: boolean;
}

export const popoverManifest = {
  parts: [],
  slots: [],
  readers: ["open"],
  methods: ["show", "hide", "toggle", "getTriggerProps", "getContentProps"],
  channels: [],
} as const;

export interface PopoverApi {
  readonly open: boolean;
  show(): void;
  hide(): void;
  toggle(): void;
  getTriggerProps(): Record<string, unknown>;
  getContentProps(): Record<string, unknown>;
}

function panelOf(el: Element): HTMLElement | null {
  return el.querySelector("[popover]") as HTMLElement | null;
}

export function attachPopover(el: Element): PopoverApi {
  const readOpen = (): boolean => panelOf(el)?.matches(":popover-open") ?? false;

  const emit = (open: boolean): void => {
    el.dispatchEvent(new CustomEvent("open-change", { detail: { open }, bubbles: true }));
  };

  // The `toggle` event does not bubble, but a capture listener on the
  // element still sees it on the way down — and unlike a panel lookup,
  // this works no matter when the recipe renders the panel.
  el.addEventListener("toggle", (event) => {
    emit((event as ToggleEvent).newState === "open");
  }, true);

  const triggerId = `${el.id || "popover"}:trigger`;
  const panelId = `${el.id || "popover"}:panel`;

  return {
    get open(): boolean {
      return readOpen();
    },
    show: () => panelOf(el)?.showPopover(),
    hide: () => panelOf(el)?.hidePopover(),
    toggle: () => panelOf(el)?.togglePopover(),
    getTriggerProps: () => ({
      id: triggerId,
      popovertarget: panelId,
      "aria-expanded": readOpen(),
      "data-state": readOpen() ? "open" : "closed",
    }),
    getContentProps: () => ({
      id: panelId,
      popover: "",
      "data-state": readOpen() ? "open" : "closed",
    }),
  };
}

export const popover: ControllerDef = {
  attach: attachPopover,
  commands: ["show", "hide", "toggle"],
  events: {
    "open-change": {
      on: "onOpenChange",
      detail: (change: PopoverOpenChange) => ({ open: change.open }),
    },
  },
};

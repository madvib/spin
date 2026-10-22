/**
 * The edge the host gives the studio.
 *
 * The studio does not know whether it is a window or a drawer: the host says
 * so — in the frame's URL when the frame is made, and over a message when
 * the host switches — and the studio lays itself out for the edge it occupies
 * rather than guessing from its own width. A drawer is narrow because the
 * host made it narrow, and the pages get a different layout there rather
 * than a squeezed one.
 *
 * It lives here rather than in the shell because both the shell and the
 * pages ask: the shell mirrors its rail to the outer edge, and the pages
 * lay their own furniture out for the edge. A signal that both read is a
 * fact about the studio, and a fact about the studio is not the shell's
 * private business.
 */

import { createSignal } from "solid-js";

/** The edges the studio can be shown at. */
export type HostMode = "drawer" | "modal";

/**
 * The frame's own parameters, read once.
 *
 * The URL does not change under the studio — the host switches modes by
 * message, not by navigating — so this is a constant rather than a lookup
 * on every read.
 */
const params = new URLSearchParams(
  typeof location === "undefined" ? "" : location.search,
);

const [hostMode, setHostMode] = createSignal<HostMode>(
  params.get("mode") === "drawer" ? "drawer" : "modal",
);

// The host shell announces mode switches without reloading the frame: the
// layout re-branches in place, which is the whole reason the toggles feel
// instant instead of rebooting the studio.
if (typeof window !== "undefined") {
  globalThis.addEventListener("message", (event) => {
    if (event.data === "spin:mode-drawer") setHostMode("drawer");
    if (event.data === "spin:mode-modal") setHostMode("modal");
  });
}

/** Whether the studio runs in the host's drawer. */
export function inDrawer(): boolean {
  return hostMode() === "drawer";
}

/**
 * Whether the studio is embedded in a host at all.
 *
 * The mode toggle and the close control are the HOST's verbs: they answer
 * "how is the studio shown" and "close the studio", and they mean nothing
 * when the studio is a page of its own.
 */
export function embedded(): boolean {
  return params.get("app") !== null;
}

/**
 * Switch the edge the studio is shown at.
 *
 * The studio tells the host as well as moving itself: the host owns the
 * frame, and the frame's own size is the host's to decide. The studio
 * re-branches in place, so the page it is on does not have to be rebuilt to
 * be laid out for the new edge.
 */
export function toggleHostMode(): void {
  const next = inDrawer() ? "modal" : "drawer";
  setHostMode(next);
  globalThis.parent.postMessage(
    next === "modal" ? "spin:modal" : "spin:drawer",
    "*",
  );
}

/** Ask the host to close the studio. */
export function closeStudio(): void {
  globalThis.parent.postMessage("spin:close", "*");
}

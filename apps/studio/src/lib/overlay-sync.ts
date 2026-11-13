/**
 * Overlay draft sync and launcher corner preference.
 *
 * Keeps external agent `brand_draft` overlay updates synchronized into
 * Studio's live document state without bloating `store.ts`.
 */

import { createSignal } from "solid-js";
import { spinClient, spinClientAt } from "./client.ts";

export type FabCorner = "top-left" | "top-right" | "bottom-left" | "bottom-right";

const FAB_CORNER_KEY = "spin-fab-corner";

function readStoredCorner(): FabCorner {
  try {
    const value = localStorage.getItem(FAB_CORNER_KEY);
    if (
      value === "top-left" ||
      value === "top-right" ||
      value === "bottom-left" ||
      value === "bottom-right"
    ) {
      return value;
    }
  } catch {
    // Private mode keeps default.
  }
  return "bottom-right";
}

const [fabCorner, setFabCornerSignal] = createSignal<FabCorner>(readStoredCorner());

export { fabCorner };

export function setFabCorner(corner: FabCorner): void {
  setFabCornerSignal(corner);
  try {
    localStorage.setItem(FAB_CORNER_KEY, corner);
  } catch {
    // Private mode keeps session preference.
  }
  if (typeof window !== "undefined" && window.parent !== window) {
    window.parent.postMessage(`spin:fab-${corner}`, "*");
  }
}

const lastPushedOverlay: Record<string, string> = {};

export function notePushedOverlay(name: string, doc: unknown): void {
  lastPushedOverlay[name] = JSON.stringify(doc);
}

export async function pullExternalOverlayDrafts(
  getCurrentText: (name: string) => string | undefined,
  applyDraft: (name: string, formatted: string) => void,
): Promise<void> {
  try {
    const base = new URLSearchParams(location.search).get("app");
    const client = base !== null
      ? await spinClientAt(new URL("/__spin/rpc", base).toString())
      : await spinClient();
    const state = await client.overlay.get({});
    if (!state.open) return;
    for (const [name, doc] of Object.entries(state.themes)) {
      const compact = JSON.stringify(doc);
      if (lastPushedOverlay[name] === compact) continue;
      const formatted = JSON.stringify(doc, null, 2);
      if (getCurrentText(name) === formatted) {
        lastPushedOverlay[name] = compact;
        continue;
      }
      applyDraft(name, formatted);
      lastPushedOverlay[name] = compact;
    }
  } catch {
    // Unreachable daemon; next heartbeat retries.
  }
}

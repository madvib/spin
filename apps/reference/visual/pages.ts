/**
 * The reference's page conventions, shipped to the tab by serialising source.
 *
 * Like `auditPage`, every function here has to carry everything it reads: the
 * serialised source is what runs, so a module-scope constant would simply be
 * missing in the browser. The generic probes — the blank check, the settle
 * wait, the hover walk — live in `internal/check`; these three are the
 * reference's own answers to "has it rendered", "what does it say about
 * itself", and "how is a theme stored".
 */

import type { FrameState } from "../../../internal/check/harness.ts";

/** What the rendered page looks like to someone reading it. */
export function pageState(): FrameState {
  const main = document.querySelector("main");
  return {
    heading: main?.querySelector("h2")?.textContent?.trim() ?? null,
    text: (main?.textContent ?? "").replace(/\s+/g, " ").trim(),
    theme: document.documentElement.dataset.theme ?? null,
    mode: document.documentElement.dataset.mode ?? null,
  };
}

/**
 * True once the app has booted on the route it was given.
 *
 * The theme attribute is the app's own signal that it is running: the app
 * writes it as it mounts, so a page without it has not rendered anything yet.
 * Deliberately not a test of how much content arrived, because a route that
 * renders an error is still a route the check has to look at.
 */
export function renderReady(): boolean {
  if (document.querySelector("main") === null) return false;
  return document.documentElement.dataset.theme !== undefined;
}

/** Seeds the theme and mode the way the app itself stores them. */
export function seedTheme(seed: { theme: string; mode: string }): void {
  localStorage.setItem("spin-theme", seed.theme);
  localStorage.setItem("spin-mode", seed.mode);
}

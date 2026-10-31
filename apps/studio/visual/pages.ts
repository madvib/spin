/**
 * The studio's page conventions, shipped to the tab by serialising source.
 *
 * Like `auditPage`, every function here has to carry everything it reads: the
 * serialised source is what runs, so a module-scope constant would simply be
 * missing in the browser.
 */

import type { FrameState, GeometryClaim } from "@spin/check";

/** What the rendered page looks like to someone reading it. */
export function pageState(): FrameState {
  const heading = document.querySelector("#app h1")?.textContent?.trim() ?? null;
  const preview = document.querySelector(".spin-preview");
  return {
    heading,
    text: (document.querySelector("#app")?.textContent ?? "").replace(/\s+/g, " ").trim(),
    theme: preview?.getAttribute("data-theme") ?? null,
    mode: preview?.getAttribute("data-mode") ?? null,
  };
}

/**
 * True once the app has booted on the route it was given.
 *
 * The heading is the mount signal the e2e suite waits on: a page without it
 * has not rendered anything yet. Deliberately not a test of how much content
 * arrived, because a route that renders an error is still a route the check
 * has to look at.
 */
export function renderReady(): boolean {
  return document.querySelector("#app h1") !== null;
}

/**
 * Seeds the theme and mode the way the app itself stores them.
 *
 * The overlay is process-global and outlives the tab: a leftover edit from
 * an earlier session would re-theme the preview under the seeded name, so
 * the seed closes it first and the combos measure the files on disk.
 */
export function seedTheme(seed: { theme: string; mode: string }): Promise<void> {
  localStorage.setItem("spin-theme", seed.theme);
  localStorage.setItem("spin-mode", seed.mode);
  return fetch("/__spin/rpc/overlay/clear", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
  }).then(() => {});
}

/**
 * Geometry stays single-owned by the e2e sweep: the studio's geometry claims
 * are asserted there, against the live app, and a second list here would
 * drift from the first. These exist only to satisfy the adapter.
 */
export function geometryClaimsFor(_hash: string): readonly string[] {
  return [];
}

export function geometryAudit(_options: {
  readonly claims: readonly string[];
}): readonly GeometryClaim[] {
  return [];
}

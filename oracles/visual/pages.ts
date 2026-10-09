/**
 * Page-side helpers, each shipped to the tab by serialising its source.
 *
 * Like `auditPage`, every function here has to carry everything it reads: the
 * serialised source is what runs, so a module-scope constant would simply be
 * missing in the browser. Each one is a probe of one fact.
 */

export interface PageState {
  readonly heading: string | null;
  readonly text: string;
  /** What the app says the theme and mode are, once it has painted. */
  readonly theme: string | null;
  readonly mode: string | null;
}

/** What the rendered page looks like to someone reading it. */
export function pageState(): PageState {
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
 * renders an error is still a route the oracle has to look at.
 */
export function renderReady(): boolean {
  if (document.querySelector("main") === null) return false;
  return document.documentElement.dataset.theme !== undefined;
}

/**
 * True on the blank document the oracle navigates through. Waiting for this is
 * how the oracle knows the page it just left is gone: a route differs from
 * the next by hash only, which a browser calls the same document.
 */
export function blankDocument(): boolean {
  return location.href === "about:blank";
}

/**
 * True once nothing on the page is mid-motion.
 *
 * A text node measured while it fades in is a different measurement every run,
 * so the oracle waits for the page to hold still. Endless loops — a loader
 * that pulses forever — are exempt: they are the page, not a thing that
 * finishes.
 */
export function animationsSettled(): boolean {
  return document.getAnimations().every((animation) => {
    const iterations = animation.effect?.getTiming().iterations ?? 1;
    return iterations === Infinity || animation.playState !== "running";
  });
}

/** Seeds the theme and mode the way the app itself stores them. */
export function seedTheme(seed: { theme: string; mode: string }): void {
  localStorage.setItem("spin-theme", seed.theme);
  localStorage.setItem("spin-mode", seed.mode);
}

export interface HoverCandidate {
  readonly index: number;
  readonly label: string;
  /** `none` means no pointer can hover the element, so :hover never applies. */
  readonly pointerEvents: string;
}

/** Every element the hover probe will visit, in document order. */
export function hoverCandidates(selector: string): readonly HoverCandidate[] {
  return [...document.querySelectorAll<HTMLElement>(selector)].map((
    el,
    index,
  ) => ({
    index,
    label: (el.textContent ?? el.getAttribute("aria-label") ?? "").trim()
      .replace(/\s+/g, " ").slice(0, 40),
    pointerEvents: getComputedStyle(el).pointerEvents,
  }));
}

export interface HoverPoint {
  readonly x: number;
  readonly y: number;
  /**
   * How long the element takes to finish a hover transition, in ms. Zero when
   * hovering it changes nothing that animates: a colour caught mid-fade is a
   * different measurement every run, so the probe waits exactly as long as the
   * page needs and no longer.
   */
  readonly settleMs: number;
}

/**
 * The viewport point a pointer must reach to hover this element, or null when
 * the element occupies no area. Scrolling first is part of the answer: an
 * element below the fold has no hover point until it is in view.
 */
export function hoverPoint(target: {
  selector: string;
  index: number;
}): HoverPoint | null {
  const el =
    document.querySelectorAll<HTMLElement>(target.selector)[target.index];
  if (el === undefined) return null;
  el.scrollIntoView({ block: "center", inline: "nearest" });
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return null;
  const style = getComputedStyle(el);
  const properties = style.transitionProperty.split(",").map((p) => p.trim());
  const durations = style.transitionDuration.split(",").map((value) => {
    const parsed = parseFloat(value.trim());
    return Number.isFinite(parsed) ? parsed * 1000 : 0;
  });
  let settleMs = 0;
  for (let index = 0; index < properties.length; index++) {
    const property = properties[index] ?? "";
    if (!/^(all|.*(color|background))$/.test(property)) continue;
    settleMs = Math.max(settleMs, durations[index] ?? 0);
  }
  return {
    x: rect.x + rect.width / 2,
    y: rect.y + rect.height / 2,
    settleMs: Math.round(settleMs),
  };
}

/** Whether the pointer currently sits on this element. */
export function isHovered(target: {
  selector: string;
  index: number;
}): boolean {
  const el =
    document.querySelectorAll<HTMLElement>(target.selector)[target.index];
  return el !== undefined && el.matches(":hover");
}

/**
 * The studio's browser session, for the e2e tests.
 *
 * A page with one vocabulary: navigate and wait for the shell, drive the
 * controls the way a pointer would, and read the project back through its
 * own RPC channel. Nothing here is a test hook — every step a test takes is
 * a step an author can take in a tab against the running dev server.
 */

import { type Browser, chromium, type Page } from "playwright-core";
import { CHILD_PATHS, ROUTE_PATHS } from "../src/lib/routes.ts";

/** The studio under test; the dev server's default port, overridable. */
export function studioUrl(): string {
  return (process.env.STUDIO_URL ?? "http://localhost:5173").replace(
    /\/$/,
    "",
  );
}

/** The app the studio edits and previews. */
export function appUrl(): string {
  return (process.env.APP_URL ?? "http://localhost:5174").replace(
    /\/$/,
    "",
  );
}

/** One browser for the whole file; `SPIN_CHROMIUM` names a binary if needed. */
export function launchBrowser(): Promise<Browser> {
  return chromium.launch({
    executablePath: process.env.SPIN_CHROMIUM ?? undefined,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
}

/**
 * One slot of an overlay theme, read by path.
 *
 * The overlay carries the theme as the document it is; a verdict asks about
 * a single leaf — the value an author wrote, or the mode override beside it
 * — and reads exactly that much without asserting on the document's shape.
 * A `null` is the path holding nothing, which is itself a finding.
 */
export function valueAt(
  theme: Record<string, unknown> | undefined,
  path: readonly string[],
  mode?: string,
): string | null {
  let node: unknown = theme;
  for (const segment of path) {
    if (typeof node !== "object" || node === null) return null;
    node = (node as Record<string, unknown>)[segment];
  }
  if (typeof node !== "object" || node === null) return null;
  const leaf = node as { $value?: unknown; $modes?: Record<string, unknown> };
  const value = mode === undefined ? leaf.$value : leaf.$modes?.[mode];
  if (typeof value === "string") return value;
  // A weight or a z-index is a number in the document's own JSON; the
  // controls speak text, so the digit comes back as text.
  if (typeof value === "number") return String(value);
  return null;
}

/**
 * The page went away under a read.
 *
 * The browser says so in one way — the execution context is destroyed when
 * the document is replaced — and nothing else is a page that left.
 */
function pageWentAway(error: unknown): boolean {
  return error instanceof Error &&
    error.message.includes("Execution context was destroyed");
}

export class StudioPage {
  /**
   * The Playwright page underneath.
   *
   * Some steps are only Playwright's to take: a pointer that must land on a
   * control, a clipboard the browser hands over. A test that needs one asks
   * for it here, rather than driving a browser of its own.
   */
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Read the page, and read it again if the page went away.
   *
   * A dev server that rebuilds reloads the page under the reader's hands, and
   * a read that lands in the page that is leaving is not a verdict — it is a
   * question asked of a page that is on its way out. The read is asked once
   * more, in the page that arrived.
   */
  async eval<T>(expression: string): Promise<T> {
    try {
      return await this.page.evaluate(expression) as T;
    } catch (error) {
      if (!pageWentAway(error)) throw error;
      await this.settle(300);
      return await this.page.evaluate(expression) as T;
    }
  }

  /** A command refused mid-navigation means ask again, not give up. */
  async #waitFor<T>(
    expression: string,
    timeoutMs: number,
  ): Promise<T | undefined> {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      try {
        const value = await this.eval<T | null>(expression);
        if (value !== null && value !== undefined && value !== false) {
          return value as T;
        }
      } catch {
        // Navigating.
      }
      if (Date.now() > deadline) return undefined;
      await this.page.waitForTimeout(150);
    }
  }

  /** Readiness is the heading: an unrouted path renders only the shell. */
  async goto(url: string): Promise<string | undefined> {
    try {
      await this.page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: 20_000,
      });
    } catch {
      // A route that never loaded is the verdict's finding, not the run's
      // death: the wait below reads what is on screen and says so.
    }
    const heading = await this.#waitFor<string>(
      `document.querySelector("#app h1")?.textContent ?? null`,
      15_000,
    );
    await this.settle(400);
    return heading;
  }

  async settle(ms: number): Promise<void> {
    await this.page.waitForTimeout(ms);
  }

  async reload(): Promise<void> {
    try {
      await this.page.reload({
        waitUntil: "domcontentloaded",
        timeout: 20_000,
      });
    } catch {
      // Same as goto: readiness below reports it.
    }
    await this.#waitFor(
      `document.querySelector("#app h1")?.textContent ?? null`,
      15_000,
    );
    await this.settle(400);
  }

  /**
   * The frame the drawer gets from its host: 38% of the window with a floor,
   * so the pages are laid out for the narrow edge rather than for a squeezed
   * desktop.
   */
  async fitDrawer(width: number, height: number): Promise<void> {
    await this.page.setViewportSize({ width, height });
  }

  /** Read from computed style, not from the token: the claim is about the page. */
  async cssVar(name: string): Promise<string | null> {
    return await this.eval<string | null>(
      `(() => { const t = document.querySelector("[data-theme]"); return t ? getComputedStyle(t).getPropertyValue(${
        JSON.stringify(name)
      }).trim() : null; })()`,
    );
  }

  async overlay(base: string): Promise<{
    open: boolean;
    themes: Record<string, Record<string, unknown>>;
    dirty: string[];
  }> {
    return await this.eval(
      `fetch(${
        JSON.stringify(new URL("/__spin/rpc/overlay/get", base).toString())
      }, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }).then((r) => r.json()).then((b) => b.json ?? { open: false, themes: {}, dirty: [] })`,
    );
  }

  async clearOverlay(base: string): Promise<void> {
    await this.eval(
      `(async () => { await fetch(${
        JSON.stringify(new URL("/__spin/rpc/overlay/clear", base).toString())
      }, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }); })()`,
    );
  }

  /**
   * A colour slot, addressed by its own id, both events sent.
   *
   * Each slot writes where it sits: the light input commits the token's
   * `$value`, the dark one its `$modes.dark`. Naming the slot is the point —
   * "the first colour input" is whichever slot the page happens to draw
   * first, and a test that reaches for it reads as a mode it never chose.
   */
  async setColor(selector: string, value: string): Promise<string> {
    return await this.eval<string>(
      `(async () => {
        const input = document.querySelector(${JSON.stringify(selector)});
        if (input === null) return "no-input";
        input.value = ${JSON.stringify(value)};
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
        await new Promise((r) => setTimeout(r, 800));
        return "edited";
      })()`,
    );
  }

  /** A row's track, released: `change` commits — linked, the group follows. */
  async dragRange(label: string, value: string): Promise<string> {
    return await this.eval<string>(
      `(async () => {
        const input = document.querySelector(${
        JSON.stringify(`input[type="range"][aria-label="${label}"], input[aria-label="${label} value"]`)
      });
        if (input === null) return "no-track";
        input.value = ${JSON.stringify(value)};
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
        await new Promise((r) => setTimeout(r, 1200));
        return "dragged";
      })()`,
    );
  }

  /**
   * The step a ramp's editor is showing.
   *
   * The spacing ramp draws every step but edits only the selected one, so a
   * row is picked before its track exists. The row's click handler is on the
   * button, which is why the label is looked up as the row's `code`.
   */
  async selectStep(path: string): Promise<string> {
    return await this.eval<string>(
      `(() => {
        const code = [...document.querySelectorAll("code")].find((c) => (c.textContent ?? "").trim() === ${
        JSON.stringify(path)
      });
        const button = code ? code.closest("button") : null;
        if (button === null) return "no-row";
        button.click();
        return "selected";
      })()`,
    );
  }

  /** The theme the registry seats, read off the line that names it. */
  async editingName(): Promise<string> {
    return await this.eval<string>(
      `(() => {
        const t = document.getElementById("app")?.innerText ?? "";
        const line = (t.split("\\n").find((l) => l.trim().indexOf("Editing") === 0) || "").trim();
        return line.indexOf("Editing ") === 0
          ? line.slice("Editing ".length).split("·")[0].trim()
          : "";
      })()`,
    );
  }

  /**
   * Choose a mode with the single cycle button.
   *
   * The mode lives on one button that cycles light → dark → system, so
   * choosing is pressing until the preview wears the mode — at most three
   * presses. A single-mode theme disables the button instead, and the
   * helper says so rather than pressing a dead control.
   */
  async chooseMode(mode: "light" | "dark" | "system"): Promise<string> {
    const chosen = await this.eval<string>(
      `(async () => {
        const wait = (ms) => new Promise((r) => setTimeout(r, ms));
        const button = document.querySelector('[data-testid="mode-button"]');
        if (!button) return "absent";
        if (button.disabled) return "disabled";
        const worn = () => document.querySelector(".spin-preview")?.getAttribute("data-mode");
        for (let press = 0; press < 3; press++) {
          if (worn() === "${mode}") return "pressed";
          button.click();
          await wait(400);
          if (button.disabled) return "disabled";
        }
        return worn() === "${mode}" ? "pressed" : "unreached";
      })()`,
    );
    await this.settle(600);
    return chosen;
  }

  /**
   * Seat a theme from the theme panel.
   *
   * The panel is the picker: a swatch opens it, a row applies a theme. The
   * row is waited for, because the registry is refetched after every create
   * and every delete — a theme the studio has not heard of yet is a theme
   * whose row is not there yet.
   */
  async chooseTheme(name: string): Promise<string> {
    const seated = await this.eval<string>(
      `(async () => {
        const wait = (ms) => new Promise((r) => setTimeout(r, ms));
        const button = document.querySelector('[data-testid="theme-picker"]');
        if (!button) return "absent";
        button.click();
        await wait(300);
        const selector = '[role="option"][data-theme-option=' + ${
        JSON.stringify(name)
      } + '], [role="option"][data-value=' + ${
        JSON.stringify(name)
      } + '], [role="option"][data-theme=' + ${
        JSON.stringify(name)
      } + ']';
        const deadline = Date.now() + 15000;
        while (!document.querySelector(selector)) {
          if (Date.now() > deadline) return "not-offered";
          await wait(100);
        }
        document.querySelector(selector).click();
        await wait(600);
        return "seated";
      })()`,
    );
    await this.settle(600);
    return seated;
  }

  /**
   * Point the pointer at the first match and let the hover state land.
   *
   * `eval` can synthesize a click, but only real pointer input raises
   * `:hover` — so this one goes through playwright's own mouse. The settle
   * outlasts the transition a themed control carries, so the caller reads a
   * landed state rather than a frame of it.
   */
  async hover(selector: string): Promise<string> {
    const target = this.page.locator(selector).first();
    if (await target.count() === 0) return "absent";
    await target.hover();
    await this.settle(600);
    return "hovered";
  }

  /** Park the pointer in a corner, so nothing reads as hovered. */
  async parkPointer(): Promise<void> {
    await this.page.mouse.move(0, 0);
    await this.settle(100);
  }

  /** Client-side, because a navigation would reset the mode this walk was given. */
  async followRail(route: string): Promise<void> {
    await this.eval(
      `(() => { const a = [...document.querySelectorAll("nav a")].find((x) => { const h = x.getAttribute("href") ?? ""; return h === ${
        JSON.stringify(route)
      } || h.startsWith(${
        JSON.stringify(route)
      } + "?"); }); if (a) a.click(); })()`,
    );
    // The arrival, not any heading: a client-side navigation leaves the
    // old page's h1 on screen while the route's chunk compiles, and a
    // readiness check that matches any h1 passes on the page being left.
    await this.#waitFor(
      `location.pathname === ${JSON.stringify(route)} ? location.pathname : null`,
      20_000,
    );
    await this.#waitFor(
      `document.querySelector("#app h1")?.textContent ?? null`,
      20_000,
    );
    await this.settle(400);
  }

  /** Swap a component's specimen for the markup that produced it. */
  async toggleCode(): Promise<string> {
    const clicked = await this.eval<string>(
      `(() => { const b = [...document.querySelectorAll("button")].find((x) => x.textContent.trim().toLowerCase() === "code"); if (!b) return "absent"; b.click(); return "shown"; })()`,
    );
    await this.settle(400);
    return clicked;
  }

  /** WCAG thresholds: 4.5 for body text, 3 for the large and the bold. */
  async contrastFailures(): Promise<
    readonly { text: string; cls: string; ratio: number; need: number }[]
  > {
    return await this.eval(
      `(() => {
        const parse = (c) => { const m = c.match(/[\\d.]+/g); if (!m) return null; return { r: +m[0], g: +m[1], b: +m[2], a: m.length > 3 ? +m[3] : 1 }; };
        const over = (fg, bg) => ({ r: fg.r*fg.a + bg.r*(1-fg.a), g: fg.g*fg.a + bg.g*(1-fg.a), b: fg.b*fg.a + bg.b*(1-fg.a), a: 1 });
        const lum = (c) => { const f = [c.r,c.g,c.b].map((v) => { v/=255; return v<=0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4); }); return 0.2126*f[0] + 0.7152*f[1] + 0.0722*f[2]; };
        const ratio = (a, b) => { const x = lum(a), y = lum(b); const hi = Math.max(x,y), lo = Math.min(x,y); return Math.round(((hi+0.05)/(lo+0.05)) * 100) / 100; };
        const paperOf = (el) => {
          const stack = []; let n = el;
          while (n) { const c = parse(getComputedStyle(n).backgroundColor); if (c && c.a > 0) { stack.push(c); if (c.a >= 0.999) break; } n = n.parentElement; }
          let base = parse(getComputedStyle(document.documentElement).backgroundColor);
          if (!base || base.a === 0) base = { r: 255, g: 255, b: 255, a: 1 };
          for (let i = stack.length - 1; i >= 0; i--) base = over(stack[i], base);
          return base;
        };
        const fails = [];
        for (const el of document.querySelectorAll("#app *")) {
          const own = [...el.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim() !== "").map((n) => n.textContent.trim()).join(" ");
          if (own === "") continue;
          const s = getComputedStyle(el);
          if (s.visibility === "hidden" || s.display === "none" || Number(s.opacity) < 0.05) continue;
          if (el.getClientRects().length === 0) continue;
          // Visually-hidden text is clipped to a one-pixel box for a screen
          // reader; it has no surface to read its colour against.
          const r = el.getBoundingClientRect();
          if (s.clipPath !== "none" || s.clip !== "auto" || (r.width <= 1 && r.height <= 1)) continue;
          const fgRaw = parse(s.color); if (!fgRaw) continue;
          const paper = paperOf(el);
          const fg = over(fgRaw, paper);
          const px = parseFloat(s.fontSize);
          const weight = Number(s.fontWeight) || 400;
          const need = (px >= 24 || (px >= 18.66 && weight >= 700)) ? 3 : 4.5;
          const got = ratio(fg, paper);
          if (got < need) fails.push({ text: own.slice(0, 40), cls: (el.getAttribute("class") || "").slice(0, 56), ratio: got, need });
        }
        const seen = new Map();
        for (const f of fails) { const k = f.cls + "|" + f.ratio; if (!seen.has(k)) seen.set(k, f); }
        return [...seen.values()];
      })()`,
    );
  }
}

/** Every path the studio serves, with each open segment filled from the library. */
export async function routeTargets(
  page: StudioPage,
  studio: string,
): Promise<string[]> {
  await page.goto(`${studio}/`);
  const subject = await page.eval<string>(
    `(async () => {
      const body = await fetch("/__spin/rpc/components/list", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ json: {} }),
      }).then((r) => r.json());
      const listed = body.json ?? [];
      return listed.length > 0 ? String(listed[0].name) : "";
    })()`,
  );
  const children = CHILD_PATHS.map((path) => path.replace(":name", subject))
    .filter((path) => !path.includes(":"));
  return [...new Set([...ROUTE_PATHS, ...children])];
}

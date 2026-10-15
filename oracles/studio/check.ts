#!/usr/bin/env -S deno run --allow-read --allow-write --allow-net --allow-run --allow-env
/**
 * The studio oracle.
 *
 *   deno task studio-check -- --studio http://localhost:5173 --app http://localhost:5174
 */

import { CHILD_PATHS, ROUTE_PATHS } from "../../apps/studio/src/lib/routes.ts";
import { launchChromium } from "../visual/chromium.ts";
import type { CdpSession, CdpSocket } from "../visual/cdp.ts";

interface Verdict {
  readonly name: string;
  readonly pass: boolean;
  readonly detail: string;
}

class Page {
  readonly #session: CdpSession;
  constructor(session: CdpSession) {
    this.#session = session;
  }

  async eval<T>(expression: string): Promise<T> {
    const outcome = await this.#session.command<{
      result: { value: T };
      exceptionDetails?: { text: string };
    }>("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (outcome.exceptionDetails !== undefined) {
      throw new Error(
        `page evaluation failed: ${outcome.exceptionDetails.text}\n  in: ${
          expression.slice(0, 200)
        }`,
      );
    }
    return outcome.result.value;
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
          return value;
        }
      } catch {
        // Navigating.
      }
      if (Date.now() > deadline) return undefined;
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
  }

  /** Readiness is the heading: an unrouted path renders only the shell. */
  async goto(url: string): Promise<string | undefined> {
    await this.#session.command("Page.navigate", { url });
    const heading = await this.#waitFor<string>(
      `document.querySelector("#app h1")?.textContent ?? null`,
      15_000,
    );
    await this.settle(400);
    return heading;
  }

  async settle(ms: number): Promise<void> {
    await this.#waitFor(
      `new Promise((r) => setTimeout(() => r(true), ${ms}))`,
      ms + 10_000,
    );
  }

  async reload(): Promise<void> {
    await this.#session.command("Page.reload", {});
    await this.#waitFor(
      `document.querySelector("#app h1")?.textContent ?? null`,
      15_000,
    );
    await this.settle(400);
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
    themes: Record<string, { color?: { primary?: { $value?: string } } }>;
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
      `fetch(${
        JSON.stringify(new URL("/__spin/rpc/overlay/clear", base).toString())
      }, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" })`,
    );
  }

  /** Both events: the control commits on either. */
  async setFirstColor(value: string): Promise<string> {
    return await this.eval<string>(
      `(async () => {
        const input = document.querySelector('input[type="color"]');
        if (input === null) return "no-inputs";
        input.value = ${JSON.stringify(value)};
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
        await new Promise((r) => setTimeout(r, 800));
        return "edited";
      })()`,
    );
  }

  async press(label: string): Promise<string> {
    const pressed = await this.eval<string>(
      `(() => { const b = [...document.querySelectorAll("button")].find((x) => x.textContent.trim() === ${
        JSON.stringify(label)
      }); if (!b) return "absent"; b.click(); return "pressed"; })()`,
    );
    await this.settle(600);
    return pressed;
  }

  /** Client-side, because a navigation would reset the mode this walk was given. */
  async followRail(route: string): Promise<void> {
    await this.eval(
      `(() => { const a = [...document.querySelectorAll("nav a")].find((x) => x.getAttribute("href") === ${
        JSON.stringify(route)
      }); if (a) a.click(); return "followed"; })()`,
    );
    await this.#waitFor(
      `document.querySelector("#app h1")?.textContent ?? null`,
      20_000,
    );
    await this.settle(400);
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

function verdict(
  results: Verdict[],
  name: string,
  pass: boolean,
  detail: string,
): void {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name} — ${detail}`);
}

interface Tab {
  readonly page: Page;
  close(): Promise<void>;
}

async function openTab(socket: CdpSocket): Promise<Tab> {
  const target = await socket.command<{ targetId: string }>(
    "Target.createTarget",
    { url: "about:blank" },
  );
  const session = await socket.attach(target.targetId);
  return {
    page: new Page(session),
    close: () =>
      socket.command("Target.closeTarget", { targetId: target.targetId }),
  };
}

/** Every path the table serves, with each open segment filled from the library. */
async function routeTargets(page: Page, studio: string): Promise<string[]> {
  await page.goto(`${studio}/`);
  const subject = await page.eval<string>(
    `(async () => {
      const body = await fetch("/__spin/rpc/primitives/list", {
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

/** A tab per route: sharing one made a verdict depend on the routes before it. */
async function checkRoutes(
  socket: CdpSocket,
  studio: string,
  results: Verdict[],
): Promise<void> {
  const scout = await openTab(socket);
  let routes: string[];
  try {
    routes = await routeTargets(scout.page, studio);
  } finally {
    await scout.close().catch(() => {});
  }
  for (const route of routes) {
    const tab = await openTab(socket);
    try {
      const heading = await tab.page.goto(`${studio}${route}`);
      const probe = await tab.page.eval<{ text: number; buildError: boolean }>(
        `(() => { const el = document.getElementById("app"); const t = el ? el.innerText : ""; return { text: t.trim().length, buildError: t.indexOf("does not build") > -1 }; })()`,
      );
      // The shell is furniture: an unrouted path renders it and no words.
      const rendered = heading !== undefined && heading.trim() !== "" &&
        probe.text > 50;
      verdict(
        results,
        `route ${route} renders`,
        rendered && !probe.buildError,
        `h1=${
          heading ?? "none"
        } text=${probe.text} buildError=${probe.buildError}`,
      );
    } finally {
      await tab.close().catch(() => {});
    }
  }
}

/** Every route in both modes, with every visible text run readable. */
async function checkLegibility(
  socket: CdpSocket,
  studio: string,
  results: Verdict[],
): Promise<void> {
  const routes = [...ROUTE_PATHS];
  for (const mode of ["Light", "Dark"] as const) {
    const tab = await openTab(socket);
    try {
      await tab.page.goto(`${studio}/`);
      const pressed = await tab.page.press(mode);
      if (pressed !== "pressed") {
        verdict(
          results,
          `legible in ${mode.toLowerCase()} mode`,
          false,
          `the mode control is ${pressed}`,
        );
        continue;
      }
      const seen: string[] = [];
      for (const route of routes) {
        await tab.page.followRail(route);
        for (const fail of await tab.page.contrastFailures()) {
          seen.push(
            `${route} ${fail.ratio} (need ${fail.need}) ${fail.cls} "${fail.text}"`,
          );
        }
      }
      verdict(
        results,
        `legible in ${mode.toLowerCase()} mode`,
        seen.length === 0,
        seen.length === 0
          ? `${routes.length} routes readable`
          : `${seen.length} failing — ${seen.slice(0, 3).join("  |  ")}`,
      );
    } finally {
      await tab.close().catch(() => {});
    }
  }
}

async function checkRegistrySeats(
  page: Page,
  studio: string,
  results: Verdict[],
): Promise<void> {
  await page.goto(`${studio}/`);
  const probe = await page.eval<{ editing: string; buildError: boolean }>(
    `(() => { const t = document.getElementById("app")?.innerText ?? ""; const line = (t.split("\\n").filter((l) => l.indexOf("Editing") > -1)[0] || "").trim().slice(0, 60); return { editing: line, buildError: t.indexOf("does not build") > -1 }; })()`,
  );
  verdict(
    results,
    "registry seats a project theme",
    probe.editing.startsWith("Editing default") && !probe.buildError,
    probe.editing === "" ? "no status line" : probe.editing,
  );
}

/** Two tabs: the watcher never navigates, so what it reads is the page it had. */
async function checkEditRethemesApp(
  driver: Page,
  watcher: Page,
  studio: string,
  app: string,
  results: Verdict[],
): Promise<void> {
  await watcher.goto(`${app}/`);
  await watcher.clearOverlay(app);
  await watcher.reload();
  const before = await watcher.cssVar("--color-primary");

  await driver.goto(`${studio}/colors?app=${encodeURIComponent(app)}`);
  const edited = await driver.setFirstColor("#b91c1c");

  const published = (await watcher.overlay(app)).themes["default"]?.color
    ?.primary?.$value ?? null;

  await watcher.settle(3000);
  const after = await watcher.cssVar("--color-primary");

  verdict(
    results,
    "studio edit re-themes the app",
    before === "#2563eb" && after === "#b91c1c" &&
      published === "#b91c1c" && edited === "edited",
    `primary ${before} → ${after}, edit=${edited}, published=${published}`,
  );

  await watcher.clearOverlay(app);
}

async function checkSaveClearsDirty(
  page: Page,
  studio: string,
  results: Verdict[],
): Promise<void> {
  // Clear before the editor seats its document: the store reads the overlay
  // on the way in, so a later clear would leave this run on last run's leftovers.
  await page.goto(`${studio}/`);
  await page.eval(
    `fetch("/__spin/rpc/overlay/clear", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" })`,
  );
  await page.goto(`${studio}/colors`);
  const flow = await page.eval<string>(
    `(async () => {
      const rpc = (proc, input) => fetch("/__spin/rpc" + proc, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ json: input }) }).then((x) => x.json()).then((b) => b.json);
      const original = (await rpc("/project/themes/read", { name: "default" })).text;
      const saveButton = () => [...document.querySelectorAll("button")].find((b) => b.getAttribute("aria-label") === "Save to disk");
      const inputs = [...document.querySelectorAll('input[type="color"]')];
      if (!inputs.length) return "no-inputs RESTORED=yes";
      const input = inputs[0];
      input.value = "#b91c1c";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      await new Promise((r) => setTimeout(r, 1200));
      const save = saveButton();
      if (!save) { await rpc("/project/themes/write", { name: "default", text: original }); return "no-save-control RESTORED=yes"; }
      if (save.disabled) { await rpc("/project/themes/write", { name: "default", text: original }); await rpc("/overlay/clear", {}); return "save-disabled-after-edit RESTORED=yes"; }
      save.click();
      await new Promise((r) => setTimeout(r, 2000));
      const after = saveButton();
      const state = await rpc("/overlay/get", {});
      await rpc("/project/themes/write", { name: "default", text: original });
      await rpc("/overlay/clear", {});
      return "saveDisabled=" + (after ? after.disabled : "?") + " dirty=" + JSON.stringify(state.dirty) + " RESTORED=yes";
    })()`,
  );
  verdict(
    results,
    "save clears the dirty set",
    flow.includes("saveDisabled=true") && flow.includes("dirty=[]"),
    flow,
  );
}

async function main(argv: readonly string[]): Promise<number> {
  let studio = "http://localhost:5173";
  let app = "http://localhost:5174";
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--studio") studio = argv[++i];
    if (argv[i] === "--app") app = argv[++i];
  }
  const results: Verdict[] = [];
  const launched = await launchChromium({
    viewport: { width: 1280, height: 800 },
  });
  try {
    const driver = await openTab(launched.socket);
    const watcher = await openTab(launched.socket);
    try {
      await checkRoutes(launched.socket, studio, results);
      await checkLegibility(launched.socket, studio, results);
      await checkRegistrySeats(driver.page, studio, results);
      await checkEditRethemesApp(
        driver.page,
        watcher.page,
        studio,
        app,
        results,
      );
      await checkSaveClearsDirty(driver.page, studio, results);
    } finally {
      await watcher.close().catch(() => {});
      await driver.close().catch(() => {});
    }
  } finally {
    launched.close();
  }
  const failed = results.filter((r) => !r.pass).length;
  console.log(`\n${results.length - failed}/${results.length} pass`);
  return failed === 0 ? 0 : 1;
}

if (import.meta.main) {
  main(Deno.args)
    .then((code) => Deno.exit(code))
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error));
      Deno.exit(2);
    });
}

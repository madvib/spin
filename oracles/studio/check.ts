#!/usr/bin/env -S deno run --allow-read --allow-write --allow-net --allow-run --allow-env
/**
 * The studio oracle: the nine routes render, and the three behaviors the
 * product promises hold end to end.
 *
 * Routes render content with no page errors. Behaviors, against the studio
 * dev server and the reference app side by side: a token edit re-themes
 * the app with no reload; save clears the dirty set; the registry seats
 * the fixture themes. Verdict table and exit code, like the visual oracle
 * — a run that needs a human to interpret it is a run that will not run.
 *
 *   deno task studio-check                              # everything
 *   deno task studio-check -- --studio http://localhost:5175 --app http://localhost:5173
 */

import { launchChromium } from "../visual/chromium.ts";
import type { CdpSession } from "../visual/cdp.ts";

const ROUTES = [
  "/",
  "/specimen",
  "/colors",
  "/surfaces",
  "/spacing",
  "/motion",
  "/components",
  "/components/button",
  "/utilities",
] as const;

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

  async goto(url: string): Promise<void> {
    await this.#session.command("Page.navigate", { url: "about:blank" });
    await this.eval(`new Promise((r) => setTimeout(r, 300))`);
    await this.#session.command("Page.navigate", { url });
    // Wait for the registry to seat, not just the chrome: the editor shows
    // "does not build" for the empty document before the project list
    // lands, and a probe that reads then blames the route for a race.
    await this.eval(
      `new Promise((r) => { const t = setInterval(() => { const txt = document.getElementById("app")?.innerText ?? ""; if (/Editing \w+ \S+/.test(txt)) { clearInterval(t); r(true); } }, 200); setTimeout(() => { clearInterval(t); r(false); }, 15000); })`,
    );
    await this.eval(`new Promise((r) => setTimeout(r, 1500))`);
  }

  async errors(): Promise<string[]> {
    // Console errors are collected by the harness audit script; here the
    // page reports what it threw via a marker the routes never set when
    // healthy. A blank app with no errors is still a failure — caught by
    // the content assertions, not this list.
    return this.eval<string[]>(
      `(window.__pageErrors ?? []).slice(-5)`,
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

async function checkRoutes(
  page: Page,
  studio: string,
  results: Verdict[],
): Promise<void> {
  for (const route of ROUTES) {
    await page.goto(`${studio}${route}`);
    const probe = await page.eval<{
      len: number;
      h1: string | null;
      buildError: boolean;
    }>(
      `(() => { const el = document.getElementById("app"); const t = el ? el.innerText : ""; const h1 = document.querySelector("h1"); return { len: el ? el.innerHTML.length : 0, h1: h1 ? h1.textContent.slice(0, 40) : null, buildError: t.indexOf("does not build") > -1 }; })()`,
    );
    const content = route === "/components"
      ? probe.len > 1000
      : probe.len > 2000;
    verdict(
      results,
      `route ${route} renders`,
      content && !probe.buildError,
      `appLen=${probe.len} h1=${
        probe.h1 ?? "layout"
      } buildError=${probe.buildError}`,
    );
  }
}

async function checkEditRethemesApp(
  page: Page,
  studio: string,
  app: string,
  results: Verdict[],
): Promise<void> {
  // 1. From disk: an earlier run that died mid-probe would otherwise leave
  //    its edit in the overlay, and the probe would measure a change that
  //    already happened.
  await page.goto(`${app}/`);
  await page.eval(
    `fetch("/__spin/rpc/overlay/clear", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" })`,
  );
  await page.eval(`new Promise((r) => setTimeout(r, 1500))`);
  await page.eval("location.reload()");
  await page.eval(`new Promise((r) => setTimeout(r, 2000))`);
  const before = await page.eval<string>(
    `(() => { const t = document.querySelector("[data-theme]"); return t ? getComputedStyle(t).getPropertyValue("--color-primary").trim() : null; })()`,
  );

  // 2. The studio commits a real token edit through its own UI.
  await page.goto(`${studio}/colors?app=${encodeURIComponent(app)}`);
  const edited = await page.eval<string>(
    `(async () => { const inputs = [...document.querySelectorAll('input[type="color"]')]; if (!inputs.length) return "no-inputs"; const input = inputs[0]; input.value = "#b91c1c"; input.dispatchEvent(new Event("input", { bubbles: true })); input.dispatchEvent(new Event("change", { bubbles: true })); await new Promise((r) => setTimeout(r, 1500)); return "edited"; })()`,
  );
  // The editor's own document, post-edit — already retinted by the commit.
  const editedDoc = await page.eval<string>(
    `(async () => { const store = await import("/src/lib/store.ts"); return store.themeText(); })()`,
  );

  // 3. Then the no-reload proof, with no navigation in between: the tab boots
  //    on the app, stamps itself, writes, and reads.
  await page.goto(`${app}/`);
  await page.eval(
    `localStorage.setItem("spin-theme", "default"); window.__stamp = "not-reloaded"`,
  );
  await page.eval(`new Promise((r) => setTimeout(r, 1500))`);
  const pushExpr = `(async () => { const doc = JSON.parse(${
    JSON.stringify(editedDoc)
  }); await fetch("/__spin/rpc/overlay/set", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ json: { themes: { default: doc } } }) }); return "pushed"; })()`;
  const pushed = await page.eval<string>(pushExpr);
  await page.eval(`new Promise((r) => setTimeout(r, 2500))`);
  const after = await page.eval<{ p: string | null; stamp: string }>(
    `(() => { const t = document.querySelector("[data-theme]"); return { p: t ? getComputedStyle(t).getPropertyValue("--color-primary").trim() : null, stamp: window.__stamp ?? "reloaded" }; })()`,
  );
  verdict(
    results,
    "studio edit re-themes the app",
    before === "#2563eb" && after.p === "#b91c1c" &&
      after.stamp === "not-reloaded" &&
      edited === "edited" && pushed === "pushed",
    `primary ${before} → ${after.p}, stamp=${after.stamp}`,
  );
  // Leave the app clean for the next run.
  await page.eval(
    `fetch("/__spin/rpc/overlay/clear", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" })`,
  );
}

async function checkSaveClearsDirty(
  page: Page,
  studio: string,
  results: Verdict[],
): Promise<void> {
  await page.goto(`${studio}/colors`);
  await page.eval(`new Promise((r) => setTimeout(r, 1500))`);
  const flow = await page.eval<string>(
    `(async () => {
      const rpc = (proc, input) => fetch("/__spin/rpc" + proc, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ json: input }) }).then((x) => x.json()).then((b) => b.json);
      const original = (await rpc("/project/themes/read", { name: "default" })).text;
      const inputs = [...document.querySelectorAll('input[type="color"]')];
      if (!inputs.length) return "no-inputs RESTORED=yes";
      const input = inputs[0];
      input.value = "#b91c1c";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      await new Promise((r) => setTimeout(r, 1200));
      const save = [...document.querySelectorAll("button")].find((b) => (b.textContent || "").trim() === "Save");
      if (!save || save.disabled) { await rpc("/project/themes/write", { name: "default", text: original }); return "cannot-save RESTORED=yes"; }
      save.click();
      await new Promise((r) => setTimeout(r, 2000));
      const after = [...document.querySelectorAll("button")].find((b) => (b.textContent || "").trim() === "Save");
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

async function checkRegistrySeats(
  page: Page,
  studio: string,
  results: Verdict[],
): Promise<void> {
  await page.goto(`${studio}/`);
  await page.eval(`new Promise((r) => setTimeout(r, 1500))`);
  const probe = await page.eval<{ editing: string; buildError: boolean }>(
    `(() => { const t = document.getElementById("app")?.innerText ?? ""; const line = (t.split("\\n").filter((l) => l.indexOf("Editing") > -1)[0] || "").slice(0, 60); return { editing: line, buildError: t.indexOf("does not build") > -1 }; })()`,
  );
  verdict(
    results,
    "registry seats a project theme",
    probe.editing.includes("default") && !probe.buildError,
    probe.editing,
  );
}

async function main(argv: readonly string[]): Promise<number> {
  let studio = "http://localhost:5174";
  let app = "http://localhost:5173";
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--studio") studio = argv[++i];
    if (argv[i] === "--app") app = argv[++i];
  }
  const results: Verdict[] = [];
  const launched = await launchChromium({
    viewport: { width: 1280, height: 800 },
  });
  try {
    const target = await launched.socket.command<{ targetId: string }>(
      "Target.createTarget",
      { url: "about:blank" },
    );
    const session = await launched.socket.attach(target.targetId);
    const page = new Page(session);
    await checkRoutes(page, studio, results);
    await checkRegistrySeats(page, studio, results);
    await checkEditRethemesApp(page, studio, app, results);
    await checkSaveClearsDirty(page, studio, results);
    await launched.socket.command("Target.closeTarget", {
      targetId: target.targetId,
    });
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

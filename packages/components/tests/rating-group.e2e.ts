/**
 * E2E: the forked-FSM rating-group rates in a real browser — click to
 * commit, hover to preview, arrows/Home/End from the keyboard, and the
 * imperative commands.
 *
 * Run explicitly (not in default `deno task test`):
 *   cd packages/components && deno test --allow-read --allow-net --allow-run
 *     --allow-env --allow-sys --allow-write=/tmp --allow-import
 *     --min-dep-age=0 tests/rating-group.e2e.ts
 *
 * Builds the specimens app, serves dist, drives real Chromium via Playwright.
 * Requires the Playwright browser once: `bunx playwright install chromium`.
 * Fails loud naming the step; silent on success.
 */

import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { strict as assert } from "node:assert";
import { chromium, type Browser, type Page } from "npm:playwright-core";

const ROOT = join(import.meta.dirname as string, "..", "..", "..");
const SPECIMENS = "packages/components/specimens";
const PORT = 5251;
const URL = `http://127.0.0.1:${PORT}/rating-group`;

/** Part ids are the machine's scheme: `rating-group:<element id>:<part>`. */
const at = (id: string, part: string): string => `[id="rating-group:${id}:${part}"]`;
const CONTROL = at("stars", "control");
const item = (index: number): string => `[id="rating-group:stars:item:${index}"]`;

/** Runs a named step, rethrowing any failure prefixed with the step name. */
async function step<T>(name: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    throw new Error(`[${name}] ${(error as Error).message}`, { cause: error });
  }
}

/** Builds the specimens app from a clean checkout. */
async function buildDemo(): Promise<void> {
  const cmd = new Deno.Command("node", {
    args: [join(ROOT, "node_modules/vite/bin/vite.js"), "build", SPECIMENS],
    cwd: ROOT,
    stdout: "piped",
    stderr: "piped",
  });
  const { code, stderr } = await cmd.output();
  assert.equal(code, 0, `vite build failed:\n${new TextDecoder().decode(stderr)}`);
}

/** Serves the built dist on a fixed port and waits until it answers. */
async function startServer(): Promise<Deno.ChildProcess> {
  const cmd = new Deno.Command("node", {
    args: [
      join(ROOT, "node_modules/vite/bin/vite.js"),
      "preview",
      SPECIMENS,
      "--port",
      String(PORT),
      "--strictPort",
    ],
    cwd: ROOT,
    stdout: "piped",
    stderr: "piped",
  });
  const child = cmd.spawn();
  for (let i = 0; i < 50; i += 1) {
    try {
      if ((await fetch(URL)).ok) return child;
    } catch {
      // server not ready yet
    }
    await delay(100);
  }
  const stderr = new TextDecoder().decode(await new Response(child.stderr).arrayBuffer());
  try {
    child.kill();
  } catch {
    // already exited
  }
  throw new Error(`vite preview did not start on :${PORT}\n${stderr}`);
}

Deno.test("spin-rating-group e2e", async () => {
  await step("build", buildDemo);
  const server = await step("serve", startServer);
  const pageErrors: string[] = [];
  let browser: Browser | undefined;

  try {
    browser = await step("launch chromium", () =>
      chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] }));

    const page: Page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    page.on("pageerror", (err) => pageErrors.push(err.message));

    await step("load page", async () => {
      await page.goto(URL, { waitUntil: "load" });
      await page.waitForSelector(CONTROL, { state: "attached", timeout: 5000 });
      await page.waitForTimeout(1500);
    });

    const readout = page.locator("text=/rating: (unrated|[\\d.]+)/").first();

    await step("a click commits the value", async () => {
      await page.locator(item(3)).click();
      await page.waitForTimeout(300);
      assert.match(await readout.textContent() ?? "", /rating: 3/, "the third star committed");
      assert.equal(
        await page.locator(item(3)).getAttribute("aria-checked"),
        "true",
        "the third star reads checked",
      );
    });

    await step("arrows walk the value", async () => {
      // The click focused item 3 with no focus change, so the machine is
      // still idle: move focus elsewhere first so a FOCUS event fires.
      await page.locator(item(5)).focus();
      // The click parked the mouse over the group, which is the hover
      // state — keyboard lives in focus. Moving off leaves to focus (a
      // radio holds focus) and the arrows drive from there.
      await page.mouse.move(20, 20);
      await page.keyboard.press("ArrowRight");
      await page.waitForTimeout(300);
      assert.match(await readout.textContent() ?? "", /rating: 4/, "ArrowRight moved to four");
      await page.keyboard.press("ArrowLeft");
      await page.waitForTimeout(300);
      assert.match(await readout.textContent() ?? "", /rating: 3/, "ArrowLeft moved back to three");
    });

    await step("Home and End jump", async () => {
      await page.keyboard.press("End");
      await page.waitForTimeout(300);
      assert.match(await readout.textContent() ?? "", /rating: 5/, "End jumped to five");
      await page.keyboard.press("Home");
      await page.waitForTimeout(300);
      assert.match(await readout.textContent() ?? "", /rating: 1/, "Home jumped to one");
    });

    await step("commands drive the instance", async () => {
      await page.getByText("el.setValue(4)").click();
      await page.waitForTimeout(300);
      assert.match(await readout.textContent() ?? "", /rating: 4/, "setValue committed four");
      await page.getByText("el.clearValue()").click();
      await page.waitForTimeout(300);
      assert.match(await readout.textContent() ?? "", /rating: unrated/, "clearValue emptied");
    });

    assert.deepEqual(pageErrors, [], `page errors: ${pageErrors.join("; ")}`);
  } finally {
    await browser?.close();
    try {
      server.kill();
    } catch {
      // already exited
    }
  }
});

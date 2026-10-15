/**
 * E2E: the forked-FSM splitter splits in a real browser — handle drag
 * redistributes the percents, arrows nudge from the keyboard, Enter
 * collapses and re-expands, and the imperative commands drive the layout.
 *
 * Run explicitly (not in default `deno task test`):
 *   cd packages/components && deno test --allow-read --allow-net --allow-run
 *     --allow-env --allow-sys --allow-write=/tmp --allow-import
 *     --min-dep-age=0 tests/splitter.e2e.ts
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
const PORT = 5253;
const URL = `http://127.0.0.1:${PORT}/splitter`;

/** Part ids are the machine's scheme: `splitter:<element id>:<part>`. */
const at = (id: string, part: string): string => `[id="splitter:${id}:${part}"]`;
const ROOT_ID = '[id="splitter:group"]';
const handle = (pair: string): string => `[id="splitter:group:handle:${pair}"]`;
const FIRST_HANDLE = handle("nav:main");

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

Deno.test("spin-splitter e2e", async () => {
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
      await page.waitForSelector(ROOT_ID, { state: "attached", timeout: 5000 });
      await page.waitForTimeout(1500);
    });

    const readout = page.locator("text=/sizes: [\\d, ]+/").first();

    await step("a handle drag redistributes", async () => {
      const box = await page.locator(FIRST_HANDLE).boundingBox();
      assert.ok(box !== null, "the handle has a box");
      const before = await readout.textContent();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + 60, box.y + box.height / 2, { steps: 5 });
      await page.mouse.up();
      await page.waitForTimeout(300);
      const after = await readout.textContent();
      assert.notEqual(after, before, "the drag moved the percents");
    });

    await step("arrows nudge the handle", async () => {
      await page.locator(FIRST_HANDLE).focus();
      const before = await readout.textContent() ?? "";
      await page.keyboard.press("ArrowRight");
      await page.waitForTimeout(300);
      const after = await readout.textContent() ?? "";
      assert.notEqual(after, before, "ArrowRight nudged the layout");
    });

    await step("Enter collapses and re-expands", async () => {
      // Enter collapses the panel BEFORE the focused handle.
      await page.locator(FIRST_HANDLE).focus();
      await page.keyboard.press("Enter");
      await page.waitForTimeout(300);
      const collapsed = await readout.textContent() ?? "";
      assert.match(collapsed, /^sizes: 0,/, "the nav panel collapsed to zero");
      await page.keyboard.press("Enter");
      await page.waitForTimeout(300);
      const expanded = await readout.textContent() ?? "";
      assert.ok(!expanded.startsWith("sizes: 0,"), "the nav panel re-expanded");
    });

    await step("commands drive the instance", async () => {
      await page.getByText("el.setSizes([30, 40, 30])").click();
      await page.waitForTimeout(300);
      assert.match(await readout.textContent() ?? "", /sizes: 30, 40, 30/, "setSizes committed");
      await page.getByText("el.resetSizes()").click();
      await page.waitForTimeout(300);
      assert.match(
        await readout.textContent() ?? "",
        /sizes: 33, 33, 33/,
        "resetSizes evened out",
      );
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

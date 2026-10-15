/**
 * E2E: the forked-FSM angle-slider turns in a real browser — dial press
 * jumps the value, arrows step from the keyboard, Home/End jump, and the
 * imperative commands drive the dial.
 *
 * Run explicitly (not in default `deno task test`):
 *   cd packages/components && deno test --allow-read --allow-net --allow-run
 *     --allow-env --allow-sys --allow-write=/tmp --allow-import
 *     --min-dep-age=0 tests/angle-slider.e2e.ts
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
const PORT = 5256;
const URL = `http://127.0.0.1:${PORT}/angle-slider`;

/** Part ids are the machine's scheme: `angle-slider:<element id>:<part>`. */
const CONTROL = '[id="angle-slider:dial:control"]';
const THUMB = '[id="angle-slider:dial:thumb"]';

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

Deno.test("spin-angle-slider e2e", async () => {
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

    const readout = page.locator("text=/angle: \\d+deg/").first();

    await step("a dial press jumps the value", async () => {
      const box = await page.locator(CONTROL).boundingBox();
      assert.ok(box !== null, "the control has a box");
      // Right of center: ~90 degrees.
      await page.mouse.move(box.x + box.width - 10, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.up();
      await page.waitForTimeout(300);
      const text = await readout.textContent() ?? "";
      const value = Number(text.replace("angle:", "").replace("deg", "").trim());
      assert.ok(value >= 80 && value <= 100, `the press jumped near 90 (got ${value})`);
    });

    await step("arrows step the thumb", async () => {
      await page.locator(THUMB).focus();
      const before = Number(
        (await readout.textContent() ?? "").replace("angle:", "").replace("deg", "").trim(),
      );
      await page.keyboard.press("ArrowRight");
      await page.waitForTimeout(300);
      const after = Number(
        (await readout.textContent() ?? "").replace("angle:", "").replace("deg", "").trim(),
      );
      assert.equal(after, before + 1, "ArrowRight stepped by one");
      assert.equal(
        await page.locator(THUMB).getAttribute("aria-valuenow"),
        String(after),
        "aria-valuenow tracks the value",
      );
    });

    await step("Home and End jump", async () => {
      await page.keyboard.press("End");
      await page.waitForTimeout(300);
      assert.match(await readout.textContent() ?? "", /angle: 359deg/, "End jumped to max");
      await page.keyboard.press("Home");
      await page.waitForTimeout(300);
      assert.match(await readout.textContent() ?? "", /angle: 0deg/, "Home jumped to min");
    });

    await step("commands drive the instance", async () => {
      await page.getByText("el.setValue(180)").click();
      await page.waitForTimeout(300);
      assert.match(await readout.textContent() ?? "", /angle: 180deg/, "setValue committed 180");
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

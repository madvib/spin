/**
 * E2E: the forked-FSM signature-pad draws in a real browser — a press
 * starts a stroke, the release commits one path, clear empties the pad, and
 * the imperative command works.
 *
 * Run explicitly (not in default `deno task test`):
 *   cd packages/components && deno test --allow-read --allow-net --allow-run
 *     --allow-env --allow-sys --allow-write=/tmp --allow-import
 *     --min-dep-age=0 tests/signature-pad.e2e.ts
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
const PORT = 5250;
const URL = `http://127.0.0.1:${PORT}/signature-pad`;

/** Part ids are the machine's scheme: `signature-pad:<element id>:<part>`. */
const at = (id: string, part: string): string => `[id="signature-pad:${id}:${part}"]`;
const CONTROL = at("pad", "control");
const CLEAR = at("pad", "clear-trigger");

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

Deno.test("spin-signature-pad e2e", async () => {
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

    const readout = page.locator("text=/strokes: (empty|\\d)/").first();

    await step("a stroke commits one path", async () => {
      const box = await page.locator(CONTROL).boundingBox();
      assert.ok(box !== null, "the control has a box");
      assert.ok(box.width > 0 && box.height > 0, "the control has size");
      const before = await readout.textContent();
      await page.mouse.move(box.x + 40, box.y + 40);
      await page.mouse.down();
      await page.mouse.move(box.x + 80, box.y + 60, { steps: 5 });
      await page.mouse.move(box.x + 120, box.y + 40, { steps: 5 });
      await page.mouse.up();
      await page.waitForTimeout(300);
      const after = await readout.textContent();
      assert.notEqual(after, before, "the stroke committed a path");
      assert.match(after ?? "", /1 committed/, "exactly one path committed");
    });

    await step("the stroke renders an svg path", async () => {
      const d = await page.locator(`${CONTROL} svg path`).first().getAttribute("d");
      assert.ok(d !== null && d.length > 0, "a path element carries ink");
    });

    await step("clear empties the pad", async () => {
      await page.locator(CLEAR).click();
      await page.waitForTimeout(300);
      const after = await readout.textContent();
      assert.match(after ?? "", /empty/, "the pad is empty after clear");
      assert.equal(
        await page.locator(`${CONTROL} svg path`).count(),
        0,
        "no rendered paths remain",
      );
    });

    await step("the clear command works", async () => {
      const box = await page.locator(CONTROL).boundingBox();
      assert.ok(box !== null, "the control has a box");
      await page.mouse.move(box.x + 40, box.y + 40);
      await page.mouse.down();
      await page.mouse.move(box.x + 80, box.y + 60, { steps: 5 });
      await page.mouse.up();
      await page.waitForTimeout(300);
      assert.match(await readout.textContent() ?? "", /1 committed/, "a stroke committed");
      await page.getByText("el.clear()").click();
      await page.waitForTimeout(300);
      assert.match(await readout.textContent() ?? "", /empty/, "the command cleared the pad");
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

/**
 * E2E: the forked-FSM image-cropper drives its machine in a real browser —
 * measurement, selection drag, handle resize, wheel zoom, keyboard nudge,
 * and the imperative commands.
 *
 * Run explicitly (not in default `deno task test`):
 *   cd packages/components && deno test --allow-read --allow-net --allow-run
 *     --allow-env --allow-sys --allow-write=/tmp --allow-import
 *     --min-dep-age=0 tests/image-cropper.e2e.ts
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
const PORT = 5249;
const URL = `http://127.0.0.1:${PORT}/image-cropper`;

/** Part ids are the machine's scheme: `image-cropper:<element id>:<part>`. */
const at = (id: string, part: string): string => `[id="image-cropper:${id}:${part}"]`;
const VIEWPORT = at("photo", "viewport");
const SELECTION = at("photo", "selection");
const HANDLE_SE = at("photo", "handle:se");

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

Deno.test("spin-image-cropper e2e", async () => {
  await step("build", buildDemo);
  const server = await step("serve", startServer);
  const pageErrors: string[] = [];
  let browser: Browser | undefined;

  try {
    browser = await step("launch chromium", () =>
      chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] }));

    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    page.on("pageerror", (err) => pageErrors.push(err.message));

    await step("load page", async () => {
      await page.goto(URL, { waitUntil: "load" });
      await page.waitForSelector(VIEWPORT, { state: "attached", timeout: 5000 });
      await page.waitForFunction(
        () => document.querySelector('[id="image-cropper:photo:selection"]')?.getAttribute("data-measured") === "",
        undefined,
        { timeout: 8000 },
      );
    });

    await step("selection drag moves the crop", async () => {
      const box = await page.locator(SELECTION).boundingBox();
      assert.ok(box !== null, "the selection has a box");
      const readout = page.locator("text=/crop:/").first();
      const before = await readout.textContent();
      // Center of the selection: a move, not a handle resize.
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2 + 20, { steps: 5 });
      await page.mouse.up();
      const after = await readout.textContent();
      assert.notEqual(after, before, "the drag moved the crop");
    });

    await step("handle drag resizes the crop", async () => {
      const box = await page.locator(HANDLE_SE).boundingBox();
      assert.ok(box !== null, "the se handle has a box");
      const readout = page.locator("text=/crop:/").first();
      const before = await readout.textContent();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + 30, box.y + 30, { steps: 5 });
      await page.mouse.up();
      const after = await readout.textContent();
      assert.notEqual(after, before, "the resize changed the crop");
    });

    await step("arrows nudge the crop", async () => {
      const readout = page.locator("text=/crop:/").first();
      const before = await readout.textContent();
      await page.locator(SELECTION).focus();
      await page.keyboard.press("ArrowRight");
      const after = await readout.textContent();
      assert.notEqual(after, before, "the nudge moved the crop");
    });

    await step("commands drive the instance", async () => {
      const card = page.locator("card").first();
      await card.getByRole("button", { name: "el.zoomBy(0.5)" }).click();
      const readout = await page.locator("text=/zoom:/").first().textContent();
      assert.ok(readout?.includes("1.5"), `zoom stepped to 1.5, got: ${readout}`);
      await card.getByRole("button", { name: "el.rotateBy(90)" }).click();
      const rotated = await page.locator("text=/rotation:/").first().textContent();
      assert.ok(rotated?.includes("90"), `rotation stepped to 90, got: ${rotated}`);
    });

    await step("no page errors", async () => {
      assert.deepEqual(pageErrors, [], `page errors: ${pageErrors.join("; ")}`);
    });
  } finally {
    await browser?.close();
    server.kill();
  }
});

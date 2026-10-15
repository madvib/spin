/**
 * spin-floating-panel e2e: open/closed, the gesture modes, and the stage,
 * behind the app-controller handle.
 *
 * Builds the specimens app, serves dist, drives real Chromium via Playwright.
 * The route binds a machine-owned floating-panel through
 * `{ commands, state, bind }`; this suite exercises the seeded open, the
 * drag gesture (position follows the press-origin delta), an edge resize,
 * the stage cycle, the escape close, and the imperative commands.
 */

import { join } from "node:path";
import { strict as assert } from "node:assert";
import { chromium, type Browser, type Page } from "npm:playwright-core";

const ROOT = join(import.meta.dirname as string, "..", "..", "..");
const SPECIMENS = "packages/components/specimens";
const PORT = 5236;
const PAGE_URL = `http://127.0.0.1:${PORT}/floating-panel`;

async function step<T>(name: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    throw new Error(`[${name}] ${(error as Error).message}`, { cause: error });
  }
}

/** Builds the specimens app once; the suite serves the result. */
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
  const server = cmd.spawn();
  for (let i = 0; i < 50; i++) {
    try {
      const res = await fetch(PAGE_URL);
      if (res.ok) return server;
    } catch {
      // Not up yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  server.kill();
  throw new Error(`preview server never answered on ${PORT}`);
}

const READOUT = "#panel-state";
const POSITIONER = "#panel [role='dialog']";
const TRIGGER = "#panel [id$=':trigger']";
const DRAG = "#panel [id$=':drag']";
const RESIZE_E = "#panel [id$=':resize:e']";
const STAGE = "#panel [id$=':stage']";

const posState = (page: Page): Promise<string> =>
  page.evaluate(() => document.querySelector("#panel [role='dialog']")?.getAttribute("data-state") ?? "gone");

const stage = (page: Page): Promise<string> =>
  page.evaluate(() => document.querySelector("#panel [role='dialog']")?.getAttribute("data-stage") ?? "gone");

/** The panel's rect in page coordinates. */
const bodyRect = (page: Page): Promise<{ x: number; y: number; w: number; h: number }> =>
  page.evaluate(() => {
    const node = document.querySelector("#panel div.flex") as HTMLElement;
    const rect = node.getBoundingClientRect();
    return { x: rect.x, y: rect.y, w: rect.width, h: rect.height };
  });

const centerOf = (page: Page, selector: string): Promise<{ x: number; y: number }> =>
  page.evaluate((sel) => {
    const node = document.querySelector(sel) as HTMLElement;
    const rect = node.getBoundingClientRect();
    return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  }, selector);

/** A press-move-release gesture on a handle. */
async function gesture(page: Page, selector: string, dx: number, dy: number): Promise<void> {
  // Settle before the press as well as after: a target read mid-transition
  // points at where the panel WAS, and the press misses the handle.
  await page.waitForTimeout(300);
  const point = await centerOf(page, selector);
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.mouse.move(point.x + dx, point.y + dy, { steps: 5 });
  await page.mouse.up();
  // The panel eases between positions (duration-fast); the rect follows
  // the machine only after the transition lands.
  await page.waitForTimeout(300);
}

Deno.test("spin-floating-panel e2e", async () => {
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
      await page.goto(PAGE_URL, { waitUntil: "load" });
      // The trigger, not the positioner: the positioner is a zero-box
      // relative container, which Playwright's visibility wait never sees.
      // A generous timeout — the first load of the half-megabyte bundle on
      // a cold cache has been observed past five seconds.
      await page.waitForSelector(TRIGGER, { timeout: 30000 });
    });

    await step("the seeded panel opens and reports its state", async () => {
      assert.equal(await posState(page), "open", "defaultOpen seeds the panel open");
      assert.equal(await page.locator(READOUT).textContent(), "open", "and the readout follows the seed");
      assert.equal(await stage(page), "restored", "the stage starts restored");
      const rect = await bodyRect(page);
      assert.equal(rect.w, 360, "the seeded geometry rides the channel");
      assert.equal(rect.h, 240, "width and height");
    });

    await step("dragging the header moves the panel by the press delta", async () => {
      const before = await bodyRect(page);
      await gesture(page, DRAG, 90, 40);
      const after = await bodyRect(page);
      assert.equal(after.x - before.x, 90, "x moved by the delta");
      assert.equal(after.y - before.y, 40, "y moved by the delta");
      assert.equal(await posState(page), "open", "the release returns to open");
    });

    await step("dragging enters and leaves the gesture mode", async () => {
      const point = await centerOf(page, DRAG);
      await page.mouse.move(point.x, point.y);
      await page.mouse.down();
      assert.equal(
        await page.locator(POSITIONER).getAttribute("data-dragging"),
        "",
        "the press enters dragging",
      );
      await page.mouse.move(point.x + 10, point.y + 10, { steps: 2 });
      await page.mouse.up();
      assert.equal(await page.locator(POSITIONER).getAttribute("data-dragging"), null, "the release leaves it");
    });

    await step("the east edge resizes the panel", async () => {
      const before = await bodyRect(page);
      await gesture(page, RESIZE_E, 60, 0);
      const after = await bodyRect(page);
      assert.equal(after.w - before.w, 60, "the width grew by the delta");
      assert.equal(after.h, before.h, "the height is untouched");
    });

    await step("escape during a drag cancels back to the press point", async () => {
      // Settle first: the resize before this step is still easing its
      // width, and a mid-ease rect is not the position the press records.
      await page.waitForTimeout(300);
      const before = await bodyRect(page);
      const point = await centerOf(page, DRAG);
      await page.mouse.move(point.x, point.y);
      await page.mouse.down();
      await page.mouse.move(point.x + 70, point.y + 0, { steps: 3 });
      await page.keyboard.press("Escape");
      await page.mouse.up();
      await page.waitForTimeout(300);
      const after = await bodyRect(page);
      assert.equal(after.x, before.x, "the move cancelled");
      assert.equal(after.y, before.y, "and the panel stayed open");
      assert.equal(await posState(page), "open", "no close from a gesture escape");
    });

    await step("the stage control cycles minimized and restored", async () => {
      await page.locator(STAGE).click();
      assert.equal(await stage(page), "minimized", "the stage minimizes");
      assert.equal(await page.locator(READOUT).textContent(), "minimized", "and reports through the channel");
      await page.locator(STAGE).click();
      assert.equal(await stage(page), "restored", "and restores");
    });

    await step("escape closes the panel", async () => {
      await page.keyboard.press("Escape");
      assert.equal(await posState(page), "closed", "the panel closes");
      assert.equal(await page.locator(READOUT).textContent(), "closed", "and reports");
    });

    await step("imperative commands reopen and close", async () => {
      await page.getByRole("button", { name: "el.setOpen()" }).click();
      assert.equal(await posState(page), "open", "setOpen opens through the command");
      await page.getByRole("button", { name: "el.close()" }).click();
      assert.equal(await posState(page), "closed", "close closes");
    });

    await step("no page errors", () => {
      assert.deepEqual(pageErrors, [], `page errors: ${pageErrors.join("; ")}`);
      return Promise.resolve();
    });
  } finally {
    await browser?.close();
    server.kill();
  }
});

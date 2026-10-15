/**
 * spin-hover-card e2e: one hover-delay action on the root behind the same
 * app-controller handle as a machine.
 *
 * Builds the specimens app, serves dist, drives real Chromium via Playwright.
 * The route binds a platform-owned hover-card through `{ commands, state,
 * bind }`; this suite exercises the dwell open, the move-to-panel persistence
 * (the behavior that separates a card from a tooltip), the leave close after
 * the delay, the focus path, and the imperative commands, with the host
 * readout following throughout.
 */

import { join } from "node:path";
import { strict as assert } from "node:assert";
import { chromium, type Browser, type Page } from "npm:playwright-core";

const ROOT = join(import.meta.dirname as string, "..", "..", "..");
const SPECIMENS = "packages/components/specimens";
const PORT = 5233;
const PAGE_URL = `http://127.0.0.1:${PORT}/hover-card`;

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

const READOUT = "#hover-card-open";
const TRIGGER = "#demo-hover-card button";

const nativeOpen = (page: Page): Promise<boolean> =>
  page.evaluate(() => document.querySelector("#demo-hover-card [popover]")?.matches(":popover-open") ?? false);

const waitReadout = (page: Page, value: string): Promise<void> => {
  const expected = value;
  return page.waitForFunction(
    (want) => document.querySelector("#hover-card-open")?.textContent === want,
    expected,
    { timeout: 5000 },
  ).then(() => undefined);
};

Deno.test("spin-hover-card e2e", async () => {
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
      await page.waitForSelector("#demo-hover-card button", { timeout: 5000 });
    });

    await step("dwell opens the anchored panel", async () => {
      assert.equal(await page.locator(READOUT).textContent(), "false");
      await page.locator(TRIGGER).hover();
      assert.equal(await nativeOpen(page), false, "no instant open: the dwell owns the timing");
      await waitReadout(page, "true");
      assert.equal(await nativeOpen(page), true, "the native panel is open after the dwell");
      const geometry = await page.evaluate(() => {
        const panel = document.querySelector("#demo-hover-card [popover]") as HTMLElement;
        const trigger = document.querySelector("#demo-hover-card button") as HTMLElement;
        const panelRect = panel.getBoundingClientRect();
        const triggerRect = trigger.getBoundingClientRect();
        return {
          gap: panelRect.top - triggerRect.bottom,
          left: panelRect.left - triggerRect.left,
          placement: panel.getAttribute("data-placement"),
        };
      });
      assert.equal(geometry.placement, "bottom", "the viewport leaves room below");
      assert.ok(geometry.gap >= 4 && geometry.gap <= 16, `the panel sits under the trigger (gap ${geometry.gap})`);
      assert.ok(Math.abs(geometry.left) < 4, `the panel aligns to the trigger (offset ${geometry.left})`);
    });

    await step("moving to the panel keeps it open", async () => {
      const point = await page.evaluate(() => {
        const trigger = document.querySelector("#demo-hover-card button") as HTMLElement;
        const rect = trigger.getBoundingClientRect();
        return { x: rect.left + rect.width / 2, y: rect.bottom + 40 };
      });
      await page.mouse.move(point.x, point.y);
      await new Promise((resolve) => setTimeout(resolve, 400));
      assert.equal(await nativeOpen(page), true, "the card stays while the pointer is over it");
      assert.equal(await page.locator(READOUT).textContent(), "true");
    });

    await step("leaving both closes after the delay", async () => {
      await page.mouse.move(1200, 800);
      await new Promise((resolve) => setTimeout(resolve, 150));
      assert.equal(await nativeOpen(page), true, "still open inside the close delay");
      await waitReadout(page, "false");
      assert.equal(await nativeOpen(page), false, "the native panel closed");
    });

    await step("focus opens at once for keyboard users", async () => {
      await page.locator(TRIGGER).focus();
      await waitReadout(page, "true");
      assert.equal(await nativeOpen(page), true, "focus skips the hover clock");
      await page.locator(TRIGGER).blur();
      await waitReadout(page, "false");
    });

    await step("imperative commands reach the native methods", async () => {
      await page.getByRole("button", { name: "el.show()" }).click();
      await waitReadout(page, "true");
      assert.equal(await nativeOpen(page), true, "show opens the native panel");
      await page.keyboard.press("Escape");
      await waitReadout(page, "false");
      assert.equal(await nativeOpen(page), false, "Escape dismisses through the platform");
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

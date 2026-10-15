/**
 * spin-tooltip e2e: the hover-delay and anchor actions behind the same
 * app-controller handle as a machine.
 *
 * Builds the specimens app, serves dist, drives real Chromium via Playwright.
 * The route binds a platform-owned tooltip through `{ commands, state, bind }`;
 * this suite exercises the dwell open, the leave close, the immediate focus
 * open, the anchored position, and the imperative commands, with the host
 * readout following throughout.
 */

import { join } from "node:path";
import { strict as assert } from "node:assert";
import { chromium, type Browser, type Page } from "npm:playwright-core";

const ROOT = join(import.meta.dirname as string, "..", "..", "..");
const SPECIMENS = "packages/components/specimens";
const PORT = 5232;
const PAGE_URL = `http://127.0.0.1:${PORT}/tooltip`;

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
const READOUT = "#tooltip-open";
const TRIGGER = "#demo-tooltip button";
const nativeOpen = (page: Page): Promise<boolean> =>
  page.evaluate(() => document.querySelector("#demo-tooltip [popover]")?.matches(":popover-open") ?? false);

const readout = (page: Page): Promise<boolean> =>
  page.waitForFunction(
    () => document.querySelector("#tooltip-open")?.textContent === "true",
    undefined,
    { timeout: 5000 },
  ).then(() => true);
Deno.test("spin-tooltip e2e", async () => {
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
      await page.waitForSelector("#demo-tooltip button", { timeout: 5000 });
    });

    await step("dwell opens the anchored panel", async () => {
      assert.equal(await page.locator(READOUT).textContent(), "false");
      await page.locator(TRIGGER).hover();
      assert.equal(await nativeOpen(page), false, "no instant open: the dwell owns the timing");
      await page.waitForFunction(
        () => document.querySelector("#tooltip-open")?.textContent === "true",
        undefined,
        { timeout: 5000 },
      );
      assert.equal(await nativeOpen(page), true, "the native panel is open after the dwell");
      const geometry = await page.evaluate(() => {
        const panel = document.querySelector("#demo-tooltip [popover]") as HTMLElement;
        const trigger = document.querySelector("#demo-tooltip button") as HTMLElement;
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

    await step("leaving closes after the delay", async () => {
      await page.mouse.move(1200, 800);
      await page.waitForFunction(
        () => document.querySelector("#tooltip-open")?.textContent === "false",
        undefined,
        { timeout: 5000 },
      );
      assert.equal(await nativeOpen(page), false, "the native panel closed");
    });

    await step("focus opens at once for keyboard users", async () => {
      await page.locator(TRIGGER).focus();
      await readout(page);
      assert.equal(await nativeOpen(page), true, "focus skips the hover clock");
      assert.equal(
        await page.locator(TRIGGER).getAttribute("aria-describedby"),
        "demo-tooltip:panel",
        "the trigger names its description",
      );
      await page.locator(TRIGGER).blur();
      await page.waitForFunction(
        () => document.querySelector("#tooltip-open")?.textContent === "false",
        undefined,
        { timeout: 5000 },
      );
    });

    await step("imperative commands reach the native methods", async () => {
      await page.getByRole("button", { name: "el.show()" }).click();
      await readout(page);
      assert.equal(await nativeOpen(page), true, "show opens the native panel");
      await page.keyboard.press("Escape");
      await page.waitForFunction(
        () => document.querySelector("#tooltip-open")?.textContent === "false",
        undefined,
        { timeout: 5000 },
      );
      assert.equal(await nativeOpen(page), false, "Escape dismisses through the platform");
      await page.getByRole("button", { name: "el.hide()" }).click();
      assert.equal(await nativeOpen(page), false, "hide on a closed panel is a no-op");
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

/**
 * spin-popover e2e: the platform tier behind the same app-controller
 * handle as a machine.
 *
 * Builds the specimens app, serves dist, drives real Chromium via Playwright.
 * The proof route binds a machine-owned toast and a platform-owned popover
 * through identical `{ commands, state, bind }` code; this suite exercises
 * both halves: the popover's native open/Escape/imperative paths with the
 * host readout following, and the toast's create/dismiss through the same
 * handle shape.
 */

import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { strict as assert } from "node:assert";
import { chromium, type Browser, type Page } from "npm:playwright-core";

const ROOT = join(import.meta.dirname as string, "..", "..", "..");
const SPECIMENS = "packages/components/specimens";
const PORT = 5224;
const PAGE_URL = `http://127.0.0.1:${PORT}/popover`;

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
    await delay(200);
  }
  server.kill();
  throw new Error(`preview server never answered on ${PORT}`);
}

const READOUT = "#popover-open";
const TOASTS = "#popover-toasts";

Deno.test("spin-popover e2e", async () => {
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
      await page.waitForSelector("spin-popover button", { timeout: 5000 });
    });

    await step("the trigger opens the native popover", async () => {
      assert.equal(await page.locator(READOUT).textContent(), "false");
      await page.getByRole("button", { name: "Open popover" }).click();
      await page.waitForFunction(
        () => document.querySelector("#popover-open")?.textContent === "true",
        undefined,
        { timeout: 5000 },
      );
      assert.equal(await page.locator(READOUT).textContent(), "true", "the host readout follows the platform");
      const open = await page.evaluate(() =>
        document.querySelector("spin-popover [popover]")?.matches(":popover-open") ?? false
      );
      assert.equal(open, true, "the native popover is open");
    });

    await step("Escape dismisses through the platform", async () => {
      await page.keyboard.press("Escape");
      await page.waitForFunction(
        () => document.querySelector("#popover-open")?.textContent === "false",
        undefined,
        { timeout: 5000 },
      );
      assert.equal(await page.locator(READOUT).textContent(), "false", "the toggle event reported the close");
    });

    await step("imperative commands reach the native methods", async () => {
      await page.getByRole("button", { name: "el.show()" }).click();
      await page.waitForFunction(
        () => document.querySelector("#popover-open")?.textContent === "true",
        undefined,
        { timeout: 5000 },
      );
      await page.getByRole("button", { name: "el.hide()" }).click();
      await page.waitForFunction(
        () => document.querySelector("#popover-open")?.textContent === "false",
        undefined,
        { timeout: 5000 },
      );
      // A toggle click while open would race light-dismiss (the button's
      // own pointerdown dismisses before the click toggles back open), so
      // the close direction is established with hide() first: toggle from
      // a known closed state opens deterministically.
      await page.getByRole("button", { name: "el.hide()" }).click();
      await page.waitForFunction(
        () => document.querySelector("#popover-open")?.textContent === "false",
        undefined,
        { timeout: 5000 },
      );
      await page.getByRole("button", { name: "el.toggle()" }).click();
      await page.waitForFunction(
        () => document.querySelector("#popover-open")?.textContent === "true",
        undefined,
        { timeout: 5000 },
      );
      await page.getByRole("button", { name: "el.hide()" }).click();
      await page.waitForFunction(
        () => document.querySelector("#popover-open")?.textContent === "false",
        undefined,
        { timeout: 5000 },
      );
    });

    await step("the machine half answers the same handle", async () => {
      await page.getByRole("button", { name: "el.create({...})" }).click();
      assert.equal(await page.locator(TOASTS).textContent(), "1", "create through the ctl shows one toast");
      await page.getByRole("button", { name: "el.dismissAll()" }).click();
      // Dismissed rows leave on the remove delay; the region empties after.
      await page.waitForFunction(
        () => document.querySelector("#popover-toasts")?.textContent === "0",
        undefined,
        { timeout: 8000 },
      );
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

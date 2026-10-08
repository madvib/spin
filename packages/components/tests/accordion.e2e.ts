/**
 * E2E: spin-accordion renders and toggles in a real browser.
 *
 * Run explicitly (not in default `deno task test`):
 *   cd packages/components && deno task e2e
 *
 * Builds the demo, serves dist, drives real Chromium via Playwright.
 * Requires the Playwright browser once: `bunx playwright install chromium`.
 * Fails loud naming the step; silent on success.
 */

import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { strict as assert } from "node:assert";
import { chromium, type Browser } from "npm:playwright-core";

const ROOT = join(import.meta.dirname as string, "..", "..", "..");
const DEMO = "packages/components/demo";
const PORT = 5199;
const URL = `http://127.0.0.1:${PORT}/spin-accordion.html`;

/** Runs a named step, rethrowing any failure prefixed with the step name. */
async function step<T>(name: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    throw new Error(`[${name}] ${(error as Error).message}`, { cause: error });
  }
}

/** Builds the demo from a clean checkout — the stranger's first step. */
async function buildDemo(): Promise<void> {
  const cmd = new Deno.Command("node", {
    args: [join(ROOT, "node_modules/vite/bin/vite.js"), "build", DEMO],
    cwd: ROOT,
    stdout: "piped",
    stderr: "piped",
  });
  const { code, stderr } = await cmd.output();
  assert.equal(
    code,
    0,
    `vite build failed:\n${new TextDecoder().decode(stderr)}`,
  );
}

/** Serves the built dist on a fixed port and waits until it answers. */
async function startServer(): Promise<Deno.ChildProcess> {
  const cmd = new Deno.Command("node", {
    args: [
      join(ROOT, "node_modules/vite/bin/vite.js"),
      "preview",
      DEMO,
      "--port",
      String(PORT),
      "--strictPort",
    ],
    cwd: ROOT,
    stdout: "piped",
    stderr: "piped",
  });
  const child = cmd.spawn();
  for (let i = 0; i < 50; i++) {
    try {
      if ((await fetch(URL)).ok) return child;
    } catch {
      // server not ready yet
    }
    await delay(100);
  }
  const stderr = new TextDecoder().decode(
    await new Response(child.stderr).arrayBuffer(),
  );
  try {
    child.kill();
  } catch {
    // already exited
  }
  throw new Error(`vite preview did not start on :${PORT}\n${stderr}`);
}

Deno.test("spin-accordion e2e", async () => {
  await step("build", buildDemo);
  const server = await step("serve", startServer);
  const pageErrors: string[] = [];
  let browser: Browser | undefined;

  try {
    browser = await step("launch chromium", () =>
      chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] }));

    const page = await browser.newPage();
    page.on("pageerror", (err) => pageErrors.push(err.message));

    await step("load page", async () => {
      await page.goto(URL, { waitUntil: "load" });
      await page.waitForSelector('spin-accordion [data-part="item"]', {
        timeout: 5000,
      });
    });

    const items = page.locator('spin-accordion [data-part="item"]');
    const triggers = page.locator('spin-accordion [data-part="item-trigger"]');

    await step("renders two labelled items", async () => {
      assert.equal(await items.count(), 2, "expected 2 accordion items");
      assert.equal(
        await triggers.nth(0).locator("span").first().textContent(),
        "First",
        "first item label should be 'First'",
      );
      assert.equal(
        await triggers.nth(1).locator("span").first().textContent(),
        "Second",
        "second item label should be 'Second'",
      );
    });

    await step("starts closed,closed", async () => {
      assert.deepEqual(
        await items.evaluateAll((els) =>
          els.map((el) => el.getAttribute("data-state"))
        ),
        ["closed", "closed"],
        "initial data-state should be closed,closed",
      );
    });

    await step("click second trigger", async () => {
      await triggers.nth(1).click();
    });

    await step("swaps to closed,open", async () => {
      assert.deepEqual(
        await items.evaluateAll((els) =>
          els.map((el) => el.getAttribute("data-state"))
        ),
        ["closed", "open"],
        "after click data-state should be closed,open",
      );
    });

    await step("no page errors", async () => {
      assert.deepEqual(
        pageErrors,
        [],
        `page errors detected: ${pageErrors.join(", ")}`,
      );
    });
  } finally {
    if (browser) await browser.close();
    try {
      server.kill();
    } catch {
      // server already exited
    }
  }
});

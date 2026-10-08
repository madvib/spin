/**
 * E2E: spin-accordion appended rows toggle in a real browser.
 *
 * Run explicitly (not in default `deno task test`):
 *   cd packages/components && deno task e2e:append
 *
 * Builds the specimens app, serves dist, drives real Chromium via Playwright.
 * Requires the Playwright browser once: `bunx playwright install chromium`.
 * Fails loud naming the step; silent on success.
 */

import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { strict as assert } from "node:assert";
import { chromium, type Browser } from "npm:playwright-core";

const ROOT = join(import.meta.dirname as string, "..", "..", "..");
const SPECIMENS = "packages/components/specimens";
const PORT = 5201;
const URL = `http://127.0.0.1:${PORT}/accordion`;

/** Runs a named step, rethrowing any failure prefixed with the step name. */
async function step<T>(name: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    throw new Error(`[${name}] ${(error as Error).message}`, { cause: error });
  }
}

/** Builds the specimens app from a clean checkout. */
async function buildSpecimens(): Promise<void> {
  const cmd = new Deno.Command("node", {
    args: [join(ROOT, "node_modules/vite/bin/vite.js"), "build", SPECIMENS],
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

Deno.test("spin-accordion append e2e", async () => {
  await step("build", buildSpecimens);
  const server = await step("serve", startServer);
  const pageErrors: string[] = [];
  let browser: Browser | undefined;

  try {
    browser = await step("launch chromium", () =>
      chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] }));

    const page = await browser.newPage();
    page.on("pageerror", (err) => pageErrors.push(err.message));

    await step("load page", async () => {
      // Try deep-link first; fall back to navigating home and clicking the link.
      try {
        await page.goto(URL, { waitUntil: "load" });
        await page.waitForSelector('spin-accordion [data-part="item"]', {
          timeout: 3000,
        });
      } catch {
        await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: "load" });
        await page.click('a[href="/accordion"]');
        await page.waitForSelector('spin-accordion [data-part="item"]', {
          timeout: 5000,
        });
      }
    });

    const items = page.locator('spin-accordion [data-part="item"]');
    const triggers = page.locator('spin-accordion [data-part="item-trigger"]');

    await step("renders three base items", async () => {
      assert.equal(await items.count(), 3, "expected 3 base accordion items");
    });

    await step("starts all closed", async () => {
      assert.deepEqual(
        await items.evaluateAll((els) =>
          els.map((el) => el.getAttribute("data-state"))
        ),
        ["closed", "closed", "closed"],
        "initial data-state should be all closed",
      );
    });

    // Positive control: pre-append toggle works (catches base path regressions).
    await step("click first trigger (positive control)", async () => {
      await triggers.nth(0).click();
    });

    await step("first item opens", async () => {
      assert.deepEqual(
        await items.evaluateAll((els) =>
          els.map((el) => el.getAttribute("data-state"))
        ),
        ["open", "closed", "closed"],
        "after click data-state should be open,closed,closed",
      );
    });

    // Close it back to have a clean state before appending.
    await step("click first trigger again to close", async () => {
      await triggers.nth(0).click();
    });

    await step("first item closes again", async () => {
      assert.deepEqual(
        await items.evaluateAll((els) =>
          els.map((el) => el.getAttribute("data-state"))
        ),
        ["closed", "closed", "closed"],
        "after second click data-state should be all closed again",
      );
    });

    await step("click Append item", async () => {
      await page.click('button:has-text("Append item")');
    });

    await step("renders four items after append", async () => {
      assert.equal(
        await items.count(),
        4,
        "expected 4 accordion items after append",
      );
    });

    await step("appended item starts closed", async () => {
      assert.deepEqual(
        await items.evaluateAll((els) =>
          els.map((el) => el.getAttribute("data-state"))
        ),
        ["closed", "closed", "closed", "closed"],
        "appended item should start closed",
      );
    });

    // Focus-first per Zag design: focus the trigger, then real-click it.
    await step("focus and click appended trigger", async () => {
      await triggers.nth(3).focus();
      await triggers.nth(3).click();
    });

    await step("appended item opens", async () => {
      assert.deepEqual(
        await items.evaluateAll((els) =>
          els.map((el) => el.getAttribute("data-state"))
        ),
        ["closed", "closed", "closed", "open"],
        "appended item should be open after focus+click",
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

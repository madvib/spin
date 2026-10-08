/**
 * E2E: spin-popover's `open` property drives the machine in a real browser.
 *
 * Run explicitly (not in default `deno task test`):
 *   cd packages/components && deno task e2e:popover
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
const PORT = 5200;
const URL = `http://127.0.0.1:${PORT}/spin-popover.html`;

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

Deno.test("spin-popover e2e", async () => {
  await step("build", buildDemo);
  const server = await step("serve", startServer);
  const pageErrors: string[] = [];
  let browser: Browser | undefined;

  try {
    browser = await step("launch chromium", () =>
      chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] }));

    const page = await browser.newPage();
    page.on("pageerror", (err) => pageErrors.push(err.message));

    // One selector across every assertion, so the content part stays in lockstep.
    const stateOf = (id: string) =>
      page.locator(`#${id} [data-part="content"]`).getAttribute("data-state");

    await step("load page", async () => {
      await page.goto(URL, { waitUntil: "load" });
      await page.waitForSelector('#controlled [data-part="content"]', {
        state: "attached",
        timeout: 5000,
      });
    });

    await step("renders both popovers closed", async () => {
      assert.equal(
        await stateOf("controlled"),
        "closed",
        "controlled popover should start closed",
      );
      assert.equal(
        await stateOf("uncontrolled"),
        "closed",
        "uncontrolled popover should start closed",
      );
      assert.equal(
        await page.locator('#controlled [data-part="content"]').isHidden(),
        true,
        "controlled content should start hidden",
      );
      assert.equal(
        await page.locator('#uncontrolled [data-part="content"]').isHidden(),
        true,
        "uncontrolled content should start hidden",
      );
    });

    await step("writing the open property opens the controlled popover", async () => {
      await page.evaluate(() => {
        // The component declares a live `open` property on the element.
        const el = document.getElementById("controlled") as
          | (HTMLElement & { open: boolean })
          | null;
        if (el) el.open = true;
      });
      await page.waitForSelector(
        '#controlled [data-part="content"][data-state="open"]',
        { state: "attached", timeout: 2000 },
      );
      assert.equal(
        await stateOf("controlled"),
        "open",
        "controlled popover should be open",
      );
      assert.equal(
        await page.locator('#controlled [data-part="content"]').isHidden(),
        false,
        "open content should be visible",
      );
    });

    await step("writing the open property closes it again", async () => {
      await page.evaluate(() => {
        // The component declares a live `open` property on the element.
        const el = document.getElementById("controlled") as
          | (HTMLElement & { open: boolean })
          | null;
        if (el) el.open = false;
      });
      await page.waitForSelector(
        '#controlled [data-part="content"][data-state="closed"]',
        { state: "attached", timeout: 2000 },
      );
      assert.equal(
        await stateOf("controlled"),
        "closed",
        "controlled popover should be closed again",
      );
      assert.equal(
        await page.locator('#controlled [data-part="content"]').isHidden(),
        true,
        "closed content should be hidden again",
      );
    });

    await step("clicking the trigger opens the uncontrolled popover", async () => {
      await page.locator('#uncontrolled [data-part="trigger"]').click();
      await page.waitForSelector(
        '#uncontrolled [data-part="content"][data-state="open"]',
        { state: "attached", timeout: 2000 },
      );
      assert.equal(
        await stateOf("uncontrolled"),
        "open",
        "uncontrolled popover should be open after a trigger click",
      );
      assert.equal(
        await page.locator('#uncontrolled [data-part="content"]').isHidden(),
        false,
        "uncontrolled content should be visible after a trigger click",
      );
    });

    await step("clicking the close trigger closes it", async () => {
      await page.locator('#uncontrolled [data-part="close-trigger"]').click();
      await page.waitForSelector(
        '#uncontrolled [data-part="content"][data-state="closed"]',
        { state: "attached", timeout: 2000 },
      );
      assert.equal(
        await stateOf("uncontrolled"),
        "closed",
        "uncontrolled popover should be closed after the close trigger",
      );
      assert.equal(
        await page.locator('#uncontrolled [data-part="content"]').isHidden(),
        true,
        "uncontrolled content should be hidden after the close trigger",
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

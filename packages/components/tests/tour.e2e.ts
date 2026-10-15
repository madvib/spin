/**
 * spin-tour e2e: the inactive and running modes with the three phases,
 * behind the app-controller handle.
 *
 * Builds the specimens app, serves dist, drives real Chromium via Playwright.
 * The route binds a machine-owned tour through `{ commands, state, bind }`;
 * this suite exercises the start (resolve, scroll, activate), the step
 * navigation with the spotlight moving to each target, the dismiss
 * through the overlay, and the complete at the last step.
 */

import { join } from "node:path";
import { strict as assert } from "node:assert";
import { chromium, type Browser, type Page } from "npm:playwright-core";

const ROOT = join(import.meta.dirname as string, "..", "..", "..");
const SPECIMENS = "packages/components/specimens";
const PORT = 5239;
const PAGE_URL = `http://127.0.0.1:${PORT}/tour`;

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


const overlay = (page: Page): Promise<{ state: string | null; title: string; spot: string }> =>
  page.evaluate(() => {
    const dialog = document.querySelector("#tour [role='dialog']");
    const spot = document.querySelector("#tour [id$=':spotlight']");
    return {
      state: dialog?.getAttribute("data-state") ?? null,
      title: dialog?.querySelector("span")?.textContent ?? "",
      spot: spot?.getAttribute("style") ?? "",
    };
  });

/** Clicks one of the tour's overlay buttons by its id suffix. */
const clickOverlay = (page: Page, suffix: string): Promise<void> =>
  page.evaluate((id) => {
    document.querySelector(`#tour [id$=':${id}']`)?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  }, suffix).then(() => undefined);

Deno.test("spin-tour e2e", async () => {
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
      await page.waitForSelector("#tour-one", { timeout: 30000 });
      const start = await overlay(page);
      assert.equal(start.state, "closed", "the tour starts inactive");
      assert.equal(await page.locator("#tour-state").textContent(), "inactive", "and reports inactive");
    });

    await step("starting resolves, scrolls, and activates the first step", async () => {
      await page.getByRole("button", { name: "el.start()" }).click();
      await page.waitForFunction(
        () => document.querySelector("#tour [role='dialog']")?.getAttribute("data-state") === "open",
        undefined,
        { timeout: 8000 },
      );
      const first = await overlay(page);
      assert.equal(first.title, "First stop", "the first step's title shows");
      assert.equal(
        await page.locator("#tour-state").textContent(),
        "greet",
        "step-change carries the id",
      );
      // The spotlight frames the first target padded by 8: measured against
      // the live target, not hardcoded, so demo layout can move.
      const spot = await page.evaluate(() => {
        const style = document.querySelector("#tour [id$=':spotlight']")?.getAttribute("style") ?? "";
        const x = style.match(/--tour-x:\s*([\d.]+)px/);
        const w = style.match(/--tour-w:\s*([\d.]+)px/);
        const target = document.querySelector("#tour-one")?.getBoundingClientRect();
        return {
          x: x === null ? null : Number(x[1]),
          w: w === null ? null : Number(w[1]),
          left: target === undefined ? null : Math.round(target.left),
          width: target === undefined ? null : Math.round(target.width),
        };
      });
      assert.equal(spot.x, (spot.left ?? 0) - 8, "the spotlight's x is the target's left minus the padding");
      assert.equal(spot.w, (spot.width ?? 0) + 16, "and its width is the target's width plus the padding");
    });

    await step("next advances and re-frames the second target", async () => {
      await clickOverlay(page, "next");
      await page.waitForFunction(
        () => document.querySelector("#tour [role='dialog'] span")?.textContent === "Second stop",
        undefined,
        { timeout: 8000 },
      );
      await page.waitForFunction(
        () => document.querySelector("#tour [role='dialog']")?.getAttribute("data-state") === "open",
        undefined,
        { timeout: 8000 },
      );
      const spot = await page.evaluate(() => {
        const style = document.querySelector("#tour [id$=':spotlight']")?.getAttribute("style") ?? "";
        const x = style.match(/--tour-x:\s*([\d.]+)px/);
        const target = document.querySelector("#tour-two")?.getBoundingClientRect();
        return {
          x: x === null ? null : Number(x[1]),
          left: target === undefined ? null : Math.round(target.left),
        };
      });
      assert.equal(spot.x, (spot.left ?? 0) - 8, "the spotlight moved to the second target");
      assert.equal(await page.locator("#tour-state").textContent(), "second", "the channel carries the new id");
    });

    await step("prev returns to the first step", async () => {
      await clickOverlay(page, "prev");
      await page.waitForFunction(
        () => document.querySelector("#tour [role='dialog'] span")?.textContent === "First stop",
        undefined,
        { timeout: 8000 },
      );
      assert.equal(await page.locator("#tour-state").textContent(), "greet", "and back to the first id");
    });

    await step("skip ends the tour", async () => {
      await clickOverlay(page, "skip");
      await page.waitForFunction(
        () => document.querySelector("#tour [role='dialog']")?.getAttribute("data-state") === "closed",
        undefined,
        { timeout: 8000 },
      );
      assert.equal(await page.locator("#tour-state").textContent(), "skip", "the skip reason reports");
    });

    await step("the last step's dismiss completes", async () => {
      await page.getByRole("button", { name: "el.start()" }).click();
      await page.waitForFunction(
        () => document.querySelector("#tour [role='dialog']")?.getAttribute("data-state") === "open",
        undefined,
        { timeout: 8000 },
      );
      await clickOverlay(page, "next");
      await page.waitForFunction(
        () => document.querySelector("#tour [role='dialog'] span")?.textContent === "Second stop",
        undefined,
        { timeout: 8000 },
      );
      await page.waitForFunction(
        () => document.querySelector("#tour [role='dialog']")?.getAttribute("data-state") === "open",
        undefined,
        { timeout: 8000 },
      );
      await clickOverlay(page, "dismiss");
      await page.waitForFunction(
        () => document.querySelector("#tour [role='dialog']")?.getAttribute("data-state") === "closed",
        undefined,
        { timeout: 8000 },
      );
      assert.equal(
        await page.locator("#tour-state").textContent(),
        "complete",
        "the last dismiss completes",
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

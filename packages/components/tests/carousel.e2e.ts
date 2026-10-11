/**
 * E2E: spin-carousel renders and pages in a real browser.
 *
 * Run explicitly (not in default `deno task test`):
 *   cd packages/components && deno task e2e:carousel
 *
 * Builds the specimens app, serves dist, drives real Chromium via
 * Playwright. Requires the Playwright browser once:
 * `bunx playwright install chromium`. Fails loud naming the step; silent
 * on success.
 */

import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { strict as assert } from "node:assert";
import { chromium, type Browser, type Page } from "npm:playwright-core";

const ROOT = join(import.meta.dirname as string, "..", "..", "..");
const SPECIMENS = "packages/components/specimens";
const PORT = 5204;
const URL = `http://127.0.0.1:${PORT}/carousel`;

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

/** The specimen's readout of the machine's index. */
const indexOf = async (page: Page): Promise<string> =>
  (await page.locator("#carousel-index").textContent()) ?? "";

Deno.test("spin-carousel e2e", async () => {
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
      await page.waitForSelector('spin-carousel [aria-roledescription="carousel"]', {
        timeout: 5000,
      });
    });

    const region = page.locator('spin-carousel [aria-roledescription="carousel"]');
    const track = page.locator('spin-carousel [id$=":item-group"]');
    const items = page.locator('spin-carousel [id$=":item-group"] > [data-index]');
    const indicators = page.locator('spin-carousel [aria-label="Slides"] > button');
    const prev = page.locator('spin-carousel button[aria-label="Previous slide"]');
    const next = page.locator('spin-carousel button[aria-label="Next slide"]');
    const autoplayTrigger = page.locator('spin-carousel button[aria-label="Start slide rotation"]');

    await step("renders the carousel contract", async () => {
      assert.equal(await region.getAttribute("role"), "region");
      assert.equal(await items.count(), 5, "expected 5 slides");
      assert.equal(await indicators.count(), 5, "expected 5 indicators");
      assert.equal(
        await track.getAttribute("tabindex"),
        "0",
        "the track is the keyboard surface",
      );
      assert.equal(
        await page.locator('spin-carousel [id$=":progress-text"]').textContent(),
        "1 / 5",
        "progress text reads page one of five",
      );
    });

    await step("starts on the first page, first slide in view", async () => {
      assert.equal(await indexOf(page), "0");
      assert.equal(
        await items.nth(0).getAttribute("data-inview"),
        "",
        "the first slide reports in view",
      );
      assert.equal(
        await items.nth(1).getAttribute("data-inview"),
        null,
        "the second slide does not",
      );
      assert.equal(
        await indicators.nth(0).getAttribute("data-current"),
        "",
        "the first indicator is current",
      );
      assert.equal(await prev.isDisabled(), true, "prev holds on the first page");
      assert.equal(await next.isDisabled(), false, "next is live");
    });

    await step("clicking next pages forward", async () => {
      await next.click();
      assert.equal(await indexOf(page), "1");
      assert.equal(await indicators.nth(1).getAttribute("data-current"), "");
      assert.equal(
        await page.locator('spin-carousel [id$=":progress-text"]').textContent(),
        "2 / 5",
      );
    });

    await step("clicking prev pages back", async () => {
      await prev.click();
      assert.equal(await indexOf(page), "0");
      assert.equal(await prev.isDisabled(), true, "prev holds again on the first page");
    });

    await step("clicking an indicator jumps to its page", async () => {
      await indicators.nth(3).click();
      assert.equal(await indexOf(page), "3");
      assert.equal(await indicators.nth(3).getAttribute("data-current"), "");
      assert.equal(await items.nth(3).getAttribute("data-inview"), "");
    });

    await step("the el.goTo command jumps to the last page", async () => {
      await page.click("#carousel-goto");
      assert.equal(await indexOf(page), "4");
      assert.equal(await next.isDisabled(), true, "next holds on the last page");
    });

    await step("the el.next command wraps when loop is on", async () => {
      await page.click("#carousel-loop");
      await page.click("#carousel-next");
      assert.equal(await indexOf(page), "0");
    });

    await step("arrow keys page the track", async () => {
      await track.focus();
      await page.keyboard.press("ArrowRight");
      assert.equal(await indexOf(page), "1");
      await page.keyboard.press("ArrowLeft");
      assert.equal(await indexOf(page), "0");
      await page.keyboard.press("End");
      assert.equal(await indexOf(page), "4");
      await page.keyboard.press("Home");
      assert.equal(await indexOf(page), "0");
    });

    await step("a mouse drag pages the track", async () => {
      await page.click("#carousel-drag");
      const box = await track.boundingBox();
      if (!box) throw new Error("the track has no box");
      const y = box.y + box.height / 2;
      await step("press and pull", async () => {
        await page.mouse.move(box.x + box.width * 0.8, y);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width * 0.2, y, { steps: 12 });
        await page.mouse.up();
      });
      await step("the drag moved the page", async () => {
        assert.notEqual(await track.evaluate((el) => el.scrollLeft), 0);
      });
      assert.equal(await indexOf(page), "1");
    });

    await step("autoplay advances and stops on a press", async () => {
      await page.click("#carousel-play");
      assert.equal(
        await page.locator("#carousel-rotation").textContent(),
        "playing",
        "the rotation reports playing",
      );
      await page.waitForFunction(
        () => document.querySelector("#carousel-index")?.textContent === "1",
        undefined,
        { timeout: 6000 },
      );
      await track.click();
      assert.equal(
        await page.locator("#carousel-rotation").textContent(),
        "stopped",
        "a press stops the rotation",
      );
      const held = await indexOf(page);
      await delay(3000);
      assert.equal(await indexOf(page), held, "no page moved while stopped");
    });

    await step("no page errors", async () => {
      assert.deepEqual(pageErrors, [], `page errors detected: ${pageErrors.join(", ")}`);
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

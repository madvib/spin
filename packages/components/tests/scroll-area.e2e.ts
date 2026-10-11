/**
 * E2E: the forked-FSM scroll area drives its machine in a real browser — the
 * layout readings, the two bars and the corner, the wheel/track/drag pointer
 * paths, the api commands, and independent instances.
 *
 * Run explicitly (not in default `deno task test`):
 *   cd packages/components && deno test -A tests/scroll-area.e2e.ts
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
const PORT = 5227;
const URL = `http://127.0.0.1:${PORT}/scroll-area-fsm`;

/** The parts, addressed by the element's id: `scroll-area:<id>:<part>`. */
const BOTH_ROOT = '[id="scroll-area:both"]';
const BOTH_VIEWPORT = '[id="scroll-area:both:viewport"]';
const BOTH_BAR_Y = '[id="scroll-area:both:scrollbar-y"]';
const BOTH_BAR_X = '[id="scroll-area:both:scrollbar-x"]';
const BOTH_THUMB_Y = '[id="scroll-area:both:thumb-y"]';
const BOTH_CORNER = '[id="scroll-area:both:corner"]';
const VERTICAL_ROOT = '[id="scroll-area:vertical"]';
const VERTICAL_VIEWPORT = '[id="scroll-area:vertical:viewport"]';
const VERTICAL_BAR_X = '[id="scroll-area:vertical:scrollbar-x"]';

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

/** The horizontal scroll offset, as the browser reports it (RTL flips sign). */
const scrollLeftNow = (page: Page, selector: string): Promise<number> =>
  page.locator(selector).evaluate((node) => Math.abs((node as HTMLElement).scrollLeft));

Deno.test("spin-scroll-area-fsm e2e", async () => {
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
      await page.waitForSelector(BOTH_VIEWPORT, { state: "attached", timeout: 5000 });
      // The first measurement arrives with the observers' first callback.
      await page.waitForSelector(`${BOTH_VIEWPORT}[data-overflow-y]`, { timeout: 5000 });
    });

    await step("the layout reading paints both bars and the corner", async () => {
      assert.equal(await page.locator(BOTH_ROOT).getAttribute("role"), "presentation", "the root is presentational");
      assert.equal(await page.locator(BOTH_VIEWPORT).getAttribute("role"), "presentation", "and so is the viewport");
      assert.equal(
        await page.locator(BOTH_VIEWPORT).getAttribute("tabindex"),
        "0",
        "a box with overflow is a tab stop",
      );
      assert.equal(
        await page.locator(BOTH_VIEWPORT).getAttribute("data-overflow-x"),
        "",
        "the reading reports the horizontal overflow",
      );
      assert.equal(
        await page.locator(BOTH_VIEWPORT).getAttribute("data-overflow-y"),
        "",
        "and the vertical",
      );
      assert.equal(
        await page.locator(BOTH_VIEWPORT).getAttribute("data-at-top"),
        "",
        "the box starts at the top edge",
      );
      assert.equal(
        await page.locator(BOTH_VIEWPORT).getAttribute("data-at-bottom"),
        null,
        "and not at the bottom",
      );
      assert.equal(
        await page.locator(BOTH_VIEWPORT).getAttribute("data-at-left"),
        "",
        "nor at the left edge",
      );
      assert.equal(
        await page.locator(BOTH_VIEWPORT).getAttribute("data-at-right"),
        null,
        "and not at the right",
      );
      // Both bars exist for the axes that overflow, and only for those.
      assert.equal(await page.locator(BOTH_BAR_Y).isHidden(), false, "the vertical bar is painted");
      assert.equal(await page.locator(BOTH_BAR_X).isHidden(), false, "the horizontal bar is painted");
      const cornerSize = await page.locator(BOTH_CORNER).evaluate((node) => {
        const style = getComputedStyle(node);
        return { width: parseFloat(style.width), height: parseFloat(style.height) };
      });
      assert.ok(cornerSize.width > 0, `the corner has a width, got ${cornerSize.width}`);
      assert.ok(cornerSize.height > 0, `the corner has a height, got ${cornerSize.height}`);
      assert.equal(
        await page.locator(BOTH_CORNER).getAttribute("data-state"),
        "visible",
        "the corner reports itself visible",
      );
    });

    await step("the geometry channel carries the measured boxes", async () => {
      const rootVars = await page.locator(BOTH_ROOT).evaluate((node) => {
        const style = getComputedStyle(node);
        return {
          thumbWidth: parseFloat(style.getPropertyValue("--scroll-area-thumb-width")),
          thumbHeight: parseFloat(style.getPropertyValue("--scroll-area-thumb-height")),
          cornerWidth: parseFloat(style.getPropertyValue("--scroll-area-corner-width")),
        };
      });
      const viewport = await page.locator(BOTH_VIEWPORT).evaluate((node) => ({
        width: (node as HTMLElement).clientWidth,
        height: (node as HTMLElement).clientHeight,
        scrollHeight: (node as HTMLElement).scrollHeight,
        scrollWidth: (node as HTMLElement).scrollWidth,
      }));
      assert.ok(rootVars.thumbWidth >= 20, `the measured thumb width respects the minimum, got ${rootVars.thumbWidth}`);
      // A thumb is its track scaled by the visible fraction, and at least the
      // floor: 200px of box over 1000px of content would be 60px tall.
      assert.ok(
        rootVars.thumbHeight > 20 && rootVars.thumbHeight < viewport.height,
        `the thumb height is the box's fraction of the content, got ${rootVars.thumbHeight} of ${viewport.height}`,
      );
      assert.equal(rootVars.cornerWidth, 8, "the corner is one scrollbar wide");
      const overflow = await page.locator(BOTH_VIEWPORT).evaluate((node) => {
        const style = getComputedStyle(node);
        return {
          start: parseFloat(style.getPropertyValue("--scroll-area-overflow-y-start")),
          end: parseFloat(style.getPropertyValue("--scroll-area-overflow-y-end")),
        };
      });
      assert.equal(overflow.start, 0, "at the top the start distance is zero");
      assert.ok(
        overflow.end > 0,
        `and the end distance is what is left to scroll, got ${overflow.end}`,
      );
    });

    await step("a one-axis box hides the other bar", async () => {
      await page.waitForSelector(`${VERTICAL_VIEWPORT}[data-overflow-y]`, { timeout: 5000 });
      assert.equal(
        await page.locator(VERTICAL_VIEWPORT).getAttribute("data-overflow-x"),
        null,
        "a wide box has no horizontal overflow",
      );
      assert.equal(
        await page.locator(VERTICAL_BAR_X).isHidden(),
        true,
        "the horizontal bar is not there",
      );
      assert.equal(
        await page.locator(`${VERTICAL_ROOT} [id="scroll-area:vertical:scrollbar-y"]`).isHidden(),
        false,
        "the vertical bar is",
      );
      assert.equal(
        await page.locator(`${VERTICAL_ROOT} [id="scroll-area:vertical:corner"]`).getAttribute("data-state"),
        "hidden",
        "and one bar leaves no corner",
      );
      assert.equal(
        await page.locator(VERTICAL_VIEWPORT).getAttribute("tabindex"),
        "0",
        "a box that scrolls is still a tab stop",
      );
    });

    await step("hover lights the bars and leaving puts them out", async () => {
      await page.locator(BOTH_ROOT).hover();
      assert.equal(await page.locator(BOTH_BAR_Y).getAttribute("data-hover"), "", "the bar reports the hover");
      assert.equal(await page.locator(BOTH_BAR_X).getAttribute("data-hover"), "", "and so does the other bar");
      // The other instance is untouched: one root's pointer never reaches it.
      assert.equal(
        await page.locator(`${VERTICAL_BAR_X}`).getAttribute("data-hover"),
        null,
        "the other instance stays unlit",
      );
      await step("the hovered bar fades in", async () => {
        await page.waitForFunction(
          (selector) => getComputedStyle(document.querySelector(selector)!).opacity === "1",
          BOTH_BAR_Y,
          { timeout: 2000 },
        );
      });
      await page.mouse.move(0, 0);
      await page.waitForSelector(`${BOTH_BAR_Y}:not([data-hover])`, { timeout: 2000 });
      await step("the unlit bar fades out", async () => {
        await page.waitForFunction(
          (selector) => getComputedStyle(document.querySelector(selector)!).opacity === "0",
          BOTH_BAR_Y,
          { timeout: 2000 },
        );
      });
    });

    await step("the wheel over a bar scrolls the viewport", async () => {
      const before = await page.locator(BOTH_VIEWPORT).evaluate((node) => (node as HTMLElement).scrollTop);
      const box = await page.locator(BOTH_BAR_Y).boundingBox();
      assert.ok(box !== null, "the vertical bar has a box");
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.wheel(0, 300);
      await step("the bar reports the scroll", async () => {
        await page.waitForSelector(`${BOTH_BAR_Y}[data-scrolling]`, { timeout: 2000 });
      });
      const after = await page.locator(BOTH_VIEWPORT).evaluate((node) => (node as HTMLElement).scrollTop);
      assert.ok(after > before, `the wheel scrolled the box, ${before} → ${after}`);
      // The box is taller than one wheel notch reaches, so keep rolling
      // until the far edge reports itself.
      for (let i = 0; i < 6; i += 1) {
        if ((await page.locator(BOTH_VIEWPORT).getAttribute("data-at-bottom")) === "") break;
        await page.mouse.wheel(0, 300);
        await page.waitForTimeout(150);
      }
      assert.equal(
        await page.locator(BOTH_VIEWPORT).getAttribute("data-at-bottom"),
        "",
        "the far end is now the bottom edge",
      );
      assert.equal(
        await page.locator(BOTH_VIEWPORT).getAttribute("data-at-top"),
        null,
        "the top edge is behind it",
      );
      // The thumb rides the scroll through the geometry channel.
      const thumbOffset = await page.locator(BOTH_THUMB_Y).evaluate((node) =>
        parseFloat(getComputedStyle(node).getPropertyValue("--scroll-area-thumb-y"))
      );
      assert.ok(thumbOffset > 0, `the thumb's inset follows the scroll, got ${thumbOffset}`);
      await step("the dwell ends the scroll report", async () => {
        await page.waitForSelector(`${BOTH_BAR_Y}:not([data-scrolling])`, { timeout: 3000 });
      });
    });

    await step("a press on the track jumps the thumb there", async () => {
      await page.getByRole("button", { name: "scrollTo(0, 0)" }).click();
      await delay(600);
      const box = await page.locator(BOTH_BAR_Y).boundingBox();
      assert.ok(box !== null, "the vertical bar has a box");
      // Press near the bottom of the track, away from wherever the thumb is.
      await page.mouse.click(box.x + box.width / 2, box.y + box.height - 6);
      await delay(200);
      const after = await page.locator(BOTH_VIEWPORT).evaluate((node) => (node as HTMLElement).scrollTop);
      assert.ok(after > 0, `the track press scrolled the box, got ${after}`);
    });

    await step("a drag on the thumb scrubs the viewport", async () => {
      await page.getByRole("button", { name: "scrollTo(0, 0)" }).click();
      await delay(600);
      const thumb = await page.locator(BOTH_THUMB_Y).boundingBox();
      assert.ok(thumb !== null, "the thumb has a box");
      const bar = await page.locator(BOTH_BAR_Y).boundingBox();
      assert.ok(bar !== null, "the bar has a box");
      await page.mouse.move(thumb.x + thumb.width / 2, thumb.y + thumb.height / 2);
      await page.mouse.down();
      await page.mouse.move(thumb.x + thumb.width / 2, thumb.y + thumb.height / 2 + 60, { steps: 12 });
      assert.equal(
        await page.locator(BOTH_BAR_Y).getAttribute("data-dragging"),
        "",
        "the bar reports the drag",
      );
      const dragged = await page.locator(BOTH_VIEWPORT).evaluate((node) => (node as HTMLElement).scrollTop);
      assert.ok(dragged > 60, `the drag moved the box by the thumb's travel, got ${dragged}`);
      await page.mouse.up();
      assert.equal(
        await page.locator(BOTH_BAR_Y).getAttribute("data-dragging"),
        null,
        "the lift ends the drag",
      );
      await page.waitForSelector(`${BOTH_BAR_Y}:not([data-scrolling])`, { timeout: 3000 });
    });

    await step("the api commands drive the scroll", async () => {
      await page.getByRole("button", { name: "scrollToEdge(bottom)" }).click();
      await step("the box settles at the bottom", async () => {
        await page.waitForFunction(
          () => {
            const node = document.querySelector('[id="scroll-area:both:viewport"]') as HTMLElement | null;
            if (node === null) return false;
            return node.scrollTop >= node.scrollHeight - node.clientHeight - 2;
          },
          undefined,
          { timeout: 3000 },
        );
      });
      // The route polls the edges on a clock, so the readout trails the
      // box by a beat.
      await page.waitForFunction(
        () => document.querySelector("#both-bottom")?.textContent === "yes",
        undefined,
        { timeout: 3000 },
      );
      assert.equal(await page.locator("#both-bottom").textContent(), "yes", "the route reads the bottom edge");
      await page.getByRole("button", { name: "scrollToEdge(right)" }).click();
      await delay(900);
      assert.equal(
        await scrollLeftNow(page, BOTH_VIEWPORT) > 0,
        true,
        "the horizontal command reached the right edge",
      );
      await page.waitForFunction(
        () => document.querySelector("#both-right")?.textContent === "yes",
        undefined,
        { timeout: 3000 },
      );
      assert.equal(await page.locator("#both-right").textContent(), "yes", "the route reads the right edge");
      await page.getByRole("button", { name: "scrollTo(0, 0)" }).click();
      await delay(900);
      assert.equal(await page.locator("#both-top").textContent(), "yes", "the home command returns to the top");
      assert.equal(await page.locator("#both-x").textContent(), "0.00", "and the progress reports a settled axis");
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

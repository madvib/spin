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

import { strict as assert } from "node:assert";
import { runComponentSuite, step } from "./harness.ts";
import { type Page } from "npm:playwright-core";


const READOUT = "#panel-state";
const POSITIONER = "#panel [role='dialog']";
const TRIGGER = "#panel [id$=':trigger']";
const DRAG = "#panel [id$=':drag']";
const RESIZE_E = "#panel [id$=':resize:e']";
const STAGE_MIN = "#panel [id$=':stage:minimized']";
const STAGE_DEFAULT = "#panel [id$=':stage:default']";

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

Deno.test("spin-floating-panel e2e", () =>
  runComponentSuite({ port: 5236, route: "/floating-panel", ready: TRIGGER, timeoutMs: 30000 }, async ({ page }) => {
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

    await step("the stage triggers cycle minimized and restored", async () => {
      await page.locator(STAGE_MIN).click();
      assert.equal(await stage(page), "minimized", "the stage minimizes");
      assert.equal(await page.locator(READOUT).textContent(), "minimized", "and reports through the channel");
      await page.locator(STAGE_DEFAULT).click();
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
  }));

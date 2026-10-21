/**
 * E2E: the forked-FSM splitter splits in a real browser — handle drag
 * redistributes the percents, arrows nudge from the keyboard, Enter
 * collapses and re-expands, and the imperative commands drive the layout.
 */

import { strict as assert } from "node:assert";
import { runComponentSuite, step } from "./harness.ts";
import { type Page } from "npm:playwright-core";


/** Part ids are the machine's scheme: `splitter:<element id>:<part>`. */
const at = (id: string, part: string): string => `[id="splitter:${id}:${part}"]`;
const ROOT_ID = '[id="splitter:group"]';
const handle = (pair: string): string => `[id="splitter:group:handle:${pair}"]`;
const FIRST_HANDLE = handle("nav:main");

Deno.test("spin-splitter e2e", () =>
  runComponentSuite({ port: 5253, route: "/splitter", ready: ROOT_ID }, async ({ page }) => {
    const readout = page.locator("text=/sizes: [\\d, ]+/").first();

    await step("a handle drag redistributes", async () => {
      const box = await page.locator(FIRST_HANDLE).boundingBox();
      assert.ok(box !== null, "the handle has a box");
      const before = await readout.textContent();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + 60, box.y + box.height / 2, { steps: 5 });
      await page.mouse.up();
      await page.waitForTimeout(300);
      const after = await readout.textContent();
      assert.notEqual(after, before, "the drag moved the percents");
    });

    await step("arrows nudge the handle", async () => {
      await page.locator(FIRST_HANDLE).focus();
      const before = await readout.textContent() ?? "";
      await page.keyboard.press("ArrowRight");
      await page.waitForTimeout(300);
      const after = await readout.textContent() ?? "";
      assert.notEqual(after, before, "ArrowRight nudged the layout");
    });

    await step("Enter collapses and re-expands", async () => {
      // Enter collapses the panel BEFORE the focused handle.
      await page.locator(FIRST_HANDLE).focus();
      await page.keyboard.press("Enter");
      await page.waitForTimeout(300);
      const collapsed = await readout.textContent() ?? "";
      assert.match(collapsed, /^sizes: 0,/, "the nav panel collapsed to zero");
      await page.keyboard.press("Enter");
      await page.waitForTimeout(300);
      const expanded = await readout.textContent() ?? "";
      assert.ok(!expanded.startsWith("sizes: 0,"), "the nav panel re-expanded");
    });

    await step("commands drive the instance", async () => {
      await page.getByText("el.setSizes([30, 40, 30])").click();
      await page.waitForTimeout(300);
      assert.match(await readout.textContent() ?? "", /sizes: 30, 40, 30/, "setSizes committed");
      await page.getByText("el.resetSizes()").click();
      await page.waitForTimeout(300);
      assert.match(
        await readout.textContent() ?? "",
        /sizes: 33, 33, 33/,
        "resetSizes evened out",
      );
    });

  }));

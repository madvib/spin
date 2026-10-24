/**
 * E2E: the forked-FSM angle-slider turns in a real browser — dial press
 * jumps the value, arrows step from the keyboard, Home/End jump, and the
 * imperative commands drive the dial.
 */

import { strict as assert } from "node:assert";
import { runComponentSuite, step } from "./harness.ts";
import { type Page } from "npm:playwright-core";

/** Part ids are the machine's scheme: `angle-slider:<element id>:<part>`. */
const CONTROL = '[id="angle-slider:dial:control"]';
const THUMB = '[id="angle-slider:dial:thumb"]';

Deno.test("spin-angle-slider e2e", () =>
  runComponentSuite(
    { port: 5256, route: "/angle-slider", ready: CONTROL },
    async ({ page }) => {
      const readout = page.locator("text=/angle: \\d+deg/").first();

      await step("a dial press jumps the value", async () => {
        const box = await page.locator(CONTROL).boundingBox();
        assert.ok(box !== null, "the control has a box");
        // Right of center: ~90 degrees.
        await page.mouse.move(box.x + box.width - 10, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.up();
        await page.waitForTimeout(300);
        const text = await readout.textContent() ?? "";
        const value = Number(
          text.replace("angle:", "").replace("deg", "").trim(),
        );
        assert.ok(
          value >= 80 && value <= 100,
          `the press jumped near 90 (got ${value})`,
        );
      });

      await step("arrows step the thumb", async () => {
        await page.locator(THUMB).focus();
        const before = Number(
          (await readout.textContent() ?? "").replace("angle:", "").replace(
            "deg",
            "",
          ).trim(),
        );
        await page.keyboard.press("ArrowRight");
        await page.waitForTimeout(300);
        const after = Number(
          (await readout.textContent() ?? "").replace("angle:", "").replace(
            "deg",
            "",
          ).trim(),
        );
        assert.equal(after, before + 1, "ArrowRight stepped by one");
        assert.equal(
          await page.locator(THUMB).getAttribute("aria-valuenow"),
          String(after),
          "aria-valuenow tracks the value",
        );
      });

      await step("Home and End jump", async () => {
        await page.keyboard.press("End");
        await page.waitForTimeout(300);
        assert.match(
          await readout.textContent() ?? "",
          /angle: 359deg/,
          "End jumped to max",
        );
        await page.keyboard.press("Home");
        await page.waitForTimeout(300);
        assert.match(
          await readout.textContent() ?? "",
          /angle: 0deg/,
          "Home jumped to min",
        );
      });

      await step("commands drive the instance", async () => {
        await page.getByText("el.setValue(180)").click();
        await page.waitForTimeout(300);
        assert.match(
          await readout.textContent() ?? "",
          /angle: 180deg/,
          "setValue committed 180",
        );
      });
    },
  ));

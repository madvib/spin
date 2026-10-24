import { test } from "bun:test";
/**
 * E2E: the forked-FSM rating-group rates in a real browser — click to
 * commit, hover to preview, arrows/Home/End from the keyboard, and the
 * imperative commands.
 */

import { strict as assert } from "node:assert";
import { runComponentSuite, step } from "./harness.ts";
import { type Page } from "playwright-core";

/** Part ids are the machine's scheme: `rating-group:<element id>:<part>`. */
const at = (id: string, part: string): string =>
  `[id="rating-group:${id}:${part}"]`;
const CONTROL = at("stars", "control");
const item = (index: number): string =>
  `[id="rating-group:stars:item:${index}"]`;

test("spin-rating-group e2e", () =>
  runComponentSuite(
    { port: 5251, route: "/rating-group", ready: CONTROL },
    async ({ page }) => {
      const readout = page.locator("text=/rating: (unrated|[\\d.]+)/").first();

      await step("a click commits the value", async () => {
        await page.locator(item(3)).click();
        await page.waitForTimeout(300);
        assert.match(
          await readout.textContent() ?? "",
          /rating: 3/,
          "the third star committed",
        );
        assert.equal(
          await page.locator(item(3)).getAttribute("aria-checked"),
          "true",
          "the third star reads checked",
        );
      });

      await step("arrows walk the value", async () => {
        // The click focused item 3 with no focus change, so the machine is
        // still idle: move focus elsewhere first so a FOCUS event fires.
        await page.locator(item(5)).focus();
        // The click parked the mouse over the group, which is the hover
        // state — keyboard lives in focus. Moving off leaves to focus (a
        // radio holds focus) and the arrows drive from there.
        await page.mouse.move(20, 20);
        await page.keyboard.press("ArrowRight");
        await page.waitForTimeout(300);
        assert.match(
          await readout.textContent() ?? "",
          /rating: 4/,
          "ArrowRight moved to four",
        );
        await page.keyboard.press("ArrowLeft");
        await page.waitForTimeout(300);
        assert.match(
          await readout.textContent() ?? "",
          /rating: 3/,
          "ArrowLeft moved back to three",
        );
      });

      await step("Home and End jump", async () => {
        await page.keyboard.press("End");
        await page.waitForTimeout(300);
        assert.match(
          await readout.textContent() ?? "",
          /rating: 5/,
          "End jumped to five",
        );
        await page.keyboard.press("Home");
        await page.waitForTimeout(300);
        assert.match(
          await readout.textContent() ?? "",
          /rating: 1/,
          "Home jumped to one",
        );
      });

      await step("commands drive the instance", async () => {
        await page.getByText("el.setValue(4)").click();
        await page.waitForTimeout(300);
        assert.match(
          await readout.textContent() ?? "",
          /rating: 4/,
          "setValue committed four",
        );
        await page.getByText("el.clearValue()").click();
        await page.waitForTimeout(300);
        assert.match(
          await readout.textContent() ?? "",
          /rating: unrated/,
          "clearValue emptied",
        );
      });
    },
  ));

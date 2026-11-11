import { test } from "bun:test";
/**
 * E2E: the forked-FSM toggle-group presses in a real browser — click
 * toggles, arrows rove with loop wrap, and the imperative command drives
 * the selection.
 */

import { strict as assert } from "node:assert";
import { runComponentSuite, step } from "./harness.ts";

/** Part ids are the machine's scheme: `toggle-group:<element id>:<part>`. */
const ROOT_ID = '[id="toggle-group:format"]';
const item = (value: string): string =>
  `[id="toggle-group:format:item:${value}"]`;

test("spin-toggle-group e2e", () =>
  runComponentSuite(
    { port: 5257, route: "/toggle-group", ready: ROOT_ID },
    async ({ page }) => {
      const readout = page.locator("text=/selection: [\\w, ]+/").first();

      await step("a click presses and presses again releases", async () => {
        await page.locator(item("bold")).click();
        await page.waitForTimeout(300);
        assert.match(
          await readout.textContent() ?? "",
          /selection: bold/,
          "bold pressed",
        );
        assert.equal(
          await page.locator(item("bold")).getAttribute("data-state"),
          "on",
          "bold reads on",
        );
        await page.locator(item("italic")).click();
        await page.waitForTimeout(300);
        assert.match(
          await readout.textContent() ?? "",
          /selection: bold, italic/,
          "multiple accumulates",
        );
      });

      await step("arrows rove with loop wrap", async () => {
        await page.locator(item("italic")).focus();
        await page.keyboard.press("ArrowRight");
        await page.waitForTimeout(300);
        assert.equal(
          await page.evaluate(() => document.activeElement?.id),
          "toggle-group:format:item:underline",
          "ArrowRight roved to underline",
        );
        await page.keyboard.press("ArrowRight");
        await page.waitForTimeout(300);
        assert.equal(
          await page.evaluate(() => document.activeElement?.id),
          "toggle-group:format:item:bold",
          "ArrowRight looped to bold",
        );
      });

      await step("the command drives the selection", async () => {
        await page.getByText('el.setValue(["bold", "italic"])').click();
        await page.waitForTimeout(300);
        assert.match(
          await readout.textContent() ?? "",
          /selection: bold, italic/,
          "setValue committed",
        );
      });
    },
  ));

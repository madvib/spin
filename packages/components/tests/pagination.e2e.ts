/**
 * E2E: the forked-FSM pagination pages in a real browser — triggers walk
 * and jump the ends, numbers jump, and the imperative commands drive the
 * page.
 */

import { strict as assert } from "node:assert";
import { runComponentSuite, step } from "./harness.ts";
import { type Page } from "npm:playwright-core";

/** Part ids are the machine's scheme: `pagination:<element id>:<part>`. */
const at = (part: string): string => `[id="pagination:pages:${part}"]`;
const ROOT_ID = '[id="pagination:pages"]';
const item = (value: number): string => at(`item:${value}`);

Deno.test("spin-pagination e2e", () =>
  runComponentSuite(
    { port: 5255, route: "/pagination", ready: ROOT_ID },
    async ({ page }) => {
      const readout = page.locator("text=/page: \\d+/").first();

      await step("next and prev walk", async () => {
        await page.locator(at("next")).click();
        await page.waitForTimeout(300);
        assert.match(
          await readout.textContent() ?? "",
          /page: 2/,
          "next advanced to two",
        );
        assert.equal(
          await page.locator(item(2)).getAttribute("aria-current"),
          "page",
          "page two reads current",
        );
        await page.locator(at("prev")).click();
        await page.waitForTimeout(300);
        assert.match(
          await readout.textContent() ?? "",
          /page: 1/,
          "prev retreated to one",
        );
      });

      await step("a number jumps", async () => {
        await page.locator(item(5)).click();
        await page.waitForTimeout(300);
        assert.match(
          await readout.textContent() ?? "",
          /page: 5/,
          "five jumped",
        );
      });

      await step("commands drive the instance", async () => {
        await page.getByText("el.setPage(5)").click();
        await page.waitForTimeout(300);
        assert.match(
          await readout.textContent() ?? "",
          /page: 5/,
          "setPage committed five",
        );
        await page.getByText("el.goToLastPage()").click();
        await page.waitForTimeout(300);
        assert.match(
          await readout.textContent() ?? "",
          /page: 10/,
          "last page is ten",
        );
      });
    },
  ));

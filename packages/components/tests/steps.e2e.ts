/**
 * E2E: the forked-FSM steps flow in a real browser — next advances, back
 * retreats, triggers jump, and the imperative commands drive the index.
 *
 * Run explicitly (not in default `deno task test`):
 *   cd packages/components && deno test --allow-read --allow-net --allow-run
 *     --allow-env --allow-sys --allow-write=/tmp --allow-import
 *     --min-dep-age=0 tests/steps.e2e.ts
 *
 * Builds the specimens app, serves dist, drives real Chromium via Playwright.
 * Requires the Playwright browser once: `bunx playwright install chromium`.
 * Fails loud naming the step; silent on success.
 */

import { strict as assert } from "node:assert";
import { runComponentSuite, step } from "./harness.ts";
import { type Page } from "npm:playwright-core";


/** Part ids are the machine's scheme: `steps:<element id>:<part>`. */
const at = (part: string): string => `[id="steps:flow:${part}"]`;
const ROOT_ID = '[id="steps:flow"]';
const trigger = (index: number): string => at(`trigger:${index}`);

Deno.test("spin-steps e2e", () =>
  runComponentSuite({ port: 5254, route: "/steps", ready: ROOT_ID }, async ({ page }) => {
    const readout = page.locator("text=/step: \\d+/").first();

    await step("next advances and back retreats", async () => {
      await page.getByRole("button", { name: "Next", exact: true }).click();
      await page.waitForTimeout(300);
      assert.match(await readout.textContent() ?? "", /step: 1/, "next advanced to one");
      assert.equal(
        await page.locator(trigger(1)).getAttribute("aria-selected"),
        "true",
        "the second trigger reads selected",
      );
      await page.getByRole("button", { name: "Back", exact: true }).click();
      await page.waitForTimeout(300);
      assert.match(await readout.textContent() ?? "", /step: 0/, "back retreated to zero");
    });

    await step("a trigger jumps to its step", async () => {
      await page.locator(trigger(2)).click();
      await page.waitForTimeout(300);
      assert.match(await readout.textContent() ?? "", /step: 2/, "the third trigger jumped");
    });

    await step("commands drive the instance", async () => {
      await page.getByText("el.resetStep()").click();
      await page.waitForTimeout(300);
      assert.match(await readout.textContent() ?? "", /step: 0/, "reset returned to zero");
      await page.getByText("el.goToNextStep()").click();
      await page.waitForTimeout(300);
      assert.match(await readout.textContent() ?? "", /step: 1/, "the command advanced");
    });

  }));

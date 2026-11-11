import { test } from "bun:test";
/**
 * E2E: the forked-FSM steps flow in a real browser — next advances, back
 * retreats, triggers jump, and the imperative commands drive the index.
 */

import { strict as assert } from "node:assert";
import { runComponentSuite, step } from "./harness.ts";

/** Part ids are the machine's scheme: `steps:<element id>:<part>`. */
const at = (part: string): string => `[id="steps:flow:${part}"]`;
const ROOT_ID = '[id="steps:flow"]';
const trigger = (index: number): string => at(`trigger:${index}`);

test("spin-steps e2e", () =>
  runComponentSuite(
    { port: 5254, route: "/steps", ready: ROOT_ID },
    async ({ page }) => {
      const readout = page.locator("text=/step: \\d+/").first();

      await step("next advances and back retreats", async () => {
        await page.getByRole("button", { name: "Next", exact: true }).click();
        await page.waitForTimeout(300);
        assert.match(
          await readout.textContent() ?? "",
          /step: 1/,
          "next advanced to one",
        );
        assert.equal(
          await page.locator(trigger(1)).getAttribute("aria-selected"),
          "true",
          "the second trigger reads selected",
        );
        await page.getByRole("button", { name: "Back", exact: true }).click();
        await page.waitForTimeout(300);
        assert.match(
          await readout.textContent() ?? "",
          /step: 0/,
          "back retreated to zero",
        );
      });

      await step("a trigger jumps to its step", async () => {
        await page.locator(trigger(2)).click();
        await page.waitForTimeout(300);
        assert.match(
          await readout.textContent() ?? "",
          /step: 2/,
          "the third trigger jumped",
        );
      });

      await step("commands drive the instance", async () => {
        await page.getByText("el.resetStep()").click();
        await page.waitForTimeout(300);
        assert.match(
          await readout.textContent() ?? "",
          /step: 0/,
          "reset returned to zero",
        );
        await page.getByText("el.goToNextStep()").click();
        await page.waitForTimeout(300);
        assert.match(
          await readout.textContent() ?? "",
          /step: 1/,
          "the command advanced",
        );
      });
    },
  ));

/**
 * spin-date-input e2e: per-segment editing behind the app-controller handle.
 *
 * The route binds a machine-owned date-input through `{ commands, state,
 * bind }`; this suite exercises the seeded render, digit typing with
 * auto-advance, arrow cycling, the month-aware day clamp, paste, and the
 * imperative commands, with the host readout following throughout.
 */

import { strict as assert } from "node:assert";
import { runComponentSuite, step } from "./harness.ts";
import { type Page } from "npm:playwright-core";

const SEGMENTS = "#date [role='spinbutton']";

const texts = (page: Page): Promise<string[]> =>
  page.evaluate(() =>
    [...document.querySelectorAll("#date [role='spinbutton']")].map((node) =>
      node.textContent ?? ""
    )
  );

const waitReadout = (page: Page, value: string): Promise<void> =>
  page.waitForFunction(
    (want) => document.querySelector("#date-value")?.textContent === want,
    value,
    { timeout: 5000 },
  ).then(() => undefined);

Deno.test("spin-date-input e2e", () =>
  runComponentSuite(
    { port: 5234, route: "/date-input", ready: SEGMENTS },
    async ({ page }) => {
      await step("seeded date renders in segments", async () => {
        assert.deepEqual(
          await texts(page),
          ["02", "15", "2024"],
          "month, day, year from defaultValue",
        );
        assert.equal(
          await page.locator(SEGMENTS).first().getAttribute("aria-label"),
          "Month",
          "segments name themselves",
        );
      });

      await step("typing fills the segment and reports the date", async () => {
        await page.locator(SEGMENTS).first().click();
        await page.keyboard.press("1");
        await page.keyboard.press("2");
        assert.deepEqual(
          await texts(page),
          ["12", "15", "2024"],
          "both digits land in the month",
        );
        await waitReadout(page, "2024-12-15");
      });

      await step("arrows cycle the focused field", async () => {
        await page.locator(SEGMENTS).first().click();
        await page.keyboard.press("ArrowUp");
        assert.deepEqual(
          (await texts(page))[0],
          "01",
          "December wraps to January",
        );
        await page.keyboard.press("ArrowDown");
        assert.deepEqual((await texts(page))[0], "12", "and back down");
      });

      await step("imperative commands write every segment", async () => {
        await page.getByRole("button", { name: "el.setValue(2025-07-04)" })
          .click();
        await waitReadout(page, "2025-07-04");
        assert.deepEqual(
          await texts(page),
          ["07", "04", "2025"],
          "setValue fills month, day, year",
        );
        await page.getByRole("button", { name: "el.clearValue()" }).click();
        assert.deepEqual(
          await texts(page),
          ["mm", "dd", "yyyy"],
          "clear returns the placeholders",
        );
      });
    },
  ));

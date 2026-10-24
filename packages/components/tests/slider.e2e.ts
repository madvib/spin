/**
 * E2E: the forked-FSM slider slides in a real browser — track press jumps
 * the thumb, arrows step from the keyboard, Home/End jump, and the
 * imperative commands drive the instance.
 */

import { strict as assert } from "node:assert";
import { runComponentSuite, step } from "./harness.ts";
import { type Page } from "npm:playwright-core";

/** Part ids are the machine's scheme: `slider:<element id>:<part>`. */
const at = (id: string, part: string): string => `[id="slider:${id}:${part}"]`;
const CONTROL = at("volume", "control");
const THUMB = at("volume", "thumb:0");

Deno.test("spin-slider e2e", () =>
  runComponentSuite(
    { port: 5252, route: "/slider", ready: CONTROL },
    async ({ page }) => {
      const readout = page.locator("text=/volume: [\\d, ]+/").first();

      await step("the declared default seeds the machine", async () => {
        // The blind spot this suite had: a scope's DECLARED default never
        // reached the machine, and every assertion here was about a gesture.
        const range0 = page.locator(at("range", "thumb:0"));
        const range1 = page.locator(at("range", "thumb:1"));
        await range0.waitFor({ state: "attached", timeout: 5000 });
        assert.equal(
          await range0.getAttribute("aria-valuenow"),
          "20",
          "the first thumb starts at the declared default",
        );
        assert.equal(
          await range1.getAttribute("aria-valuenow"),
          "80",
          "the second thumb starts at the declared default",
        );
      });

      await step("a track press jumps the thumb", async () => {
        const box = await page.locator(CONTROL).boundingBox();
        assert.ok(box !== null, "the control has a box");
        // Three quarters across the track: near 75 on a 0..100 slider.
        // Asserted on the thumb (machine state, direct) — not the host
        // readout, which only updates on the controlled channel (host
        // writes), never on machine-internal moves.
        await page.mouse.move(box.x + box.width * 0.75, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.up();
        await page.waitForTimeout(300);
        const value = Number(
          await page.locator(THUMB).getAttribute("aria-valuenow"),
        );
        assert.ok(
          value >= 70 && value <= 80,
          `the press jumped near 75 (got ${value})`,
        );
      });

      await step("arrows step the thumb", async () => {
        // Machine-internal moves never reach the host readout (the units
        // assert valueChange stays silent); assert the thumb directly.
        await page.locator(THUMB).focus();
        const before = Number(
          await page.locator(THUMB).getAttribute("aria-valuenow"),
        );
        await page.keyboard.press("ArrowRight");
        await page.waitForTimeout(300);
        const after = Number(
          await page.locator(THUMB).getAttribute("aria-valuenow"),
        );
        assert.equal(after, before + 1, "ArrowRight stepped by one");
      });

      await step("Home and End jump", async () => {
        await page.keyboard.press("End");
        await page.waitForTimeout(300);
        assert.equal(
          await page.locator(THUMB).getAttribute("aria-valuenow"),
          "100",
          "End jumped to max",
        );
        await page.keyboard.press("Home");
        await page.waitForTimeout(300);
        assert.equal(
          await page.locator(THUMB).getAttribute("aria-valuenow"),
          "0",
          "Home jumped to min",
        );
      });

      await step("commands drive the instance", async () => {
        // Same contract as gestures: commands move the machine silently;
        // the host hears only its own writes. Assert the thumb.
        await page.getByText("el.setValue([75])").click();
        await page.waitForTimeout(300);
        assert.equal(
          await page.locator(THUMB).getAttribute("aria-valuenow"),
          "75",
          "setValue committed 75",
        );
      });
    },
  ));

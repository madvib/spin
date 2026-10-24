/**
 * E2E: the forked-FSM signature-pad draws in a real browser — a press
 * starts a stroke, the release commits one path, clear empties the pad, and
 * the imperative command works.
 */

import { strict as assert } from "node:assert";
import { runComponentSuite, step } from "./harness.ts";
import { type Page } from "npm:playwright-core";

/** Part ids are the machine's scheme: `signature-pad:<element id>:<part>`. */
const at = (id: string, part: string): string =>
  `[id="signature-pad:${id}:${part}"]`;
const CONTROL = at("pad", "control");
const CLEAR = at("pad", "clear-trigger");

Deno.test("spin-signature-pad e2e", () =>
  runComponentSuite(
    { port: 5250, route: "/signature-pad", ready: CONTROL },
    async ({ page }) => {
      const readout = page.locator("text=/strokes: (empty|\\d)/").first();

      await step("a stroke commits one path", async () => {
        const box = await page.locator(CONTROL).boundingBox();
        assert.ok(box !== null, "the control has a box");
        assert.ok(box.width > 0 && box.height > 0, "the control has size");
        const before = await readout.textContent();
        await page.mouse.move(box.x + 40, box.y + 40);
        await page.mouse.down();
        await page.mouse.move(box.x + 80, box.y + 60, { steps: 5 });
        await page.mouse.move(box.x + 120, box.y + 40, { steps: 5 });
        await page.mouse.up();
        await page.waitForTimeout(300);
        const after = await readout.textContent();
        assert.notEqual(after, before, "the stroke committed a path");
        assert.match(after ?? "", /1 committed/, "exactly one path committed");
      });

      await step("the stroke renders an svg path", async () => {
        const d = await page.locator(`${CONTROL} svg path`).first()
          .getAttribute("d");
        assert.ok(d !== null && d.length > 0, "a path element carries ink");
      });

      await step("clear empties the pad", async () => {
        await page.locator(CLEAR).click();
        await page.waitForTimeout(300);
        const after = await readout.textContent();
        assert.match(after ?? "", /empty/, "the pad is empty after clear");
        assert.equal(
          await page.locator(`${CONTROL} svg path`).count(),
          0,
          "no rendered paths remain",
        );
      });

      await step("the clear command works", async () => {
        const box = await page.locator(CONTROL).boundingBox();
        assert.ok(box !== null, "the control has a box");
        await page.mouse.move(box.x + 40, box.y + 40);
        await page.mouse.down();
        await page.mouse.move(box.x + 80, box.y + 60, { steps: 5 });
        await page.mouse.up();
        await page.waitForTimeout(300);
        assert.match(
          await readout.textContent() ?? "",
          /1 committed/,
          "a stroke committed",
        );
        await page.getByText("el.clear()").click();
        await page.waitForTimeout(300);
        assert.match(
          await readout.textContent() ?? "",
          /empty/,
          "the command cleared the pad",
        );
      });
    },
  ));

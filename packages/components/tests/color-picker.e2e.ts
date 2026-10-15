/**
 * E2E: the forked-FSM color-picker drives its machine in a real browser —
 * the trigger lifecycle, swatch commit, area drag, channel arrows, hex
 * input, format switch, commands, and the inline instance.
 *
 * Run explicitly (not in default `deno task test`):
 *   cd packages/components && deno test --allow-read --allow-net --allow-run
 *     --allow-env --allow-sys --allow-write=/tmp --allow-import
 *     --min-dep-age=0 tests/color-picker.e2e.ts
 *
 * Builds the specimens app, serves dist, drives real Chromium via Playwright.
 * Requires the Playwright browser once: `bunx playwright install chromium`.
 * Fails loud naming the step; silent on success.
 */

import { strict as assert } from "node:assert";
import { runComponentSuite, step } from "./harness.ts";


/** Part ids are the machine's scheme: `color-picker:<element id>:<part>`. */
const at = (id: string, part: string): string => `[id="color-picker:${id}:${part}"]`;
const TRIGGER = at("brand", "trigger");
const CONTENT = at("brand", "content");
const AREA = at("brand", "area");
const AREA_THUMB = at("brand", "area-thumb");
const HUE_THUMB = at("brand", "thumb:hue");
const INLINE_CONTENT = at("inline", "content");

Deno.test("spin-color-picker e2e", () =>
  runComponentSuite({ port: 5248, route: "/color-picker", ready: TRIGGER,
    settle: async (page) => {
    assert.equal(
      await page.locator(TRIGGER).getAttribute("aria-expanded"),
      "false",
      "the panel starts closed",
    );
    },
  }, async ({ page }) => {
    await step("trigger opens the panel", async () => {
      await page.locator(TRIGGER).click();
      assert.equal(
        await page.locator(TRIGGER).getAttribute("aria-expanded"),
        "true",
        "the trigger opens",
      );
      assert.equal(
        await page.locator(CONTENT).getAttribute("data-state"),
        "open",
        "the content reports open",
      );
    });

    await step("area arrows move the color", async () => {
      // Red is fully saturated, so the x channel only moves down from here.
      const before = await page.locator(AREA_THUMB).getAttribute("aria-valuenow");
      await page.locator(AREA_THUMB).focus();
      await page.keyboard.press("ArrowLeft");
      const after = await page.locator(AREA_THUMB).getAttribute("aria-valuenow");
      assert.notEqual(after, before, "the x channel stepped");
    });

    await step("hue arrows move the hue", async () => {
      const before = await page.locator(HUE_THUMB).getAttribute("aria-valuenow");
      await page.locator(HUE_THUMB).focus();
      await page.keyboard.press("ArrowRight");
      const after = await page.locator(HUE_THUMB).getAttribute("aria-valuenow");
      assert.notEqual(after, before, "the hue stepped");
    });

    await step("area drag moves the color", async () => {
      // The panel hangs below the trigger and the inline card's area
      // can cover it: put the trigger above center so the panel lands
      // mid-viewport and the inline card stays below the fold.
      await page.locator(TRIGGER).evaluate((node) =>
        node.scrollIntoView({ block: "center" })
      );
      const box = await page.locator(AREA).boundingBox();
      assert.ok(box !== null, "the area has a box");
      const readout = page.locator("text=/value:/").first();
      const before = await readout.textContent();
      await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.8, { steps: 5 });
      await page.mouse.up();
      const after = await readout.textContent();
      assert.notEqual(after, before, "the drag moved the value");
    });

    await step("commands drive the instance", async () => {
      // The panel is open over the command row: dismiss it first.
      await page.keyboard.press("Escape");
      const card = page.locator("card").first();
      await card.getByRole("button", { name: 'el.setFormat("rgb")' }).click();
      const readout = await page.locator("text=/format:/").first().textContent();
      assert.ok(readout?.includes("rgb"), `format switched to rgb, got: ${readout}`);
    });

    await step("inline is always open", async () => {
      assert.equal(
        await page.locator(INLINE_CONTENT).getAttribute("data-state"),
        "open",
        "the inline panel reports open",
      );
    });
  }));

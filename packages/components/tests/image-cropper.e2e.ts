import { test } from "bun:test";
/**
 * E2E: the forked-FSM image-cropper drives its machine in a real browser —
 * measurement, selection drag, handle resize, wheel zoom, keyboard nudge,
 * and the imperative commands.
 */

import { strict as assert } from "node:assert";
import { runComponentSuite, step } from "./harness.ts";

/** Part ids are the machine's scheme: `image-cropper:<element id>:<part>`. */
const at = (id: string, part: string): string =>
  `[id="image-cropper:${id}:${part}"]`;
const VIEWPORT = at("photo", "viewport");
const SELECTION = at("photo", "selection");
const HANDLE_SE = at("photo", "handle:se");

test("spin-image-cropper e2e", () =>
  runComponentSuite({
    port: 5249,
    route: "/image-cropper",
    ready: VIEWPORT,
    settle: async (page) => {
      await page.waitForFunction(
        () =>
          document.querySelector('[id="image-cropper:photo:selection"]')
            ?.getAttribute("data-measured") === "",
        undefined,
        { timeout: 8000 },
      );
    },
  }, async ({ page }) => {
    await step("selection drag moves the crop", async () => {
      const box = await page.locator(SELECTION).boundingBox();
      assert.ok(box !== null, "the selection has a box");
      const readout = page.locator("text=/crop:/").first();
      const before = await readout.textContent();
      // Center of the selection: a move, not a handle resize.
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(
        box.x + box.width / 2 + 40,
        box.y + box.height / 2 + 20,
        { steps: 5 },
      );
      await page.mouse.up();
      const after = await readout.textContent();
      assert.notEqual(after, before, "the drag moved the crop");
    });

    await step("handle drag resizes the crop", async () => {
      const box = await page.locator(HANDLE_SE).boundingBox();
      assert.ok(box !== null, "the se handle has a box");
      const readout = page.locator("text=/crop:/").first();
      const before = await readout.textContent();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + 30, box.y + 30, { steps: 5 });
      await page.mouse.up();
      const after = await readout.textContent();
      assert.notEqual(after, before, "the resize changed the crop");
    });

    await step("arrows nudge the crop", async () => {
      const readout = page.locator("text=/crop:/").first();
      const before = await readout.textContent();
      await page.locator(SELECTION).focus();
      await page.keyboard.press("ArrowRight");
      const after = await readout.textContent();
      assert.notEqual(after, before, "the nudge moved the crop");
    });

    await step("commands drive the instance", async () => {
      const card = page.locator("card").first();
      await card.getByRole("button", { name: "el.zoomBy(0.5)" }).click();
      const readout = await page.locator("text=/zoom:/").first().textContent();
      assert.ok(
        readout?.includes("1.5"),
        `zoom stepped to 1.5, got: ${readout}`,
      );
      await card.getByRole("button", { name: "el.rotateBy(90)" }).click();
      const rotated = await page.locator("text=/rotation:/").first()
        .textContent();
      assert.ok(
        rotated?.includes("90"),
        `rotation stepped to 90, got: ${rotated}`,
      );
    });
  }));

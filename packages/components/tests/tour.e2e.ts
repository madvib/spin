import { test } from "bun:test";
/**
 * spin-tour e2e: the inactive and running modes with the three phases,
 * behind the app-controller handle.
 *
 * The route binds a machine-owned tour through `{ commands, state, bind }`;
 * this suite exercises the start (resolve, scroll, activate), the step
 * navigation with the spotlight moving to each target, the dismiss
 * through the overlay, and the complete at the last step.
 */

import { strict as assert } from "node:assert";
import { runComponentSuite, step } from "./harness.ts";
import { type Page } from "playwright-core";

const overlay = (
  page: Page,
): Promise<{ state: string | null; title: string; spot: string }> =>
  page.evaluate(() => {
    const dialog = document.querySelector("#tour [role='dialog']");
    const spot = document.querySelector("#tour [id$=':spotlight']");
    return {
      state: dialog?.getAttribute("data-state") ?? null,
      title: dialog?.querySelector("span")?.textContent ?? "",
      spot: spot?.getAttribute("style") ?? "",
    };
  });

/** Clicks one of the tour's overlay buttons by its id suffix. */
const clickOverlay = (page: Page, suffix: string): Promise<void> =>
  page.evaluate((id) => {
    document.querySelector(`#tour [id$=':${id}']`)?.dispatchEvent(
      new MouseEvent("click", { bubbles: true }),
    );
  }, suffix).then(() => undefined);

test("spin-tour e2e", () =>
  runComponentSuite({
    port: 5239,
    route: "/tour",
    ready: "#tour-one",
    timeoutMs: 30000,
    settle: async (page) => {
      const start = await overlay(page);
      assert.equal(start.state, "closed", "the tour starts inactive");
      assert.equal(
        await page.locator("#tour-state").textContent(),
        "inactive",
        "and reports inactive",
      );
    },
  }, async ({ page }) => {
    await step(
      "starting resolves, scrolls, and activates the first step",
      async () => {
        await page.getByRole("button", { name: "el.start()" }).click();
        await page.waitForFunction(
          () =>
            document.querySelector("#tour [role='dialog']")?.getAttribute(
              "data-state",
            ) === "open",
          undefined,
          { timeout: 8000 },
        );
        const first = await overlay(page);
        assert.equal(first.title, "First stop", "the first step's title shows");
        assert.equal(
          await page.locator("#tour-state").textContent(),
          "greet",
          "step-change carries the id",
        );
        // The spotlight frames the first target padded by 8: measured against
        // the live target, not hardcoded, so demo layout can move.
        const spot = await page.evaluate(() => {
          const style =
            document.querySelector("#tour [id$=':spotlight']")?.getAttribute(
              "style",
            ) ?? "";
          const x = style.match(/left:\s*([\d.]+)px/);
          const w = style.match(/width:\s*([\d.]+)px/);
          const target = document.querySelector("#tour-one")
            ?.getBoundingClientRect();
          return {
            x: x === null ? null : Number(x[1]),
            w: w === null ? null : Number(w[1]),
            left: target === undefined ? null : Math.round(target.left),
            width: target === undefined ? null : Math.round(target.width),
          };
        });
        assert.equal(
          spot.x,
          (spot.left ?? 0) - 8,
          "the spotlight's x is the target's left minus the padding",
        );
        assert.equal(
          spot.w,
          (spot.width ?? 0) + 16,
          "and its width is the target's width plus the padding",
        );
      },
    );

    await step("next advances and re-frames the second target", async () => {
      await clickOverlay(page, "next");
      await page.waitForFunction(
        () =>
          document.querySelector("#tour [role='dialog'] span")?.textContent ===
            "Second stop",
        undefined,
        { timeout: 8000 },
      );
      await page.waitForFunction(
        () =>
          document.querySelector("#tour [role='dialog']")?.getAttribute(
            "data-state",
          ) === "open",
        undefined,
        { timeout: 8000 },
      );
      const spot = await page.evaluate(() => {
        const style =
          document.querySelector("#tour [id$=':spotlight']")?.getAttribute(
            "style",
          ) ?? "";
        const x = style.match(/left:\s*([\d.]+)px/);
        const target = document.querySelector("#tour-two")
          ?.getBoundingClientRect();
        return {
          x: x === null ? null : Number(x[1]),
          left: target === undefined ? null : Math.round(target.left),
        };
      });
      assert.equal(
        spot.x,
        (spot.left ?? 0) - 8,
        "the spotlight moved to the second target",
      );
      assert.equal(
        await page.locator("#tour-state").textContent(),
        "second",
        "the channel carries the new id",
      );
    });

    await step("prev returns to the first step", async () => {
      await clickOverlay(page, "prev");
      await page.waitForFunction(
        () =>
          document.querySelector("#tour [role='dialog'] span")?.textContent ===
            "First stop",
        undefined,
        { timeout: 8000 },
      );
      assert.equal(
        await page.locator("#tour-state").textContent(),
        "greet",
        "and back to the first id",
      );
    });

    await step("skip ends the tour", async () => {
      await clickOverlay(page, "skip");
      await page.waitForFunction(
        () =>
          document.querySelector("#tour [role='dialog']")?.getAttribute(
            "data-state",
          ) === "closed",
        undefined,
        { timeout: 8000 },
      );
      assert.equal(
        await page.locator("#tour-state").textContent(),
        "skip",
        "the skip reason reports",
      );
    });

    await step("the last step's dismiss completes", async () => {
      await page.getByRole("button", { name: "el.start()" }).click();
      await page.waitForFunction(
        () =>
          document.querySelector("#tour [role='dialog']")?.getAttribute(
            "data-state",
          ) === "open",
        undefined,
        { timeout: 8000 },
      );
      await clickOverlay(page, "next");
      await page.waitForFunction(
        () =>
          document.querySelector("#tour [role='dialog'] span")?.textContent ===
            "Second stop",
        undefined,
        { timeout: 8000 },
      );
      await page.waitForFunction(
        () =>
          document.querySelector("#tour [role='dialog']")?.getAttribute(
            "data-state",
          ) === "open",
        undefined,
        { timeout: 8000 },
      );
      await clickOverlay(page, "dismiss");
      await page.waitForFunction(
        () =>
          document.querySelector("#tour [role='dialog']")?.getAttribute(
            "data-state",
          ) === "closed",
        undefined,
        { timeout: 8000 },
      );
      assert.equal(
        await page.locator("#tour-state").textContent(),
        "complete",
        "the last dismiss completes",
      );
    });
  }));

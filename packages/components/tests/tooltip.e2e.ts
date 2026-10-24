/**
 * spin-tooltip e2e: the hover-delay and anchor actions behind the same
 * app-controller handle as a machine.
 *
 * The route binds a platform-owned tooltip through `{ commands, state, bind }`;
 * this suite exercises the dwell open, the leave close, the immediate focus
 * open, the anchored position, and the imperative commands, with the host
 * readout following throughout.
 */

import { strict as assert } from "node:assert";
import { runComponentSuite, step } from "./harness.ts";
import { type Page } from "npm:playwright-core";

const READOUT = "#tooltip-open";
const TRIGGER = "#demo-tooltip button";
const nativeOpen = (page: Page): Promise<boolean> =>
  page.evaluate(() =>
    document.querySelector("#demo-tooltip [popover]")?.matches(
      ":popover-open",
    ) ?? false
  );

const readout = (page: Page): Promise<boolean> =>
  page.waitForFunction(
    () => document.querySelector("#tooltip-open")?.textContent === "true",
    undefined,
    { timeout: 5000 },
  ).then(() => true);
Deno.test("spin-tooltip e2e", () =>
  runComponentSuite(
    { port: 5232, route: "/tooltip", ready: TRIGGER },
    async ({ page }) => {
      await step("dwell opens the anchored panel", async () => {
        assert.equal(await page.locator(READOUT).textContent(), "false");
        await page.locator(TRIGGER).hover();
        assert.equal(
          await nativeOpen(page),
          false,
          "no instant open: the dwell owns the timing",
        );
        await page.waitForFunction(
          () => document.querySelector("#tooltip-open")?.textContent === "true",
          undefined,
          { timeout: 5000 },
        );
        assert.equal(
          await nativeOpen(page),
          true,
          "the native panel is open after the dwell",
        );
        const geometry = await page.evaluate(() => {
          const panel = document.querySelector(
            "#demo-tooltip [popover]",
          ) as HTMLElement;
          const trigger = document.querySelector(
            "#demo-tooltip button",
          ) as HTMLElement;
          const panelRect = panel.getBoundingClientRect();
          const triggerRect = trigger.getBoundingClientRect();
          return {
            gap: panelRect.top - triggerRect.bottom,
            left: panelRect.left - triggerRect.left,
            placement: panel.getAttribute("data-placement"),
          };
        });
        assert.equal(
          geometry.placement,
          "bottom",
          "the viewport leaves room below",
        );
        assert.ok(
          geometry.gap >= 4 && geometry.gap <= 16,
          `the panel sits under the trigger (gap ${geometry.gap})`,
        );
        assert.ok(
          Math.abs(geometry.left) < 4,
          `the panel aligns to the trigger (offset ${geometry.left})`,
        );
      });

      await step("leaving closes after the delay", async () => {
        await page.mouse.move(1200, 800);
        await page.waitForFunction(
          () =>
            document.querySelector("#tooltip-open")?.textContent === "false",
          undefined,
          { timeout: 5000 },
        );
        assert.equal(await nativeOpen(page), false, "the native panel closed");
      });

      await step("focus opens at once for keyboard users", async () => {
        await page.locator(TRIGGER).focus();
        await readout(page);
        assert.equal(
          await nativeOpen(page),
          true,
          "focus skips the hover clock",
        );
        assert.equal(
          await page.locator(TRIGGER).getAttribute("aria-describedby"),
          "demo-tooltip:panel",
          "the trigger names its description",
        );
        await page.locator(TRIGGER).blur();
        await page.waitForFunction(
          () =>
            document.querySelector("#tooltip-open")?.textContent === "false",
          undefined,
          { timeout: 5000 },
        );
      });

      await step("imperative commands reach the native methods", async () => {
        await page.getByRole("button", { name: "el.show()" }).click();
        await readout(page);
        assert.equal(
          await nativeOpen(page),
          true,
          "show opens the native panel",
        );
        await page.keyboard.press("Escape");
        await page.waitForFunction(
          () =>
            document.querySelector("#tooltip-open")?.textContent === "false",
          undefined,
          { timeout: 5000 },
        );
        assert.equal(
          await nativeOpen(page),
          false,
          "Escape dismisses through the platform",
        );
        await page.getByRole("button", { name: "el.hide()" }).click();
        assert.equal(
          await nativeOpen(page),
          false,
          "hide on a closed panel is a no-op",
        );
      });
    },
  ));

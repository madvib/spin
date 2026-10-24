/**
 * spin-hover-card e2e: one hover-delay action on the root behind the same
 * app-controller handle as a machine.
 *
 * The route binds a platform-owned hover-card through `{ commands, state,
 * bind }`; this suite exercises the dwell open, the move-to-panel persistence
 * (the behavior that separates a card from a tooltip), the leave close after
 * the delay, the focus path, and the imperative commands, with the host
 * readout following throughout.
 */

import { strict as assert } from "node:assert";
import { runComponentSuite, step } from "./harness.ts";
import { type Page } from "npm:playwright-core";

const READOUT = "#hover-card-open";
const TRIGGER = "#demo-hover-card button";

const nativeOpen = (page: Page): Promise<boolean> =>
  page.evaluate(() =>
    document.querySelector("#demo-hover-card [popover]")?.matches(
      ":popover-open",
    ) ?? false
  );

const waitReadout = (page: Page, value: string): Promise<void> => {
  const expected = value;
  return page.waitForFunction(
    (want) => document.querySelector("#hover-card-open")?.textContent === want,
    expected,
    { timeout: 5000 },
  ).then(() => undefined);
};

Deno.test("spin-hover-card e2e", () =>
  runComponentSuite(
    { port: 5233, route: "/hover-card", ready: TRIGGER },
    async ({ page }) => {
      await step("dwell opens the anchored panel", async () => {
        assert.equal(await page.locator(READOUT).textContent(), "false");
        await page.locator(TRIGGER).hover();
        assert.equal(
          await nativeOpen(page),
          false,
          "no instant open: the dwell owns the timing",
        );
        await waitReadout(page, "true");
        assert.equal(
          await nativeOpen(page),
          true,
          "the native panel is open after the dwell",
        );
        const geometry = await page.evaluate(() => {
          const panel = document.querySelector(
            "#demo-hover-card [popover]",
          ) as HTMLElement;
          const trigger = document.querySelector(
            "#demo-hover-card button",
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

      await step("moving to the panel keeps it open", async () => {
        const point = await page.evaluate(() => {
          const trigger = document.querySelector(
            "#demo-hover-card button",
          ) as HTMLElement;
          const rect = trigger.getBoundingClientRect();
          return { x: rect.left + rect.width / 2, y: rect.bottom + 40 };
        });
        await page.mouse.move(point.x, point.y);
        await new Promise((resolve) => setTimeout(resolve, 400));
        assert.equal(
          await nativeOpen(page),
          true,
          "the card stays while the pointer is over it",
        );
        assert.equal(
          await page.locator(READOUT).textContent(),
          "true",
          "the host readout follows the platform",
        );
      });

      await step("leaving both closes after the delay", async () => {
        await page.mouse.move(1200, 800);
        await new Promise((resolve) => setTimeout(resolve, 150));
        assert.equal(
          await nativeOpen(page),
          true,
          "still open inside the close delay",
        );
        await waitReadout(page, "false");
        assert.equal(await nativeOpen(page), false, "the native panel closed");
      });

      await step("focus opens at once for keyboard users", async () => {
        await page.locator(TRIGGER).focus();
        await waitReadout(page, "true");
        assert.equal(
          await nativeOpen(page),
          true,
          "focus skips the hover clock",
        );
        await page.locator(TRIGGER).blur();
        await waitReadout(page, "false");
      });

      await step("imperative commands reach the native methods", async () => {
        await page.getByRole("button", { name: "el.show()" }).click();
        await waitReadout(page, "true");
        assert.equal(
          await nativeOpen(page),
          true,
          "show opens the native panel",
        );
        await page.keyboard.press("Escape");
        await waitReadout(page, "false");
        assert.equal(
          await nativeOpen(page),
          false,
          "Escape dismisses through the platform",
        );
      });
    },
  ));

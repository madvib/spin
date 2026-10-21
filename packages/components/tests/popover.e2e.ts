/**
 * spin-popover e2e: the platform tier behind the same app-controller
 * handle as a machine.
 *
 * The proof route binds a machine-owned toast and a platform-owned popover
 * through identical `{ commands, state, bind }` code; this suite exercises
 * both halves: the popover's native open/Escape/imperative paths with the
 * host readout following, and the toast's create/dismiss through the same
 * handle shape.
 */

import { strict as assert } from "node:assert";
import { runComponentSuite, step } from "./harness.ts";
import { type Page } from "npm:playwright-core";


const READOUT = "#popover-open";
const TOASTS = "#popover-toasts";

/** The platform's own truth: the native popover's open state. */
const nativeOpen = (page: Page): Promise<boolean> =>
  page.evaluate(() =>
    document.querySelector("spin-popover [popover]")?.matches(":popover-open") ?? false
  );

Deno.test("spin-popover e2e", () =>
  runComponentSuite({ port: 5224, route: "/popover", ready: "spin-popover button" }, async ({ page }) => {
    await step("the trigger opens the native popover", async () => {
      assert.equal(await page.locator(READOUT).textContent(), "false");
      await page.getByRole("button", { name: "Open popover" }).click();
      await page.waitForFunction(
        () => document.querySelector("#popover-open")?.textContent === "true",
        undefined,
        { timeout: 5000 },
      );
      assert.equal(await page.locator(READOUT).textContent(), "true", "the host readout follows the platform");
      assert.equal(await nativeOpen(page), true, "the native popover is open");
    });

    await step("Escape dismisses through the platform", async () => {
      await page.keyboard.press("Escape");
      await page.waitForFunction(
        () => document.querySelector("#popover-open")?.textContent === "false",
        undefined,
        { timeout: 5000 },
      );
      assert.equal(await page.locator(READOUT).textContent(), "false", "the toggle event reported the close");
    });

    await step("imperative commands reach the native methods", async () => {
      await page.getByRole("button", { name: "el.show()" }).click();
      await page.waitForFunction(
        () => document.querySelector("#popover-open")?.textContent === "true",
        undefined,
        { timeout: 5000 },
      );
      await page.getByRole("button", { name: "el.hide()" }).click();
      await page.waitForFunction(
        () => document.querySelector("#popover-open")?.textContent === "false",
        undefined,
        { timeout: 5000 },
      );
      // The panel is closed here: hide() on a closed popover changes
      // nothing, so a wait for the close would be satisfied by the state
      // it waits for. The step asserts that no-op instead.
      await page.getByRole("button", { name: "el.hide()" }).click();
      assert.equal(await nativeOpen(page), false, "hide on a closed popover leaves it closed");
      assert.equal(
        await page.locator(READOUT).textContent(),
        "false",
        "the host readout reports no close for a closed popover",
      );
      // A toggle click while open would race light-dismiss (the button's
      // own pointerdown dismisses before the click toggles back open), so
      // the close direction is established with hide() first: toggle from
      // a known closed state opens deterministically.
      await page.getByRole("button", { name: "el.toggle()" }).click();
      await page.waitForFunction(
        () => document.querySelector("#popover-open")?.textContent === "true",
        undefined,
        { timeout: 5000 },
      );
      await page.getByRole("button", { name: "el.hide()" }).click();
      await page.waitForFunction(
        () => document.querySelector("#popover-open")?.textContent === "false",
        undefined,
        { timeout: 5000 },
      );
    });

    await step("the machine half answers the same handle", async () => {
      await page.getByRole("button", { name: "el.create({...})" }).click();
      assert.equal(await page.locator(TOASTS).textContent(), "1", "create through the ctl shows one toast");
      await page.getByRole("button", { name: "el.dismissAll()" }).click();
      // Dismissed rows leave on the remove delay; the region empties after.
      await page.waitForFunction(
        () => document.querySelector("#popover-toasts")?.textContent === "0",
        undefined,
        { timeout: 8000 },
      );
    });
  }));

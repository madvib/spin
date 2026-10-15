/**
 * spin-date-picker e2e: open/closed modes, the view climb, and the three
 * selection modes, behind the app-controller handle.
 *
 * Builds the specimens app, serves dist, drives real Chromium via Playwright.
 * The route binds a machine-owned date-picker through `{ commands, state,
 * bind }`; this suite exercises the seeded render, open/focus, day selection
 * with closeOnSelect, keyboard navigation, the view climb (day → month →
 * year and back through cells), and the imperative commands, with the host
 * readout following throughout.
 */

import { strict as assert } from "node:assert";
import { runComponentSuite, step } from "./harness.ts";
import { type Page } from "npm:playwright-core";


const READOUT = "#picker-value";
const TRIGGER = "#picker [id$=':trigger']";
const CELLS = "#picker [role='gridcell']";

const panelState = (page: Page): Promise<string> =>
  page.evaluate(() => document.querySelector("#picker [role='dialog']")?.getAttribute("data-state") ?? "gone");

const triggerText = (page: Page): Promise<string> =>
  page.evaluate(() => document.querySelector('#picker [id$=":trigger"] span.truncate')?.textContent ?? "");

const cellText = (page: Page, day: string): Promise<string | undefined> =>
  page.evaluate(
    (value) => document.querySelector(`#picker [data-value='${value}']`)?.textContent ?? undefined,
    day,
  );

const focusedDay = (page: Page): Promise<string | undefined> =>
  page.evaluate(() => document.querySelector("#picker [data-focus]")?.getAttribute("data-value") ?? undefined);

Deno.test("spin-date-picker e2e", () =>
  runComponentSuite({ port: 5235, route: "/date-picker", ready: TRIGGER }, async ({ page }) => {
    await step("seeded value renders in trigger and grid", async () => {
      assert.equal(await triggerText(page), "Feb 15, 2024", "the trigger formats the seeded day");
      assert.equal(await panelState(page), "closed", "the panel starts closed");
      assert.equal(
        await page.locator("#picker [data-value='2024-02-15']").getAttribute("role"),
        "gridcell",
        "cells carry the gridcell role",
      );
      assert.equal(
        await page.locator("#picker [data-value='2024-02-15']").getAttribute("aria-selected"),
        "true",
        "the seeded day reports selected",
      );
      const cellCount = await page.locator(CELLS).count();
      assert.equal(cellCount, 35, "five weeks of grid cells");
      assert.equal(await cellText(page, "2024-02-29"), "29", "February 2024 holds a leap day");
    });

    await step("opening hands focus to the active cell", async () => {
      await page.locator(TRIGGER).click();
      assert.equal(await panelState(page), "open", "the trigger opens the panel");
      assert.equal(await focusedDay(page), "2024-02-15", "focus lands on the selected day");
      assert.equal(
        await page.locator(TRIGGER).getAttribute("aria-expanded"),
        "true",
        "the trigger reports the mode",
      );
    });

    await step("selecting a day reports and closes", async () => {
      await page.locator("#picker [data-value='2024-02-20']").click();
      assert.equal(await page.locator(READOUT).textContent(), "2024-02-20", "value-change carries the ISO day");
      assert.equal(await triggerText(page), "Feb 20, 2024", "the trigger follows the selection");
      assert.equal(await panelState(page), "closed", "closeOnSelect closes the panel");
    });

    await step("arrows move focus across the grid", async () => {
      await page.locator(TRIGGER).click();
      await page.keyboard.press("ArrowRight");
      assert.equal(await focusedDay(page), "2024-02-21", "right moves one day");
      await page.keyboard.press("ArrowUp");
      assert.equal(await focusedDay(page), "2024-02-14", "up moves a week");
      await page.keyboard.press("PageDown");
      assert.equal(await focusedDay(page), "2024-03-13", "page down moves a month");
    });

    await step("the view climbs day to month to year and back", async () => {
      const view = page.locator("#picker [id$=':view']");
      assert.equal(await view.getAttribute("data-view"), "day");
      assert.equal(await view.textContent(), "March 2024", "the day view names its month");
      await view.click();
      assert.equal(await view.getAttribute("data-view"), "month", "the control climbs to months");
      // Cells are months now: twelve, keyed on each month's first day.
      assert.equal(await page.locator(CELLS).count(), 12, "twelve month cells");
      await page.locator("#picker [data-value='2024-06-01']").click();
      assert.equal(await view.getAttribute("data-view"), "day", "a month cell drills into its days");
      assert.equal(await view.textContent(), "June 2024", "and the view names the new month");
    });

    await step("Escape dismisses back to the trigger", async () => {
      await page.keyboard.press("Escape");
      assert.equal(await panelState(page), "closed", "Escape closes the panel");
    });

    await step("imperative commands drive the panel", async () => {
      // clear first: once the panel is open it overlays the demo controls,
      // so the host's own buttons are only hittable while it is closed.
      await page.getByRole("button", { name: "el.clear()" }).click();
      assert.equal(await triggerText(page), "Pick a date", "clear() empties the selection");
      assert.equal(await page.locator(READOUT).textContent(), "", "and reports the empty string");
      await page.getByRole("button", { name: "el.open()" }).click();
      assert.equal(await panelState(page), "open", "open() opens the panel");
      await page.keyboard.press("Escape");
      assert.equal(await panelState(page), "closed", "and Escape closes it again");
    });
  }));

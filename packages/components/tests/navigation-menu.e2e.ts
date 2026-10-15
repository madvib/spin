/**
 * spin-navigation-menu e2e: the closed/open modes and the dwell clocks,
 * behind the app-controller handle.
 *
 * Builds the specimens app, serves dist, drives real Chromium via Playwright.
 * The route binds a machine-owned navigation-menu through
 * `{ commands, state, bind }`; this suite exercises the dwell open, the
 * swap, the leave close after the grace, the click toggle, and the
 * imperative commands.
 */

import { strict as assert } from "node:assert";
import { runComponentSuite, step } from "./harness.ts";
import { type Page } from "npm:playwright-core";


const ITEMS = "#nav [role='menuitem']";
const PANELS = "#nav [role='menu']";

const states = (page: Page, selector: string): Promise<(string | null)[]> =>
  page.evaluate(
    (sel) => [...document.querySelectorAll(sel)].map((node) => node.getAttribute("data-state")),
    selector,
  );

const hover = async (page: Page, index: number): Promise<void> => {
  const point = await page.evaluate((at) => {
    const nodes = document.querySelectorAll("#nav [role='menuitem']");
    const rect = (nodes[at] as HTMLElement)?.getBoundingClientRect();
    return rect === undefined ? null : { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  }, index);
  if (point === null) throw new Error(`no item at ${index}`);
  await page.mouse.move(point.x, point.y);
};

Deno.test("spin-navigation-menu e2e", () =>
  runComponentSuite({ port: 5238, route: "/navigation-menu", ready: ITEMS,
    settle: async (page) => {
    assert.deepEqual(await states(page, ITEMS), ["closed", "closed", "closed"], "all items start closed");
    },
  }, async ({ page }) => {
    await step("hovering after the dwell opens the item", async () => {
      await hover(page, 0);
      assert.deepEqual(await states(page, ITEMS), ["closed", "closed", "closed"], "no instant open");
      await page.waitForFunction(
        () => document.querySelectorAll("#nav [role='menuitem'][data-state='open']").length === 1,
        undefined,
        { timeout: 5000 },
      );
      assert.deepEqual(await states(page, PANELS), ["open", "closed", "closed"], "the panel opens");
      assert.equal(
        await page.locator("#nav-value").textContent(),
        "docs",
        "value-change carries the item",
      );
    });

    await step("moving to another item swaps at once", async () => {
      await hover(page, 1);
      // Wait for the SECOND item, not "one open": the first is still open
      // for the close grace, so "exactly one" is true before the swap.
      await page.waitForFunction(
        () => document.querySelectorAll("#nav [role='menuitem']")[1]?.getAttribute("data-state") === "open",
        undefined,
        { timeout: 5000 },
      );
      assert.deepEqual(await states(page, ITEMS), ["closed", "open", "closed"], "the hover swaps");
      assert.equal(await page.locator("#nav-value").textContent(), "guides", "and reports the new item");
    });

    await step("leaving the menu closes after the grace", async () => {
      await page.mouse.move(1200, 800);
      await page.waitForFunction(
        () => document.querySelectorAll("#nav [role='menuitem'][data-state='open']").length === 0,
        undefined,
        { timeout: 5000 },
      );
      assert.equal(await page.locator("#nav-value").textContent(), "", "the close reports the empty value");
    });

    await step("clicking toggles without a dwell", async () => {
      await hover(page, 2);
      await page.mouse.down();
      await page.mouse.up();
      await page.waitForFunction(
        () => document.querySelectorAll("#nav [role='menuitem'][data-state='open']").length === 1,
        undefined,
        { timeout: 5000 },
      );
      assert.deepEqual(await states(page, ITEMS), ["closed", "closed", "open"], "the click opens");
      await page.mouse.down();
      await page.mouse.up();
      await page.waitForFunction(
        () => document.querySelectorAll("#nav [role='menuitem'][data-state='open']").length === 0,
        undefined,
        { timeout: 5000 },
      );
      assert.deepEqual(await states(page, ITEMS), ["closed", "closed", "closed"], "the second click closes");
    });
  }));

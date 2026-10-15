/**
 * E2E: the forked-FSM combobox drives its machine in a real browser — the
 * focus/open lifecycle, the arrow walk with wrapping, Enter selection, the
 * trigger, the multiple instance that stays open, the inline autocomplete,
 * the controlled open channel, and the imperative commands.
 *
 * Run explicitly (not in default `deno task test`):
 *   cd packages/components && deno test --allow-read --allow-net --allow-run
 *     --allow-env --allow-sys --allow-write=/tmp --allow-import
 *     --min-dep-age=0 tests/combobox.e2e.ts
 *
 * Builds the specimens app, serves dist, drives real Chromium via Playwright.
 * Requires the Playwright browser once: `bunx playwright install chromium`.
 * Fails loud naming the step; silent on success.
 */

import { strict as assert } from "node:assert";
import { runComponentSuite, step } from "./harness.ts";
import { type Page } from "npm:playwright-core";


/** Part ids are the machine's scheme: `combobox:<element id>:<part>`. */
const at = (id: string, part: string): string => `[id="combobox:${id}:${part}"]`;
const FW_INPUT = at("frameworks", "input");
const FW_TRIGGER = at("frameworks", "trigger");
const FW_ITEM = (value: string): string => at("frameworks", `item:${value}`);
const TOP_INPUT = at("toppings", "input");
const CITY_INPUT = at("cities", "input");
const CTL_INPUT = at("controlled", "input");

const readout = async (page: Page, id: string): Promise<string> =>
  (await page.locator(`#${id}`).textContent()) ?? "";

Deno.test("spin-combobox e2e", () =>
  runComponentSuite({ port: 5228, route: "/combobox", ready: FW_INPUT,
    settle: async (page) => {
    assert.equal(await readout(page, "combobox-value"), "svelte", "the default value reports up");
    },
  }, async ({ page }) => {
    await step("arrows open the panel and walk the rows", async () => {
      await page.locator(FW_INPUT).click();
      assert.equal(
        await page.locator(FW_INPUT).getAttribute("aria-expanded"),
        "true",
        "clicking the field opens the panel",
      );
      assert.equal(await readout(page, "combobox-open"), "open", "open-change reports it");
      assert.equal(
        await page.locator(FW_INPUT).getAttribute("aria-activedescendant"),
        "combobox:frameworks:item:svelte",
        "the walk starts at the selected row",
      );
      await page.keyboard.press("ArrowDown");
      assert.equal(
        await page.locator(FW_INPUT).getAttribute("aria-activedescendant"),
        "combobox:frameworks:item:deno",
        "the next arrow walks on",
      );
      await page.keyboard.press("ArrowUp");
      assert.equal(
        await page.locator(FW_INPUT).getAttribute("aria-activedescendant"),
        "combobox:frameworks:item:svelte",
        "and ArrowUp walks back",
      );
    });

    await step("End then ArrowDown wraps to the first row", async () => {
      await page.keyboard.press("End");
      assert.equal(
        await page.locator(FW_INPUT).getAttribute("aria-activedescendant"),
        "combobox:frameworks:item:node",
        "End takes the last row",
      );
      await page.keyboard.press("ArrowDown");
      assert.equal(
        await page.locator(FW_INPUT).getAttribute("aria-activedescendant"),
        "combobox:frameworks:item:react",
        "loopFocus wraps past the end",
      );
    });

    await step("Enter selects the highlight and closes", async () => {
      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("Enter");
      assert.equal(await readout(page, "combobox-value"), "vue", "Enter selects the highlight");
      assert.equal(
        await page.locator(FW_INPUT).getAttribute("aria-expanded"),
        "false",
        "closeOnSelect closes the panel",
      );
    });

    await step("the trigger reopens the panel", async () => {
      await page.locator(FW_TRIGGER).click();
      assert.equal(
        await page.locator(FW_INPUT).getAttribute("aria-expanded"),
        "true",
        "the trigger opens the panel",
      );
      assert.equal(
        await page.locator(FW_ITEM("vue")).getAttribute("aria-selected"),
        "true",
        "the selection is marked in the list",
      );
      await page.keyboard.press("Escape");
    });

    await step("the multiple instance stays open on Enter", async () => {
      await page.locator(TOP_INPUT).click();
      await page.keyboard.press("Enter");
      assert.equal(await readout(page, "combobox-toppings"), "cheese", "the pick lands");
      assert.equal(
        await page.locator(TOP_INPUT).getAttribute("aria-expanded"),
        "true",
        "closeOnSelect false keeps the panel up",
      );
      await page.keyboard.press("Escape");
    });

    await step("autocomplete completes the city into the field", async () => {
      await page.locator(CITY_INPUT).click();
      await page.keyboard.press("ArrowDown");
      assert.equal(
        await page.locator(CITY_INPUT).inputValue(),
        "Athens",
        "the walk completes the row into the field",
      );
      await page.keyboard.press("Enter");
      assert.equal(await readout(page, "combobox-inline"), "athens", "Enter commits the completion");
    });

    await step("the host opens the controlled panel from outside", async () => {
      await page.getByRole("button", { name: "open from host" }).click();
      assert.equal(
        await page.locator(CTL_INPUT).getAttribute("aria-expanded"),
        "true",
        "the authored open reaches the machine",
      );
      // The open panel overlays its own toggle, so the host closes it the
      // way a user would — the panel is a layer above the page now.
      await page.keyboard.press("Escape");
      assert.equal(
        await page.locator(CTL_INPUT).getAttribute("aria-expanded"),
        "false",
        "and Escape closes it again",
      );
    });

    await step("the imperative commands move the single instance", async () => {
      await page.getByRole("button", { name: 'el.selectValue("deno")' }).click();
      assert.equal(await readout(page, "combobox-value"), "deno", "selectValue writes the selection");
      await page.getByRole("button", { name: 'el.setInputValue("sve")' }).click();
      assert.equal(await readout(page, "combobox-typed"), "sve", "setInputValue writes the field");
    });
  }));

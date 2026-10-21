/**
 * E2E: the forked-FSM select drives its machine in a real browser — the
 * closed combobox trigger, one click opening the panel with its four
 * options, the click pick with the readout and the hidden native select
 * carrying the value, the keyboard walk (Enter opens, the listbox walks,
 * Enter picks), Escape, and the multiple demo that stays open.
 */

import { strict as assert } from "node:assert";
import { runComponentSuite, step } from "./harness.ts";
import { type Browser, chromium, type Page } from "npm:playwright-core";


/** Part ids are the machine's scheme: `select:<element id>:<part>`. */
const at = (id: string, part: string): string => `[id="select:${id}:${part}"]`;
const S_ROOT = '[id="select:single"]';
const S_TRIGGER = at("single", "trigger");
const S_CONTENT = at("single", "content");
const S_HIDDEN = at("single", "hidden");
const S_ITEM = (value: string): string => at("single", `item:${value}`);
const M_ROOT = '[id="select:multi"]';
const M_TRIGGER = at("multi", "trigger");
const M_ITEM = (value: string): string => at("multi", `item:${value}`);

const readout = async (page: Page, id: string): Promise<string> =>
  (await page.locator(`#${id}`).textContent()) ?? "";

Deno.test("spin-select e2e", () =>
  runComponentSuite({ port: 5229, route: "/select", ready: S_TRIGGER }, async ({ page }) => {

    await step(
      "the trigger is a combobox and the panel is closed",
      async () => {
        assert.equal(
          await page.locator(S_TRIGGER).getAttribute("role"),
          "combobox",
          "the trigger is the combobox",
        );
        assert.equal(
          await page.locator(S_ROOT).getAttribute("data-state"),
          "closed",
          "the root reports closed",
        );
        assert.equal(
          await page.locator(S_TRIGGER).getAttribute("aria-expanded"),
          "false",
          "and the trigger reports collapsed",
        );
      },
    );

    await step("one click opens the panel with the four options", async () => {
      await page.locator(S_TRIGGER).click();
      assert.equal(
        await page.locator(S_ROOT).getAttribute("data-state"),
        "open",
        "the click opens the panel — no focus-first workaround needed",
      );
      assert.equal(
        await page.locator(S_TRIGGER).getAttribute("aria-expanded"),
        "true",
        "and the trigger reports expanded",
      );
      assert.equal(
        await page.locator(S_CONTENT).getByRole("option").count(),
        4,
        "the panel holds the four options",
      );
    });

    await step("clicking an option picks it and closes the panel", async () => {
      await page.locator(S_ITEM("node")).click();
      assert.equal(
        await readout(page, "select-value"),
        "node",
        "the readout shows the pick",
      );
      assert.equal(
        await page.locator(S_ROOT).getAttribute("data-state"),
        "closed",
        "the panel closes on the pick",
      );
      assert.equal(
        await page.locator(S_HIDDEN).inputValue(),
        "node",
        "the hidden native select carries the value",
      );
    });

    await step(
      "the keyboard walk opens, walks the listbox, and picks",
      async () => {
        // Opening hands the panel focus — the trigger's own keys stop
        // applying once the panel is up, so the arrow walk starts inside the
        // listbox, which is the component's arrow handler.
        await page.locator(S_TRIGGER).focus();
        await page.keyboard.press("Enter");
        assert.equal(
          await page.locator(S_ROOT).getAttribute("data-state"),
          "open",
          "Enter opens the panel",
        );
        assert.equal(
          await page.locator(S_CONTENT).getAttribute("aria-activedescendant"),
          "select:single:item:deno",
          "with the first option highlighted",
        );
        await page.keyboard.press("ArrowDown");
        assert.equal(
          await page.locator(S_CONTENT).getAttribute("aria-activedescendant"),
          "select:single:item:bun",
          "ArrowDown moves the highlight",
        );
        await page.keyboard.press("Enter");
        assert.equal(
          await readout(page, "select-value"),
          "bun",
          "Enter picks the highlight",
        );
        assert.equal(
          await page.locator(S_ROOT).getAttribute("data-state"),
          "closed",
          "and the panel closes",
        );
      },
    );

    await step("Escape closes the panel", async () => {
      await page.locator(S_TRIGGER).click();
      assert.equal(
        await page.locator(S_ROOT).getAttribute("data-state"),
        "open",
        "the panel opens again",
      );
      await page.keyboard.press("Escape");
      assert.equal(
        await page.locator(S_ROOT).getAttribute("data-state"),
        "closed",
        "Escape closes it",
      );
    });

    await step(
      "the multiple demo adds to the selection and stays open",
      async () => {
        await page.locator(M_TRIGGER).click();
        assert.equal(
          await page.locator(M_ROOT).getAttribute("data-state"),
          "open",
          "the multiple panel opens",
        );
        await page.locator(M_ITEM("node")).click();
        assert.equal(
          await page.locator(M_ITEM("node")).getAttribute("aria-selected"),
          "true",
          "the click adds to the selection",
        );
        assert.equal(
          await page.locator(M_ITEM("deno")).getAttribute("aria-selected"),
          "true",
          "the seeded values stay selected",
        );
        assert.equal(
          await page.locator(M_ITEM("bun")).getAttribute("aria-selected"),
          "true",
          "the seeded values stay selected",
        );
        assert.equal(
          await page.locator(M_ROOT).getAttribute("data-state"),
          "open",
          "the panel stays open",
        );
        await page.keyboard.press("Escape");
      },
    );

  }));

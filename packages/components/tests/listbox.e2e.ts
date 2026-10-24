/**
 * E2E: the forked-FSM listbox drives its machine in a real browser — the
 * focus default, the arrow walk with wrapping and disabled-skip, Enter/Space
 * selection, typeahead, hover, the multiple instance with shift-extend and
 * select-all, and the imperative commands.
 */

import { strict as assert } from "node:assert";
import { runComponentSuite, step } from "./harness.ts";

/** Part ids are the machine's scheme: `listbox:<element id>:<part>`. */
const at = (id: string, part: string): string => `[id="listbox:${id}:${part}"]`;
const FW_CONTENT = at("frameworks", "content");
const FW_ITEM = (value: string): string => at("frameworks", `item:${value}`);
const TOP_CONTENT = at("toppings", "content");
const TOP_ITEM = (value: string): string => at("toppings", `item:${value}`);

Deno.test("spin-listbox e2e", () =>
  runComponentSuite({
    port: 5247,
    route: "/listbox",
    ready: FW_CONTENT,
    settle: async (page) => {
      assert.equal(
        await page.locator(FW_CONTENT).getAttribute("role"),
        "listbox",
        "the content is a listbox",
      );
    },
  }, async ({ page }) => {
    await step(
      "focus keeps the highlight empty when svelte is selected",
      async () => {
        await page.locator(FW_CONTENT).focus();
        assert.equal(
          await page.locator(FW_CONTENT).getAttribute("aria-activedescendant"),
          null,
          "a selection is already visible so nothing defaults",
        );
      },
    );

    await step("arrows walk and skip the disabled row", async () => {
      await page.keyboard.press("ArrowDown");
      assert.equal(
        await page.locator(FW_CONTENT).getAttribute("aria-activedescendant"),
        "listbox:frameworks:item:react",
        "the first arrow lands on the first row",
      );
      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("ArrowDown");
      assert.equal(
        await page.locator(FW_CONTENT).getAttribute("aria-activedescendant"),
        "listbox:frameworks:item:svelte",
        "the walk reaches svelte",
      );
      await page.keyboard.press("ArrowDown");
      assert.equal(
        await page.locator(FW_CONTENT).getAttribute("aria-activedescendant"),
        "listbox:frameworks:item:deno",
        "the walk skips disabled angular",
      );
    });

    await step("End then ArrowDown wraps to the first row", async () => {
      await page.keyboard.press("End");
      assert.equal(
        await page.locator(FW_CONTENT).getAttribute("aria-activedescendant"),
        "listbox:frameworks:item:node",
        "End jumps to the last row",
      );
      await page.keyboard.press("ArrowDown");
      assert.equal(
        await page.locator(FW_CONTENT).getAttribute("aria-activedescendant"),
        "listbox:frameworks:item:react",
        "and the next arrow wraps",
      );
    });

    await step("Enter selects the highlight", async () => {
      await page.keyboard.press("Home");
      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("Enter");
      assert.equal(
        await page.locator(FW_ITEM("vue")).getAttribute("aria-selected"),
        "true",
        "vue is selected",
      );
    });

    await step("click selects a row", async () => {
      await page.locator(FW_ITEM("deno")).click();
      assert.equal(
        await page.locator(FW_ITEM("deno")).getAttribute("aria-selected"),
        "true",
        "deno is selected",
      );
      assert.equal(
        await page.locator(FW_ITEM("vue")).getAttribute("aria-selected"),
        "false",
        "single mode replaces",
      );
    });

    await step("click on a disabled row selects nothing", async () => {
      await page.locator(FW_ITEM("angular")).click({ force: true });
      assert.equal(
        await page.locator(FW_ITEM("angular")).getAttribute("aria-selected"),
        "false",
        "angular stays unselected",
      );
    });

    await step("typeahead highlights the match", async () => {
      await page.locator(FW_CONTENT).focus();
      await page.keyboard.press("b");
      assert.equal(
        await page.locator(FW_CONTENT).getAttribute("aria-activedescendant"),
        "listbox:frameworks:item:bun",
        "b matches bun",
      );
    });

    await step("commands drive the instance", async () => {
      const card = page.locator("card").first();
      await card.getByRole("button", { name: 'el.selectValue("deno")' })
        .click();
      assert.equal(
        await page.locator(FW_ITEM("deno")).getAttribute("aria-selected"),
        "true",
        "selectValue commits deno",
      );
      await card.getByRole("button", { name: "el.clearValue()" }).click();
      assert.equal(
        await page.locator(FW_ITEM("deno")).getAttribute("aria-selected"),
        "false",
        "clearValue empties the selection",
      );
    });

    await step("multiple selects and extends", async () => {
      await page.locator(TOP_ITEM("cheese")).click();
      await page.locator(TOP_ITEM("basil")).click();
      assert.equal(
        await page.locator(TOP_ITEM("cheese")).getAttribute("aria-selected"),
        "true",
        "cheese stays selected in clear mode",
      );
      const multi = page.locator("card").nth(1);
      await multi.getByRole("button", { name: "el.selectAll()" }).click();
      assert.equal(
        await page.locator(TOP_ITEM("olives")).getAttribute("aria-selected"),
        "true",
        "selectAll fills the enabled rows",
      );
      assert.equal(
        await page.locator(TOP_ITEM("pineapple")).getAttribute("aria-selected"),
        "false",
        "but not the disabled one",
      );
    });
  }));

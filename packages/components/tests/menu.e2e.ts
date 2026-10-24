/**
 * E2E: spin-menu drives its machine in a real browser — the trigger
 * contract, the keyboard map (arrows, Home/End, typeahead, Enter, Escape), a
 * submenu level that opens by hover dwell and by ArrowRight, and the rows
 * that stay inert.
 */

import { strict as assert } from "node:assert";
import { type Page } from "playwright-core";
import { delay, runComponentSuite, step } from "./harness.ts";


/**
 * Presses a row at its own coordinates. A row re-renders on every highlight
 * move, so a press aimed at a node captured before the pointer lands can hit
 * an element the framework has already replaced.
 */
async function pressRow(page: Page, selector: string): Promise<void> {
  const box = await page.locator(selector).boundingBox();
  if (box === null) throw new Error(`no box for ${selector}`);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await delay(200);
  const settled = await page.locator(selector).boundingBox();
  if (settled === null) throw new Error(`no box for ${selector}`);
  await page.mouse.click(
    settled.x + settled.width / 2,
    settled.y + settled.height / 2,
  );
}

await runComponentSuite({
  port: PORT,
  route: "/menu",
  ready: 'spin-menu [aria-haspopup="menu"]',
}, async ({ page }) => {

  const trigger = page.getByRole("button", { name: "File actions" });
  const owner = ((await trigger.getAttribute("id")) ?? "").replace(
    /:trigger$/,
    "",
  );
  assert.notEqual(owner, "", "the trigger carries its part id");

  /** Parts are scoped by the element's id: `menu:<id>:<part>`. */
  const part = (name: string): string => `[id="${owner}:${name}"]`;
  /** A row appends its value: `menu:<id>:item:<value>`. */
  const row = (value: string): string => `[id="${owner}:item:${value}"]`;
  /** A submenu level is its own instance, nested inside its row. */
  const submenuPanel = (value: string): string =>
    `${part(`submenu:${value}`)} > div > div.absolute > [role="menu"]`;
  /** A row of that level, reached through its panel. */
  const submenuRow = (value: string, rowValue: string): string =>
    `${submenuPanel(value)} [id$=":item:${rowValue}"]`;

  const panel = page.locator(part("positioner"));
  const menu = page.locator(part("content"));

  await step("renders the trigger contract, closed", async () => {
    assert.equal(await trigger.getAttribute("type"), "button");
    assert.equal(await trigger.getAttribute("aria-expanded"), "false");
    assert.equal(await panel.getAttribute("data-state"), "closed");
    assert.equal(await menu.getAttribute("data-state"), "closed");
    assert.equal(await menu.getAttribute("role"), "menu");
    assert.equal(
      await menu.getAttribute("aria-labelledby"),
      `${owner}:trigger`,
      "the menu is labelled by its trigger",
    );
    assert.equal(await panel.isVisible(), false, "the panel starts hidden");
    assert.equal(
      await page.locator(`${part("content")} [data-highlighted]`).count(),
      0,
    );
    assert.equal(await page.locator("#menu-open").textContent(), "false");
    assert.equal(
      await page.locator("#menu-selected").textContent(),
      "nothing selected yet",
    );
    assert.equal(await page.locator("#menu-highlighted").textContent(), "none");
  });

  await step("a click on the trigger opens the panel below it", async () => {
    await trigger.click();
    assert.equal(await trigger.getAttribute("aria-expanded"), "true");
    assert.equal(
      await trigger.getAttribute("aria-controls"),
      `${owner}:content`,
    );
    assert.equal(await panel.getAttribute("data-state"), "open");
    assert.equal(await panel.isVisible(), true);
    assert.equal(await menu.getAttribute("data-state"), "open");
    assert.equal(
      await page.locator("#menu-open").textContent(),
      "true",
      "open-change reached the host",
    );

    // The panel scales in (`scale-95` → `100`), so its bounding box is the
    // mid-animation one until the transition settles.
    await page.waitForTimeout(250);
    const triggerBox = await trigger.boundingBox();
    const panelBox = await panel.boundingBox();
    if (triggerBox === null || panelBox === null) {
      throw new Error("no box to compare");
    }
    assert.ok(
      panelBox.y >= triggerBox.y + triggerBox.height - 1,
      `the panel (y=${panelBox.y}) sits below the trigger (bottom=${
        triggerBox.y + triggerBox.height
      })`,
    );
    assert.ok(
      panelBox.width >= triggerBox.width - 1,
      `the panel (w=${panelBox.width}) is at least as wide as the trigger (w=${triggerBox.width})`,
    );
  });

  await step("a second click on the trigger closes it", async () => {
    await trigger.click();
    assert.equal(await trigger.getAttribute("aria-expanded"), "false");
    assert.equal(await panel.getAttribute("data-state"), "closed");
    assert.equal(await panel.isVisible(), false);
    assert.equal(await page.locator("#menu-open").textContent(), "false");
  });

  await step("ArrowDown on the trigger opens on the first item", async () => {
    await trigger.focus();
    await page.keyboard.press("ArrowDown");
    assert.equal(await trigger.getAttribute("aria-expanded"), "true");
    assert.equal(await panel.isVisible(), true);
    assert.equal(
      await menu.getAttribute("aria-activedescendant"),
      `${owner}:item:new`,
      "the first item is the active descendant",
    );
    assert.equal(
      await page.locator(`${part("content")} [data-highlighted]`).count(),
      1,
      "exactly one row is highlighted",
    );
    assert.equal(
      await page.locator(row("new")).getAttribute("data-highlighted"),
      "",
      "the first row is the highlighted one",
    );
    assert.equal(await page.locator("#menu-highlighted").textContent(), "new");
    assert.equal(
      await menu.evaluate((el) => document.activeElement === el),
      true,
      "the open panel holds focus",
    );
  });

  await step("arrows, Home and End move the highlight", async () => {
    await page.keyboard.press("ArrowDown");
    assert.equal(await page.locator("#menu-highlighted").textContent(), "open");
    await page.keyboard.press("End");
    assert.equal(
      await page.locator("#menu-highlighted").textContent(),
      "copy",
      "End lands on the last row",
    );
    await page.keyboard.press("Home");
    assert.equal(
      await page.locator("#menu-highlighted").textContent(),
      "new",
      "Home lands on the first row",
    );
    await page.keyboard.press("ArrowUp");
    assert.equal(
      await page.locator("#menu-highlighted").textContent(),
      "new",
      "the highlight holds at the top row without looping",
    );
  });

  await step("typeahead jumps to the row starting with the key", async () => {
    await page.keyboard.type("c");
    assert.equal(await page.locator("#menu-highlighted").textContent(), "cut");
  });

  await step("Enter selects the highlighted row and closes", async () => {
    await page.keyboard.press("Enter");
    assert.equal(await page.locator("#menu-selected").textContent(), "Cut");
    assert.equal(
      await page.locator("#menu-open").textContent(),
      "false",
      "open-change reported the close",
    );
    assert.equal(await panel.getAttribute("data-state"), "closed");
    assert.equal(await panel.isVisible(), false);
    assert.equal(await page.locator("#menu-highlighted").textContent(), "none");
  });

  await step("a disabled row is inert", async () => {
    await trigger.click();
    const disabled = page.locator(row("delete"));
    assert.equal(await disabled.getAttribute("role"), "menuitem");
    assert.equal(await disabled.getAttribute("aria-disabled"), "true");
    assert.equal(await disabled.getAttribute("data-disabled"), "");
    assert.equal(
      await disabled.evaluate((el) => getComputedStyle(el).opacity),
      "0.5",
      "the row paints as disabled",
    );
    await pressRow(page, row("delete"));
    await delay(150);
    assert.equal(
      await page.locator("#menu-selected").textContent(),
      "Cut",
      "the press on the disabled row selected nothing",
    );
    assert.equal(
      await page.locator(`${part("content")} [data-highlighted]`).count(),
      0,
      "the disabled row takes no highlight",
    );
    assert.equal(
      await panel.getAttribute("data-state"),
      "open",
      "the menu stayed open",
    );
    assert.equal(await page.locator("#menu-open").textContent(), "true");
    await page.keyboard.press("Escape");
  });

  await step("a submenu level opens on hover dwell", async () => {
    await trigger.click();
    await page.locator(row("share")).hover();
    await delay(400);
    const child = page.locator(submenuPanel("share"));
    assert.equal(
      await child.getAttribute("data-state"),
      "open",
      "the child panel opened",
    );
    assert.equal(await child.isVisible(), true, "the child panel is visible");
    assert.equal(
      await child.getByRole("menuitem").count(),
      3,
      "the child panel has its three rows",
    );
    assert.equal(
      await page.locator(row("share")).getAttribute("aria-expanded"),
      "true",
      "the row reports its submenu as expanded",
    );
    assert.equal(
      await child.getByRole("menuitem", { name: "Email link" }).count(),
      1,
      "the child row is reachable by role and name",
    );
    assert.equal(
      await child.getByRole("menuitem", { name: "Permissions" }).count(),
      1,
      "the nested row is reachable by role and name",
    );
  });

  await step(
    "selecting inside the submenu reports upward and closes the chain",
    async () => {
      await pressRow(page, submenuRow("share", "mail"));
      assert.equal(
        await page.locator("#menu-selected").textContent(),
        "Email link",
      );
      assert.equal(
        await page.locator("#menu-open").textContent(),
        "false",
        "open-change reported the close of the whole chain",
      );
      assert.equal(await panel.getAttribute("data-state"), "closed");
      assert.equal(
        await page.locator(submenuPanel("share")).getAttribute("data-state"),
        "closed",
        "the child panel closed too",
      );
    },
  );

  await step("ArrowRight enters the submenu from the keyboard", async () => {
    await trigger.focus();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    assert.equal(
      await page.locator("#menu-highlighted").textContent(),
      "share",
    );
    await page.keyboard.press("ArrowRight");
    const child = page.locator(submenuPanel("share"));
    assert.equal(
      await child.getAttribute("data-state"),
      "open",
      "ArrowRight opened it",
    );
    assert.equal(await child.isVisible(), true);
  });

  await step("Escape closes the open level", async () => {
    await page.keyboard.press("Escape");
    assert.equal(await panel.getAttribute("data-state"), "closed");
    assert.equal(await panel.isVisible(), false);
    assert.equal(
      await page.locator(submenuPanel("share")).getAttribute("data-state"),
      "closed",
    );
    assert.equal(await page.locator("#menu-open").textContent(), "false");
  });

  await step("a press outside the menu closes it", async () => {
    await trigger.click();
    assert.equal(
      await page.locator("#menu-open").textContent(),
      "true",
      "the menu opened for this step",
    );
    await page.locator("h2").first().click({ position: { x: 2, y: 2 } });
    assert.equal(await panel.getAttribute("data-state"), "closed");
    assert.equal(await panel.isVisible(), false);
    assert.equal(await page.locator("#menu-open").textContent(), "false");
  });
});


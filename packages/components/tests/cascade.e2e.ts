/**
 * E2E: spin-cascade-select drives its machine in a real browser — the
 * trigger contract, the level stack that grows with the highlight, the
 * keyboard map (arrows in and out, Home/End, Enter, Escape), the mouse path
 * over a disabled row, the controlled command surface, and the hidden input
 * that carries the value to a form.
 *
 * Run explicitly (not in the default `deno task test`):
 *   cd packages/components && deno test -A tests/cascade.e2e.ts
 *
 * Builds the specimens app, serves dist, drives real Chromium via Playwright.
 * Requires the Playwright browser once: `bunx playwright install chromium`.
 * Fails loud naming the step; silent on success.
 *
 * A `Deno.test` (not a program run by `deno run`): the shared harness the
 * slider, carousel and accordion e2e files use, so the task and the file shape
 * match.
 */

import { strict as assert } from "node:assert";
import { delay, runComponentSuite, step } from "./harness.ts";
import { type Page } from "npm:playwright-core";


/** Parts are addressed by the machine's id scheme: `cascade:<id>:<part>`. */
const ROOT_EL = "spin-cascade-select";
const TRIGGER = `${ROOT_EL} [role="combobox"]`;
const CONTENT = `${ROOT_EL} [role="listbox"]`;
const LEVEL = `${ROOT_EL} [role="group"]`;

/** Presses the trigger at its own coordinates: it re-measures its geometry on
 *  every machine move, so a press aimed at a box captured before the pointer
 *  lands can hit an element the framework has already replaced. */
async function pressTrigger(page: Page): Promise<void> {
  const box = await page.locator(TRIGGER).boundingBox();
  if (box === null) throw new Error("no box for the trigger");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await delay(100);
  const settled = await page.locator(TRIGGER).boundingBox();
  if (settled === null) throw new Error("no box for the trigger");
  await page.mouse.click(settled.x + settled.width / 2, settled.y + settled.height / 2);
}

/** Presses a row at its own coordinates: a row re-renders on every highlight
 *  move, so a press aimed at a node captured before the pointer lands can hit
 *  an element the framework has already replaced. */
async function pressRow(page: Page, selector: string): Promise<void> {
  const box = await page.locator(selector).boundingBox();
  if (box === null) throw new Error(`no box for ${selector}`);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await delay(150);
  const settled = await page.locator(selector).boundingBox();
  if (settled === null) throw new Error(`no box for ${selector}`);
  await page.mouse.click(settled.x + settled.width / 2, settled.y + settled.height / 2);
}

Deno.test("spin-cascade-select e2e", () =>
  runComponentSuite({ port: 5214, route: "/cascade", ready: TRIGGER }, async ({ page }) => {
    const trigger = page.locator(TRIGGER);
    const owner = ((await trigger.getAttribute("id")) ?? "").replace(/:trigger$/, "");
    assert.notEqual(owner, "", "the trigger carries its part id");
    const part = (name: string): string => `[id="${owner}:${name}"]`;
    const item = (valuePath: string): string => `[id="${owner}:item:${valuePath}"]`;
    const list = (valuePath: string): string => `[id="${owner}:list:${valuePath}"]`;
    const itemEl = (valuePath: string) => page.locator(item(valuePath));
    const panel = page.locator(part("positioner"));
    /** The panel's state from the DOM contract, not from CSS: the entrance
     *  animation scales and fades the panel, so a visibility check would race
     *  the transition rather than the machine. */
    const panelOpen = async (): Promise<boolean> =>
      (await panel.getAttribute("data-state")) === "open" &&
      (await page.locator(CONTENT).getAttribute("hidden")) === null;

    await step("renders the trigger contract, closed", async () => {
      assert.equal(await trigger.getAttribute("aria-expanded"), "false", "the trigger starts collapsed");
      assert.equal(await trigger.getAttribute("aria-haspopup"), "listbox", "it owns a listbox");
      assert.equal(await trigger.getAttribute("aria-controls"), `${owner}:content`, "it points at the content");
      assert.equal(await page.locator(CONTENT).getAttribute("role"), "listbox", "the content is a listbox");
      assert.equal(await panelOpen(), false, "the panel starts hidden");
      assert.equal(await panel.getAttribute("data-state"), "closed", "the panel reports closed");
      assert.equal(await page.locator("#cascade-open").textContent(), "false", "the host sees closed");
      assert.equal(await page.locator("#cascade-value").textContent(), "—", "no value is selected");
      assert.equal(
        await page.locator(part("hidden-input")).inputValue(),
        "",
        "the hidden input submits an empty value",
      );
    });

    await step("a click on the trigger opens the panel below it", async () => {
      await trigger.click();
      assert.equal(await trigger.getAttribute("aria-expanded"), "true", "the trigger reports expanded");
      assert.equal(await panel.getAttribute("data-state"), "open", "the panel reports open");
      assert.equal(await panelOpen(), true, "the panel is visible");
      assert.equal(await page.locator("#cascade-open").textContent(), "true", "open-change reached the host");
      // Layout sizes, not bounding boxes: the panel is mid-entrance (`scale-95`
      // to `scale-100`), and a transform would shrink the measured box.
      const widthOf = (selector: string) =>
        page.evaluate((sel) => {
          const el = document.querySelector(sel);
          return el === null ? 0 : (el as HTMLElement).offsetWidth;
        }, selector);
      const triggerBox = await trigger.boundingBox();
      const panelBox = await panel.boundingBox();
      if (triggerBox === null || panelBox === null) throw new Error("no box to compare");
      assert.ok(
        panelBox.y >= triggerBox.y + triggerBox.height - 1,
        `the panel (y=${panelBox.y}) sits below the trigger (bottom=${triggerBox.y + triggerBox.height})`,
      );
      assert.ok(
        await widthOf(part("positioner")) >= (await widthOf(TRIGGER)) - 1,
        "the panel is at least as wide as the trigger, through the anchor var",
      );
      assert.equal(await page.locator(LEVEL).count(), 1, "opening shows the root level alone");
      assert.equal(
        await page.locator(`${LEVEL} [role="treeitem"]`).count(),
        2,
        "the root level lists the two continents",
      );
    });

    await step("ArrowDown highlights a root and drills into its level", async () => {
      // The trigger's own keys are the closed-panel path, so close first.
      await pressTrigger(page);
      assert.equal(await page.locator("#cascade-open").textContent(), "false", "the second click closed it");
      await trigger.focus();
      await page.keyboard.press("ArrowDown");
      assert.equal(await page.locator("#cascade-highlighted").textContent(), "asia", "the first root is highlighted");
      assert.equal(await itemEl("asia").getAttribute("data-highlighted"), "", "the row carries the attribute");
      assert.equal(await itemEl("asia").getAttribute("aria-expanded"), "true", "the branch reports expanded");
      assert.equal(
        await itemEl("asia").getAttribute("aria-controls"),
        `${owner}:list:asia`,
        "it points at its own level's list",
      );
      assert.equal(await page.locator(LEVEL).count(), 2, "the highlighted branch adds its level");
      assert.equal(
        await page.locator(list("asia")).getAttribute("aria-level"),
        "1",
        "the drilled level reports its depth",
      );
    });

    await step("arrows walk the level, skipping the disabled row", async () => {
      await page.keyboard.press("ArrowDown");
      assert.equal(await page.locator("#cascade-highlighted").textContent(), "europe", "arrow down moves to the next root");
      await page.keyboard.press("ArrowDown");
      assert.equal(await page.locator("#cascade-highlighted").textContent(), "europe", "the last root is the boundary");
      await page.keyboard.press("ArrowUp");
      assert.equal(await page.locator("#cascade-highlighted").textContent(), "asia", "arrow up walks back");
      await page.keyboard.press("ArrowRight");
      assert.equal(
        await page.locator("#cascade-highlighted").textContent(),
        "asia / india",
        "arrow right drills into the first child",
      );
      assert.equal(await page.locator(LEVEL).count(), 3, "the deepest level joins the stack");
      await page.keyboard.press("ArrowRight");
      assert.equal(
        await page.locator("#cascade-highlighted").textContent(),
        "asia / india / haryana",
        "and again, one level deeper",
      );
      await page.keyboard.press("End");
      assert.equal(
        await page.locator("#cascade-highlighted").textContent(),
        "asia / india / karnataka",
        "end takes the level's last enabled row, so the disabled one is skipped",
      );
      await page.keyboard.press("ArrowDown");
      assert.equal(
        await page.locator("#cascade-highlighted").textContent(),
        "asia / india / karnataka",
        "the last enabled row is the boundary",
      );
      await page.keyboard.press("Home");
      assert.equal(
        await page.locator("#cascade-highlighted").textContent(),
        "asia / india / haryana",
        "home takes the level's first row",
      );
    });

    await step("Enter commits a leaf, closes the panel and reports the value", async () => {
      await page.keyboard.press("Enter");
      assert.equal(await page.locator("#cascade-value").textContent(), "Haryana", "the path's labels are the value text");
      assert.equal(await page.locator("#cascade-open").textContent(), "false", "open-change reported the close");
      assert.equal(await panelOpen(), false, "the panel closed");
      assert.equal(
        await page.locator(part("hidden-input")).inputValue(),
        "asia,india,haryana",
        "the hidden input carries the path a form submits",
      );
      assert.equal(await page.locator("#cascade-changes").textContent(), "1", "value-change reached the host");
      assert.equal(await trigger.getAttribute("aria-expanded"), "false", "the trigger collapsed with it");
      assert.equal(
        await page.locator(part("value-text")).textContent(),
        "Asia / India / Haryana",
        "the trigger shows the labels along the path",
      );
    });

    await step("Escape returns focus to the trigger", async () => {
      // The select closed the panel; the trigger still opens it from the keyboard.
      await trigger.focus();
      await page.keyboard.press("ArrowDown");
      assert.equal(await panelOpen(), true, "the panel opened");
      assert.equal(
        await page.locator("#cascade-highlighted").textContent(),
        "asia",
        "arrow down opens on the first root, not on the previous selection",
      );
      await page.keyboard.press("Escape");
      assert.equal(await panel.getAttribute("data-state"), "closed", "escape closes the panel");
      assert.equal(await page.locator("#cascade-open").textContent(), "false", "the host sees the close");
      assert.equal(
        await page.evaluate(() => document.activeElement?.getAttribute("role")),
        "combobox",
        "focus returned to the trigger",
      );
      await page.keyboard.press("ArrowDown");
      assert.equal(await panelOpen(), true, "the trigger still opens from the keyboard");
      assert.equal(await page.locator("#cascade-highlighted").textContent(), "asia", "on the first root");
    });

    await step("a click on a branch drills in, a click on a leaf selects", async () => {
      // The trigger's mouse path is covered above; this step opens from the
      // keyboard and then drives the panel with the mouse.
      await trigger.focus();
      await page.keyboard.press("ArrowDown");
      assert.equal(await panelOpen(), true, "the panel opened");
      await pressRow(page, item("europe"));
      assert.equal(await page.locator(LEVEL).count(), 2, "clicking a branch adds its level");
      assert.equal(await page.locator("#cascade-highlighted").textContent(), "europe", "the branch takes the highlight");
      assert.equal(await itemEl("europe").getAttribute("data-highlighted"), "", "and stays highlighted");
      await pressRow(page, item("europe,france"));
      assert.equal(await page.locator(LEVEL).count(), 3, "the nested branch drills one deeper");
      assert.equal(
        await page.locator("#cascade-highlighted").textContent(),
        "europe / france",
        "the nested branch takes the highlight",
      );
      await pressRow(page, `${list("europe,france")} [id="${owner}:item:europe,france,lyon"]`);
      assert.equal(await page.locator("#cascade-value").textContent(), "Lyon", "the leaf's label is the value");
      assert.equal(await page.locator("#cascade-open").textContent(), "false", "the panel closed on the select");
      assert.equal(await panelOpen(), false, "and it is hidden");
      assert.equal(
        await page.locator(LEVEL).first().isVisible(),
        false,
        "the levels sit inside the hidden panel while closed",
      );
    });

    await step("a disabled row is inert", async () => {
      await pressTrigger(page);
      await pressRow(page, item("asia"));
      await pressRow(page, item("asia,india"));
      const disabled = page.locator(`${list("asia,india")} [id="${owner}:item:asia,india,punjab"]`);
      assert.equal(await disabled.getAttribute("aria-disabled"), "true", "the row reports disabled");
      assert.equal(await disabled.getAttribute("data-disabled"), "", "and carries the attribute");
      assert.equal(
        await disabled.evaluate((el) => getComputedStyle(el).opacity),
        "0.5",
        "the row paints as disabled",
      );
      await pressRow(page, `${list("asia,india")} [id="${owner}:item:asia,india,punjab"]`);
      await delay(150);
      assert.equal(await page.locator("#cascade-value").textContent(), "Lyon", "the press selected nothing");
      assert.equal(await page.locator("#cascade-open").textContent(), "true", "and the panel stayed open");
      await page.keyboard.press("Escape");
    });

    await step("the clear trigger empties the value", async () => {
      assert.equal(await page.locator(part("clear-trigger")).getAttribute("hidden"), null, "a selection shows the clear trigger");
      await page.locator(part("clear-trigger")).click();
      assert.equal(await page.locator("#cascade-value").textContent(), "—", "the value clears");
      assert.equal(await page.locator(TRIGGER).getAttribute("aria-expanded"), "false", "the trigger is still there");
      assert.equal(await page.locator("#cascade-changes").textContent(), "3", "value-change fired again");
      assert.equal(await page.locator(part("clear-trigger")).getAttribute("hidden"), "", "and the clear trigger hides");
    });

    await step("the host's setValue command drives the machine", async () => {
      await page.getByRole("button", { name: "el.setValue([…])" }).click();
      assert.equal(await page.locator("#cascade-value").textContent(), "Haryana", "the command's value lands");
      assert.equal(
        await page.locator(part("hidden-input")).inputValue(),
        "asia,india,haryana",
        "and the hidden input follows",
      );
    });

    await step("a press outside closes the panel", async () => {
      await pressTrigger(page);
      assert.equal(await page.locator("#cascade-open").textContent(), "true", "the panel opened");
      await page.locator("h2").first().click({ position: { x: 2, y: 2 } });
      assert.equal(await page.locator("#cascade-open").textContent(), "false", "the outside press closed it");
      assert.equal(await panelOpen(), false, "and it is hidden");
    });
  }));

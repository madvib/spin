/**
 * E2E: spin-tags-input drives its machine in a real browser — the
 * keyboard map, the pointer gestures, edit-in-place, the max/overflow and
 * blurBehavior contracts, the host commands, the live-region
 * announcements and the aria contract, with zero page errors.
 *
 * Run explicitly (not in default `deno task test`):
 *   cd packages/components && deno test -A tests/tags.e2e.ts
 *
 * Builds the specimens app, serves dist, drives real Chromium via Playwright.
 * Requires the Playwright browser once: `bunx playwright install chromium`.
 * Fails loud naming the step; silent on success.
 */

import { strict as assert } from "node:assert";
import { runComponentSuite, step } from "./harness.ts";
import { chromium, type Browser } from "npm:playwright-core";


/** Parts are addressed by the machine's id scheme: `tags-input:<id>:<part>`. */
const ROOT_PART = "spin-tags-input > div";
const CONTROL = '[id$=":control"]';
/** The entry field, as opposed to the inline tag inputs and the hidden one. */
const INPUT = '[id$=":input"]:not([id*=":tag:"])';
const HIDDEN_INPUT = '[id$=":hidden-input"]';
const LABEL = 'label[id$=":label"]';
const CLEAR_TRIGGER = '[id$=":clear-btn"]';
const LIVE_REGION = '[id$=":live-region"]';
/** A tag's preview: the id-bearing child of the item, minus its inputs. */
const TAG_PREVIEW = '[id*=":tag:"]:not([id$=":input"]):not([id$=":delete-btn"])';
const TAG_TEXT = `${TAG_PREVIEW} > span.truncate`;
const DELETE_TRIGGER = '[id$=":delete-btn"]';
const TAG_INPUT = '[id*=":tag:"][id$=":input"]:not([hidden])';

Deno.test("spin-tags-input e2e", () =>
  runComponentSuite({ port: 5215, route: "/tags", ready: INPUT }, async ({ page }) => {
  /** The tag chips in order, by their text. */
  const tags = async (): Promise<string[]> =>
    page.locator(TAG_TEXT).allTextContents();
  const readout = async (id: string): Promise<string> =>
    (await page.locator(`#${id}`).textContent()) ?? "";
  const press = async (key: string): Promise<void> => {
    await page.keyboard.press(key);
  };
    await step("renders the seeded tags and the empty field", async () => {
      assert.deepEqual(await tags(), ["react", "solid"], "the seed renders as chips");
      assert.equal(
        await page.locator(INPUT).inputValue(),
        "",
        "the entry field starts empty",
      );
      assert.equal(
        await readout("tags-value"),
        "react, solid",
        "the host readout mirrors the value",
      );
      assert.equal(await readout("tags-count"), "2", "the count reads 2");
      // Form plumbing: the hidden input carries the joined value.
      assert.equal(
        await page.locator(HIDDEN_INPUT).inputValue(),
        "react, solid",
        "the hidden input carries the joined value for forms",
      );
      // The live region exists and is empty until a mutation announces.
      assert.equal(
        await page.locator(LIVE_REGION).getAttribute("aria-live"),
        "assertive",
        "the live region is assertive",
      );
      assert.equal(
        await page.locator(LIVE_REGION).textContent(),
        "",
        "nothing is announced at rest",
      );
      assert.equal(
        await page.locator(ROOT_PART).getAttribute("data-empty"),
        null,
        "a seeded input is not empty",
      );
    });

    await step("has the aria contract", async () => {
      const labelFor = await page.locator(LABEL).getAttribute("for");
      const inputId = await page.locator(INPUT).getAttribute("id");
      assert.equal(labelFor, inputId, "the label names the entry field");
      assert.equal(
        await page.locator(INPUT).getAttribute("aria-invalid"),
        "false",
        "a seeded input is not invalid",
      );
      assert.equal(
        await page.locator(DELETE_TRIGGER).first().getAttribute("aria-label"),
        "Delete tag react",
        "the delete trigger is labelled by its tag",
      );
      assert.equal(
        await page.locator(CLEAR_TRIGGER).getAttribute("aria-label"),
        "Clear all tags",
        "the clear trigger is labelled",
      );
    });

    await step("a form reset restores the seed", async () => {
      await page.locator(INPUT).click();
      await page.keyboard.type("extra");
      await press("Enter");
      assert.deepEqual(await tags(), ["react", "solid", "extra"], "the chip was added");
      await page.getByRole("button", { name: "form reset" }).click();
      assert.deepEqual(await tags(), ["react", "solid"], "the reset restores the seed");
      assert.equal(
        await page.locator(HIDDEN_INPUT).inputValue(),
        "react, solid",
        "the hidden input follows the reset",
      );
    });

    await step("Enter and the delimiter add tags, sanitized by the host", async () => {
      await page.locator(INPUT).click();
      await page.keyboard.type("Deno");
      await press("Enter");
      assert.deepEqual(
        await tags(),
        ["react", "solid", "deno"],
        "the host's sanitizeValue lowercased the tag",
      );
      assert.equal(await page.locator(LIVE_REGION).textContent(), "Added deno", "the add is announced");
      assert.equal(await page.locator(INPUT).inputValue(), "", "the field cleared");
      await page.keyboard.type("Fresh,");
      assert.deepEqual(
        await tags(),
        ["react", "solid", "deno", "fresh"],
        "the delimiter key adds without the delimiter",
      );
      assert.equal(await readout("tags-value"), "react, solid, deno, fresh", "the readout follows");
    });

    await step("a duplicate is refused", async () => {
      await page.locator(INPUT).click();
      await page.keyboard.type("deno");
      await press("Enter");
      assert.deepEqual(
        await tags(),
        ["react", "solid", "deno", "fresh"],
        "no duplicate chip appears",
      );
      assert.equal(await readout("tags-count"), "4", "the count holds");
    });

    await step("a rejected value reports value-invalid and adds nothing", async () => {
      await page.locator(INPUT).click();
      await page.keyboard.type("banned");
      await press("Enter");
      assert.deepEqual(await tags(), ["react", "solid", "deno", "fresh"], "the tag is refused");
      assert.equal(await readout("tags-invalid"), "invalidTag", "value-invalid reported");
    });

    await step("the delete trigger removes a chip", async () => {
      await page.locator(DELETE_TRIGGER).first().click();
      assert.deepEqual(await tags(), ["solid", "deno", "fresh"], "the first chip is gone");
      assert.equal(await page.locator(LIVE_REGION).textContent(), "Removed react", "the delete is announced");
    });

    await step("ArrowLeft walks the chips and Backspace removes", async () => {
      await page.locator(INPUT).click();
      // An empty field with the caret at the start is the gate.
      await page.keyboard.press("Control+a");
      await page.keyboard.press("Backspace");
      await press("ArrowLeft");
      assert.equal(
        await page.locator(`${TAG_PREVIEW}[data-highlighted]`).count(),
        1,
        "one chip is highlighted",
      );
      assert.equal(
        await page.locator(`${TAG_PREVIEW}[data-highlighted]`).first().getAttribute("data-value"),
        "fresh",
        "the last chip is highlighted",
      );
      await press("Backspace");
      assert.deepEqual(await tags(), ["solid", "deno"], "the highlighted chip is removed");
    });

    await step("a double-click edits a chip in place", async () => {
      // The text, not the chip box: the delete trigger sits inside the chip.
      await page.locator(TAG_TEXT).first().dblclick();
      const editing = page.locator(TAG_INPUT);
      assert.equal(await editing.count(), 1, "one inline input is open");
      assert.equal(await editing.inputValue(), "solid", "it carries the chip's value");
      await editing.fill("solidjs");
      await press("Enter");
      assert.deepEqual(await tags(), ["solidjs", "deno"], "the chip is rewritten in place");
      assert.equal(
        await page.locator(LIVE_REGION).textContent(),
        "Tag update to solidjs. Tag solidjs selected. Press enter to edit, delete or backspace to remove.",
        "the update and the selection that follows it announce together",
      );
      assert.equal(await page.locator(TAG_INPUT).count(), 0, "the inline input closes");
    });

    await step("an emptied edit removes the chip", async () => {
      await page.locator(TAG_TEXT).first().dblclick();
      await page.locator(TAG_INPUT).fill("");
      await press("Enter");
      assert.deepEqual(await tags(), ["deno"], "the emptied chip is removed");
    });

    await step("max caps the list and marks it invalid", async () => {
      await page.getByRole("button", { name: "max: unlimited" }).click();
      await page.locator(INPUT).click();
      await page.keyboard.type("extra");
      await press("Enter");
      assert.deepEqual(await tags(), ["deno", "extra"], "the cap of two is reached");
      await page.keyboard.type("more");
      await press("Enter");
      assert.deepEqual(await tags(), ["deno", "extra"], "the insert is refused at the cap");
      assert.equal(await page.locator(INPUT).inputValue(), "more", "the text survives the refusal");
      assert.equal(await readout("tags-invalid"), "invalidTag", "the host validator runs on the refused text");
    });

    await step("allowOverflow lets the cap be passed and marks the root invalid", async () => {
      await page.getByRole("button", { name: "allowOverflow: false" }).click();
      await page.locator(INPUT).click();
      // The refused text from the cap step survived; sweep it out first.
      await page.keyboard.press("Control+a");
      await page.keyboard.press("Backspace");
      await page.keyboard.type("third");
      await press("Enter");
      assert.deepEqual(await tags(), ["deno", "extra", "third"], "overflow lets the chip through");
      assert.equal(
        await page.locator(ROOT_PART).getAttribute("data-invalid"),
        "",
        "the root reports invalid while overflowing",
      );
      assert.equal(
        await page.locator(INPUT).getAttribute("aria-invalid"),
        "true",
        "the field reports invalid",
      );
      assert.equal(await readout("tags-invalid"), "rangeOverflow", "the overflow is reported");
      await page.getByRole("button", { name: "allowOverflow: true" }).click();
      await page.getByRole("button", { name: "max: 2" }).click();
    });

    await step("blurBehavior add turns the field into a chip on blur", async () => {
      await page.getByRole("button", { name: "blurBehavior: none" }).click();
      await page.locator(INPUT).click();
      await page.keyboard.type("onblur");
      await page.locator(LABEL).click();
      assert.deepEqual(
        await tags(),
        ["deno", "extra", "third", "onblur"],
        "the blur added the typed text",
      );
      await page.getByRole("button", { name: "blurBehavior: add" }).click();
    });

    await step("the host commands drive the machine", async () => {
      await page.getByRole("button", { name: 'el.setValue(["deno", "fresh", "jsr"])' }).click();
      assert.deepEqual(await tags(), ["deno", "fresh", "jsr"], "setValue replaces the list");
      // The route carries two `el.addValue("elm")` buttons — the host-command
      // row and the seeded-add pair, which is the id-bearing one.
      await page
        .locator('button:not([id]):text-is("el.addValue(\\"elm\\")")')
        .click();
      assert.deepEqual(await tags(), ["deno", "fresh", "jsr", "elm"], "addValue appends");
      await page.getByRole("button", { name: 'el.setValueAtIndex(0, "rewritten")' }).click();
      assert.deepEqual(await tags(), ["rewritten", "fresh", "jsr", "elm"], "setValueAtIndex rewrites");
      await page.getByRole("button", { name: "el.setInputValue(\"typed\")" }).click();
      assert.equal(await page.locator(INPUT).inputValue(), "typed", "setInputValue writes the field");
      await page.getByRole("button", { name: "el.clearInputValue()" }).click();
      assert.equal(await page.locator(INPUT).inputValue(), "", "clearInputValue clears the field");
      await page.getByRole("button", { name: "el.focus()" }).click();
      assert.equal(
        await page.evaluate(() => document.activeElement?.id),
        await page.locator(INPUT).getAttribute("id"),
        "focus lands on the entry field",
      );
      await page.getByRole("button", { name: "el.clearValue()" }).click();
      assert.deepEqual(await tags(), [], "clearValue empties the list");
      assert.equal(
        await page.locator(ROOT_PART).getAttribute("data-empty"),
        "",
        "the root reports the empty state",
      );
      assert.equal(
        await page.locator(CLEAR_TRIGGER).getAttribute("hidden"),
        "",
        "the clear trigger hides on the empty state",
      );
      assert.equal(await page.locator(LIVE_REGION).textContent(), "No tags", "the clear is announced");
      assert.equal(await page.locator(INPUT).getAttribute("placeholder"), "Add a skill", "the placeholder shows when empty");
    });

    await step("a disabled input is inert", async () => {
      await page.getByRole("button", { name: "disable" }).click();
      await page.waitForSelector(`${INPUT}[disabled]`, { timeout: 2000 });
      await page.locator(INPUT).click({ force: true });
      await page.keyboard.type("nope");
      assert.deepEqual(await tags(), [], "a disabled input adds nothing");
      assert.equal(await readout("tags-count"), "0", "the count holds");
      await page.getByRole("button", { name: "enable" }).click();
      await page.waitForSelector(`${INPUT}:not([disabled])`, { timeout: 2000 });
    });

    await step("a read-only input keeps the tags and refuses edits", async () => {
      await page.getByRole("button", { name: 'el.addValue("kept")' }).click();
      await page.getByRole("button", { name: "readOnly: false" }).click();
      await page.waitForSelector(`${INPUT}[disabled]`, { timeout: 2000 });
      await page.locator(INPUT).click({ force: true });
      await page.keyboard.type("nope");
      await press("Enter");
      assert.deepEqual(await tags(), ["kept"], "a read-only input refuses edits");
      assert.equal(
        await page.locator(CONTROL).getAttribute("tabindex"),
        "0",
        "the control is reachable while read-only",
      );
      await page.getByRole("button", { name: "readOnly: true" }).click();
    });
  }));

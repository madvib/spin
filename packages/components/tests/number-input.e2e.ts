/**
 * E2E: the forked-FSM number input drives its machine in a real browser —
 * the keyboard map, the press-and-hold, the scrubber drag, the wheel, the
 * aria contract, the host commands, and a disabled input that stays inert.
 */

import { strict as assert } from "node:assert";
import { delay, runComponentSuite, step } from "./harness.ts";
import { type Page } from "npm:playwright-core";


/** Parts are addressed by the element's id, which the route writes so each
 * instance is addressable: `number-input:<id>:<part>`. */
const QUANTITY = "#quantity";
const QUANTITY_INPUT = '#quantity [id="number-input:quantity:input"]';
const QUANTITY_INCREMENT = '#quantity [id="number-input:quantity:increment"]';
const QUANTITY_DECREMENT = '#quantity [id="number-input:quantity:decrement"]';
const QUANTITY_SCRUBBER = '#quantity [id="number-input:quantity:scrubber"]';
const QUANTITY_CURSOR = '#quantity [id="number-input:quantity:cursor"]';
const CONTROLLED_INPUT = '#controlled [id="number-input:controlled:input"]';
const RTL_INPUT = '#rtl [id="number-input:rtl:input"]';

const readout = async (page: Page, id: string): Promise<string> =>
  (await page.locator(`#number-input-${id}`).textContent()) ?? "";

Deno.test("spin-number-input e2e", () =>
  runComponentSuite({ port: 5231, route: "/number-input", ready: QUANTITY_INPUT }, async ({ page }) => {
  const inputValue = async (selector: string): Promise<string> =>
    await page.locator(selector).inputValue();
    await step("renders the initial number input", async () => {
      assert.equal(await inputValue(QUANTITY_INPUT), "12", "the default value is in the field");
      assert.equal(await page.locator(QUANTITY_INPUT).getAttribute("role"), "spinbutton", "the field is a spinbutton");
      assert.equal(
        await page.locator(QUANTITY_INPUT).getAttribute("aria-roledescription"),
        "numberfield",
        "and a numberfield",
      );
      assert.equal(await page.locator(QUANTITY_INPUT).getAttribute("aria-valuemin"), "0", "with the minimum");
      assert.equal(await page.locator(QUANTITY_INPUT).getAttribute("aria-valuemax"), "20", "and the maximum");
      assert.equal(await page.locator(QUANTITY_INPUT).getAttribute("aria-valuenow"), "12", "and the current value");
      assert.equal(await page.locator(QUANTITY_INPUT).getAttribute("aria-invalid"), "false", "an in-range value is valid");
      assert.equal(await page.locator(QUANTITY_INPUT).getAttribute("inputmode"), "decimal", "with the decimal keypad");
      // The label names the input through the machine's id scheme.
      const labelId = await page.locator(`${QUANTITY} label`).getAttribute("id");
      assert.equal(
        await page.locator(`${QUANTITY} label`).getAttribute("for"),
        await page.locator(QUANTITY_INPUT).getAttribute("id"),
        "the label names the input",
      );
      assert.equal(labelId, "number-input:quantity:label", "with a namespaced label id");
      assert.equal(await page.locator(`${QUANTITY} label`).textContent(), "Quantity", "and the host's text");
      // The control groups the field, and the triggers name it.
      assert.equal(
        await page.locator(`${QUANTITY} [role="group"]`).getAttribute("aria-disabled"),
        "false",
        "the control is a group",
      );
      assert.equal(
        await page.locator(QUANTITY_INCREMENT).getAttribute("aria-controls"),
        "number-input:quantity:input",
        "the increment trigger controls the input",
      );
      assert.equal(
        await page.locator(QUANTITY_INCREMENT).getAttribute("aria-label"),
        "increment value",
        "with the default label",
      );
      assert.equal(
        await page.locator(QUANTITY_DECREMENT).getAttribute("aria-label"),
        "decrease value",
        "and the decrement default",
      );
      assert.equal(
        await page.locator(QUANTITY_INCREMENT).getAttribute("tabindex"),
        "-1",
        "the triggers stay out of the tab order",
      );
      assert.equal(await readout(page, "value"), "12", "the host readout carries the value");
      assert.equal(await readout(page, "focus"), "blurred", "and nothing is focused yet");
    });

    await step("the keyboard steps the value", async () => {
      await page.locator(QUANTITY_INPUT).focus();
      assert.equal(await readout(page, "focus"), "focused", "focusing the field reports it");
      await page.keyboard.press("ArrowUp");
      assert.equal(await inputValue(QUANTITY_INPUT), "13", "ArrowUp steps once");
      await page.keyboard.press("ArrowDown");
      assert.equal(await inputValue(QUANTITY_INPUT), "12", "ArrowDown steps back");
    });

    await step("the modifier keys take the large and small steps", async () => {
      await page.locator(CONTROLLED_INPUT).focus();
      assert.equal(await inputValue(CONTROLLED_INPUT), "40", "the controlled value is seeded");
      await page.keyboard.press("ArrowUp");
      assert.equal(await inputValue(CONTROLLED_INPUT), "45", "the plain step is 5");
      page.keyboard.down("Shift");
      await page.keyboard.press("ArrowUp");
      page.keyboard.up("Shift");
      assert.equal(await inputValue(CONTROLLED_INPUT), "70", "Shift takes the large step");
      page.keyboard.down("Alt");
      await page.keyboard.press("ArrowUp");
      page.keyboard.up("Alt");
      assert.equal(await inputValue(CONTROLLED_INPUT), "71", "Alt takes the small step");
    });

    await step("Home and End take the bounds", async () => {
      await page.locator(QUANTITY_INPUT).focus();
      await page.keyboard.press("End");
      assert.equal(await inputValue(QUANTITY_INPUT), "20", "End takes the max");
      await page.keyboard.press("Home");
      assert.equal(await inputValue(QUANTITY_INPUT), "0", "Home takes the min");
      assert.equal(await page.locator(QUANTITY_INCREMENT).isDisabled(), false, "at the min the increment trigger is live");
      assert.equal(await page.locator(QUANTITY_DECREMENT).isDisabled(), true, "and the decrement trigger is not");
      await page.keyboard.press("ArrowUp");
      assert.equal(await inputValue(QUANTITY_INPUT), "1", "and the arrow walks off it");
    });

    await step("typing, Enter, and the blur that clamps", async () => {
      await page.locator(QUANTITY_INPUT).fill("7");
      assert.equal(await inputValue(QUANTITY_INPUT), "7", "a typed value lands verbatim");
      await page.keyboard.press("Enter");
      assert.equal(await readout(page, "commit"), "7", "Enter commits what was typed");
      assert.equal(await readout(page, "focus"), "blurred", "and reports the blur");
      await page.locator(QUANTITY_INPUT).fill("40");
      await page.locator(QUANTITY_INPUT).blur();
      assert.equal(await inputValue(QUANTITY_INPUT), "20", "the blur clamps a typed value into range");
      assert.equal(await readout(page, "commit"), "20", "and commits it");
      assert.equal(await readout(page, "value"), "20", "the host readout follows");
    });

    await step("a letter is refused at the field", async () => {
      await page.locator(QUANTITY_INPUT).focus();
      await page.keyboard.type("a");
      assert.equal(await inputValue(QUANTITY_INPUT), "20", "the partial-number guard keeps the value");
    });

    await step("the pointer steps the value", async () => {
      await page.locator(QUANTITY_INPUT).fill("10");
      await page.locator(QUANTITY_INCREMENT).click();
      assert.equal(await inputValue(QUANTITY_INPUT), "11", "a click increments");
      assert.equal(
        await page.locator(QUANTITY_INPUT).evaluate((node: HTMLInputElement) => node === document.activeElement),
        true,
        "the press focuses the field",
      );
      await page.locator(QUANTITY_DECREMENT).click();
      await page.locator(QUANTITY_DECREMENT).click();
      assert.equal(await inputValue(QUANTITY_INPUT), "9", "clicking the decrement twice steps twice");
    });

    await step("holding the trigger repeats", async () => {
      const box = await page.locator(QUANTITY_INCREMENT).boundingBox();
      assert.equal(box !== null, true, "the trigger is laid out");
      await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
      await page.mouse.down();
      const first = await inputValue(QUANTITY_INPUT);
      // One step on the press, a 300ms dwell, then a 50ms repeat.
      await delay(400);
      await page.mouse.up();
      const held = Number(await inputValue(QUANTITY_INPUT));
      assert.equal(held > Number(first), true, `holding repeated past ${first} (saw ${held})`);
      assert.equal(
        await page.locator(QUANTITY_INCREMENT).evaluate((node) => node === document.activeElement),
        false,
        "the field, not the button, keeps focus",
      );
    });

    await step("the scrubber drag steps the value", async () => {
      await page.locator(QUANTITY_INPUT).fill("5");
      const box = await page.locator(QUANTITY_SCRUBBER).boundingBox();
      assert.equal(box !== null, true, "the rail is laid out");
      const middle = box!.y + box!.height / 2;
      await page.mouse.move(box!.x + 10, middle);
      await page.mouse.down();
      // A rightward drag increments; the cursor rides the geometry channel.
      await page.mouse.move(box!.x + 90, middle, { steps: 5 });
      const scrolled = Number(await inputValue(QUANTITY_INPUT));
      assert.equal(scrolled > 5, true, `a rightward drag steps up (saw ${scrolled})`);
      const cursor = await page.locator(QUANTITY_CURSOR).getAttribute("style");
      assert.equal(
        cursor !== null && cursor.includes("left:"),
        true,
        "the cursor rides the style object's geometry",
      );
      await page.mouse.move(box!.x + 10, middle, { steps: 5 });
      const back = Number(await inputValue(QUANTITY_INPUT));
      assert.equal(back < scrolled, true, `a leftward drag steps down (saw ${back})`);
      await page.mouse.up();
      assert.equal(
        await page.locator(QUANTITY_CURSOR).isHidden(),
        true,
        "the drag is over, so the virtual cursor hides",
      );
    });

    await step("the wheel steps the value when it is allowed", async () => {
      await page.locator(RTL_INPUT).focus();
      await page.keyboard.press("Home");
      await page.locator(RTL_INPUT).hover();
      await page.mouse.wheel(0, -120);
      await delay(50);
      assert.equal(await inputValue(RTL_INPUT), "0.5", "a wheel up steps by the fractional step");
      await page.mouse.wheel(0, 120);
      await delay(50);
      assert.equal(await inputValue(RTL_INPUT), "0", "and a wheel down steps back");
    });

    await step("the host commands drive the machine", async () => {
      await page.getByRole("button", { name: "el.setToMax()" }).click();
      assert.equal(await inputValue(QUANTITY_INPUT), "20", "setToMax writes the max");
      await page.getByRole("button", { name: "el.setToMin()" }).click();
      assert.equal(await inputValue(QUANTITY_INPUT), "0", "setToMin writes the min");
      await page.getByRole("button", { name: "el.clearValue()" }).click();
      assert.equal(await inputValue(QUANTITY_INPUT), "", "clearValue empties the field");
      // The controlled instance drives its own commands, with its own steps.
      await page.getByRole("button", { name: "el.setValue(75)" }).click();
      assert.equal(await inputValue(CONTROLLED_INPUT), "75", "setValue writes the authored value");
      await page.getByRole("button", { name: "el.increment()" }).click();
      assert.equal(await inputValue(CONTROLLED_INPUT), "80", "increment steps the controlled field");
      await page.getByRole("button", { name: "el.decrement()" }).click();
      assert.equal(await inputValue(CONTROLLED_INPUT), "75", "and decrement brings it back");
    });

    await step("a controlled value is re-imposed", async () => {
      await page.getByRole("button", { name: "el.setValue(75)" }).click();
      assert.equal(await inputValue(CONTROLLED_INPUT), "75", "the command writes the value");
      assert.equal(await readout(page, "value"), "75", "the host sees it");
      await page.locator(CONTROLLED_INPUT).focus();
      await page.keyboard.press("ArrowUp");
      assert.equal(await inputValue(CONTROLLED_INPUT), "80", "the bound machine moves by its step");
      await page.getByRole("button", { name: "el.setValue(75)" }).click();
      assert.equal(await inputValue(CONTROLLED_INPUT), "75", "the host's write re-imposes itself");
    });

    await step("a disabled input stays inert", async () => {
      await page.locator(QUANTITY_INPUT).fill("12");
      await page.getByRole("button", { name: "Disable" }).click();
      assert.equal(await page.locator(QUANTITY_INPUT).isDisabled(), true, "the field is disabled");
      assert.equal(await page.locator(QUANTITY_INCREMENT).isDisabled(), true, "and so are both triggers");
      assert.equal(await page.locator(QUANTITY_DECREMENT).isDisabled(), true, "the other one too");
      assert.equal(
        await page.locator(`${QUANTITY} [id="number-input:quantity"]`).getAttribute("data-disabled"),
        "",
        "and the root reports it",
      );
      assert.equal(
        await page.locator(`${QUANTITY} [role="group"]`).getAttribute("aria-disabled"),
        "true",
        "the control announces it",
      );
      // A disabled field takes no focus, so the keyboard never reaches it.
      await page.locator(QUANTITY_INPUT).focus();
      assert.notEqual(
        await page.evaluate(() => document.activeElement?.id ?? ""),
        "number-input:quantity:input",
        "the disabled field is not the active element",
      );
      await page.keyboard.press("ArrowUp");
      assert.equal(
        await inputValue(QUANTITY_INPUT),
        "12",
        "the keyboard never reaches it, and the value stands",
      );
      await page.getByRole("button", { name: "Enable" }).click();
      assert.equal(await page.locator(QUANTITY_INPUT).isDisabled(), false, "re-enabling restores the field");
      await page.locator(QUANTITY_DECREMENT).click();
      assert.equal(await inputValue(QUANTITY_INPUT), "11", "and it steps again");
    });

    // Deep, not strict: `assert.equal` is `strictEqual` here, and no array is
    // ever identical to a fresh literal.
  }));

/**
 * E2E: the library's EXAMPLES — the product's own markup.
 *
 * The 35 component suites drive the specimens app, which is Solid's
 * routes. The examples are the other surface: the markup a user
 * copies, each compiled into its own element. They were ungated, and
 * a broken example reached the reference app unnoticed — a thumb
 * without an index, a scope whose declared default never reached the
 * machine.
 *
 * This suite mounts the examples and asserts the two things a broken
 * example breaks: the machine's state, and the page's silence.
 */

import { strict as assert } from "node:assert";
import { runComponentSuite, step } from "./harness.ts";

/** The example's element: the machine and the example's stem. */
const exampleTag = (machine: string, stem: string): string => `${machine}-${stem}`;

Deno.test("spin examples e2e", () =>
  runComponentSuite({
    port: 5253,
    route: "/#/components/component-slider",
    ready: "slider-basic",
    app: "apps/reference",
  }, async ({ page }) => {
    await step("the examples mount", async () => {
      // The slider's seven examples, each its own element.
      for (const stem of ["basic", "fractional", "marks", "range", "stepped", "ticks", "vertical"]) {
        const tag = exampleTag("slider", stem);
        const count = await page.locator(tag).count();
        assert.equal(count, 1, `${tag} is on the page`);
      }
    });

    await step("a scope's declared default reaches the machine", async () => {
      // The blind spot: every suite asserted a GESTURE, and a declared
      // default that never arrived looked like a correct start.
      // The element's id carries a page-load counter, so the thumb is
      // found by the example's element and the slider's role.
      const thumb = page.locator("slider-basic [role='slider']").first();
      await thumb.waitFor({ state: "attached", timeout: 5000 });
      assert.equal(
        await thumb.getAttribute("aria-valuenow"),
        "50",
        "the basic example starts at its declared default",
      );
    });

    await step("the markup binds the machine's state, typed", async () => {
      // The markup owns the binding: `data-mode={slider.state}` is a
      // typed read of the machine's mode, and it follows the machine.
      const mode = page.locator("slider-basic [data-mode]").first();
      await mode.waitFor({ state: "attached", timeout: 5000 });
      assert.equal(await mode.getAttribute("data-mode"), "idle", "the mode is reported");
      await page.locator("slider-basic [role='slider']").first().focus();
      assert.equal(
        await mode.getAttribute("data-mode"),
        "focus",
        "and it follows the machine",
      );
    });

    await step("every example's machine has a state", async () => {
      // A machine that never started has no value: the thumb's aria is
      // the observable.
      const thumbs = page.locator("[role='slider']");
      const count = await thumbs.count();
      assert.ok(count >= 7, `the examples rendered their thumbs (${count})`);
      for (let i = 0; i < count; i += 1) {
        const value = await thumbs.nth(i).getAttribute("aria-valuenow");
        assert.notEqual(value, null, "every thumb reports a value");
      }
    });
  }));

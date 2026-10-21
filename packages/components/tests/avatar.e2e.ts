/**
 * E2E: the forked-FSM avatar faces in a real browser — the portrait loads
 * and the fallback yields, the broken src keeps its fallback, and the
 * imperative reports drive the states.
 */

import { strict as assert } from "node:assert";
import { runComponentSuite, step } from "./harness.ts";

/** Part ids are the machine's scheme: `avatar:<element id>:<part>`. */
const at = (id: string, part: string): string => `[id="avatar:${id}:${part}"]`;
const USER_IMAGE = at("user", "image");
const USER_FALLBACK = at("user", "fallback");
const BROKEN_FALLBACK = at("broken", "fallback");

Deno.test("spin-avatar e2e", () =>
  runComponentSuite({ port: 5258, route: "/avatar", ready: USER_IMAGE }, async ({ page }) => {
    const readout = page.locator("text=/status: \\w+/").first();

    await step("the portrait loads and the fallback yields", async () => {
      await page.waitForFunction(
        () => document.querySelector('[id="avatar:user:image"]')?.getAttribute("data-state") === "visible",
        undefined,
        { timeout: 8000 },
      );
      assert.match(await readout.textContent() ?? "", /status: loaded/, "the portrait loaded");
      assert.equal(
        await page.locator(USER_FALLBACK).getAttribute("data-hidden"),
        "",
        "the user fallback hides",
      );
    });

    await step("the broken src keeps its fallback", async () => {
      await page.waitForFunction(
        () => document.querySelector('[id="avatar:broken:image"]')?.getAttribute("data-state") === "hidden",
        undefined,
        { timeout: 8000 },
      );
      assert.equal(
        await page.locator(BROKEN_FALLBACK).getAttribute("data-state"),
        "visible",
        "the broken fallback shows",
      );
    });

    await step("the reports drive the states", async () => {
      await page.getByText("el.setError()").click();
      await page.waitForTimeout(300);
      assert.match(await readout.textContent() ?? "", /status: error/, "setError errored");
      assert.equal(
        await page.locator(USER_IMAGE).getAttribute("data-state"),
        "hidden",
        "the image hides on error",
      );
      await page.getByText("el.setLoaded()").click();
      await page.waitForTimeout(300);
      assert.match(await readout.textContent() ?? "", /status: loaded/, "setLoaded loaded");
    });

  }));


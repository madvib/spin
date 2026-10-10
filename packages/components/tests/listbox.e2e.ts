/**
 * E2E: the forked-FSM listbox drives its machine in a real browser — the
 * keyboard contract, the pointer contract, the aria contract, the grid
 * column walk, the host commands, and a disabled listbox that stays inert.
 *
 * Run explicitly (not in default `deno task test`):
 *   cd packages/components && deno test -A tests/listbox.e2e.ts
 *
 * Builds the specimens app, serves dist, drives real Chromium via Playwright.
 * Requires the Playwright browser once: `bunx playwright install chromium`.
 * Fails loud naming the step; silent on success.
 */

import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { strict as assert } from "node:assert";
import { chromium, type Browser, type Page } from "npm:playwright-core";

const ROOT = join(import.meta.dirname as string, "..", "..", "..");
const SPECIMENS = "packages/components/specimens";
const PORT = 5219;
const URL = `http://127.0.0.1:${PORT}/listbox-fsm`;

/** Parts are addressed by the element's id, which the route writes so each
 * instance is addressable: `listbox:<id>:<part>`. */
const FRAMEWORKS = "#frameworks";
const FRAMEWORKS_CONTENT = '[id="listbox:frameworks:content"]';
const TOPPINGS_CONTENT = '[id="listbox:toppings:content"]';
const COLORS_CONTENT = '[id="listbox:colors:content"]';

const value = async (page: Page): Promise<string> =>
  (await page.locator("#listbox-value").textContent()) ?? "";
const highlighted = async (page: Page): Promise<string> =>
  (await page.locator("#listbox-highlighted").textContent()) ?? "";

/** Runs a named step, rethrowing any failure prefixed with the step name. */
async function step<T>(name: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    throw new Error(`[${name}] ${(error as Error).message}`, { cause: error });
  }
}

/** Builds the specimens app from a clean checkout. */
async function buildDemo(): Promise<void> {
  const cmd = new Deno.Command("node", {
    args: [
      join(ROOT, "node_modules/vite/bin/vite.js"),
      "build",
      SPECIMENS,
    ],
    cwd: ROOT,
    stdout: "piped",
    stderr: "piped",
  });
  const { code, stderr } = await cmd.output();
  assert.equal(
    code,
    0,
    `vite build failed:\n${new TextDecoder().decode(stderr)}`,
  );
}

/** Serves the built dist on a fixed port and waits until it answers. */
async function startServer(): Promise<Deno.ChildProcess> {
  const cmd = new Deno.Command("node", {
    args: [
      join(ROOT, "node_modules/vite/bin/vite.js"),
      "preview",
      SPECIMENS,
      "--port",
      String(PORT),
      "--strictPort",
    ],
    cwd: ROOT,
    stdout: "piped",
    stderr: "piped",
  });
  const child = cmd.spawn();
  for (let i = 0; i < 50; i++) {
    try {
      if ((await fetch(URL)).ok) return child;
    } catch {
      // server not ready yet
    }
    await delay(100);
  }
  const stderr = new TextDecoder().decode(
    await new Response(child.stderr).arrayBuffer(),
  );
  try {
    child.kill();
  } catch {
    // already exited
  }
  throw new Error(`vite preview did not start on :${PORT}\n${stderr}`);
}

Deno.test("spin-listbox-fsm e2e", async () => {
  await step("build", buildDemo);
  const server = await step("serve", startServer);
  const pageErrors: string[] = [];
  let browser: Browser | undefined;

  try {
    browser = await step("launch chromium", () =>
      chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] }));

    const page = await browser.newPage();
    page.on("pageerror", (err) => pageErrors.push(err.message));

    /** The active descendant is the machine's id scheme: `listbox:<id>:item:<value>`. */
    const activeDescendant = async (content: string): Promise<string | null> =>
      page.locator(content).getAttribute("aria-activedescendant");
    const selectedValues = async (content: string): Promise<string[]> => {
      const options = page.locator(`${content} [role="option"]`);
      const count = await options.count();
      const found: string[] = [];
      for (let index = 0; index < count; index += 1) {
        const option = options.nth(index);
        if (await option.getAttribute("aria-selected") === "true") {
          found.push((await option.getAttribute("data-value")) ?? "");
        }
      }
      return found;
    };

    await step("load page", async () => {
      await page.goto(URL, { waitUntil: "load" });
      await page.waitForSelector(FRAMEWORKS_CONTENT, { state: "attached", timeout: 5000 });
    });

    await step("renders the initial listbox", async () => {
      assert.equal(await page.locator(FRAMEWORKS_CONTENT).getAttribute("role"), "listbox", "the content is a listbox");
      assert.equal(
        await page.locator(FRAMEWORKS_CONTENT).getAttribute("tabindex"),
        "0",
        "the content is one tab stop",
      );
      // The label names the listbox through the machine's id scheme.
      const labelId = await page.locator(`${FRAMEWORKS} [id="listbox:frameworks:label"]`).getAttribute("id");
      assert.equal(
        await page.locator(FRAMEWORKS_CONTENT).getAttribute("aria-labelledby"),
        labelId,
        "the content is labelled by the label part",
      );
      assert.equal(
        await page.locator(`${FRAMEWORKS} [id="listbox:frameworks:label"]`).textContent(),
        "Pick a framework",
        "the label is the host's",
      );
      assert.equal(
        await page.locator(FRAMEWORKS_CONTENT).getAttribute("aria-multiselectable"),
        null,
        "a single-mode listbox does not announce multiselectable",
      );
      assert.equal(
        await page.locator(`${FRAMEWORKS} [role="option"]`).count(),
        6,
        "every item in the collection renders",
      );
      assert.deepEqual(
        await selectedValues(FRAMEWORKS_CONTENT),
        ["svelte"],
        "the default value is selected",
      );
      assert.equal(
        await page.locator(`${FRAMEWORKS} [role="group"]`).count(),
        2,
        "the host's groups render",
      );
      assert.equal(
        await page.locator(`${FRAMEWORKS} [role="group"] [id="listbox:frameworks:item-group-label:Libraries"]`).isHidden(),
        false,
        "a named group's label is visible",
      );
      assert.equal(
        await page.locator(`${FRAMEWORKS} [id="listbox:frameworks:item:angular"]`).getAttribute("aria-disabled"),
        "true",
        "a disabled item announces it",
      );
      assert.equal(
        await page.locator(`${FRAMEWORKS} [id="listbox:frameworks:item:angular"]`).getAttribute("data-disabled"),
        "",
        "and carries the data flag",
      );
      assert.equal(await value(page), "svelte", "the host readout carries the selected value");
    });

    await step("the keyboard moves the roving highlight and selects", async () => {
      await page.locator(FRAMEWORKS_CONTENT).focus();
      // A focus with an existing highlight keeps it: nothing moves yet.
      assert.equal(await activeDescendant(FRAMEWORKS_CONTENT), null, "the focus keeps the empty highlight");
      await page.keyboard.press("ArrowDown");
      assert.equal(
        await activeDescendant(FRAMEWORKS_CONTENT),
        "listbox:frameworks:item:react",
        "the first value is the adopted highlight",
      );
      assert.equal(await highlighted(page), "react", "the host sees the highlight");
      await page.keyboard.press("ArrowDown");
      assert.equal(
        await activeDescendant(FRAMEWORKS_CONTENT),
        "listbox:frameworks:item:vue",
        "ArrowDown walks the enabled rows",
      );
      await page.keyboard.press("ArrowDown");
      assert.equal(
        await activeDescendant(FRAMEWORKS_CONTENT),
        "listbox:frameworks:item:svelte",
        "ArrowDown keeps walking",
      );
      // angular is disabled, so the walk skips over it.
      await page.keyboard.press("ArrowDown");
      assert.equal(
        await activeDescendant(FRAMEWORKS_CONTENT),
        "listbox:frameworks:item:deno",
        "a disabled value is skipped",
      );
      await page.keyboard.press("ArrowUp");
      assert.equal(
        await activeDescendant(FRAMEWORKS_CONTENT),
        "listbox:frameworks:item:svelte",
        "ArrowUp walks back",
      );
      await page.keyboard.press("End");
      assert.equal(
        await activeDescendant(FRAMEWORKS_CONTENT),
        "listbox:frameworks:item:bun",
        "End takes the last value",
      );
      await page.keyboard.press("Home");
      assert.equal(
        await activeDescendant(FRAMEWORKS_CONTENT),
        "listbox:frameworks:item:react",
        "Home takes the first value",
      );
      // Typeahead searches the labels.
      await page.keyboard.press("v");
      assert.equal(
        await activeDescendant(FRAMEWORKS_CONTENT),
        "listbox:frameworks:item:vue",
        "a printable letter jumps to the matching label",
      );
      await page.keyboard.press("Enter");
      assert.deepEqual(await selectedValues(FRAMEWORKS_CONTENT), ["vue"], "Enter selects the highlight");
      assert.equal(await value(page), "vue", "the host readout follows the keyboard");
      await page.keyboard.press("Escape");
      assert.deepEqual(await selectedValues(FRAMEWORKS_CONTENT), [], "Escape clears the selection");
      assert.equal(await value(page), "none", "and the value text follows");
    });

    await step("the pointer selects and toggles", async () => {
      await page.locator(`${FRAMEWORKS} [id="listbox:frameworks:item:deno"]`).click();
      assert.deepEqual(await selectedValues(FRAMEWORKS_CONTENT), ["deno"], "a click selects the row");
      assert.equal(
        await activeDescendant(FRAMEWORKS_CONTENT),
        "listbox:frameworks:item:deno",
        "and moves the highlight to the clicked row",
      );
      // A single-mode deselectable listbox clears on a re-pick.
      await page.locator(`${FRAMEWORKS} [id="listbox:frameworks:item:deno"]`).click();
      assert.deepEqual(await selectedValues(FRAMEWORKS_CONTENT), [], "a re-pick clears the selection");
      await page.locator(`${FRAMEWORKS} [id="listbox:frameworks:item:angular"]`).dispatchEvent("click");
      assert.deepEqual(await selectedValues(FRAMEWORKS_CONTENT), [], "a disabled row ignores the click");
      await page.locator(`${FRAMEWORKS} [id="listbox:frameworks:item:svelte"]`).click();
      assert.deepEqual(await selectedValues(FRAMEWORKS_CONTENT), ["svelte"], "and an enabled row selects");
    });

    await step("a multiple listbox accumulates and ctrl+a selects all", async () => {
      await page.locator(`${TOPPINGS_CONTENT} [id="listbox:toppings:item:cheese"]`).click();
      await page.locator(`${TOPPINGS_CONTENT} [id="listbox:toppings:item:olives"]`).click();
      assert.deepEqual(await selectedValues(TOPPINGS_CONTENT), ["cheese", "olives"], "two clicks accumulate");
      assert.equal(
        await page.locator(TOPPINGS_CONTENT).getAttribute("aria-multiselectable"),
        "true",
        "a multi mode announces multiselectable",
      );
      await page.locator(TOPPINGS_CONTENT).focus();
      await page.keyboard.press("Control+a");
      assert.deepEqual(
        await selectedValues(TOPPINGS_CONTENT),
        ["cheese", "olives", "anchovy"],
        "ctrl+a selects every enabled value",
      );
      await page.keyboard.press("Escape");
      assert.deepEqual(await selectedValues(TOPPINGS_CONTENT), [], "Escape clears them all");
      await page.locator(`${TOPPINGS_CONTENT} [id="listbox:toppings:item:pineapple"]`).dispatchEvent("click");
      assert.deepEqual(await selectedValues(TOPPINGS_CONTENT), [], "the disabled topping refuses a click");
    });

    await step("the grid walks a column with the vertical axis", async () => {
      assert.equal(
        await page.locator(COLORS_CONTENT).getAttribute("data-layout"),
        "grid",
        "the content reports the grid layout",
      );
      // The column count reaches the utilities as a presence attribute, so
      // the grid's track count is a static class the preset compiled.
      assert.equal(
        await page.locator(`${COLORS_CONTENT} [role="group"]`).getAttribute("data-columns-3"),
        "",
        "the group carries the column count",
      );
      const columns = await page.locator(`${COLORS_CONTENT} [role="group"]`).evaluate((node: HTMLElement) =>
        getComputedStyle(node).gridTemplateColumns.split(" ").length
      );
      assert.equal(columns, 3, "and the grid is three columns wide");
      await page.locator(`${COLORS_CONTENT} [id="listbox:colors:item:green"]`).click();
      assert.deepEqual(await selectedValues(COLORS_CONTENT), ["green"], "a click selects the row");
      await page.locator(COLORS_CONTENT).focus();
      await page.keyboard.press("ArrowDown");
      assert.equal(
        await activeDescendant(COLORS_CONTENT),
        "listbox:colors:item:violet",
        "ArrowDown walks the column, not the row",
      );
      await page.keyboard.press("ArrowRight");
      assert.equal(
        await activeDescendant(COLORS_CONTENT),
        "listbox:colors:item:pink",
        "ArrowRight walks the row order",
      );
      await page.keyboard.press("ArrowLeft");
      assert.equal(
        await activeDescendant(COLORS_CONTENT),
        "listbox:colors:item:violet",
        "ArrowLeft walks back",
      );
      await page.keyboard.press("Enter");
      assert.deepEqual(await selectedValues(COLORS_CONTENT), ["violet"], "Enter selects the grid highlight");
    });

    await step("the host commands drive the machine", async () => {
      await page.getByRole("button", { name: 'el.setValue(["react", "vue"])' }).click();
      assert.deepEqual(await selectedValues(FRAMEWORKS_CONTENT), ["react", "vue"], "setValue writes the value");
      assert.equal(await value(page), "react, vue", "the value text follows");
      await page.getByRole("button", { name: "el.highlightFirst()" }).click();
      assert.equal(await highlighted(page), "react", "highlightFirst reports the first value");
      await page.getByRole("button", { name: "el.selectAll()" }).click();
      assert.deepEqual(
        await selectedValues(FRAMEWORKS_CONTENT),
        ["react", "vue", "svelte", "deno", "bun"],
        "selectAll takes every value the collection holds",
      );
      await page.getByRole("button", { name: "el.clearValue()" }).click();
      assert.deepEqual(await selectedValues(FRAMEWORKS_CONTENT), [], "clearValue empties the selection");
      assert.equal(await value(page), "none", "and the value text follows");
      await page.getByRole("button", { name: "el.focus()" }).click();
      assert.equal(
        await page.locator(FRAMEWORKS_CONTENT).evaluate(
          (node: HTMLElement) => node === document.activeElement,
        ),
        true,
        "the focus command focuses the content",
      );
      await page.keyboard.press("ArrowDown");
      assert.equal(await highlighted(page), "vue", "and the keyboard works afterwards");
    });

    await step("a disabled listbox is inert", async () => {
      await page.getByRole("button", { name: "disable" }).click();
      await page.waitForSelector(`${FRAMEWORKS_CONTENT}[data-disabled]`, { timeout: 2000 });
      await page.locator(`${FRAMEWORKS} [id="listbox:frameworks:item:react"]`).dispatchEvent("click");
      await page.locator(FRAMEWORKS_CONTENT).focus();
      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("Enter");
      assert.deepEqual(await selectedValues(FRAMEWORKS_CONTENT), [], "the keyboard is inert too");
      assert.equal(
        await page.locator(`${FRAMEWORKS} [id="listbox:frameworks:item:react"]`).getAttribute("aria-selected"),
        "false",
        "nothing became selected",
      );
      await page.getByRole("button", { name: "enable" }).click();
      await page.waitForSelector(`${FRAMEWORKS_CONTENT}:not([data-disabled])`, { timeout: 2000 });
      await page.locator(`${FRAMEWORKS} [id="listbox:frameworks:item:react"]`).click();
      assert.deepEqual(await selectedValues(FRAMEWORKS_CONTENT), ["react"], "re-enabling restores the interaction");
    });

    await step("no page errors", async () => {
      assert.deepEqual(
        pageErrors,
        [],
        `page errors detected: ${pageErrors.join(", ")}`,
      );
    });
  } finally {
    if (browser) await browser.close();
    try {
      server.kill();
    } catch {
      // server already exited
    }
  }
});

/**
 * E2E: the forked-FSM pin-input drives its machine in a real browser — the
 * typing contract, the keyboard map, the paste distribution, the refusal
 * report, the completion edge, the host commands, and a disabled pin that
 * stays inert.
 *
 * Run explicitly (not in default `deno task test`):
 *   cd packages/components && deno test -A tests/pin-input.e2e.ts
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
const PORT = 5221;
const URL = `http://127.0.0.1:${PORT}/pin-input-fsm`;

/** Parts are addressed by the element's id, which the route writes so each
 * instance is addressable: `pin-input:<id>:input:<index>`. */
const PIN = "#pin";
/** The root part: the element's id is the namespace the parts hang off. */
const PIN_ROOT = '[id="pin-input:pin"]';
const CELL = (index: number): string => `[id="pin-input:pin:input:${index}"]`;
const DOTS = "#dots";
const DOTS_CELL = (index: number): string => `[id="pin-input:dots:input:${index}"]`;

const value = async (page: Page): Promise<string> =>
  (await page.locator("#pin-value").textContent()) ?? "";
const completions = async (page: Page): Promise<string> =>
  (await page.locator("#pin-completions").textContent()) ?? "";
const refused = async (page: Page): Promise<string> =>
  (await page.locator("#pin-refused").textContent()) ?? "";

/** Which cell the browser holds focused, or "" when focus left the pin. */
const focusedCell = async (page: Page): Promise<string> =>
  page.evaluate(() => {
    const active = document.activeElement;
    return active instanceof HTMLInputElement && active.id.startsWith("pin-input:pin:input:")
      ? active.id
      : "";
  });

/** The character a cell shows. */
const cellValue = async (page: Page, index: number): Promise<string> =>
  page.locator(`${PIN} ${CELL(index)}`).inputValue();

/** Distributes a paste through a real ClipboardEvent, the way a browser does. */
const pasteInto = async (page: Page, selector: string, text: string): Promise<void> =>
  page.evaluate(
    ({ selector, text }) => {
      const node = document.querySelector(selector);
      if (node === null) throw new Error(`no node at ${selector}`);
      const data = new DataTransfer();
      data.setData("text/plain", text);
      node.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }));
    },
    { selector, text },
  );

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

Deno.test("spin-pin-input-fsm e2e", async () => {
  await step("build", buildDemo);
  const server = await step("serve", startServer);
  const pageErrors: string[] = [];
  let browser: Browser | undefined;

  try {
    browser = await step("launch chromium", () =>
      chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] }));

    const page = await browser.newPage();
    page.on("pageerror", (err) => pageErrors.push(err.message));

    await step("load page", async () => {
      await page.goto(URL, { waitUntil: "load" });
      await page.waitForSelector(`${PIN} ${CELL(0)}`, { state: "attached", timeout: 5000 });
    });

    await step("renders the initial pin", async () => {
      assert.equal(await page.locator(`${PIN} ${CELL(0)}`).count(), 1, "the first cell renders");
      assert.equal(await page.locator(`${PIN} input`).count(), 5, "four cells plus the hidden input");
      assert.equal(
        await page.locator(`${PIN} ${CELL(0)}`).getAttribute("aria-label"),
        "pin code 1 of 4",
        "each cell is labelled by its position",
      );
      assert.equal(
        await page.locator(`${PIN} ${CELL(3)}`).getAttribute("aria-label"),
        "pin code 4 of 4",
        "the last cell knows the count",
      );
      // One tab stop: the first cell a value has not filled.
      assert.equal(await page.locator(`${PIN} ${CELL(2)}`).getAttribute("tabindex"), "0", "the first empty cell is the tab stop");
      assert.equal(await page.locator(`${PIN} ${CELL(0)}`).getAttribute("tabindex"), "-1", "a filled cell is not");
      assert.equal(await page.locator(`${PIN} ${CELL(0)}`).getAttribute("type"), "tel", "a numeric pin is a telephone field");
      assert.equal(await page.locator(`${PIN} ${CELL(0)}`).getAttribute("inputmode"), "numeric", "and asks for the numeric keyboard");
      assert.equal(await page.locator(`${PIN} ${CELL(2)}`).getAttribute("placeholder"), "\u25CB", "an empty cell shows the placeholder");
      assert.equal(await cellValue(page, 0), "1", "the seed lands in the first cell");
      assert.equal(await cellValue(page, 2), "", "and the rest are empty");
      assert.equal(await page.locator(`${PIN} [id="pin-input:pin:hidden"]`).inputValue(), "12", "the hidden input carries the joined pin");
      assert.equal(
        await page.locator(PIN_ROOT).getAttribute("data-complete"),
        null,
        "a half-filled pin is not complete",
      );
      assert.equal(await page.locator(`${PIN} label`).getAttribute("for"), "pin-input:pin:hidden", "the label names the hidden input");
      assert.equal(await value(page), "none", "the seed reports no change to the host");
      assert.equal(await completions(page), "0", "and nothing has completed yet");
    });

    await step("typing fills the cells and advances the focus", async () => {
      await page.locator(`${PIN} ${CELL(0)}`).click();
      assert.equal(await focusedCell(page), "pin-input:pin:input:0", "the click focuses the clicked cell");
      await page.keyboard.press("7");
      assert.equal(await cellValue(page, 0), "7", "the character lands in the focused cell");
      assert.equal(await focusedCell(page), "pin-input:pin:input:1", "focus advances to the next cell");
      await page.keyboard.press("8");
      assert.equal(await cellValue(page, 1), "8", "the second character lands");
      assert.equal(await focusedCell(page), "pin-input:pin:input:2", "focus advances again");
      assert.equal(await value(page), "78", "the host readout follows the typing");
    });

    await step("the keyboard map walks the cells", async () => {
      // Two cells are filled, so the index cannot walk past the fill.
      await page.keyboard.press("ArrowRight");
      assert.equal(await focusedCell(page), "pin-input:pin:input:2", "the walk clamps at the fill");
      await page.keyboard.press("ArrowLeft");
      assert.equal(await focusedCell(page), "pin-input:pin:input:1", "ArrowLeft walks back");
      await page.keyboard.press("Home");
      assert.equal(await focusedCell(page), "pin-input:pin:input:0", "Home takes the first cell");
      await page.keyboard.press("End");
      assert.equal(await focusedCell(page), "pin-input:pin:input:1", "End takes the last filled cell");
    });

    await step("backspace clears the focused cell and steps back", async () => {
      await page.keyboard.press("Backspace");
      assert.equal(await cellValue(page, 1), "", "the filled cell clears");
      assert.equal(await focusedCell(page), "pin-input:pin:input:0", "and focus steps back");
      await page.keyboard.press("Backspace");
      assert.equal(await cellValue(page, 0), "", "the last filled cell clears");
      assert.equal(await value(page), "none", "the host readout follows the backspace");
    });

    await step("a refused keystroke is reported, not dropped", async () => {
      await page.keyboard.press("a");
      assert.equal(await refused(page), "a", "value-invalid carries the refusal");
      assert.equal(await value(page), "none", "and the value is untouched");
      assert.equal(await cellValue(page, 0), "", "nothing landed in the cell");
    });

    await step("a paste distributes forward from the focused cell", async () => {
      // The pin is empty and cell 0 holds focus, so the paste starts there.
      await pasteInto(page, `${PIN} ${CELL(0)}`, "45");
      assert.equal(await cellValue(page, 0), "4", "the paste fills from the focused cell");
      assert.equal(await cellValue(page, 1), "5", "and the cells after it");
      assert.equal(await value(page), "45", "the host readout is what the paste filled");
    });

    await step("filling the last cell completes the pin", async () => {
      await page.keyboard.press("6");
      await page.keyboard.press("7");
      assert.equal(await value(page), "4567", "the pin is full");
      await page.waitForSelector(`${PIN_ROOT}[data-complete]`, { timeout: 2000 });
      assert.equal(
        await page.locator(PIN_ROOT).getAttribute("data-complete"),
        "",
        "a full pin reports complete",
      );
      assert.equal(await completions(page), "1", "value-complete fired once");
      assert.equal(await focusedCell(page), "", "and blurOnComplete dropped the focus");
    });

    await step("an invalid paste is refused and reported", async () => {
      await page.locator(`${PIN} ${CELL(0)}`).click();
      await pasteInto(page, `${PIN} ${CELL(0)}`, "zz");
      assert.equal(await refused(page), "zz", "value-invalid carries the refused paste");
      assert.equal(await value(page), "4567", "and the pin is untouched");
    });

    await step("the host commands drive the machine", async () => {
      await page.getByRole("button", { name: 'el.setValue(["9", "8", "7"])' }).click();
      assert.equal(await value(page), "987", "setValue writes the value");
      assert.equal(await cellValue(page, 2), "7", "and the cells follow");
      await page.getByRole("button", { name: "el.setValueAtIndex(3, \"5\")" }).click();
      assert.equal(await cellValue(page, 3), "5", "setValueAtIndex writes the named cell");
      await page.getByRole("button", { name: "el.clearValue()" }).click();
      assert.equal(await value(page), "none", "clearValue empties the pin");
      assert.equal(await cellValue(page, 0), "", "every cell is empty");
      await page.getByRole("button", { name: "el.focus()" }).click();
      assert.equal(await focusedCell(page), "pin-input:pin:input:0", "focus focuses the first cell");
      await page.keyboard.press("1");
      assert.equal(await value(page), "1", "and the keyboard works afterwards");
    });

    await step("a disabled pin is inert", async () => {
      await page.getByRole("button", { name: "disable" }).click();
      await page.waitForSelector(`${PIN_ROOT}[data-disabled]`, { timeout: 2000 });
      assert.equal(
        await page.locator(`${PIN} ${CELL(1)}`).getAttribute("disabled"),
        "",
        "every cell is disabled",
      );
      // A disabled cell refuses the browser's own activation, so the click
      // is forced: what is under test is the machine, not the click.
      await page.locator(`${PIN} ${CELL(1)}`).click({ force: true });
      await page.keyboard.press("5");
      await page.keyboard.press("Backspace");
      assert.equal(await value(page), "1", "a disabled pin takes nothing");
      await page.getByRole("button", { name: "enable" }).click();
      await page.waitForSelector(`${PIN_ROOT}:not([data-disabled])`, { timeout: 2000 });
      await page.locator(`${PIN} ${CELL(1)}`).click();
      await page.keyboard.press("5");
      assert.equal(await value(page), "15", "re-enabling restores the interaction");
    });

    await step("a masked otp pin renders six password cells", async () => {
      assert.equal(await page.locator(`${DOTS} input[type="password"]`).count(), 6, "six masked cells");
      assert.equal(await page.locator(`${DOTS} ${DOTS_CELL(0)}`).getAttribute("inputmode"), "numeric", "an otp pin is numeric");
      assert.equal(
        await page.locator(`${DOTS} ${DOTS_CELL(0)}`).getAttribute("autocomplete"),
        "one-time-code",
        "and asks the platform for the code",
      );
      await page.locator(`${DOTS} ${DOTS_CELL(0)}`).click();
      await page.keyboard.press("3");
      assert.equal(await page.locator("#pin-dots-value").textContent(), "3", "and the host readout follows");
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

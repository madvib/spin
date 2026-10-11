/**
 * E2E: the forked-FSM editable drives its machine in a real browser — the
 * preview/edit pair, the keyboard contract, the pointer contract, the
 * submit-on-blur reflex, the auto-resize stack, the disabled field and the
 * aria contract.
 *
 * Run explicitly (not in default `deno task test`):
 *   cd packages/components && deno test --allow-read --allow-net --allow-run
 *     --allow-env --allow-sys --allow-write=/tmp --allow-import
 *     --min-dep-age=0 tests/editable.e2e.ts
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
const PORT = 5223;
const URL = `http://127.0.0.1:${PORT}/editable`;

/** Part ids are the machine's scheme: `editable:<element id>:<part>`. */
const at = (id: string, part: string): string => `[id="editable:${id}:${part}"]`;
const FREE_AREA = at("uncontrolled", "area");
const FREE_PREVIEW = at("uncontrolled", "preview");
const FREE_INPUT = at("uncontrolled", "input");
const FREE_SUBMIT = at("uncontrolled", "submit");
const FREE_CANCEL = at("uncontrolled", "cancel");
const CONTROLLED_INPUT = at("controlled", "input");
const CONTROLLED_EDIT = at("controlled", "edit");
const AUTO_AREA = at("autoresize", "area");
const AUTO_INPUT = at("autoresize", "input");
const AUTO_PREVIEW = at("autoresize", "preview");
const DISABLED_PREVIEW = at("disabled", "preview");

const readout = async (page: Page, id: string): Promise<string> =>
  (await page.locator(`#${id}`).textContent()) ?? "";

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
    args: [join(ROOT, "node_modules/vite/bin/vite.js"), "build", SPECIMENS],
    cwd: ROOT,
    stdout: "piped",
    stderr: "piped",
  });
  const { code, stderr } = await cmd.output();
  assert.equal(code, 0, `vite build failed:\n${new TextDecoder().decode(stderr)}`);
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
  const stderr = new TextDecoder().decode(await new Response(child.stderr).arrayBuffer());
  try {
    child.kill();
  } catch {
    // already exited
  }
  throw new Error(`vite preview did not start on :${PORT}\n${stderr}`);
}

Deno.test("spin-editable e2e", async () => {
  await step("build", buildDemo);
  const server = await step("serve", startServer);
  const pageErrors: string[] = [];
  let browser: Browser | undefined;

  try {
    browser = await step("launch chromium", () =>
      chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] })
    );

    const page = await browser.newPage();
    page.on("pageerror", (err) => pageErrors.push(err.message));

    await step("load page", async () => {
      await page.goto(URL, { waitUntil: "load" });
      await page.waitForSelector(FREE_PREVIEW, { state: "attached", timeout: 5000 });
    });

    await step("renders the initial editable", async () => {
      assert.equal(await page.locator(FREE_AREA).getAttribute("data-state"), "preview", "the field starts in preview");
      assert.equal(await page.locator(FREE_PREVIEW).textContent(), "Ada Lovelace", "the preview carries the value");
      assert.equal(await page.locator(FREE_PREVIEW).getAttribute("data-placeholder-shown"), null, "a seeded value is not a placeholder");
      assert.equal(await page.locator(FREE_INPUT).inputValue(), "Ada Lovelace", "the input carries the value");
      assert.equal(await page.locator(FREE_INPUT).isVisible(), false, "the input is not laid out while previewing");
      assert.equal(await page.locator(FREE_PREVIEW).isVisible(), true, "the preview is laid out");
      assert.equal(await page.locator(at("uncontrolled", "edit")).isVisible(), true, "the edit trigger shows in preview");
      assert.equal(await page.locator(FREE_SUBMIT).isVisible(), false, "the submit trigger hides in preview");
      assert.equal(await page.locator(FREE_CANCEL).isVisible(), false, "the cancel trigger hides in preview");
      assert.equal(await page.locator('[id="editable:uncontrolled"]').getAttribute("id"), "editable:uncontrolled", "the root is namespaced");
      assert.equal(await readout(page, "editable-value"), "Ada Lovelace", "the host readout carries the value");
      assert.equal(await readout(page, "editable-commits"), "0", "nothing has committed");
    });

    await step("the label names the field", async () => {
      const label = page.locator(at("uncontrolled", "label"));
      assert.equal(await label.getAttribute("for"), "editable:uncontrolled:input", "the label points at the input");
      assert.equal(await label.textContent(), "Name", "the label is the host's");
      assert.equal(await page.locator(FREE_INPUT).getAttribute("aria-label"), "editable input", "the input is labelled");
      assert.equal(await page.locator(FREE_PREVIEW).getAttribute("aria-label"), "edit", "the preview is labelled");
      assert.equal(await page.locator(FREE_SUBMIT).getAttribute("aria-label"), "submit", "the submit trigger is labelled");
      assert.equal(await page.locator(FREE_CANCEL).getAttribute("aria-label"), "cancel", "the cancel trigger is labelled");
    });

    await step("focus opens the field and Enter commits", async () => {
      // A press focuses the preview on the way down, which is the
      // focus-activation path a keyboard user takes with Tab.
      await page.locator(FREE_PREVIEW).click();
      assert.equal(await page.locator(FREE_AREA).getAttribute("data-state"), "edit", "the focus opens the field");
      assert.equal(
        await page.locator(FREE_INPUT).evaluate((el) => el === document.activeElement),
        true,
        "and the input takes focus",
      );
      assert.equal(await page.locator(FREE_INPUT).isVisible(), true, "the input is laid out");
      assert.equal(await page.locator(FREE_PREVIEW).isVisible(), false, "and the preview leaves the layout");
      // Focus selects the whole value, so a real append parks the caret at
      // the end first.
      await page.keyboard.press("End");
      await page.keyboard.type(" Grace Hopper");
      assert.equal(await readout(page, "editable-value"), "Ada Lovelace Grace Hopper", "the host follows each keystroke");
      await page.keyboard.press("Enter");
      assert.equal(await page.locator(FREE_AREA).getAttribute("data-state"), "preview", "Enter closes the field");
      assert.equal(await page.locator(FREE_PREVIEW).textContent(), "Ada Lovelace Grace Hopper", "the preview carries the commit");
      assert.equal(await readout(page, "editable-commits"), "1", "value-commit reports once");
      assert.equal(await readout(page, "editable-reverts"), "0", "nothing reverts");
    });

    await step("the preview cancels with Escape", async () => {
      await page.locator(FREE_PREVIEW).click();
      // The input takes focus on a deferred frame, and focus selects the
      // whole value: typing before the selection lands replaces nothing
      // and appends nowhere, so the caret waits for the selection first.
      await page.waitForFunction(() => {
        const el = document.getElementById("editable:uncontrolled:input");
        return el === document.activeElement &&
          (el as HTMLInputElement).selectionStart !== (el as HTMLInputElement).selectionEnd;
      }, null, { timeout: 5000 });
      await page.keyboard.press("End");
      await page.keyboard.type("!");
      assert.equal(await page.locator(FREE_INPUT).inputValue(), "Ada Lovelace Grace Hopper!", "the edit lands");
      await page.keyboard.press("Escape");
      assert.equal(await page.locator(FREE_PREVIEW).textContent(), "Ada Lovelace Grace Hopper", "Escape discards the edit");
      assert.equal(await readout(page, "editable-reverts"), "1", "value-revert reports once");
      assert.equal(await readout(page, "editable-commits"), "1", "and nothing commits");
    });

    await step("the pointer cancels through the trigger", async () => {
      await page.locator(FREE_PREVIEW).click();
      assert.equal(await page.locator(FREE_AREA).getAttribute("data-state"), "edit", "a click opens the field");
      await page.locator(FREE_INPUT).fill("clicked");
      assert.equal(await page.locator(FREE_INPUT).inputValue(), "clicked", "the fill lands");
      await page.locator(FREE_CANCEL).click();
      assert.equal(await page.locator(FREE_AREA).getAttribute("data-state"), "preview", "the cancel trigger closes the field");
      assert.equal(await page.locator(FREE_PREVIEW).textContent(), "Ada Lovelace Grace Hopper", "and discards the edit");
      assert.equal(await readout(page, "editable-reverts"), "2", "value-revert reports again");
    });

    await step("walking away submits the field", async () => {
      await page.locator(FREE_PREVIEW).click();
      await page.locator(FREE_INPUT).fill("blurred away");
      // A press outside the field is the submit-on-blur reflex: the machine's
      // interact-outside effect reports it and submitMode "both" commits.
      await page.locator("h2").first().click();
      assert.equal(await page.locator(FREE_AREA).getAttribute("data-state"), "preview", "the outside press closes the field");
      assert.equal(await page.locator(FREE_PREVIEW).textContent(), "blurred away", "and commits the edit");
      assert.equal(await readout(page, "editable-commits"), "2", "value-commit reports the blur submit");
    });

    await step("the controlled field asks the host", async () => {
      assert.equal(await page.locator(CONTROLLED_INPUT).getAttribute("data-state"), "preview", "the controlled field starts in preview");
      assert.equal(await readout(page, "editable-edit"), "preview", "the host readout agrees");
      await page.getByRole("button", { name: "el.edit()" }).click();
      assert.equal(await page.locator(CONTROLLED_EDIT).getAttribute("data-state"), "edit", "the host's ask opens it");
      assert.equal(await readout(page, "editable-edit"), "edit", "and the host reports the open");
      await page.locator(CONTROLLED_INPUT).fill("controlled value");
      await page.locator(at("controlled", "submit")).click();
      // The submit answers through the host round-trip, and the route
      // counts value-commit only for the uncontrolled field — so the proof
      // here is the preview text and the host's edit readout.
      await page.waitForFunction(
        () => document.querySelector('[id="editable:controlled:preview"]')?.textContent === "controlled value",
        null,
        { timeout: 5000 },
      );
      assert.equal(await page.locator(at("controlled", "preview")).textContent(), "controlled value", "and the preview carries it");
      assert.equal(await readout(page, "editable-edit"), "preview", "with the host back in preview");
    });

    await step("the auto-resize stack keeps both parts in the layout", async () => {
      assert.equal(await page.locator(AUTO_AREA).getAttribute("data-autoresize"), "", "the area reports the stack");
      assert.equal(await page.locator(AUTO_INPUT).getAttribute("data-autoresize"), "", "the input reports it too");
      // Both parts share one grid cell: the inactive one is invisible but
      // still laid out, so the check is the box and not visibility.
      const inputBox = await page.locator(AUTO_INPUT).boundingBox();
      assert.ok((inputBox?.width ?? 0) > 0, "the input stays in the layout while previewing");
      assert.equal(await page.locator(AUTO_PREVIEW).isVisible(), true, "and so does the preview");
      const grid = await page.locator(AUTO_AREA).evaluate((el) => getComputedStyle(el).display);
      assert.equal(grid, "inline-grid", "the stack is laid out as a grid");
      // The cell is full-width, so no box grows here: the proof is that a
      // long value types, commits, and reads back with both parts laid out.
      await page.locator(AUTO_PREVIEW).click();
      await page.locator(AUTO_INPUT).fill("a much longer value than the placeholder");
      await page.keyboard.press("Enter");
      assert.equal(
        await page.locator(AUTO_PREVIEW).textContent(),
        "a much longer value than the placeholder",
        "the long value commits and reads back",
      );
    });

    await step("the disabled field stays inert", async () => {
      assert.equal(await page.locator(DISABLED_PREVIEW).getAttribute("tabindex"), null, "a disabled preview is not a tab stop");
      assert.equal(await page.locator(at("disabled", "area")).getAttribute("data-state"), "preview", "the field stays in preview");
      await page.locator(DISABLED_PREVIEW).click({ force: true });
      await page.locator(DISABLED_PREVIEW).focus({ timeout: 1000 }).catch(() => undefined);
      assert.equal(await page.locator(at("disabled", "area")).getAttribute("data-state"), "preview", "and a click opens nothing");
      assert.equal(await page.locator(at("disabled", "input")).getAttribute("disabled"), "", "the input is disabled");
    });

    await step("commits and reverts are counted", async () => {
      const commits = Number(await readout(page, "editable-commits"));
      const reverts = Number(await readout(page, "editable-reverts"));
      assert.equal(commits, 2, "two uncontrolled commits so far");
      assert.equal(reverts, 2, "two reverts so far");
    });
  } finally {
    await browser?.close();
    try {
      server.kill();
    } catch {
      // already exited
    }
  }

  assert.deepEqual(pageErrors, [], `page errors detected: ${pageErrors.join(", ")}`);
});

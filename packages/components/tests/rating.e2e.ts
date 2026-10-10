/**
 * E2E: spin-rating-group-fsm drives its machine in a real browser — pointer
 * clicks, the halfway split, the hover preview, the keyboard map, the
 * fieldset/reset reflexes, and the aria contract.
 *
 * Run explicitly (not in default `deno task test`):
 *   cd packages/components && deno test -A tests/rating.e2e.ts
 *
 * Builds the specimens app, serves dist, drives real Chromium via Playwright.
 * Requires the Playwright browser once: `bunx playwright install chromium`.
 * Fails loud naming the step; silent on success.
 */

import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { strict as assert } from "node:assert";
import { chromium, type Browser } from "npm:playwright-core";

const ROOT = join(import.meta.dirname as string, "..", "..", "..");
const SPECIMENS = "packages/components/specimens";
const PORT = 5215;
const URL = `http://127.0.0.1:${PORT}/rating-fsm`;

/** Parts are addressed by the machine's id scheme: `rating:<element id>:<part>`. */
const GROUP = "#rating-a";
const FIELD_GROUP = "#rating-b";
const STAR = (index: number): string => `#rating-a [aria-posinset="${index}"]`;
const FIELD_STAR = (index: number): string => `#rating-b [aria-posinset="${index}"]`;
const HIDDEN_INPUT = '[id="rating:rating-a:input"]';
const LABEL = '[id="rating:rating-a:label"]';
const CONTROL = '[id="rating:rating-a:control"]';
const FIELD_CONTROL = '[id="rating:rating-b:control"]';

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

Deno.test("spin-rating-group-fsm e2e", async () => {
  await step("build", buildDemo);
  const server = await step("serve", startServer);
  const pageErrors: string[] = [];
  let browser: Browser | undefined;

  try {
    browser = await step("launch chromium", () =>
      chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] }));

    const page = await browser.newPage();
    page.on("pageerror", (err) => pageErrors.push(err.message));

    const readout = async (id: string): Promise<string> =>
      (await page.locator(`#${id}`).textContent()) ?? "";
    const starBox = async (index: number) => {
      const box = await page.locator(STAR(index)).boundingBox();
      assert.ok(box !== null, `star ${index} has a box`);
      return box;
    };
    /** The painted width of a star's fill layer, from the geometry channel. */
    const fillWidth = (index: number): Promise<string> =>
      page.evaluate((at: number) => {
        const star = document.querySelector(`#rating-a [aria-posinset="${at}"]`);
        const fill = star?.querySelector("span > span:nth-child(2)");
        return fill === null || fill === undefined ? "none" : getComputedStyle(fill).width;
      }, index);
    /** The glyph box a star's fill layer fills, which the hit area surrounds. */
    const glyphWidthOf = (index: number): Promise<number> =>
      page.evaluate((at: number) => {
        const star = document.querySelector(`#rating-a [aria-posinset="${at}"]`);
        const glyph = star?.querySelector("span > span:nth-child(1)");
        return glyph === null || glyph === undefined ? 0 : glyph.getBoundingClientRect().width;
      }, index);

    await step("load page", async () => {
      try {
        await page.goto(URL, { waitUntil: "load" });
        await page.waitForSelector(STAR(1), { state: "attached", timeout: 3000 });
      } catch {
        await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: "load" });
        await page.click('a[href="/rating-fsm"]');
        await page.waitForSelector(STAR(1), { state: "attached", timeout: 5000 });
      }
    });

    await step("renders the seeded rating", async () => {
      assert.equal(await page.locator(STAR(1)).count(), 1, "one element per star");
      assert.equal(await page.locator(`${GROUP} [role="radio"]`).count(), 5, "five stars");
      assert.equal(await page.locator(LABEL).textContent(), "How was it?", "the label names the group");
      assert.equal(
        await page.locator(CONTROL).getAttribute("role"),
        "radiogroup",
        "the group is a radiogroup",
      );
      assert.equal(
        await page.locator(CONTROL).getAttribute("aria-labelledby"),
        await page.locator(LABEL).getAttribute("id"),
        "named by the label part",
      );
      assert.equal(await readout("rating-value"), "3", "the seeded default shows in the readout");
      assert.equal(
        await page.locator(STAR(3)).getAttribute("aria-checked"),
        "true",
        "the seeded star is checked",
      );
      assert.equal(
        await page.locator(STAR(1)).getAttribute("aria-checked"),
        "false",
        "the others are not",
      );
      assert.equal(await page.locator(STAR(3)).getAttribute("aria-posinset"), "3", "its position in the set");
      assert.equal(await page.locator(STAR(3)).getAttribute("aria-setsize"), "5", "the set size");
      assert.equal(await page.locator(STAR(3)).getAttribute("aria-label"), "3 stars", "the star names itself");
      assert.equal(
        await page.locator(STAR(3)).getAttribute("tabindex"),
        "0",
        "the checked star is the tab stop",
      );
      assert.equal(
        await page.locator(STAR(1)).getAttribute("tabindex"),
        "-1",
        "the others are reachable by arrow",
      );
      assert.equal(
        await page.locator(HIDDEN_INPUT).inputValue(),
        "3",
        "the hidden input carries the value for forms",
      );
      const style = await page.locator(STAR(3)).getAttribute("style") ?? "";
      assert.ok(style.includes("--rating-fill"), "the checked star carries its fill through the geometry channel");
      const style5 = await page.locator(STAR(5)).getAttribute("style") ?? "";
      assert.ok(style5.includes("--rating-fill"), "an unchecked star carries it too");
      assert.equal(Number.parseFloat(await fillWidth(5)), 0, "the unchecked star paints nothing");
      assert.ok(
        Number.parseFloat(await fillWidth(3)) > 8,
        "the checked star paints its glyph",
      );
    });

    await step("clicking a star commits it", async () => {
      await page.locator(STAR(5)).click();
      assert.equal(await readout("rating-value"), "5", "the click commits the fifth star");
      assert.equal(await page.locator(STAR(5)).getAttribute("aria-checked"), "true", "it is now checked");
      assert.equal(await page.locator(STAR(3)).getAttribute("aria-checked"), "false", "the old star is not");
      assert.equal(await page.locator(HIDDEN_INPUT).inputValue(), "5", "the hidden input follows");
      assert.equal(await readout("rating-changes"), "1", "value-change fired once");
      // The commit focuses the radio it committed to, which is what puts the
      // keyboard in the focus state.
      assert.equal(
        await page.evaluate(() => document.activeElement?.getAttribute("aria-posinset")),
        "5",
        "the click focuses the radio for the new value",
      );
    });

    await step("hovering previews without committing", async () => {
      // The click focused its radio while the pointer was already over the
      // group, so the machine is in hover with focus recorded: Zag's hover
      // state drops FOCUS, and so does this port.
      const box = await starBox(2);
      await page.mouse.move(box.x + box.width * 0.75, box.y + box.height / 2);
      assert.equal(await readout("rating-hovered"), "2", "the pointer previews the second star");
      assert.equal(
        await page.locator(CONTROL).getAttribute("data-state"),
        "hover",
        "the pointer over the group holds the hover state",
      );
      assert.equal(
        await page.locator(STAR(2)).getAttribute("data-highlighted"),
        "",
        "the previewed star is highlighted",
      );
      assert.equal(
        await page.locator(STAR(4)).getAttribute("data-highlighted"),
        null,
        "a star past the pointer is not",
      );
      assert.equal(await readout("rating-value"), "5", "the committed value is untouched");
      const far = await starBox(4);
      await page.mouse.move(far.x + far.width / 2, far.y + far.height / 2);
      assert.equal(await readout("rating-hovered"), "4", "moving along the group moves the preview");
      await page.mouse.move(far.x + far.width / 2, far.y - 60);
      assert.equal(await readout("rating-hovered"), "-1", "leaving the group clears the preview");
      assert.equal(
        await page.locator(CONTROL).getAttribute("data-state"),
        "focus",
        "a leave of the pointer is not a leave of the rating",
      );

      // The idle-to-hover crossing, on a group that has never been focused.
      await page.locator(FIELD_STAR(2)).scrollIntoViewIfNeeded();
      const field = await page.locator(FIELD_STAR(2)).boundingBox();
      assert.ok(field !== null, "the fieldset group has a box");
      await page.mouse.move(field.x + field.width / 2, field.y + field.height / 2);
      await page.mouse.move(field.x + field.width * 0.25, field.y + field.height / 2);
      assert.equal(
        await page.locator(FIELD_CONTROL).getAttribute("data-state"),
        "hover",
        "an unfocused group takes the hover state",
      );
      assert.equal(
        await page.locator(FIELD_STAR(1)).getAttribute("data-highlighted"),
        "",
        "the stars up to the pointer are highlighted",
      );
      assert.equal(
        await page.locator(FIELD_STAR(3)).getAttribute("data-highlighted"),
        null,
        "and the ones past it are not",
      );
      await page.mouse.move(field.x + field.width * 0.25, field.y - 60);
      assert.equal(
        await page.locator(FIELD_CONTROL).getAttribute("data-state"),
        "idle",
        "leaving it returns to idle",
      );
    });

    await step("the keyboard moves from the group", async () => {
      await page.locator(STAR(5)).click();
      await page.keyboard.press("ArrowLeft");
      assert.equal(await readout("rating-value"), "4", "ArrowLeft steps down one star");
      await page.keyboard.press("ArrowRight");
      assert.equal(await readout("rating-value"), "5", "ArrowRight steps up");
      await page.keyboard.press("End");
      assert.equal(await readout("rating-value"), "5", "End lands on the last star");
      await page.keyboard.press("Home");
      assert.equal(await readout("rating-value"), "1", "Home lands on the first star");
      assert.equal(await page.locator(HIDDEN_INPUT).inputValue(), "1", "the hidden input follows the keyboard");
    });

    await step("the host commands drive the machine", async () => {
      await page.getByRole("button", { name: "el.setValue(5)" }).click();
      assert.equal(await readout("rating-value"), "5", "setValue writes the value");
      await page.getByRole("button", { name: "el.clearValue()" }).click();
      assert.equal(await readout("rating-value"), "-1", "clearValue empties the group");
      assert.equal(
        await page.locator(STAR(1)).getAttribute("aria-checked"),
        "true",
        "an empty group checks its first radio",
      );
      // Space commits from the keyboard; it never clears.
      await page.locator(STAR(1)).focus();
      await page.keyboard.press("Space");
      assert.equal(await readout("rating-value"), "1", "Space commits the focused star");
    });

    await step("half stars come from the pointer's position in the star", async () => {
      await page.getByRole("button", { name: "allow half" }).click();
      await page.locator(STAR(4)).scrollIntoViewIfNeeded();
      const box = await starBox(4);
      // Two moves, as a real pointer makes: the first one puts the group in
      // hover, and Zag's idle state — like this port's — takes no preview.
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.move(box.x + box.width * 0.25, box.y + box.height / 2);
      await page.waitForTimeout(250);
      assert.equal(await readout("rating-hovered"), "3.5", "the left half previews three and a half");
      await page.mouse.click(box.x + box.width * 0.25, box.y + box.height / 2);
      assert.equal(await readout("rating-value"), "3.5", "the click commits the half");
      assert.equal(
        await page.locator(STAR(4)).getAttribute("data-half"),
        "",
        "the fourth star reports the half state",
      );
      assert.equal(await page.locator(HIDDEN_INPUT).inputValue(), "3.5", "the hidden input carries the half");
      assert.ok(
        (await page.locator(STAR(4)).getAttribute("style") ?? "").includes("--rating-fill"),
        "the half paints through the geometry channel",
      );
      assert.ok(
        Math.abs(Number.parseFloat(await fillWidth(4)) - Number.parseFloat(await fillWidth(3)) / 2) < 0.5,
        "the fourth star paints exactly half of a full star",
      );
    });

    await step("a read-only group keeps its value", async () => {
      await page.getByRole("button", { name: "read only" }).click();
      await page.locator(STAR(2)).click({ force: true });
      assert.equal(await readout("rating-value"), "3.5", "a click is ignored");
      assert.equal(
        await page.locator(STAR(2)).getAttribute("data-readonly"),
        "",
        "the read-only state is on the element",
      );
      await page.getByRole("button", { name: "make editable" }).click();
      await page.locator(STAR(2)).click();
      assert.equal(await readout("rating-value"), "2", "editing again commits");
    });

    await step("a disabled group is inert, and so is one in a disabled fieldset", async () => {
      await page.getByRole("button", { name: "disable" }).click();
      assert.equal(
        await page.locator(STAR(2)).getAttribute("aria-disabled"),
        "true",
        "the stars announce disabled",
      );
      assert.equal(
        await page.locator(STAR(2)).getAttribute("tabindex"),
        null,
        "a disabled star leaves the tab order",
      );
      await page.locator(STAR(4)).click({ force: true });
      assert.equal(await readout("rating-value"), "2", "a click is ignored");
      // The second group rides the fieldset reflex: its disabled state is
      // reported by the form-control action, not by its own prop.
      await page.waitForSelector(`${FIELD_STAR(2)}[aria-disabled="true"]`, { timeout: 2000 });
      assert.equal(
        await page.locator(FIELD_STAR(2)).getAttribute("aria-disabled"),
        "true",
        "a group in a disabled fieldset announces it too",
      );
      await page.locator(FIELD_STAR(5)).click({ force: true });
      assert.equal(
        await page.locator(FIELD_STAR(1)).getAttribute("aria-checked"),
        "true",
        "and stays on its seeded value",
      );
      await page.getByRole("button", { name: "enable" }).click();
      await page.waitForSelector(`${FIELD_STAR(2)}:not([aria-disabled="true"])`, { timeout: 2000 });
      await page.locator(FIELD_STAR(5)).click();
      assert.equal(
        await page.locator(FIELD_STAR(5)).getAttribute("aria-checked"),
        "true",
        "re-enabling the fieldset restores the group",
      );
    });

    await step("a form reset returns the seeded value", async () => {
      const before = Number(await readout("rating-changes"));
      await page.getByRole("button", { name: "reset form" }).click();
      assert.equal(await readout("rating-value"), "3", "the reset restores the seeded default");
      assert.equal(
        Number(await readout("rating-changes")),
        before + 1,
        "value-change reports the reset as one change",
      );
      await page.waitForTimeout(250);
      assert.equal(await page.locator(HIDDEN_INPUT).inputValue(), "3", "the hidden input follows the reset");
    });

    await step("no page errors", async () => {
      assert.deepEqual(pageErrors, [], `page errors detected: ${pageErrors.join(", ")}`);
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

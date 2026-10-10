/**
 * E2E: the forked-FSM slider drives its machine in a real browser — pointer
 * drag, keyboard, the aria contract, and a disabled slider that stays
 * inert.
 *
 * Run explicitly (not in default `deno task test`):
 *   cd packages/components && deno task e2e:slider
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
const PORT = 5211;
const URL = `http://127.0.0.1:${PORT}/slider-fsm`;

/** Parts are addressed by the machine's id scheme: `slider:<id>:<part>`. */
const THUMB = '[role="slider"]';
const CONTROL = '[id$=":control"]';
const RANGE = '[id$=":range"]';
const VALUE_TEXT = '[id$=":value-text"]';
const LABEL = '[id$=":label"]';
const HIDDEN_INPUT = '[id$=":input:0"]';
const INDICATOR = '[id$=":indicator"]';

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

Deno.test("spin-slider-fsm e2e", async () => {
  await step("build", buildDemo);
  const server = await step("serve", startServer);
  const pageErrors: string[] = [];
  let browser: Browser | undefined;

  try {
    browser = await step("launch chromium", () =>
      chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] }));

    const page = await browser.newPage();
    page.on("pageerror", (err) => pageErrors.push(err.message));

    const valueNow = (): Promise<string | null> =>
      page.locator(THUMB).getAttribute("aria-valuenow");
    const readout = async (): Promise<string> =>
      (await page.locator("#slider-value").textContent()) ?? "";

    await step("load page", async () => {
      // Deep-link first; fall back to the index and the route link.
      try {
        await page.goto(URL, { waitUntil: "load" });
        await page.waitForSelector(THUMB, { state: "attached", timeout: 3000 });
      } catch {
        await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: "load" });
        await page.click('a[href="/slider-fsm"]');
        await page.waitForSelector(THUMB, { state: "attached", timeout: 5000 });
      }
    });

    await step("renders the initial slider", async () => {
      assert.equal(await readout(), "50", "the host readout starts at the default");
      assert.equal(await valueNow(), "50", "the thumb starts at the default value");
      assert.equal(
        await page.locator(THUMB).getAttribute("aria-valuemin"),
        "0",
        "the thumb announces the range minimum",
      );
      assert.equal(
        await page.locator(THUMB).getAttribute("aria-valuemax"),
        "100",
        "the thumb announces the range maximum",
      );
      assert.equal(
        await page.locator(THUMB).getAttribute("aria-orientation"),
        "horizontal",
        "the thumb announces the orientation",
      );
      assert.equal(
        await page.locator(THUMB).getAttribute("tabindex"),
        "0",
        "an enabled thumb is focusable",
      );
      // The label names the thumb through the machine's id scheme.
      const labelId = await page.locator(LABEL).getAttribute("id");
      assert.equal(
        await page.locator(THUMB).getAttribute("aria-labelledby"),
        labelId,
        "the thumb is labelled by the label part",
      );
      assert.equal(await page.locator(LABEL).textContent(), "Volume");
      assert.equal(
        await page.locator(VALUE_TEXT).textContent(),
        "50",
        "the value text shows the value",
      );
      assert.equal(
        await page.locator(HIDDEN_INPUT).inputValue(),
        "50",
        "the hidden input carries the value for forms",
      );
      // Geometry leaves as custom properties on the parts that consume it.
      const thumbStyle = await page.locator(THUMB).getAttribute("style") ?? "";
      assert.ok(
        thumbStyle.includes("--slider-thumb-x"),
        "the thumb carries its position var",
      );
      const fillStyle = await page.locator(RANGE).getAttribute("style") ?? "";
      assert.ok(
        fillStyle.includes("--slider-fill-right"),
        "the fill carries its inset vars",
      );
      assert.equal(
        await page.locator(INDICATOR).isHidden(),
        true,
        "the drag indicator is hidden until a drag",
      );
    });

    await step("renders the marker parts", async () => {
      const markers = page.locator('[id*=":marker:"]');
      assert.equal(await markers.count(), 3, "three markers are declared");
      const atValue = page.locator('[data-state="at-value"]');
      assert.equal(await atValue.count(), 1, "one marker sits at the current value");
    });

    await step("clicking the thumb focuses without moving the value", async () => {
      await page.locator(THUMB).click();
      assert.equal(await valueNow(), "50", "a thumb click preserves the value");
      assert.equal(
        await page.locator("#slider-focused").textContent(),
        "yes",
        "the thumb click focuses the slider",
      );
    });

    await step("the keyboard steps by the step, the page step, Home and End", async () => {
      await page.keyboard.press("ArrowRight");
      assert.equal(await valueNow(), "51", "ArrowRight steps by one");
      await page.keyboard.press("Shift+ArrowRight");
      assert.equal(await valueNow(), "61", "Shift+ArrowRight steps by the large step");
      await page.keyboard.press("Home");
      assert.equal(await valueNow(), "0", "Home goes to the minimum");
      await page.keyboard.press("End");
      assert.equal(await valueNow(), "100", "End goes to the maximum");
      await page.keyboard.press("ArrowRight");
      assert.equal(await valueNow(), "100", "the value clamps at the maximum");
      assert.equal(await readout(), "100", "the host readout follows the keyboard");
    });

    await step("clicking the track jumps the thumb to that position", async () => {
      const box = await page.locator(CONTROL).boundingBox();
      assert.ok(box !== null, "the control has a box");
      const settle = (): Promise<void> => page.waitForTimeout(250);
      await page.mouse.click(box.x + box.width - 2, box.y + box.height / 2);
      assert.equal(await valueNow(), "100", "a click at the far right lands on the max");
      await settle();
      await page.mouse.click(box.x + 2, box.y + box.height / 2);
      assert.equal(await valueNow(), "0", "a click at the far left lands on the min");
      await settle();
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      assert.equal(await valueNow(), "50", "a click at the middle lands on the default");
      await settle();
    });

    await step("dragging the track moves the thumb and commits on release", async () => {
      const before = Number(await page.locator("#slider-ends").textContent());
      const box = await page.locator(CONTROL).boundingBox();
      assert.ok(box !== null, "the control has a box");
      const middle = box.y + box.height / 2;
      await page.mouse.move(box.x + box.width * 0.4, middle);
      await page.mouse.down();
      assert.equal(await valueNow(), "40", "pressing the track jumps the thumb there");
      await page.mouse.move(box.x + box.width - 2, middle, { steps: 8 });
      assert.equal(
        await page.locator(INDICATOR).isHidden(),
        false,
        "the drag indicator shows while dragging",
      );
      await page.mouse.up();
      assert.equal(await valueNow(), "100", "the drag carries the thumb to the release point");
      assert.equal(
        Number(await page.locator("#slider-ends").textContent()),
        before + 1,
        "the drag release commits a value-change-end",
      );
      assert.equal(
        await page.locator(INDICATOR).isHidden(),
        true,
        "the drag indicator hides again after the release",
      );
    });

    await step("the host commands drive the machine", async () => {
      await page.getByRole("button", { name: "el.setValue([75])" }).click();
      assert.equal(await valueNow(), "75", "setValue writes the value");
      await page.getByRole("button", { name: "el.focus()" }).click();
      assert.equal(
        await page.locator("#slider-focused").textContent(),
        "yes",
        "the focus command focuses the thumb",
      );
    });

    await step("a disabled slider is inert", async () => {
      await page.getByRole("button", { name: "disable" }).click();
      await page.waitForSelector(`${THUMB}[aria-disabled="true"]`, { timeout: 2000 });
      assert.equal(await valueNow(), "75", "disabling keeps the value");
      assert.equal(
        await page.locator(THUMB).getAttribute("tabindex"),
        null,
        "a disabled thumb leaves the tab order",
      );
      await page.locator(THUMB).focus();
      await page.keyboard.press("ArrowRight");
      assert.equal(await valueNow(), "75", "a disabled thumb ignores the keyboard");
      const box = await page.locator(CONTROL).boundingBox();
      assert.ok(box !== null, "the control has a box");
      await page.mouse.click(box.x + box.width - 2, box.y + box.height / 2);
      assert.equal(await valueNow(), "75", "a disabled control ignores the pointer");
      assert.equal(
        await page.locator("#slider-disabled").textContent(),
        "yes",
        "the host readout reports the disabled state",
      );
      await page.getByRole("button", { name: "enable" }).click();
      await page.waitForSelector(`${THUMB}:not([aria-disabled="true"])`, { timeout: 2000 });
      assert.equal(await valueNow(), "75", "re-enabling keeps the value");
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

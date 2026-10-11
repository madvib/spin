/**
 * E2E: the forked-FSM timer drives its clock in a real browser — the aria
 * contract, the trigger contract per phase, a clock that starts, holds and
 * resumes, a countdown that runs its bar from full to empty and completes on
 * its own, and the autoStart seed.
 *
 * Run explicitly (not in default `deno task test`):
 *   cd packages/components && deno test --allow-read --allow-net --allow-run --allow-env --allow-sys --allow-write=/tmp --allow-import tests/timer.e2e.ts
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
const PORT = 5217;
const URL = `http://127.0.0.1:${PORT}/timer`;

/** Parts are addressed by the machine's id scheme: `timer:<id>:<part>`. */
const byId = (id: string): string => `[id="${id}"]`;
const STOPWATCH_ROOT = byId("timer:stopwatch:root");
const STOPWATCH_AREA = byId("timer:stopwatch:area");
const AUTO_ROOT = byId("timer:auto:root");
const AUTO_AREA = byId("timer:auto:area");
const SHORT_ROOT = byId("timer:short:root");
const SHORT_AREA = byId("timer:short:area");
const unitValue = (id: string, part: string): string => byId(`timer:${id}:item-value:${part}`);
const trigger = (id: string, action: string): string => byId(`timer:${id}:action-trigger:${action}`);
/** The bar: the area's second child is the track, and its child is the fill. */
const fill = (area: string): string => `${area} > div:nth-child(2) > div`;
/** The track the fill lives in. */
const track = (area: string): string => `${area} > div:nth-child(2)`;

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

Deno.test("spin-timer e2e", async () => {
  await step("build", buildDemo);
  const server = await step("serve", startServer);
  const pageErrors: string[] = [];
  let browser: Browser | undefined;

  try {
    browser = await step("launch chromium", () =>
      chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] }));

    const page = await browser.newPage();
    page.on("pageerror", (err) => pageErrors.push(err.message));

    const text = async (selector: string): Promise<string> =>
      (await page.locator(selector).textContent()) ?? "";
    const state = async (root: string): Promise<string | null> =>
      page.locator(root).getAttribute("data-state");
    const width = async (selector: string): Promise<number> =>
      page.locator(selector).evaluate((node: HTMLElement) => node.getBoundingClientRect().width);
    /** Waits until the unit's digits differ from `before`, proving the clock ran. */
    const digitsChanged = async (selector: string, before: string): Promise<void> => {
      await page.waitForFunction(
        (args: { selector: string; before: string }) =>
          document.querySelector(args.selector)?.textContent !== args.before,
        { selector, before },
        { timeout: 6000 },
      );
    };
    /** The host's readout and the area's digits, read in one frame so no tick
     * can land between them. */
    const readAloud = async (readoutId: string, areaId: string): Promise<{
      readout: string;
      digits: string;
    }> => {
      const seen = await page.evaluate((args: { readoutId: string; areaId: string }) => {
        const unit = (part: string): string =>
          document.querySelector(`[id="timer:${args.areaId}:item-value:${part}"]`)?.textContent ?? "";
        return {
          readout: document.querySelector(`#${args.readoutId}`)?.textContent ?? "",
          // The units the area renders: a run under a day has no days row.
          digits: `${unit("hours")}:${unit("minutes")}:${unit("seconds")}`,
        };
      }, { readoutId, areaId });
      return seen;
    };

    await step("load page", async () => {
      await page.goto(URL, { waitUntil: "load" });
      await page.waitForSelector(STOPWATCH_ROOT, { state: "attached", timeout: 5000 });
    });

    await step("renders the timer contract", async () => {
      assert.equal(await page.locator(STOPWATCH_AREA).getAttribute("role"), "timer", "the area is a timer");
      assert.equal(
        await page.locator(STOPWATCH_AREA).getAttribute("aria-atomic"),
        "true",
        "and announces itself atomically",
      );
      assert.equal(
        await page.locator(STOPWATCH_AREA).getAttribute("aria-label"),
        "0 days 00:00:00",
        "the area label is the count a screen reader hears",
      );
      assert.equal(await state(STOPWATCH_ROOT), "idle", "a fresh stopwatch waits");
      assert.equal(await text(unitValue("stopwatch", "seconds")), "00", "the seconds unit renders padded digits");
      // days is hidden below a day, and the separator after it goes too.
      assert.equal(
        await page.locator(byId("timer:stopwatch:item:days")).isHidden(),
        true,
        "a run that has not reached a day hides the unit",
      );
      assert.equal(
        await page.locator(`${STOPWATCH_AREA} [data-after="days"]`).isHidden(),
        true,
        "and its separator, so no colon leads the display",
      );
      assert.equal(
        await page.locator(`${STOPWATCH_AREA} [data-after="minutes"]`).isHidden(),
        false,
        "the separators between visible units show",
      );
      // Only the phase's triggers are reachable: a hidden button is out of the
      // tab order and out of the accessibility tree.
      assert.equal(await page.locator(trigger("stopwatch", "start")).isHidden(), false, "a stopped clock offers start");
      assert.equal(await page.locator(trigger("stopwatch", "pause")).isHidden(), true, "and hides pause");
      assert.equal(await page.locator(trigger("stopwatch", "resume")).isHidden(), true, "and hides resume");
      assert.equal(await page.locator(trigger("stopwatch", "reset")).isHidden(), true, "and hides reset");
      assert.equal(
        await page.locator(trigger("stopwatch", "restart")).isHidden(),
        false,
        "and always offers restart",
      );
    });

    await step("the keyboard starts the clock and a tick reports the count", async () => {
      await page.locator(trigger("stopwatch", "start")).focus();
      await page.keyboard.press("Enter");
      assert.equal(await state(STOPWATCH_ROOT), "running", "Enter on the focused trigger starts the clock");
      assert.equal(await page.locator(trigger("stopwatch", "start")).isHidden(), true, "start hides once answered");
      assert.equal(await page.locator(trigger("stopwatch", "pause")).isHidden(), false, "and pause takes its place");
      assert.equal(await page.locator(trigger("stopwatch", "reset")).isHidden(), false, "with reset beside it");
      const before = await text(unitValue("stopwatch", "seconds"));
      await digitsChanged(unitValue("stopwatch", "seconds"), before);
      const seen = await readAloud("timer-value", "stopwatch");
      assert.equal(seen.readout, seen.digits, "the tick event carries the count the area renders");
    });

    await step("a paused clock holds, and resume restarts it", async () => {
      await page.locator(trigger("stopwatch", "pause")).click();
      assert.equal(await state(STOPWATCH_ROOT), "paused", "the trigger pauses it");
      assert.equal(await page.locator(trigger("stopwatch", "resume")).isHidden(), false, "resume is offered");
      const held = await text(unitValue("stopwatch", "seconds"));
      await delay(600);
      assert.equal(await text(unitValue("stopwatch", "seconds")), held, "a paused clock holds its count");
      await page.locator(trigger("stopwatch", "resume")).click();
      assert.equal(await state(STOPWATCH_ROOT), "running", "resume restarts it");
    });

    await step("reset takes the count home, and a paused clock resets to idle", async () => {
      await page.locator(trigger("stopwatch", "reset")).click();
      assert.equal(await text(unitValue("stopwatch", "seconds")), "00", "reset takes the count home");
      assert.equal(await state(STOPWATCH_ROOT), "running", "and a running clock keeps running");
      await page.locator(trigger("stopwatch", "pause")).click();
      await page.locator(trigger("stopwatch", "reset")).click();
      assert.equal(await state(STOPWATCH_ROOT), "idle", "a paused clock resets to idle");
    });

    await step("restart goes home and runs", async () => {
      await page.locator(trigger("stopwatch", "restart")).click();
      assert.equal(await state(STOPWATCH_ROOT), "running", "restart runs from home");
      assert.equal(await text(unitValue("stopwatch", "seconds")), "00", "from the start count");
    });

    await step("an autoStart countdown is running on load", async () => {
      assert.equal(await state(AUTO_ROOT), "running", "autoStart seeds the running phase");
      assert.equal(await page.locator(trigger("auto", "pause")).isHidden(), false, "and the phase offers pause");
      const before = await text(unitValue("auto", "seconds"));
      await digitsChanged(unitValue("auto", "seconds"), before);
      const seen = await readAloud("timer-countdown", "auto");
      assert.equal(seen.readout, seen.digits, "the countdown's tick event carries the count the area renders");
    });

    await step("a short countdown runs its bar from full to empty and completes", async () => {
      assert.equal(await state(SHORT_ROOT), "idle", "the short countdown waits for its trigger");
      assert.equal(await text(unitValue("short", "seconds")), "01", "seeded from startMs");
      await page.locator(trigger("short", "start")).click();
      // A countdown is full at its start, so the bar fills the track.
      const trackWidth = await width(track(SHORT_AREA));
      assert.equal(await width(fill(SHORT_AREA)), trackWidth, "a fresh countdown's bar fills the track");
      await delay(700);
      const midway = await width(fill(SHORT_AREA));
      assert.ok(midway > 0, "mid-run the bar is not empty");
      assert.ok(midway < trackWidth, "mid-run the bar is not full");
      await page.waitForFunction(
        () => document.querySelector('[id="timer:short\\:root"]')?.getAttribute("data-state") === "idle",
        undefined,
        { timeout: 6000 },
      );
      assert.equal(await state(SHORT_ROOT), "idle", "the run ends on its own");
      assert.equal(await text(unitValue("short", "seconds")), "00", "with the count at the target");
      assert.equal(await width(fill(SHORT_AREA)), 0, "and the bar empties with it");
      assert.equal(await text("#timer-completes"), "1", "the host's complete callback fired once");
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

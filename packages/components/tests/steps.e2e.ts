/**
 * E2E: the forked-FSM steps drives its machine in a real browser — the tab
 * wiring, the pointer and keyboard paths, the percent as a custom property,
 * the vertical rail, and the linear controlled stepper whose forward moves a
 * host predicate gates.
 *
 * Run explicitly (not in default `deno task test`):
 *   cd packages/components && deno task e2e:steps
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
const PORT = 5222;
const URL = `http://127.0.0.1:${PORT}/steps-fsm`;

/** Parts are addressed by the element's id, which the route writes so each
 * instance is addressable: `steps:<id>:<part>`. */
const FLOW_ROOT = '[id="steps:flow"]';
const COLUMN_ROOT = '[id="steps:column"]';
const GATED_ROOT = '[id="steps:gated"]';

const flowTrigger = (index: number): string => `[id="steps:flow:trigger:${index}"]`;
const flowPanel = (index: number): string => `[id="steps:flow:content:${index}"]`;
const gatedTrigger = (index: number): string => `[id="steps:gated:trigger:${index}"]`;

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

Deno.test("spin-steps-fsm e2e", async () => {
  await step("build", buildDemo);
  const server = await step("serve", startServer);
  const pageErrors: string[] = [];
  let browser: Browser | undefined;

  try {
    browser = await step("launch chromium", () =>
      chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] }));

    const page = await browser.newPage();
    page.on("pageerror", (err) => pageErrors.push(err.message));

    /** The step, as the host readout reports it. */
    const flowStep = async (): Promise<string> =>
      (await page.locator("#steps-step").textContent()) ?? "";
    const percent = async (root: string): Promise<string> =>
      page.locator(root).evaluate((node: HTMLElement) => node.style.getPropertyValue("--steps-percent"));
    const progressValue = async (root: string): Promise<string | null> =>
      page.locator(`${root} [role="progressbar"]`).getAttribute("aria-valuenow");
    /** The single visible tabpanel inside a stepper. */
    const visiblePanel = async (root: string): Promise<string | null> => {
      const panels = page.locator(`${root} [role="tabpanel"]`);
      const count = await panels.count();
      for (let index = 0; index < count; index += 1) {
        if (await panels.nth(index).isVisible()) {
          return panels.nth(index).getAttribute("id");
        }
      }
      return null;
    };

    await step("load page", async () => {
      await page.goto(URL, { waitUntil: "load" });
      await page.waitForSelector(FLOW_ROOT, { state: "attached", timeout: 5000 });
    });

    await step("renders the horizontal stepper", async () => {
      const list = page.locator(`${FLOW_ROOT} [role="tablist"]`);
      assert.equal(await list.getAttribute("aria-orientation"), "horizontal", "the list announces the orientation");
      assert.equal(
        await list.getAttribute("aria-owns"),
        "steps:flow:trigger:0 steps:flow:trigger:1 steps:flow:trigger:2 steps:flow:trigger:3",
        "the list owns every trigger",
      );
      assert.equal(await page.locator(`${FLOW_ROOT} [role="tab"]`).count(), 4, "every step renders a tab");
      const first = page.locator(flowTrigger(0));
      assert.equal(await first.getAttribute("aria-selected"), "true", "the first step is selected");
      assert.equal(await first.getAttribute("data-state"), "open", "and reports open");
      assert.equal(await first.getAttribute("aria-controls"), "steps:flow:content:0", "controlling its panel");
      assert.equal(await first.getAttribute("tabindex"), "0", "and is a tab stop");
      assert.equal(await page.locator(flowTrigger(1)).getAttribute("aria-selected"), "false", "the others are not");
      assert.equal(
        await page.locator(flowTrigger(1)).getAttribute("tabindex"),
        "0",
        "but are still tab stops when non-linear",
      );
      assert.equal(await visiblePanel(FLOW_ROOT), "steps:flow:content:0", "the first panel is the visible one");
      assert.equal(
        await page.locator(flowPanel(1)).getAttribute("hidden"),
        "",
        "and the others carry the hidden attribute",
      );
      assert.equal(
        await page.locator(`${flowTrigger(0)} span`).first().textContent(),
        "1",
        "the indicator numbers the step",
      );
      assert.equal(await progressValue(FLOW_ROOT), "0", "the progress starts at zero");
      assert.equal(
        await page.locator(`${FLOW_ROOT} [role="progressbar"]`).getAttribute("aria-valuetext"),
        "0% complete",
        "with its text alternative",
      );
      assert.equal(await percent(FLOW_ROOT), "0%", "the root carries the percent as a custom property");
      assert.equal(
        await page.locator(`${FLOW_ROOT} [id="steps:flow:prev-trigger"]`).getAttribute("disabled"),
        "",
        "prev is disabled on the first step",
      );
      assert.equal(
        await page.locator(`${FLOW_ROOT} [id="steps:flow:next-trigger"]`).getAttribute("disabled"),
        null,
        "and next is not",
      );
    });

    await step("the pointer walks the stepper and the percent follows", async () => {
      await page.locator(flowTrigger(2)).click();
      assert.equal(await flowStep(), "2", "a trigger click lands on that step");
      assert.equal(await page.locator(flowTrigger(2)).getAttribute("aria-selected"), "true", "and selects it");
      assert.equal(await page.locator(flowTrigger(0)).getAttribute("data-complete"), "", "the earlier triggers report complete");
      assert.equal(await page.locator(flowTrigger(2)).getAttribute("data-current"), "", "the clicked one reports current");
      assert.equal(await page.locator(flowTrigger(3)).getAttribute("data-incomplete"), "", "and the later one incomplete");
      assert.equal(await visiblePanel(FLOW_ROOT), "steps:flow:content:2", "its panel becomes visible");
      assert.equal(await percent(FLOW_ROOT), "50%", "the custom property follows the step");
      assert.equal(await progressValue(FLOW_ROOT), "50", "and so does the progress bar");
      const fill = await page.locator(`${FLOW_ROOT} [role="progressbar"] > div.h-full`).evaluate((node: HTMLElement) => ({
        width: getComputedStyle(node).width,
        background: getComputedStyle(node).backgroundColor,
      }));
      const track = await page.locator(`${FLOW_ROOT} [role="progressbar"]`).evaluate((node: HTMLElement) => getComputedStyle(node).width);
      assert.ok(
        Math.abs(Number.parseFloat(fill.width) - Number.parseFloat(track) / 2) < 2,
        `the fill is half the track (${fill.width} of ${track})`,
      );
      assert.notEqual(fill.background, "rgba(0, 0, 0, 0)", "the fill is painted by the theme's primary");

      // Backward is never guarded, valid or not.
      await page.locator(flowTrigger(1)).click();
      assert.equal(await flowStep(), "1", "an earlier trigger is always reachable");
      assert.equal(await percent(FLOW_ROOT), "25%", "and the percent rewinds");

      const next = page.locator(`${FLOW_ROOT} [id="steps:flow:next-trigger"]`);
      await next.click();
      assert.equal(await flowStep(), "2", "next advances one");
      await next.click();
      assert.equal(await flowStep(), "3", "next reaches the last visible step");
      await next.click();
      assert.equal(await flowStep(), "4", "and the position Zag calls complete: step === count");
      assert.equal(await percent(FLOW_ROOT), "100%", "at a full percent");
      assert.equal(
        await page.locator(`${FLOW_ROOT} [role="progressbar"]`).getAttribute("data-complete"),
        "",
        "the progress bar reports complete",
      );
      assert.equal(
        await page.locator("#steps-completed").textContent(),
        "1",
        "onStepComplete fired once",
      );
      assert.equal(
        await next.getAttribute("disabled"),
        "",
        "next is disabled on the complete position",
      );
      await page.locator(`${FLOW_ROOT} [id="steps:flow:prev-trigger"]`).click();
      assert.equal(await flowStep(), "3", "prev walks back");
    });

    await step("the keyboard drives a trigger", async () => {
      await page.locator(flowTrigger(1)).focus();
      await page.keyboard.press("Enter");
      assert.equal(await flowStep(), "1", "Enter on a focused trigger lands on its step");
      assert.equal(await visiblePanel(FLOW_ROOT), "steps:flow:content:1", "and shows its panel");
    });

    await step("the host commands drive the machine", async () => {
      await page.getByRole("button", { name: "el.setStep(3)" }).click();
      assert.equal(await flowStep(), "3", "setStep writes the step");
      assert.equal(await percent(FLOW_ROOT), "75%", "and the percent follows");
      await page.getByRole("button", { name: "el.resetStep()" }).click();
      assert.equal(await flowStep(), "0", "resetStep returns to the first step");
      assert.equal(await percent(FLOW_ROOT), "0%", "and the percent resets");
    });

    await step("renders the vertical stepper", async () => {
      assert.equal(
        await page.locator(`${COLUMN_ROOT} [role="tablist"]`).getAttribute("aria-orientation"),
        "vertical",
        "the vertical list announces its orientation",
      );
      assert.equal(
        await page.locator(`[id="steps:column:trigger:1"]`).getAttribute("aria-selected"),
        "true",
        "defaultStep seeds the vertical stepper",
      );
      const rail = await page
        .locator(`${COLUMN_ROOT} span.border-l`)
        .first()
        .evaluate((node: HTMLElement) => ({
          width: getComputedStyle(node).width,
          height: getComputedStyle(node).height,
        }));
      assert.ok(
        Number.parseFloat(rail.height) > Number.parseFloat(rail.width),
        `the rail runs vertically (${rail.width} x ${rail.height})`,
      );
      assert.ok(Number.parseFloat(rail.width) <= 8, "the rail is a hairline, not a full-width bar");
      await page.locator(`[id="steps:column:trigger:2"]`).click();
      assert.equal(
        await page.locator("#steps-column-step").textContent(),
        "2",
        "the vertical stepper moves",
      );
    });

    await step("a linear controlled stepper is gated by the host's predicate", async () => {
      const gatedStep = async (): Promise<string> =>
        (await page.locator("#steps-gated-step").textContent()) ?? "";
      const invalidText = async (): Promise<string> =>
        (await page.locator("#steps-gated-invalid").textContent()) ?? "";
      const gatedNext = page.locator(`${GATED_ROOT} [id="steps:gated:next-trigger"]`);

      assert.equal(await gatedStep(), "0", "the controlled stepper starts on the host's step");
      assert.equal(
        await page.locator(gatedTrigger(0)).getAttribute("tabindex"),
        "0",
        "only the current step is a tab stop when linear",
      );
      assert.equal(
        await page.locator(gatedTrigger(3)).getAttribute("tabindex"),
        "-1",
        "the others are not",
      );

      // Linear triggers are not a navigation surface, in either direction.
      await page.locator(gatedTrigger(3)).click();
      assert.equal(await gatedStep(), "0", "a linear stepper's triggers are inert");

      await gatedNext.click();
      assert.equal(await gatedStep(), "1", "step 0 is valid, so next leaves it");
      await gatedNext.click();
      assert.equal(await gatedStep(), "1", "step 1 is not valid, so next is refused");
      assert.equal(await invalidText(), "step 1 refused next", "and the refusal is reported");

      await page.getByRole("button", { name: "step 1 skippable" }).click();
      await gatedNext.click();
      assert.equal(await gatedStep(), "2", "a skippable step is bypassed");
      await gatedNext.click();
      assert.equal(await gatedStep(), "2", "step 2 is neither valid nor skippable, so it blocks");

      await page.getByRole("button", { name: "validate current step" }).click();
      await gatedNext.click();
      assert.equal(await gatedStep(), "3", "validating the step re-opens the move");
      await gatedNext.click();
      assert.equal(await gatedStep(), "3", "the last step blocks until it is validated too");

      await page.getByRole("button", { name: "validate current step" }).click();
      await gatedNext.click();
      assert.equal(await gatedStep(), "4", "and the complete position is reachable");
      assert.equal(await percent(GATED_ROOT), "100%", "with a full percent");

      // The controlled prop is never guarded: the host's own write lands.
      await page.locator(`${GATED_ROOT} [id="steps:gated:reset-trigger"]`).click();
      assert.equal(await gatedStep(), "0", "reset returns to the first step");
      assert.equal(await percent(GATED_ROOT), "0%", "and the percent follows the controlled step");
    });

    await step("the recipe hides the rail that follows no step", async () => {
      const rails = page.locator(`${FLOW_ROOT} span.border-t:not([hidden])`);
      assert.equal(
        await rails.count(),
        3,
        "one rail between each pair of steps, and none after the last",
      );
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

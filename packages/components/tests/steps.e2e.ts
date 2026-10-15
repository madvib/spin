/**
 * E2E: the forked-FSM steps flow in a real browser — next advances, back
 * retreats, triggers jump, and the imperative commands drive the index.
 *
 * Run explicitly (not in default `deno task test`):
 *   cd packages/components && deno test --allow-read --allow-net --allow-run
 *     --allow-env --allow-sys --allow-write=/tmp --allow-import
 *     --min-dep-age=0 tests/steps.e2e.ts
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
const PORT = 5254;
const URL = `http://127.0.0.1:${PORT}/steps`;

/** Part ids are the machine's scheme: `steps:<element id>:<part>`. */
const at = (part: string): string => `[id="steps:flow:${part}"]`;
const ROOT_ID = '[id="steps:flow"]';
const trigger = (index: number): string => at(`trigger:${index}`);

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
  for (let i = 0; i < 50; i += 1) {
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

Deno.test("spin-steps e2e", async () => {
  await step("build", buildDemo);
  const server = await step("serve", startServer);
  const pageErrors: string[] = [];
  let browser: Browser | undefined;

  try {
    browser = await step("launch chromium", () =>
      chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] }));

    const page: Page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    page.on("pageerror", (err) => pageErrors.push(err.message));

    await step("load page", async () => {
      await page.goto(URL, { waitUntil: "load" });
      await page.waitForSelector(ROOT_ID, { state: "attached", timeout: 5000 });
      await page.waitForTimeout(1500);
    });

    const readout = page.locator("text=/step: \\d+/").first();

    await step("next advances and back retreats", async () => {
      await page.getByRole("button", { name: "Next", exact: true }).click();
      await page.waitForTimeout(300);
      assert.match(await readout.textContent() ?? "", /step: 1/, "next advanced to one");
      assert.equal(
        await page.locator(trigger(1)).getAttribute("aria-selected"),
        "true",
        "the second trigger reads selected",
      );
      await page.getByRole("button", { name: "Back", exact: true }).click();
      await page.waitForTimeout(300);
      assert.match(await readout.textContent() ?? "", /step: 0/, "back retreated to zero");
    });

    await step("a trigger jumps to its step", async () => {
      await page.locator(trigger(2)).click();
      await page.waitForTimeout(300);
      assert.match(await readout.textContent() ?? "", /step: 2/, "the third trigger jumped");
    });

    await step("commands drive the instance", async () => {
      await page.getByText("el.resetStep()").click();
      await page.waitForTimeout(300);
      assert.match(await readout.textContent() ?? "", /step: 0/, "reset returned to zero");
      await page.getByText("el.goToNextStep()").click();
      await page.waitForTimeout(300);
      assert.match(await readout.textContent() ?? "", /step: 1/, "the command advanced");
    });

    assert.deepEqual(pageErrors, [], `page errors: ${pageErrors.join("; ")}`);
  } finally {
    await browser?.close();
    try {
      server.kill();
    } catch {
      // already exited
    }
  }
});

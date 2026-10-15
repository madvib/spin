/**
 * E2E: the forked-FSM avatar faces in a real browser — the portrait loads
 * and the fallback yields, the broken src keeps its fallback, and the
 * imperative reports drive the states.
 *
 * Run explicitly (not in default `deno task test`):
 *   cd packages/components && deno test --allow-read --allow-net --allow-run
 *     --allow-env --allow-sys --allow-write=/tmp --allow-import
 *     --min-dep-age=0 tests/avatar.e2e.ts
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
const PORT = 5258;
const URL = `http://127.0.0.1:${PORT}/avatar`;

/** Part ids are the machine's scheme: `avatar:<element id>:<part>`. */
const at = (id: string, part: string): string => `[id="avatar:${id}:${part}"]`;
const USER_IMAGE = at("user", "image");
const USER_FALLBACK = at("user", "fallback");
const BROKEN_FALLBACK = at("broken", "fallback");

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

Deno.test("spin-avatar e2e", async () => {
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
      await page.waitForSelector(USER_IMAGE, { state: "attached", timeout: 5000 });
      await page.waitForTimeout(1500);
    });

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

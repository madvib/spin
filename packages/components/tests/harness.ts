/**
 * The e2e harness: the shape every component suite runs on — the per-file
 * remainder (named steps against locators) is the actual test.
 *
 *   import { runComponentSuite, step } from "./harness.ts";
 *
 *   test("spin-slider e2e", () =>
 *     runComponentSuite({ port: 5252, route: "/slider", ready: CONTROL }, async ({ page }) => {
 *       await step("a track press jumps", ...);
 *     }));
 *
 * Run explicitly (not in default `bun test`):
 *   cd packages/components && bun test tests/<suite>.e2e.ts
 *
 * Builds the reference app, serves dist, drives real Chromium via Playwright.
 * Requires the Playwright browser once: `bunx playwright install chromium`.
 * Fails loud naming the step; silent on success.
 */

import { execFile, spawn, type ChildProcess } from "node:child_process";
import { promisify } from "node:util";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { strict as assert } from "node:assert";
import { type Browser, chromium, type Page } from "playwright-core";

const ROOT = join(import.meta.dirname as string, "..", "..", "..");
/** The reference app: the library's EXAMPLES, each its own element. The
 * specimens app is Solid's routes; this is the product's own markup. */
const REFERENCE = "apps/reference";

/** Runs a named step, rethrowing any failure prefixed with the step name. */
export async function step<T>(name: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    throw new Error(`[${name}] ${(error as Error).message}`, { cause: error });
  }
}
/** A sleep for steps and settle hooks that wait on time, not state. */
export { delay };

/** Builds an app from a clean checkout. */
async function buildDemo(app: string): Promise<void> {
  const execFileAsync = promisify(execFile);
  try {
    await execFileAsync("node", [join(ROOT, "node_modules/vite/bin/vite.js"), "build", app], { cwd: ROOT });
  } catch (error) {
    const err = error as { stderr?: string | Buffer };
    assert.equal(
      1,
      0,
      `vite build failed:\n${String(err.stderr ?? error)}`,
    );
  }
}

/** Serves the built dist on a fixed port and waits until it answers. */
async function startServer(
  port: number,
  route: string,
  app: string,
): Promise<ChildProcess> {
  const child = spawn("node", [
    join(ROOT, "node_modules/vite/bin/vite.js"),
    "preview",
    app,
    "--port",
    String(port),
    "--strictPort",
  ], { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] });
  const url = `http://127.0.0.1:${port}${route}`;
  for (let i = 0; i < 50; i += 1) {
    try {
      if ((await fetch(url)).ok) return child;
    } catch {
      // server not ready yet
    }
    await delay(100);
  }
  const errText = await new Promise<string>((resolve) => {
    let text = "";
    child.stderr?.on("data", (chunk: Buffer) => { text += String(chunk); });
    child.stderr?.on("end", () => resolve(text));
    setTimeout(() => resolve(text), 500);
  });
  try {
    child.kill();
  } catch {
    // already exited
  }
  throw new Error(`vite preview did not start on :${port}\n${errText}`);
}

export interface SuiteContext {
  readonly page: Page;
}

export interface SuiteOptions {
  readonly port: number;
  readonly route: string;
  readonly ready: string;
  /** The app to build and serve. Defaults to the reference app
   * (the library's EXAMPLES). */
  readonly app?: string;
  /** Ready-selector timeout: the default 5s covers warm serves; the
   * floating panel's half-megabyte bundle on a cold cache has been
   * observed past it. */
  readonly timeoutMs?: number;
  /** Extra waits after the ready selector (measured flags, initial
   * asserts): part of the test, not scaffolding. */
  readonly settle?: (page: Page) => Promise<void>;
}
/**
 * One component suite: build, serve, launch, load the route, run the
 * steps, assert zero page errors, tear down. The `ready` selector proves
 * the element rendered before steps run.
 */
export async function runComponentSuite(
  options: SuiteOptions,
  steps: (ctx: SuiteContext) => Promise<void>,
): Promise<void> {
  const app = options.app ?? REFERENCE;
  await step("build", () => buildDemo(app));
  const server = await step(
    "serve",
    () => startServer(options.port, options.route, app),
  );
  const pageErrors: string[] = [];
  let browser: Browser | undefined;

  try {
    browser = await step(
      "launch chromium",
      () =>
        chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] }),
    );

    const page: Page = await browser.newPage({
      viewport: { width: 1280, height: 900 },
    });
    page.on("pageerror", (err) => pageErrors.push(err.message));

    await step("load page", async () => {
      await page.goto(`http://127.0.0.1:${options.port}${options.route}`, {
        waitUntil: "load",
      });
      await page.waitForSelector(options.ready, {
        state: "attached",
        timeout: options.timeoutMs ?? 5000,
      });
      await page.waitForTimeout(1500);
      await options.settle?.(page);
    });

    await steps({ page });

    assert.deepEqual(pageErrors, [], `page errors: ${pageErrors.join("; ")}`);
  } finally {
    await browser?.close();
    try {
      server.kill();
    } catch {
      // already exited
    }
  }
}

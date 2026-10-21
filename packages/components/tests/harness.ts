/**
 * The e2e harness: build the specimens app, serve it, drive Chromium.
 * Every component suite shares this shape — the per-file remainder (named
 * steps against locators) is the actual test.
 *
 *   import { runComponentSuite, step } from "./harness.ts";
 *
 *   Deno.test("spin-slider e2e", () =>
 *     runComponentSuite({ port: 5252, route: "/slider", ready: CONTROL }, async ({ page }) => {
 *       await step("a track press jumps", ...);
 *     }));
 */

import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { strict as assert } from "node:assert";
import { chromium, type Browser, type Page } from "npm:playwright-core";

const ROOT = join(import.meta.dirname as string, "..", "..", "..");
const SPECIMENS = "packages/components/specimens";
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
  const cmd = new Deno.Command("node", {
    args: [join(ROOT, "node_modules/vite/bin/vite.js"), "build", app],
    cwd: ROOT,
    stdout: "piped",
    stderr: "piped",
  });
  const { code, stderr } = await cmd.output();
  assert.equal(code, 0, `vite build failed:\n${new TextDecoder().decode(stderr)}`);
}

/** Serves the built dist on a fixed port and waits until it answers. */
async function startServer(
  port: number,
  route: string,
  app: string,
): Promise<Deno.ChildProcess> {
  const cmd = new Deno.Command("node", {
    args: [
      join(ROOT, "node_modules/vite/bin/vite.js"),
      "preview",
      app,
      "--port",
      String(port),
      "--strictPort",
    ],
    cwd: ROOT,
    stdout: "piped",
    stderr: "piped",
  });
  const child = cmd.spawn();
  const url = `http://127.0.0.1:${port}${route}`;
  for (let i = 0; i < 50; i += 1) {
    try {
      if ((await fetch(url)).ok) return child;
    } catch {
      // server not ready yet
    }
    await delay(100);
  }
  const errText = new TextDecoder().decode(await new Response(child.stderr).arrayBuffer());
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
  /** The app to build and serve. The default is the specimens app
   * (Solid's routes); the reference app is the library's EXAMPLES. */
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
  const app = options.app ?? SPECIMENS;
  await step("build", () => buildDemo(app));
  const server = await step("serve", () => startServer(options.port, options.route, app));
  const pageErrors: string[] = [];
  let browser: Browser | undefined;

  try {
    browser = await step("launch chromium", () =>
      chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] }));

    const page: Page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    page.on("pageerror", (err) => pageErrors.push(err.message));

    await step("load page", async () => {
      await page.goto(`http://127.0.0.1:${options.port}${options.route}`, { waitUntil: "load" });
      await page.waitForSelector(options.ready, { state: "attached", timeout: options.timeoutMs ?? 5000 });
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

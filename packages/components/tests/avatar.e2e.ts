/**
 * E2E: spin-avatar-fsm drives its machine in a real browser — the load path,
 * the error path, the fallback's initials, the aria contract on both parts,
 * and every imperative command (setSrc, setLoaded, setError) plus the host's
 * own source write.
 *
 * Run explicitly (not in default `deno task test`):
 *   cd packages/components && deno task e2e:avatar
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
const URL = `http://127.0.0.1:${PORT}/avatar-fsm`;

/** Parts are addressed by the machine's id scheme: `avatar:<id>:<part>`,
 * namespaced by the element id the route writes. */
const GOOD_IMAGE = '[id="avatar:avatar-good:image"]';
const GOOD_FALLBACK = '[id="avatar:avatar-good:fallback"]';
const GOOD_ROOT = '[id="avatar:avatar-good"]';
const BROKEN_IMAGE = '[id="avatar:avatar-broken:image"]';
const BROKEN_FALLBACK = '[id="avatar:avatar-broken:fallback"]';
const COMMAND_IMAGE = '[id="avatar:avatar-commands:image"]';
const COMMAND_FALLBACK = '[id="avatar:avatar-commands:fallback"]';
const STATUS = "#avatar-status";

/** The inline bitmap the route's resolving avatar loads. */
const PHOTO_PREFIX = "data:image/svg+xml";

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

Deno.test("spin-avatar-fsm e2e", async () => {
  await step("build", buildDemo);
  const server = await step("serve", startServer);
  const pageErrors: string[] = [];
  let browser: Browser | undefined;

  try {
    browser = await step("launch chromium", () =>
      chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] }));

    const page = await browser.newPage();
    page.on("pageerror", (err) => pageErrors.push(err.message));

    /** The part's animated opacity, which is what the reveal is made of. */
    const opacity = (selector: string): Promise<string> =>
      page.locator(selector).evaluate((el) => getComputedStyle(el).opacity);

    /** Wait for a part to reach an opacity, so no fixed sleep is trusted. */
    const settleOpacity = (selector: string, value: string): Promise<void> =>
      page.waitForFunction(
        ({ selector, value }) => {
          const el = document.querySelector(selector);
          if (el === null) return false;
          return getComputedStyle(el).opacity === value;
        },
        { selector, value },
        { timeout: 4000 },
      ).then(() => undefined);

    await step("load page", async () => {
      // Deep-link first; fall back to the index and the route link.
      try {
        await page.goto(URL, { waitUntil: "load" });
        await page.waitForSelector(GOOD_IMAGE, { state: "attached", timeout: 3000 });
      } catch {
        await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: "load" });
        await page.click('a[href="/avatar-fsm"]');
        await page.waitForSelector(GOOD_IMAGE, { state: "attached", timeout: 5000 });
      }
    });

    await step("renders the load path and the fallback path", async () => {
      // The resolving source finishes, so the image shows and the fallback
      // steps out of the way.
      await settleOpacity(GOOD_IMAGE, "1");
      assert.equal(await opacity(GOOD_FALLBACK), "0", "the fallback fades out once the image is in");
      assert.equal(
        await page.locator(GOOD_ROOT).getAttribute("data-state"),
        "loaded",
        "the root reports the loaded status",
      );
      assert.equal(
        await page.locator(GOOD_IMAGE).getAttribute("alt"),
        "Ada Lovelace",
        "the image is labelled by the alt passthrough",
      );
      const src = await page.locator(GOOD_IMAGE).getAttribute("src");
      assert.ok(src?.startsWith(PHOTO_PREFIX), "the source passthrough reaches the image element");

      // The 404 source fails, so the fallback shows the name's initials.
      await settleOpacity(BROKEN_FALLBACK, "1");
      assert.equal(await opacity(BROKEN_IMAGE), "0", "a failed image stays hidden");
      assert.equal(await page.locator(BROKEN_FALLBACK).textContent(), "GH", "the initials stand in for the name");
      assert.equal(
        await page.locator(BROKEN_IMAGE).getAttribute("alt"),
        "Grace Hopper",
        "the failed image keeps its own alt passthrough",
      );
    });

    await step("the aria contract follows the visible part", async () => {
      assert.equal(
        await page.locator(GOOD_IMAGE).getAttribute("aria-hidden"),
        null,
        "the visible image is in the accessibility tree",
      );
      assert.equal(
        await page.locator(GOOD_FALLBACK).getAttribute("aria-hidden"),
        "true",
        "the hidden fallback is out of the accessibility tree",
      );
      assert.equal(
        await page.locator(BROKEN_FALLBACK).getAttribute("aria-hidden"),
        null,
        "the visible fallback is in the accessibility tree",
      );
      assert.equal(
        await page.locator(BROKEN_IMAGE).getAttribute("aria-hidden"),
        "true",
        "the hidden image is out of the accessibility tree",
      );
    });

    await step("the three parts carry the machine's id scheme", async () => {
      const rootId = await page.locator(GOOD_ROOT).getAttribute("id");
      assert.equal(rootId, "avatar:avatar-good", "the root's id namespaces by the element's own id");
      assert.equal(
        await page.locator(GOOD_IMAGE).getAttribute("id"),
        "avatar:avatar-good:image",
        "the image's id namespaces under the root",
      );
      assert.equal(
        await page.locator(GOOD_FALLBACK).getAttribute("id"),
        "avatar:avatar-good:fallback",
        "the fallback's id namespaces under the root",
      );
      assert.notEqual(
        await page.locator(GOOD_IMAGE).getAttribute("id"),
        await page.locator(BROKEN_IMAGE).getAttribute("id"),
        "each instance owns its own part ids",
      );
    });

    await step("setError by mouse moves the fallback back in", async () => {
      await page.getByRole("button", { name: "el.setError()" }).click();
      await settleOpacity(COMMAND_FALLBACK, "1");
      assert.equal(await opacity(COMMAND_IMAGE), "0", "the image steps aside on the command");
      assert.equal(
        await page.locator(STATUS).textContent(),
        "error",
        "status-change carries the error to the host",
      );
    });

    await step("setLoaded by keyboard brings the image back", async () => {
      await page.getByRole("button", { name: "el.setLoaded()" }).focus();
      await page.keyboard.press("Enter");
      await settleOpacity(COMMAND_IMAGE, "1");
      assert.equal(await opacity(COMMAND_FALLBACK), "0", "the fallback fades out on the keyboard command");
      assert.equal(
        await page.locator(STATUS).textContent(),
        "loaded",
        "status-change carries the settle to the host",
      );
    });

    await step("the host's own source write is observed as a new load", async () => {
      await page.getByRole("button", { name: "host writes a 404 source" }).click();
      await settleOpacity(COMMAND_FALLBACK, "1");
      assert.equal(
        await page.locator(STATUS).textContent(),
        "error",
        "a 404 source written by the host reports an error",
      );
      assert.equal(
        await page.locator(COMMAND_IMAGE).getAttribute("src"),
        "/avatar-missing.png",
        "the source write lands on the image element",
      );
    });

    await step("setSrc starts a new load the machine follows", async () => {
      await page.getByRole("button", { name: "el.setSrc(photo)" }).click();
      await settleOpacity(COMMAND_IMAGE, "1");
      const src = await page.locator(COMMAND_IMAGE).getAttribute("src");
      assert.ok(src?.startsWith(PHOTO_PREFIX), "the command writes the new source");
      assert.equal(
        await page.locator(STATUS).textContent(),
        "loaded",
        "the observer reports the change and the load follows",
      );
      assert.equal(
        await opacity(COMMAND_FALLBACK),
        "0",
        "the fallback steps aside once the new source settles",
      );
    });

    await step("no page errors", async () => {
      assert.deepEqual(pageErrors, [], "the page reported no errors");
    });
  } finally {
    await browser?.close();
    try {
      server.kill();
    } catch {
      // already exited
    }
  }
});

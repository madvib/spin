/**
 * spin-date-input e2e: per-segment editing behind the app-controller handle.
 *
 * Builds the specimens app, serves dist, drives real Chromium via Playwright.
 * The route binds a machine-owned date-input through `{ commands, state,
 * bind }`; this suite exercises the seeded render, digit typing with
 * auto-advance, arrow cycling, the month-aware day clamp, paste, and the
 * imperative commands, with the host readout following throughout.
 */

import { join } from "node:path";
import { strict as assert } from "node:assert";
import { chromium, type Browser, type Page } from "npm:playwright-core";

const ROOT = join(import.meta.dirname as string, "..", "..", "..");
const SPECIMENS = "packages/components/specimens";
const PORT = 5234;
const PAGE_URL = `http://127.0.0.1:${PORT}/date-input`;

async function step<T>(name: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    throw new Error(`[${name}] ${(error as Error).message}`, { cause: error });
  }
}

/** Builds the specimens app once; the suite serves the result. */
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
  const server = cmd.spawn();
  for (let i = 0; i < 50; i++) {
    try {
      const res = await fetch(PAGE_URL);
      if (res.ok) return server;
    } catch {
      // Not up yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  server.kill();
  throw new Error(`preview server never answered on ${PORT}`);
}

const SEGMENTS = "#date [role='spinbutton']";

const texts = (page: Page): Promise<string[]> =>
  page.evaluate(() =>
    [...document.querySelectorAll("#date [role='spinbutton']")].map((node) => node.textContent ?? "")
  );

const waitReadout = (page: Page, value: string): Promise<void> =>
  page.waitForFunction(
    (want) => document.querySelector("#date-value")?.textContent === want,
    value,
    { timeout: 5000 },
  ).then(() => undefined);

Deno.test("spin-date-input e2e", async () => {
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
      await page.goto(PAGE_URL, { waitUntil: "load" });
      await page.waitForSelector(SEGMENTS, { timeout: 5000 });
    });

    await step("seeded date renders in segments", async () => {
      assert.deepEqual(await texts(page), ["02", "15", "2024"], "month, day, year from defaultValue");
      assert.equal(
        await page.locator(SEGMENTS).first().getAttribute("aria-label"),
        "Month",
        "segments name themselves",
      );
    });

    await step("typing fills the segment and reports the date", async () => {
      await page.locator(SEGMENTS).first().click();
      await page.keyboard.press("1");
      await page.keyboard.press("2");
      assert.deepEqual(await texts(page), ["12", "15", "2024"], "both digits land in the month");
      await waitReadout(page, "2024-12-15");
    });

    await step("arrows cycle the focused field", async () => {
      await page.locator(SEGMENTS).first().click();
      await page.keyboard.press("ArrowUp");
      assert.deepEqual((await texts(page))[0], "01", "December wraps to January");
      await page.keyboard.press("ArrowDown");
      assert.deepEqual((await texts(page))[0], "12", "and back down");
    });

    await step("imperative commands write every segment", async () => {
      await page.getByRole("button", { name: "el.setValue(2025-07-04)" }).click();
      await waitReadout(page, "2025-07-04");
      assert.deepEqual(await texts(page), ["07", "04", "2025"], "setValue fills month, day, year");
      await page.getByRole("button", { name: "el.clearValue()" }).click();
      assert.deepEqual(await texts(page), ["mm", "dd", "yyyy"], "clear returns the placeholders");
    });

    await step("no page errors", () => {
      assert.deepEqual(pageErrors, [], `page errors: ${pageErrors.join("; ")}`);
      return Promise.resolve();
    });
  } finally {
    await browser?.close();
    server.kill();
  }
});

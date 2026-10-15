/**
 * spin-file-upload e2e: the dropzone modes and the validation split,
 * behind the app-controller handle.
 *
 * Builds the specimens app, serves dist, drives real Chromium via Playwright.
 * The route binds a machine-owned file-upload through
 * `{ commands, state, bind }`; this suite exercises the two entry paths
 * (the picker and a drop), the accept/size rules, focus and drag modes,
 * row removal, and the imperative clear.
 */

import { join } from "node:path";
import { strict as assert } from "node:assert";
import { chromium, type Browser, type Page } from "npm:playwright-core";

const ROOT = join(import.meta.dirname as string, "..", "..", "..");
const SPECIMENS = "packages/components/specimens";
const PORT = 5237;
const PAGE_URL = `http://127.0.0.1:${PORT}/file-upload`;

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

const READOUT = "#upload-value";
const DROPZONE = "#upload [role='button']";

/** Drops a set of files on the dropzone through a real DataTransfer. */
async function dropFiles(
  page: Page,
  files: readonly { name: string; type: string; bytes: number }[],
): Promise<void> {
  await page.evaluate((entries) => {
    const dropzone = document.querySelector("#upload [role='button']") as HTMLElement;
    const dt = new DataTransfer();
    for (const entry of entries) {
      dt.items.add(new File([new Uint8Array(entry.bytes)], entry.name, { type: entry.type }));
    }
    dropzone.dispatchEvent(new DragEvent("dragover", { bubbles: true, dataTransfer: dt }));
    dropzone.dispatchEvent(new DragEvent("drop", { bubbles: true, dataTransfer: dt }));
  }, files);
}

const rowTexts = (page: Page): Promise<string[]> =>
  page.evaluate(() =>
    [...document.querySelectorAll("#upload [role='listitem']")].map((node) => node.textContent ?? "")
  );

Deno.test("spin-file-upload e2e", async () => {
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
      await page.waitForSelector(DROPZONE, { timeout: 30000 });
    });

    await step("the dropzone renders with its input wired", async () => {
      const accept = await page.evaluate(() =>
        document.querySelector("#upload input[type='file']")?.getAttribute("accept")
      );
      assert.equal(accept, "image/*", "the accept rule reaches the hidden input");
      assert.deepEqual(await rowTexts(page), [], "no rows at rest");
    });

    await step("choosing through the picker lands accepted files", async () => {
      await page.locator("#upload input[type='file']").setInputFiles([
        { name: "photo.png", mimeType: "image/png", buffer: Buffer.alloc(2048) },
        { name: "notes.txt", mimeType: "text/plain", buffer: Buffer.alloc(8) },
      ]);
      assert.equal(
        await page.locator(READOUT).textContent(),
        "photo.png — notes.txt (accept)",
        "the accept rule splits the selection",
      );
      assert.deepEqual(await rowTexts(page), ["photo.png2 KB"], "the accepted file renders its row");
    });

    await step("dropping more files appends to the selection", async () => {
      await dropFiles(page, [{ name: "second.png", type: "image/png", bytes: 1024 }]);
      assert.deepEqual(
        await rowTexts(page),
        ["photo.png2 KB", "second.png1 KB"],
        "the drop appends",
      );
    });

    await step("dropping a too-large file is rejected by the size rule", async () => {
      await dropFiles(page, [{ name: "huge.png", type: "image/png", bytes: 2 * 1024 * 1024 }]);
      const readout = await page.locator(READOUT).textContent() ?? "";
      assert.ok(readout.includes("huge.png (too-large)"), `the size rule reports: ${readout}`);
      assert.equal(
        await rowTexts(page).then((rows) => rows.some((row) => row.includes("huge"))),
        false,
        "and the oversized file never lands",
      );
    });

    await step("a row's delete trigger removes the file", async () => {
      await page.locator("#upload [aria-label='Remove photo.png']").click();
      assert.deepEqual(
        await rowTexts(page),
        ["second.png1 KB"],
        "the named row leaves",
      );
    });

    await step("the clear trigger empties the selection", async () => {
      await page.locator("#upload [aria-label='Clear']").click();
      assert.deepEqual(await rowTexts(page), [], "all rows leave");
      assert.equal(await page.locator(READOUT).textContent(), "", "and the readout empties");
    });

    await step("focus reports through the dropzone bag", async () => {
      await page.locator(DROPZONE).focus();
      assert.equal(
        await page.locator(DROPZONE).getAttribute("data-focus"),
        "",
        "the focused mode reports",
      );
      await page.locator(DROPZONE).blur();
      assert.equal(
        await page.locator(DROPZONE).getAttribute("data-focus"),
        null,
        "and blur returns to idle",
      );
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

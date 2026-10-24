/**
 * The specimens rail's contract, checked in a real browser.
 *
 * The nav iterates a group list; a specimen whose group the list omits
 * renders no link at all. `tour` shipped exactly that way — the route
 * worked, the rail never showed it, and nothing failed. The group list is
 * derived now, but this is the guard that would have caught it: one nav
 * link per specimen, no group heading without a link under it.
 */

import { join } from "node:path";
import { strict as assert } from "node:assert";
import { type Browser, chromium, type Page } from "npm:playwright-core";

const ROOT = join(import.meta.dirname as string, "..", "..", "..");
const SPECIMENS = "packages/components/specimens";
const PORT = 5240;
const PAGE_URL = `http://127.0.0.1:${PORT}/`;

async function step<T>(name: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    throw new Error(`[${name}] ${(error as Error).message}`, { cause: error });
  }
}

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

/** The specimen table the app publishes in dev. */
const rail = (
  page: Page,
): Promise<{ id: string; path: string; group: string }[]> =>
  page.evaluate(
    () =>
      (window as unknown as {
        __rail?: { id: string; path: string; group: string }[];
      }).__rail ?? [],
  );

Deno.test("the rail links every specimen", async () => {
  await step("build", buildDemo);
  const server = await step("serve", startServer);
  let browser: Browser | undefined;

  try {
    browser = await step(
      "launch chromium",
      () =>
        chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] }),
    );

    const page = await browser.newPage({
      viewport: { width: 1280, height: 900 },
    });
    await step("load", async () => {
      await page.goto(PAGE_URL, { waitUntil: "load" });
      await page.waitForSelector("nav a[href]", { timeout: 30000 });
    });

    const expected = await rail(page);
    assert.ok(expected.length > 0, "the app published its specimen table");

    const links = await page.evaluate(() =>
      [...document.querySelectorAll("nav a[href]")].map((node) =>
        node.getAttribute("href") ?? ""
      )
    );

    const missing = expected
      .map((specimen) => specimen.path)
      .filter((path) => !links.includes(path));
    assert.deepEqual(missing, [], `rail omits: ${missing.join(", ")}`);

    // Every group heading in the rail has at least one link under it: an
    // empty heading is the same drift, seen from the other side.
    const orphanHeadings = await page.evaluate(() => {
      const headings = [...document.querySelectorAll("nav h2")];
      return headings
        .filter((heading) => {
          let next = heading.nextElementSibling;
          return !(next instanceof Element &&
            next.querySelector("a[href]") !== null);
        })
        .map((heading) => heading.textContent ?? "");
    });
    assert.deepEqual(
      orphanHeadings,
      [],
      `groups with no items: ${orphanHeadings.join(", ")}`,
    );
  } finally {
    await browser?.close();
    server.kill();
  }
});

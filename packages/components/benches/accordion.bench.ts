/**
 * Bench: spin-accordion interaction timing in a real browser.
 *
 * Run explicitly (not in default `deno task test`):
 *   cd packages/components && deno task bench:accordion
 *
 * Builds the specimens app, serves dist, drives real Chromium via Playwright.
 * Reports medians over repeated runs: 500-row initial render, single toggle,
 * single append, and toggle-after-append (the frozen-rows regression path).
 * Numbers print to stdout; no assertions — this measures, it does not gate.
 */

import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { chromium, type Browser } from "npm:playwright-core";

const ROOT = join(import.meta.dirname as string, "..", "..", "..");
const SPECIMENS = "packages/components/specimens";
const PORT = 5202;
const URL = `http://127.0.0.1:${PORT}/accordion`;

const ROWS = 500;
const REPEATS = 5;

function median(samples: number[]): number {
  const sorted = [...samples].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)]!;
}

async function build(): Promise<void> {
  const cmd = new Deno.Command("node", {
    args: [join(ROOT, "node_modules/vite/bin/vite.js"), "build", SPECIMENS],
    cwd: ROOT,
    stdout: "piped",
    stderr: "piped",
  });
  const { code, stderr } = await cmd.output();
  if (code !== 0) {
    throw new Error(`vite build failed:\n${new TextDecoder().decode(stderr)}`);
  }
}

async function serve(): Promise<Deno.ChildProcess> {
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
  try {
    child.kill();
  } catch {
    // already exited
  }
  throw new Error(`vite preview did not start on :${PORT}`);
}

Deno.test("spin-accordion bench", async () => {
  await build();
  const server = await serve();
  let browser: Browser | undefined;
  try {
    browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });
    const page = await browser.newPage();
    try {
      await page.goto(URL, { waitUntil: "load" });
      await page.waitForSelector('spin-accordion [data-part="item"]', { timeout: 3000 });
    } catch {
      await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: "load" });
      await page.click('a[href="/accordion"]');
      await page.waitForSelector('spin-accordion [data-part="item"]', { timeout: 5000 });
    }

    const renders: number[] = [];
    const toggles: number[] = [];
    const appends: number[] = [];
    const afterAppends: number[] = [];

    for (let r = 0; r < REPEATS; r++) {
      renders.push(
        await page.evaluate((n) => {
          const el = document.querySelector("spin-accordion") as unknown as {
            items: unknown[];
          };
          const items = Array.from({ length: n }, (_, i) => ({
            value: `row-${i}`,
            label: `Row ${i}`,
            content: `Content for row ${i}.`,
          }));
          const start = performance.now();
          el.items = items;
          return new Promise<number>((resolve) => {
            requestAnimationFrame(() => {
              const check = () => {
                if (document.querySelectorAll('spin-accordion [data-part="item"]').length >= n) {
                  resolve(performance.now() - start);
                } else {
                  requestAnimationFrame(check);
                }
              };
              check();
            });
          });
        }, ROWS),
      );

      toggles.push(
        await page.evaluate(async () => {
          const trigger = [...document.querySelectorAll('spin-accordion [data-part="item-trigger"]')][7] as HTMLElement;
          const start = performance.now();
          trigger.focus();
          trigger.click();
          await new Promise((done) => setTimeout(done, 300));
          return performance.now() - start - 300;
        }),
      );

      appends.push(
        await page.evaluate(async () => {
          const el = document.querySelector("spin-accordion") as unknown as {
            items: unknown[];
          };
          const before = document.querySelectorAll('spin-accordion [data-part="item"]').length;
          const start = performance.now();
          el.items = [...el.items, { value: `extra-${start}`, label: "Extra", content: "Extra content." }];
          await new Promise<void>((resolve) => {
            requestAnimationFrame(() => {
              const check = () => {
                if (document.querySelectorAll('spin-accordion [data-part="item"]').length > before) {
                  resolve();
                } else {
                  requestAnimationFrame(check);
                }
              };
              check();
            });
          });
          return performance.now() - start;
        }),
      );

      afterAppends.push(
        await page.evaluate(async () => {
          const trigger = [...document.querySelectorAll('spin-accordion [data-part="item-trigger"]')][3] as HTMLElement;
          const items = () =>
            [...document.querySelectorAll('spin-accordion [data-part="item"]')].map((item) =>
              item.getAttribute("data-state")
            );
          const before = items().join(",");
          const start = performance.now();
          trigger.focus();
          trigger.click();
          await new Promise((done) => setTimeout(done, 300));
          const after = items().join(",");
          if (before === after) throw new Error("toggle after append had no effect");
          return performance.now() - start - 300;
        }),
      );
    }

    console.log(`bench accordion rows=${ROWS} repeats=${REPEATS}`);
    console.log(`  render-500:        ${median(renders).toFixed(1)}ms`);
    console.log(`  toggle:            ${median(toggles).toFixed(1)}ms`);
    console.log(`  append-1:          ${median(appends).toFixed(1)}ms`);
    console.log(`  toggle-after-append: ${median(afterAppends).toFixed(1)}ms`);
  } finally {
    if (browser) await browser.close();
    try {
      server.kill();
    } catch {
      // server already exited
    }
  }
});

/**
 * E2E: spin-pagination-fsm drives its machine in a real browser — the page
 * command path (mouse AND the host's imperative commands), the aria
 * contract, the truncation, the edge triggers' disabled state, the
 * page-size repair Zag does with a watch, and the controlled channel.
 *
 * Run explicitly (not in default `deno task test`):
 *   cd packages/components && deno test -A tests/pagination.e2e.ts
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
const PORT = 5220;
const URL = `http://127.0.0.1:${PORT}/pagination-fsm`;

/** Parts are addressed by the machine's id scheme: `pagination:<id>:<part>`. */
const CONTROLLED = '[id="pagination:controlled"]';
const UNCONTROLLED = '[id="pagination:uncontrolled"]';
const SINGLE = '[id="pagination:single"]';
const ITEM = (value: number): string => `${CONTROLLED} [id="pagination:controlled:item:${value}"]`;
const READOUT = "#pagination-readout";
const TOTAL = "#pagination-total";

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

/** The slots as the reader sees them: `1`, `2`, `…`. */
const slotText = async (page: Page, root: string): Promise<string[]> =>
  page.locator(`${root} > button`).allInnerTexts();

const selectedPage = async (page: Page): Promise<number> => {
  const items = page.locator(`${CONTROLLED} [data-selected]`);
  return Number((await items.first().getAttribute("data-index")) ?? "0");
};

const disabled = async (page: Page, root: string): Promise<boolean> =>
  page.locator(root).evaluate((node: HTMLButtonElement) => node.disabled);

Deno.test("spin-pagination-fsm e2e", async () => {
  await step("build", buildDemo);
  const server = await step("serve", startServer);
  const pageErrors: string[] = [];
  let browser: Browser | undefined;

  try {
    browser = await step("launch chromium", () =>
      chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] }));

    const page = await browser.newPage();
    page.on("pageerror", (err) => pageErrors.push(err.message));

    await step("load page", async () => {
      await page.goto(URL, { waitUntil: "load" });
      await page.waitForSelector(CONTROLLED, { state: "attached", timeout: 5000 });
    });

    await step("renders the initial pagination", async () => {
      // 97 items, 10 a page: 10 pages, page 1 current.
      assert.equal(await page.locator(READOUT).textContent(), "page 1", "the host readout is the first page");
      assert.equal(await page.locator(TOTAL).textContent(), "10", "and the total pages");
      assert.deepEqual(await slotText(page, CONTROLLED), ["«", "‹", "1", "2", "3", "4", "5", "…", "10", "›", "»"], "the truncation renders as the range says it should");
      assert.equal(await selectedPage(page), 1, "page 1 is the current page");
      assert.equal(
        await page.locator(ITEM(1)).getAttribute("aria-current"),
        "page",
        "and it announces the current page",
      );
      assert.equal(await page.locator(ITEM(1)).getAttribute("aria-label"), "page 1", "with a label naming it");
      assert.equal(await page.locator(ITEM(2)).getAttribute("aria-current"), null, "another page announces nothing");
      assert.equal(
        await page.locator(CONTROLLED).getAttribute("aria-label"),
        "pagination",
        "the root names the control",
      );
      // A button-less element is not a landmark: the root is the group itself.
      assert.equal(await page.locator(CONTROLLED).evaluate((node: Element) => node.tagName), "NAV", "the root is a navigation");
      // The gap is not a control.
      const gap = page.locator(`${CONTROLLED} > button[aria-hidden="true"]`);
      assert.equal(await gap.count(), 1, "one gap renders");
      assert.equal(await disabled(page, `${CONTROLLED} > button[aria-hidden="true"]`), true, "and it is not clickable");
    });

    await step("the first page disables the front triggers", async () => {
      assert.equal(await disabled(page, '[id="pagination:controlled:prev"]'), true, "prev is disabled on page 1");
      assert.equal(await disabled(page, '[id="pagination:controlled:first"]'), true, "so is first");
      assert.equal(await disabled(page, '[id="pagination:controlled:next"]'), false, "next is live");
      assert.equal(await disabled(page, '[id="pagination:controlled:last"]'), false, "so is last");
      assert.equal(
        await page.locator('[id="pagination:controlled:prev"]').getAttribute("data-disabled"),
        "",
        "and prev carries the data flag the utilities key on",
      );
    });

    await step("a page click moves the machine", async () => {
      await page.locator(ITEM(5)).click();
      assert.equal(await selectedPage(page), 5, "the click selects page 5");
      assert.equal(await page.locator(READOUT).textContent(), "page 5 of 10", "the host readout follows");
      assert.deepEqual(
        await slotText(page, CONTROLLED),
        ["«", "‹", "1", "…", "4", "5", "6", "…", "10", "›", "»"],
        "the window slides to the clicked page",
      );
      assert.equal(await disabled(page, '[id="pagination:controlled:prev"]'), false, "and prev comes back to life");
    });

    await step("the page list animates its state change", async () => {
      // The selected page carries a transition, and the utilities keyed on
      // the data attribute are compiled into a real rule.
      const item = page.locator(ITEM(5));
      assert.equal(
        await item.evaluate((node: HTMLElement) => getComputedStyle(node).transitionDuration),
        "0.15s",
        "the selected page animates its state change",
      );
      assert.equal(
        await item.evaluate((node: HTMLElement) => getComputedStyle(node).backgroundColor),
        await page.evaluate(() => {
          const probe = document.createElement("div");
          probe.className = "bg-primary";
          document.body.appendChild(probe);
          const value = getComputedStyle(probe).backgroundColor;
          probe.remove();
          return value;
        }),
        "the selected page is painted with the theme's primary fill",
      );
    });

    await step("the next and last triggers walk the pages", async () => {
      await page.locator('[id="pagination:controlled:next"]').click();
      assert.equal(await selectedPage(page), 6, "next steps forward");
      await page.locator('[id="pagination:controlled:last"]').click();
      assert.equal(await selectedPage(page), 10, "last jumps to the end");
      assert.equal(await disabled(page, '[id="pagination:controlled:next"]'), true, "and next disables there");
      assert.equal(await disabled(page, '[id="pagination:controlled:last"]'), true, "so does last");
      assert.deepEqual(
        await slotText(page, CONTROLLED),
        ["«", "‹", "1", "…", "6", "7", "8", "9", "10", "›", "»"],
        "the last page's range shows the head and its window",
      );
    });

    await step("the host commands drive the machine", async () => {
      await page.getByRole("button", { name: "el.setPage(5)" }).click();
      assert.equal(await selectedPage(page), 5, "setPage(5) moves the machine");
      assert.equal(await page.locator(READOUT).textContent(), "page 5 of 10", "the readout follows");
      await page.getByRole("button", { name: "el.goToLastPage()" }).click();
      assert.equal(await selectedPage(page), 10, "goToLastPage jumps to the end");
      await page.getByRole("button", { name: "el.goToFirstPage()" }).click();
      assert.equal(await selectedPage(page), 1, "goToFirstPage returns to the head");
      await page.getByRole("button", { name: "el.goToNextPage()" }).click();
      assert.equal(await selectedPage(page), 2, "goToNextPage steps forward");
      await page.getByRole("button", { name: "el.goToPrevPage()" }).click();
      assert.equal(await selectedPage(page), 1, "goToPrevPage steps back");
    });

    await step("a page-size change repairs the page", async () => {
      // Page 1 at 10 a page is page 1 of 10; 25 a page is 4 pages, still valid.
      await page.locator(ITEM(3)).click();
      assert.equal(await selectedPage(page), 3, "page 3 is current");
      await page.selectOption("select >> nth=0", "25");
      assert.equal(await selectedPage(page), 3, "page 3 survives the move to 25 a page");
      assert.equal(await page.locator(TOTAL).textContent(), "4", "the total pages follow the new size");
      assert.equal(await page.locator(READOUT).textContent(), "page size 25", "the size change reports");
      // 25 of 5 pages -> 50 a page: page 3 is past page 2, so it resets.
      await page.selectOption("select >> nth=0", "50");
      assert.equal(await selectedPage(page), 1, "page 3 is past the new 2 pages, so it resets");
      assert.equal(await page.locator(READOUT).textContent(), "page size 50", "the size reports last; the page reset is in the api");
      await page.locator(ITEM(2)).click();
      await page.selectOption("select >> nth=0", "10");
      // Zag preserves a valid page through a size change; it does not
      // re-derive it from the item range.
      assert.equal(await selectedPage(page), 2, "a valid page survives the size change");
      assert.equal(await page.locator(READOUT).textContent(), "page size 10", "only the size moved, so only it reports");
      assert.equal(await page.locator(TOTAL).textContent(), "10", "and the total pages are back at ten");
    });

    await step("the uncontrolled instance keeps its own page", async () => {
      // The controlled instance stands where the previous step left it.
      const before = await selectedPage(page);
      await page.locator(`${UNCONTROLLED} [id="pagination:uncontrolled:item:10"]`).click();
      assert.equal(
        await page.locator(`${UNCONTROLLED} [id="pagination:uncontrolled:item:10"]`).getAttribute("data-selected"),
        "",
        "the uncontrolled instance takes the click",
      );
      assert.equal(await selectedPage(page), before, "while the controlled one is untouched");
      await page.locator(`${UNCONTROLLED} [id="pagination:uncontrolled:prev"]`).click();
      assert.equal(
        await page.locator(`${UNCONTROLLED} [id="pagination:uncontrolled:item:9"]`).getAttribute("data-selected"),
        "",
        "and walks on its own",
      );
      assert.equal(await selectedPage(page), before, "the controlled one still stands");
    });

    await step("a single page has no gaps and no live triggers", async () => {
      assert.deepEqual(await slotText(page, SINGLE), ["«", "‹", "1", "›", "»"], "a lone page renders as one slot");
      assert.equal(await disabled(page, '[id="pagination:single:prev"]'), true, "prev is disabled");
      assert.equal(await disabled(page, '[id="pagination:single:next"]'), true, "next is disabled");
      assert.equal(await disabled(page, '[id="pagination:single:first"]'), true, "first is disabled");
      assert.equal(await disabled(page, '[id="pagination:single:last"]'), true, "last is disabled");
      assert.equal(
        await page.locator(`${SINGLE} button[aria-hidden="true"]`).count(),
        0,
        "and no gap renders",
      );
    });

    await step("the keyboard reaches the triggers", async () => {
      await page.getByRole("button", { name: "el.goToFirstPage()" }).click();
      assert.equal(await selectedPage(page), 1, "first page");
      await page.locator('[id="pagination:controlled:next"]').focus();
      await page.keyboard.press("Enter");
      assert.equal(await selectedPage(page), 2, "Enter activates a focused trigger");
      await page.keyboard.press("Space");
      assert.equal(await selectedPage(page), 3, "so does Space");
      await page.getByRole("button", { name: "el.setPage(5)" }).click();
      // Page 5's window is 1, …, 4, 5, 6, …, 10 — page 6 is a live item.
      await page.locator(ITEM(6)).focus();
      await page.keyboard.press("Enter");
      assert.equal(await selectedPage(page), 6, "and a focused page item");
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

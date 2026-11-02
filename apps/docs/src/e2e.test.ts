/**
 * The docs site, verified in Firefox: every route renders, nothing leaks,
 * nothing overflows, and the interactive surfaces work.
 *
 * Boots the docs dev server on a fixed port, drives it with Playwright
 * Firefox, and stops the server afterwards. `DOCS_PORT` and `SPIN_FIREFOX`
 * override the port and the browser binary.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { firefox, type Browser, type Page } from "playwright-core";
import { DOCS_GROUPS, TOP_SECTIONS } from "./nav.ts";

const PORT = Number(process.env.DOCS_PORT ?? "5221");
const URL = `http://localhost:${PORT}`;
const FIREFOX =
  process.env.SPIN_FIREFOX ??
  `${process.env.HOME}/.cache/ms-playwright/firefox-1538/firefox/firefox`;

let server: ReturnType<typeof Bun.spawn> | undefined;
let browser: Browser | undefined;

/** Every docs-world route, read from the same rail the site draws. */
function docRoutes(): readonly string[] {
  return DOCS_GROUPS.flatMap((group) => group.items.map((item) => item.href));
}

async function waitForServer(url: string, timeoutMs: number): Promise<void> {
  const start = Date.now();
  for (;;) {
    try {
      const response = await fetch(url);
      // Identity, not just liveness: a stale process on this port answers
      // 200 for the wrong app. The docs shell carries its own marker.
      const text = await response.text();
      if (response.ok && text.includes('id="app"') && text.includes("/src/main.tsx")) return;
    } catch {
      // Not up yet.
    }
    if (Date.now() - start > timeoutMs) {
      throw new Error(`docs server never came up at ${url}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}

beforeAll(async () => {
  server = Bun.spawn(
    ["bun", "--bun", "vite", "dev", "--port", String(PORT), "--strictPort"],
    {
      cwd: `${import.meta.dir}/..`,
      stdout: "ignore",
      stderr: "ignore",
    },
  );
  await waitForServer(URL, 90000);
  browser = await firefox.launch({ executablePath: FIREFOX });
}, 120000);

afterAll(async () => {
  await browser?.close();
  server?.kill();
});

async function newPage(): Promise<Page> {
  const page = await browser!.newPage({ viewport: { width: 1440, height: 900 } });
  return page;
}

describe("docs routes", () => {
  for (const href of docRoutes()) {
    test(`${href} renders its h1 with no errors and no leaked markdown`, async () => {
      const page = await newPage();
      const consoleErrors: string[] = [];
      const pageErrors: string[] = [];
      const failedRequests: string[] = [];
      page.on("console", (message) => {
        if (message.type() === "error") consoleErrors.push(message.text());
      });
      page.on("pageerror", (error) => pageErrors.push(String(error)));
      page.on("requestfailed", (request) => {
        failedRequests.push(request.url());
      });
      await page.goto(`${URL}${href}`, { waitUntil: "networkidle" });
      // The favicon is the one lazy subresource: Firefox fetches it after
      // load, so under load it can still be in flight when the assertions
      // finish and page.close() aborts it. Settle it first — a favicon that
      // already landed or was never requested times out here and asserts
      // below like any other request.
      await page
        .waitForResponse((response) => response.url().includes("favicon"), {
          timeout: 8000,
        })
        .catch(() => undefined);
      const h1 = await page.locator("main h1, h1").first().textContent();
      expect(h1?.trim().length).toBeGreaterThan(0);
      const main = await page.locator("main").first().innerText();
      expect(main).not.toMatch(/\[[^\]]+\]\([^)]+\)/);
      expect(consoleErrors).toEqual([]);
      expect(pageErrors).toEqual([]);
      expect(failedRequests).toEqual([]);
      await page.close();
    }, 60000);
  }

  test("top sections all resolve", async () => {
    const page = await newPage();
    for (const section of TOP_SECTIONS) {
      const response = await page.goto(`${URL}${section.href}`, {
        waitUntil: "domcontentloaded",
      });
      expect(response?.ok()).toBe(true);
    }
    await page.close();
  }, 60000);
});

describe("tables", () => {
  const TABLE_PAGES = [
    "/start",
    "/start/paths",
    "/themes/schema",
    "/tooling/cli",
    "/tooling/lints",
    "/tooling/mcp",
    "/tooling/check",
  ] as const;
  for (const href of TABLE_PAGES) {
    test(`${href} tables fit their column without horizontal scroll`, async () => {
      const page = await newPage();
      await page.goto(`${URL}${href}`, { waitUntil: "networkidle" });
      const overflows = await page.evaluate(() => {
        const bad: string[] = [];
        for (const table of document.querySelectorAll("main table")) {
          const parent = table.parentElement;
          if (parent === null) continue;
          if (table.scrollWidth > parent.clientWidth + 2) {
            bad.push(table.outerHTML.slice(0, 120));
          }
        }
        return bad;
      });
      expect(overflows).toEqual([]);
      await page.close();
    }, 60000);
  }
});

describe("bundler picker", () => {
  const TABS = [
    "Vite",
    "Rspack",
    "webpack",
    "Rollup",
    "Rolldown",
    "esbuild",
    "Bun",
    "UnoCSS",
  ] as const;
  for (const href of ["/start/quickstart", "/start/install"] as const) {
    test(`${href} switches between all 8 bundlers`, async () => {
      const page = await newPage();
      await page.goto(`${URL}${href}`, { waitUntil: "networkidle" });
      const tablist = page.getByRole("tablist", { name: "Bundler" });
      await tablist.scrollIntoViewIfNeeded();
      const seen = new Set<string>();
      for (const name of TABS) {
        await tablist.getByRole("tab", { name }).click();
        const code = await tablist
          .locator("xpath=following-sibling::*")
          .first()
          .innerText();
        expect(code.length).toBeGreaterThan(0);
        seen.add(name);
      }
      expect([...seen].sort()).toEqual([...TABS].sort());
      await page.close();
    }, 60000);
  }
});

describe("components world", () => {
  test("/components/button opens and closes the classes modal", async () => {
    const page = await newPage();
    // First components-world page pays the dev server's cold compile of the
    // examples graph; the suite timeout still bounds the test at 60s.
    await page.goto(`${URL}/components/button`, { waitUntil: "networkidle", timeout: 60000 });
    await page.getByRole("button", { name: /Classes & tags/ }).click();
    const dialog = page.getByRole("dialog", { name: "button classes and tags" });
    await dialog.waitFor({ state: "visible" });
    expect(await dialog.textContent()).toContain("button");
    await dialog.getByRole("button", { name: "Close" }).click();
    await dialog.waitFor({ state: "hidden" });
    await page.close();
  }, 60000);

  test("/components/machine-select mounts and shows its contract", async () => {
    const page = await newPage();
    await page.goto(`${URL}/components/machine-select`, {
      waitUntil: "networkidle",
    });
    const h1 = await page.locator("main h1").first().textContent();
    expect(h1?.trim()).toBe("select");
    const body = await page.locator("main").first().innerText();
    expect(body).toContain("Component contract");
    expect(body).toContain("Props");
    expect(body).toContain("Events");
    expect(body).toContain("Commands");
    await page.close();
  }, 60000);
});

describe("guide demos", () => {
  test("/guide/components mounts docs-select with live state", async () => {
    const page = await newPage();
    await page.goto(`${URL}/guide/components`, { waitUntil: "networkidle" });
    const demo = page.locator("#guide-components-demo");
    await demo.waitFor({ state: "attached" });
    await page
      .getByRole("button", { name: "ctl.commands.setOpen(true)" })
      .click();
    const body = await page.locator("main").first().innerText();
    expect(body).toContain("ctl.state.value");
    await page.close();
  }, 60000);

  test("/guide/machines runs the signal demo", async () => {
    const page = await newPage();
    await page.goto(`${URL}/guide/machines`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "count(count() + 1)" }).click();
    const body = await page.locator("main").first().innerText();
    expect(body).toContain("count: 1, doubled: 2");
    await page.close();
  }, 60000);
});

describe("search and studio", () => {
  test("Control+k opens search and Enter navigates", async () => {
    const page = await newPage();
    await page.goto(`${URL}/start`, { waitUntil: "networkidle" });
    await page.keyboard.press("Control+k");
    const dialog = page.getByRole("dialog");
    await dialog.waitFor({ state: "visible" });
    await page.getByRole("combobox").fill("quickstart");
    await page.keyboard.press("Enter");
    await page.waitForURL("**/start/quickstart", { timeout: 10000 });
    const h1 = await page.locator("main h1").first().textContent();
    expect(h1?.trim()).toBe("Quickstart");
    await page.close();
  }, 60000);

  test("the Studio FAB opens the overlay with a flush rail", async () => {
    const page = await newPage();
    await page.goto(`${URL}/start`, { waitUntil: "networkidle" });
    const fab = page.getByRole("button", { name: "Open the theme studio" });
    await fab.waitFor({ state: "visible", timeout: 30000 });
    await fab.click();
    const frame = page.frameLocator("[data-spin-studio]");
    const rail = frame.locator('nav[aria-label="Studio"] ul').first();
    await rail.waitFor({ state: "visible", timeout: 30000 });
    const paddingLeft = await rail.evaluate(
      (el) => getComputedStyle(el).paddingLeft,
    );
    expect(paddingLeft).toBe("0px");
    await page.close();
  }, 90000);
});

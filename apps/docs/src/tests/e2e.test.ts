/**
 * The docs site, verified in Firefox: every route renders, nothing leaks,
 * nothing overflows, and the interactive surfaces work.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { firefox, type Browser, type Page } from "playwright-core";
import { DOCS_GROUPS, TOP_SECTIONS } from "../shell/nav.ts";

const PORT = Number(process.env.DOCS_PORT ?? "5221");
const URL = `http://localhost:${PORT}`;
const FIREFOX =
  process.env.SPIN_FIREFOX ??
  `${process.env.HOME}/.cache/ms-playwright/firefox-1538/firefox/firefox`;

let server: ReturnType<typeof Bun.spawn> | undefined;
let browser: Browser | undefined;

function docRoutes(): readonly string[] {
  return DOCS_GROUPS.flatMap((group) => group.items.map((item) => item.href));
}

async function waitForServer(url: string, timeoutMs: number): Promise<void> {
  const start = Date.now();
  for (;;) {
    try {
      const response = await fetch(url);
      const text = await response.text();
      if (
        response.ok &&
        text.includes('id="app"') &&
        text.includes("/src/main.tsx")
      ) {
        return;
      }
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
      cwd: `${import.meta.dir}/../..`,
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
  const page = await browser!.newPage({
    viewport: { width: 1440, height: 900 },
  });
  return page;
}

describe("docs routes", () => {
  let routePage: Page | undefined;
  afterAll(async () => {
    await routePage?.close();
  });
  for (const href of docRoutes()) {
    test(`${href} renders its h1 with no errors and no leaked markdown`, async () => {
      routePage ??= await newPage();
      const page = routePage;
      const consoleErrors: string[] = [];
      const pageErrors: string[] = [];
      const failedRequests: string[] = [];
      const onConsole = (message: { type(): string; text(): string }) => {
        if (message.type() === "error") consoleErrors.push(message.text());
      };
      const onPageError = (error: unknown) => pageErrors.push(String(error));
      const onRequestFailed = (request: {
        url(): string;
        failure(): { errorText?: string } | null;
      }) => {
        if (
          request.url().endsWith("/favicon.svg") &&
          request.failure()?.errorText === "NS_BINDING_ABORTED"
        ) {
          return;
        }
        failedRequests.push(request.url());
      };
      page.on("console", onConsole);
      page.on("pageerror", onPageError);
      page.on("requestfailed", onRequestFailed);
      try {
        await page.goto(`${URL}${href}`, { waitUntil: "networkidle" });
        const h1 = await page.locator("main h1, h1").first().textContent();
        expect(h1?.trim().length).toBeGreaterThan(0);
        const main = await page.locator("main").first().innerText();
        expect(main).not.toMatch(/\[[^\]]+\]\([^)]+\)/);
        expect(consoleErrors).toEqual([]);
        expect(pageErrors).toEqual([]);
        expect(failedRequests).toEqual([]);
      } finally {
        page.off("console", onConsole);
        page.off("pageerror", onPageError);
        page.off("requestfailed", onRequestFailed);
      }
    }, 60000);
  }

  test("top sections all resolve", async () => {
    const page = await newPage();
    for (const section of TOP_SECTIONS) {
      if (section.href === "/playground") {
        const res = await fetch(`${URL}${section.href}`);
        expect(res.ok).toBe(true);
        continue;
      }
      const response = await page.goto(`${URL}${section.href}`, {
        waitUntil: "domcontentloaded",
      });
      expect(response?.ok()).toBe(true);
    }
    await page.close();
  }, 60000);

  test("Markdown for Agents serves /llms.txt and .md endpoints", async () => {
    const llms = await fetch(`${URL}/llms.txt`);
    expect(llms.ok).toBe(true);
    expect(llms.headers.get("content-type")).toContain("text/markdown");
    const llmsText = await llms.text();
    expect(llmsText).toContain("# Spin Documentation");

    const md = await fetch(`${URL}/docs/themes/overview.md`);
    expect(md.ok).toBe(true);
    expect(md.headers.get("content-type")).toContain("text/markdown");
    expect(md.headers.get("content-signal")).toContain("ai-input=yes");
    const mdText = await md.text();
    expect(mdText).toContain("title: \"Overview · Spin Docs\"");
  }, 30000);
});

describe("tables", () => {
  const TABLE_PAGES = [
    "/docs/getting-started/overview",
    "/docs/getting-started/paths",
    "/docs/themes/reference",
    "/docs/tooling/cli",
    "/docs/tooling/lints",
    "/docs/tooling/mcp",
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
  for (const href of ["/docs/getting-started/install"] as const) {
    test(`${href} switches between all 8 bundlers`, async () => {
      const page = await newPage();
      await page.goto(`${URL}${href}`, { waitUntil: "networkidle" });
      const tablist = page.getByRole("tablist", { name: "Bundler" });
      await tablist.scrollIntoViewIfNeeded();
      const seen = new Set<string>();
      for (const name of TABS) {
        await tablist.getByRole("tab", { name }).click();
        const code = await page.locator("main pre").nth(1).innerText();
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
    await page.goto(`${URL}/components/button`, {
      waitUntil: "networkidle",
      timeout: 60000,
    });
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
  test("/docs/authoring/components mounts docs-select with live state", async () => {
    const page = await newPage();
    await page.goto(`${URL}/docs/authoring/components`, {
      waitUntil: "networkidle",
    });
    const demo = page.locator("#guide-components-demo");
    await demo.waitFor({ state: "attached" });
    await page
      .getByRole("button", { name: "ctl.commands.setOpen(true)" })
      .click();
    const body = await page.locator("main").first().innerText();
    expect(body).toContain("ctl.state.value");
    await page.close();
  }, 60000);

  test("/docs/authoring/machines runs the signal demo", async () => {
    const page = await newPage();
    await page.goto(`${URL}/docs/authoring/machines`, {
      waitUntil: "networkidle",
    });
    await page.getByRole("button", { name: "count(count() + 1)" }).click();
    const body = await page.locator("main").first().innerText();
    expect(body).toContain("count: 1, doubled: 2");
    await page.close();
  }, 60000);
});

describe("search and studio", () => {
  test("Control+k opens search and Enter navigates", async () => {
    const page = await newPage();
    await page.goto(`${URL}/docs/getting-started/overview`, {
      waitUntil: "networkidle",
    });
    await page.keyboard.press("Control+k");
    const dialog = page.getByRole("dialog");
    await dialog.waitFor({ state: "visible" });
    await page.getByRole("combobox").fill("quickstart");
    await page.keyboard.press("Enter");
    await page.waitForURL("**/docs/getting-started/quickstart", {
      timeout: 10000,
    });
    const h1 = await page.locator("main h1").first().textContent();
    expect(h1?.trim()).toBe("Quickstart");
    await page.close();
  }, 60000);

  test("the Studio FAB opens the overlay with the single bar", async () => {
    const page = await newPage();
    await page.goto(`${URL}/docs/getting-started/overview`, {
      waitUntil: "networkidle",
    });
    const fab = page.getByRole("button", { name: "Open the theme studio" });
    await fab.waitFor({ state: "visible", timeout: 30000 });
    await fab.click();
    const frame = page.frameLocator("[data-spin-studio]");
    const bar = frame.locator("#app header").first();
    await bar.waitFor({ state: "visible", timeout: 30000 });
    const nav = frame.locator('[data-testid="studio-nav"]').first();
    await nav.waitFor({ state: "visible", timeout: 30000 });
    const barBox = await bar.boundingBox();
    const navBox = await nav.boundingBox();
    expect(barBox).not.toBeNull();
    expect(navBox).not.toBeNull();
    expect(navBox!.y).toBeGreaterThanOrEqual(barBox!.y);
    expect(navBox!.y + navBox!.height).toBeLessThanOrEqual(
      barBox!.y + barBox!.height + 1,
    );
    await page.close();
  }, 90000);
});

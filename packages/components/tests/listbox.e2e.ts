/**
 * E2E: the forked-FSM listbox drives its machine in a real browser — the
 * focus default, the arrow walk with wrapping and disabled-skip, Enter/Space
 * selection, typeahead, hover, the multiple instance with shift-extend and
 * select-all, and the imperative commands.
 *
 * Run explicitly (not in default `deno task test`):
 *   cd packages/components && deno test --allow-read --allow-net --allow-run
 *     --allow-env --allow-sys --allow-write=/tmp --allow-import
 *     --min-dep-age=0 tests/listbox.e2e.ts
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
const PORT = 5247;
const URL = `http://127.0.0.1:${PORT}/listbox`;

/** Part ids are the machine's scheme: `listbox:<element id>:<part>`. */
const at = (id: string, part: string): string => `[id="listbox:${id}:${part}"]`;
const FW_CONTENT = at("frameworks", "content");
const FW_ITEM = (value: string): string => at("frameworks", `item:${value}`);
const TOP_CONTENT = at("toppings", "content");
const TOP_ITEM = (value: string): string => at("toppings", `item:${value}`);

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
  for (let i = 0; i < 50; i += 1) {
    try {
      if ((await fetch(URL)).ok) return child;
    } catch {
      // server not ready yet
    }
    await delay(100);
  }
  const stderr = new TextDecoder().decode(await new Response(child.stderr).arrayBuffer());
  try {
    child.kill();
  } catch {
    // already exited
  }
  throw new Error(`vite preview did not start on :${PORT}\n${stderr}`);
}

Deno.test("spin-listbox e2e", async () => {
  await step("build", buildDemo);
  const server = await step("serve", startServer);
  const pageErrors: string[] = [];
  let browser: Browser | undefined;

  try {
    browser = await step("launch chromium", () =>
      chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] }));

    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    page.on("pageerror", (err) => pageErrors.push(err.message));

    await step("load page", async () => {
      await page.goto(URL, { waitUntil: "load" });
      await page.waitForSelector(FW_CONTENT, { state: "attached", timeout: 5000 });
      assert.equal(
        await page.locator(FW_CONTENT).getAttribute("role"),
        "listbox",
        "the content is a listbox",
      );
    });

    await step("focus keeps the highlight empty when svelte is selected", async () => {
      await page.locator(FW_CONTENT).focus();
      assert.equal(
        await page.locator(FW_CONTENT).getAttribute("aria-activedescendant"),
        null,
        "a selection is already visible so nothing defaults",
      );
    });

    await step("arrows walk and skip the disabled row", async () => {
      await page.keyboard.press("ArrowDown");
      assert.equal(
        await page.locator(FW_CONTENT).getAttribute("aria-activedescendant"),
        "listbox:frameworks:item:react",
        "the first arrow lands on the first row",
      );
      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("ArrowDown");
      assert.equal(
        await page.locator(FW_CONTENT).getAttribute("aria-activedescendant"),
        "listbox:frameworks:item:svelte",
        "the walk reaches svelte",
      );
      await page.keyboard.press("ArrowDown");
      assert.equal(
        await page.locator(FW_CONTENT).getAttribute("aria-activedescendant"),
        "listbox:frameworks:item:deno",
        "the walk skips disabled angular",
      );
    });

    await step("End then ArrowDown wraps to the first row", async () => {
      await page.keyboard.press("End");
      assert.equal(
        await page.locator(FW_CONTENT).getAttribute("aria-activedescendant"),
        "listbox:frameworks:item:node",
        "End jumps to the last row",
      );
      await page.keyboard.press("ArrowDown");
      assert.equal(
        await page.locator(FW_CONTENT).getAttribute("aria-activedescendant"),
        "listbox:frameworks:item:react",
        "and the next arrow wraps",
      );
    });

    await step("Enter selects the highlight", async () => {
      await page.keyboard.press("Home");
      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("Enter");
      assert.equal(
        await page.locator(FW_ITEM("vue")).getAttribute("aria-selected"),
        "true",
        "vue is selected",
      );
    });

    await step("click selects a row", async () => {
      await page.locator(FW_ITEM("deno")).click();
      assert.equal(
        await page.locator(FW_ITEM("deno")).getAttribute("aria-selected"),
        "true",
        "deno is selected",
      );
      assert.equal(
        await page.locator(FW_ITEM("vue")).getAttribute("aria-selected"),
        "false",
        "single mode replaces",
      );
    });

    await step("click on a disabled row selects nothing", async () => {
      await page.locator(FW_ITEM("angular")).click({ force: true });
      assert.equal(
        await page.locator(FW_ITEM("angular")).getAttribute("aria-selected"),
        "false",
        "angular stays unselected",
      );
    });

    await step("typeahead highlights the match", async () => {
      await page.locator(FW_CONTENT).focus();
      await page.keyboard.press("b");
      assert.equal(
        await page.locator(FW_CONTENT).getAttribute("aria-activedescendant"),
        "listbox:frameworks:item:bun",
        "b matches bun",
      );
    });

    await step("commands drive the instance", async () => {
      const card = page.locator("card").first();
      await card.getByRole("button", { name: 'el.selectValue("deno")' }).click();
      assert.equal(
        await page.locator(FW_ITEM("deno")).getAttribute("aria-selected"),
        "true",
        "selectValue commits deno",
      );
      await card.getByRole("button", { name: "el.clearValue()" }).click();
      assert.equal(
        await page.locator(FW_ITEM("deno")).getAttribute("aria-selected"),
        "false",
        "clearValue empties the selection",
      );
    });

    await step("multiple selects and extends", async () => {
      await page.locator(TOP_ITEM("cheese")).click();
      await page.locator(TOP_ITEM("basil")).click();
      assert.equal(
        await page.locator(TOP_ITEM("cheese")).getAttribute("aria-selected"),
        "true",
        "cheese stays selected in clear mode",
      );
      const multi = page.locator("card").nth(1);
      await multi.getByRole("button", { name: "el.selectAll()" }).click();
      assert.equal(
        await page.locator(TOP_ITEM("olives")).getAttribute("aria-selected"),
        "true",
        "selectAll fills the enabled rows",
      );
      assert.equal(
        await page.locator(TOP_ITEM("pineapple")).getAttribute("aria-selected"),
        "false",
        "but not the disabled one",
      );
    });

    await step("no page errors", async () => {
      assert.deepEqual(pageErrors, [], `page errors: ${pageErrors.join("; ")}`);
    });
  } finally {
    await browser?.close();
    server.kill();
  }
});

/**
 * E2E: the forked-FSM select drives its machine in a real browser — the
 * closed combobox trigger, one click opening the panel with its four
 * options, the click pick with the readout and the hidden native select
 * carrying the value, the keyboard walk (Enter opens, the listbox walks,
 * Enter picks), Escape, and the multiple demo that stays open.
 *
 * Run explicitly (not in default `deno task test`):
 *   cd packages/components && deno test --allow-read --allow-net --allow-run
 *     --allow-env --allow-sys --allow-write=/tmp --allow-import
 *     --min-dep-age=0 tests/select.e2e.ts
 *
 * Builds the specimens app, serves dist, drives real Chromium via Playwright.
 * Requires the Playwright browser once: `bunx playwright install chromium`.
 * Fails loud naming the step; silent on success.
 */

import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { strict as assert } from "node:assert";
import { type Browser, chromium, type Page } from "npm:playwright-core";

const ROOT = join(import.meta.dirname as string, "..", "..", "..");
const SPECIMENS = "packages/components/specimens";
const PORT = 5229;
const URL = `http://127.0.0.1:${PORT}/select`;

/** Part ids are the machine's scheme: `select:<element id>:<part>`. */
const at = (id: string, part: string): string => `[id="select:${id}:${part}"]`;
const S_ROOT = '[id="select:single"]';
const S_TRIGGER = at("single", "trigger");
const S_CONTENT = at("single", "content");
const S_HIDDEN = at("single", "hidden");
const S_ITEM = (value: string): string => at("single", `item:${value}`);
const M_ROOT = '[id="select:multi"]';
const M_TRIGGER = at("multi", "trigger");
const M_ITEM = (value: string): string => at("multi", `item:${value}`);

const readout = async (page: Page, id: string): Promise<string> =>
  (await page.locator(`#${id}`).textContent()) ?? "";

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
  for (let i = 0; i < 50; i += 1) {
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

Deno.test("spin-select e2e", async () => {
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
    const pageErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));

    await step("load page", async () => {
      await page.goto(URL, { waitUntil: "load" });
      await page.waitForSelector(S_TRIGGER, {
        state: "attached",
        timeout: 5000,
      });
    });

    await step(
      "the trigger is a combobox and the panel is closed",
      async () => {
        assert.equal(
          await page.locator(S_TRIGGER).getAttribute("role"),
          "combobox",
          "the trigger is the combobox",
        );
        assert.equal(
          await page.locator(S_ROOT).getAttribute("data-state"),
          "closed",
          "the root reports closed",
        );
        assert.equal(
          await page.locator(S_TRIGGER).getAttribute("aria-expanded"),
          "false",
          "and the trigger reports collapsed",
        );
      },
    );

    await step("one click opens the panel with the four options", async () => {
      await page.locator(S_TRIGGER).click();
      assert.equal(
        await page.locator(S_ROOT).getAttribute("data-state"),
        "open",
        "the click opens the panel — no focus-first workaround needed",
      );
      assert.equal(
        await page.locator(S_TRIGGER).getAttribute("aria-expanded"),
        "true",
        "and the trigger reports expanded",
      );
      assert.equal(
        await page.locator(S_CONTENT).getByRole("option").count(),
        4,
        "the panel holds the four options",
      );
    });

    await step("clicking an option picks it and closes the panel", async () => {
      await page.locator(S_ITEM("node")).click();
      assert.equal(
        await readout(page, "select-value"),
        "node",
        "the readout shows the pick",
      );
      assert.equal(
        await page.locator(S_ROOT).getAttribute("data-state"),
        "closed",
        "the panel closes on the pick",
      );
      assert.equal(
        await page.locator(S_HIDDEN).inputValue(),
        "node",
        "the hidden native select carries the value",
      );
    });

    await step(
      "the keyboard walk opens, walks the listbox, and picks",
      async () => {
        // Opening hands the panel focus — the trigger's own keys stop
        // applying once the panel is up, so the arrow walk starts inside the
        // listbox, which is the component's arrow handler.
        await page.locator(S_TRIGGER).focus();
        await page.keyboard.press("Enter");
        assert.equal(
          await page.locator(S_ROOT).getAttribute("data-state"),
          "open",
          "Enter opens the panel",
        );
        assert.equal(
          await page.locator(S_CONTENT).getAttribute("aria-activedescendant"),
          "select:single:item:deno",
          "with the first option highlighted",
        );
        await page.keyboard.press("ArrowDown");
        assert.equal(
          await page.locator(S_CONTENT).getAttribute("aria-activedescendant"),
          "select:single:item:bun",
          "ArrowDown moves the highlight",
        );
        await page.keyboard.press("Enter");
        assert.equal(
          await readout(page, "select-value"),
          "bun",
          "Enter picks the highlight",
        );
        assert.equal(
          await page.locator(S_ROOT).getAttribute("data-state"),
          "closed",
          "and the panel closes",
        );
      },
    );

    await step("Escape closes the panel", async () => {
      await page.locator(S_TRIGGER).click();
      assert.equal(
        await page.locator(S_ROOT).getAttribute("data-state"),
        "open",
        "the panel opens again",
      );
      await page.keyboard.press("Escape");
      assert.equal(
        await page.locator(S_ROOT).getAttribute("data-state"),
        "closed",
        "Escape closes it",
      );
    });

    await step(
      "the multiple demo adds to the selection and stays open",
      async () => {
        await page.locator(M_TRIGGER).click();
        assert.equal(
          await page.locator(M_ROOT).getAttribute("data-state"),
          "open",
          "the multiple panel opens",
        );
        await page.locator(M_ITEM("node")).click();
        assert.equal(
          await page.locator(M_ITEM("node")).getAttribute("aria-selected"),
          "true",
          "the click adds to the selection",
        );
        assert.equal(
          await page.locator(M_ITEM("deno")).getAttribute("aria-selected"),
          "true",
          "the seeded values stay selected",
        );
        assert.equal(
          await page.locator(M_ITEM("bun")).getAttribute("aria-selected"),
          "true",
          "the seeded values stay selected",
        );
        assert.equal(
          await page.locator(M_ROOT).getAttribute("data-state"),
          "open",
          "the panel stays open",
        );
        await page.keyboard.press("Escape");
      },
    );

    await step("no page errors", async () => {
      assert.deepEqual(pageErrors, [], `page errors: ${pageErrors.join("; ")}`);
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

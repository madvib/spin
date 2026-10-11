/**
 * E2E: the forked-FSM toast drives its machine in a real browser — the queue,
 * the lifecycle, the region's posture and the geometry channel.
 *
 * Run explicitly (not in default `deno task test`):
 *   cd packages/components && deno test -A tests/toast.e2e.ts
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
const PORT = 5221;
const URL = `http://127.0.0.1:${PORT}/toast`;

const REGION = '[id="toast:region:group"]';
const ROWS = `${REGION} [role="status"]`;
/** Rows are addressed by the machine's id scheme: `toast:<elementId>:toast:<id>`. */
const row = (id: string): string => `[id="toast:region:toast:${id}"]`;
const closeOf = (id: string): string => `${row(id)} button[aria-label="Dismiss notification"]`;

const rows = (page: Page) => page.locator(ROWS);
const count = async (page: Page): Promise<number> => await rows(page).count();

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

/** Waits until the host's own list has that many toasts in it. */
async function waitCount(page: Page, expected: number): Promise<void> {
  await page.waitForFunction(
    (n: number) => {
      const node = document.querySelector("#toast-count");
      return node !== null && Number(node.textContent ?? "0") === n;
    },
    expected,
    { timeout: 5000 },
  );
}

Deno.test("spin-toast e2e", async () => {
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
      await page.waitForSelector(REGION, { state: "attached", timeout: 5000 });
    });

    await step("renders an empty region", async () => {
      const region = page.locator(REGION);
      assert.equal(await region.getAttribute("role"), "region", "the group is a live region");
      assert.equal(await region.getAttribute("aria-label"), "Notifications, bottom", "the label names the placement");
      assert.equal(await region.getAttribute("aria-live"), "polite", "and announces additions");
      assert.equal(await region.getAttribute("data-side"), "bottom", "the side comes from the placement");
      assert.equal(await region.getAttribute("data-align"), "center", "and so does the alignment");
      assert.equal(await region.getAttribute("data-empty"), "", "an empty region says so");
      assert.equal(await count(page), 0, "and holds no rows");
    });

    await step("a host write puts a toast in the queue", async () => {
      await page.getByRole("button", { name: "Success" }).click();
      await page.waitForSelector(row("toast-1"), { state: "attached", timeout: 5000 });
      await waitCount(page, 1);
      const toast = page.locator(row("toast-1"));
      assert.equal(await toast.getAttribute("role"), "status", "a toast is a status");
      assert.equal(await toast.getAttribute("data-type"), "success", "the type reaches the row");
      assert.equal(await toast.getAttribute("data-state"), "open", "the row is visible");
      assert.equal(await toast.getAttribute("data-first"), "", "the only row is the front row");
      assert.equal(await toast.getAttribute("data-sibling"), null, "and not a sibling");
      assert.equal(await toast.getAttribute("tabindex"), "0", "the row is focusable");
      assert.equal(
        await toast.getAttribute("aria-labelledby"),
        "toast:region:toast:toast-1:title",
        "the title names the toast",
      );
      assert.equal(
        await toast.getAttribute("aria-describedby"),
        "toast:region:toast:toast-1:description",
        "the description describes it",
      );
      assert.equal(
        await page.locator('[id="toast:region:toast:toast-1:title"]').textContent(),
        "Saved",
        "the host's title is rendered",
      );
      assert.equal(
        await page.locator('[id="toast:region:toast:toast-1:description"]').textContent(),
        "Toast number 1.",
        "and so is its description",
      );
    });

    await step("the newest toast is the front row", async () => {
      await page.getByRole("button", { name: "Error" }).click();
      await page.getByRole("button", { name: "With an action" }).click();
      await waitCount(page, 3);
      assert.equal(await count(page), 3, "three rows are in the queue");
      assert.equal(
        await page.locator(row("toast-3")).getAttribute("data-first"),
        "",
        "the newest row is the front",
      );
      assert.equal(
        await page.locator(row("toast-2")).getAttribute("data-sibling"),
        "",
        "the row behind is a sibling",
      );
      assert.equal(
        await page.locator(row("toast-2")).getAttribute("data-first"),
        null,
        "and not the front row",
      );
      // The geometry channel: the front row is on top and at the origin.
      const front = await page.locator(row("toast-3")).getAttribute("style");
      assert.match(front ?? "", /--toast-y:0px/, "the front row sits at the origin");
      assert.match(front ?? "", /--toast-z:3/, "the front row paints last");
      const behind = await page.locator(row("toast-1")).getAttribute("style");
      assert.match(behind ?? "", /--toast-z:1/, "the oldest row paints first");
    });

    await step("the action trigger reports to the host and dismisses", async () => {
      await page.locator(`${row("toast-3")} button[aria-label="Undo"]`).click();
      // The dismissing report lands before the remove delay lets go, so
      // the src is pinned while it is current.
      await page.waitForFunction(
        () => document.querySelector("#last-action")?.textContent?.includes("toast-3"),
        undefined,
        { timeout: 5000 },
      );
      const dismissing = await page.locator("#last-action").textContent();
      assert.match(dismissing ?? "", /toast-3 → dismissing \(user\)/, "the host hears the dismissal src");
      await waitCount(page, 2);
      assert.equal(await count(page), 2, "the action row left the queue");
    });

    await step("the close trigger dismisses after the remove delay", async () => {
      await page.locator(closeOf("toast-1")).click();
      await page.waitForSelector(row("toast-1"), { state: "detached", timeout: 5000 });
      await waitCount(page, 1);
      const last = await page.locator("#last-action").textContent();
      assert.match(last ?? "", /toast-1 → unmounted/, "the departure is reported");
    });

    await step("Escape on a focused toast dismisses it from the keyboard", async () => {
      // A press focuses on the way down, which is the delivery Playwright's
      // focus() call does not guarantee in this app.
      await page.locator(row("toast-2")).click();
      await page.keyboard.press("Escape");
      await page.waitForFunction(
        () => document.querySelector("#last-action")?.textContent?.includes("toast-2"),
        undefined,
        { timeout: 5000 },
      );
      const dismissing = await page.locator("#last-action").textContent();
      assert.match(dismissing ?? "", /toast-2 → dismissing \(keyboard\)/, "the src is keyboard");
      await waitCount(page, 0);
    });

    await step("hovering the region holds the clocks", async () => {
      await page.getByRole("button", { name: "Success" }).click();
      await page.waitForSelector(row("toast-4"), { state: "attached", timeout: 5000 });
      // Park the pointer away first: hovering what is already underneath
      // it moves nothing and pauses nothing.
      await page.mouse.move(0, 0);
      await page.locator(row("toast-4")).hover();
      await page.waitForSelector(`${REGION} [data-paused]`, { timeout: 5000 });
      assert.equal(
        await page.locator(row("toast-4")).getAttribute("data-paused"),
        "",
        "the row reports the pause",
      );
      assert.equal(await page.locator(row("toast-4")).getAttribute("data-state"), "open", "and stays open");
    });

    await step("the authored overlap collapses the region", async () => {
      await page.getByRole("button", { name: "overlap: off" }).click();
      // The region is zero-area (its rows are absolute), so visibility
      // never applies: attached is the assertion.
      await page.waitForSelector(`${REGION}[data-overlap]`, { state: "attached", timeout: 5000 });
      assert.equal(
        await page.locator(row("toast-4")).getAttribute("data-overlap"),
        "",
        "the row reports the collapse",
      );
      assert.equal(
        await page.locator(row("toast-4")).getAttribute("data-stack"),
        null,
        "and is not stacked",
      );
      const style = await page.locator(row("toast-4")).getAttribute("style");
      assert.match(style ?? "", /--toast-scale:1/, "a lone toast is full size");
    });

    await step("the placement moves the region", async () => {
      await page.getByRole("button", { name: "placement: bottom" }).click();
      await page.getByRole("button", { name: "placement: bottom-end" }).click();
      await page.waitForSelector(`${REGION}[data-side="top"]`, { state: "attached", timeout: 5000 });
      assert.equal(await page.locator(REGION).getAttribute("data-side"), "top", "the side moved to the top");
      assert.equal(await page.locator(REGION).getAttribute("data-align"), "center", "with the alignment it carries");
      const geometry = await page.locator(REGION).getAttribute("style");
      assert.match(geometry ?? "", /--toast-gap:16px/, "the gap rides the geometry channel");
      assert.match(geometry ?? "", /--toast-offset:1rem/, "and so does the offset");
    });

    await step("the host command dismisses everything", async () => {
      await page.getByRole("button", { name: "el.dismissAll()" }).click();
      await page.waitForSelector(ROWS, { state: "detached", timeout: 5000 });
      await waitCount(page, 0);
      assert.equal(await page.locator(REGION).getAttribute("data-empty"), "", "the region is empty again");
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

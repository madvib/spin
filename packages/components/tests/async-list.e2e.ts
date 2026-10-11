/**
 * E2E: the forked-FSM async list drives its machine in a real browser — the
 * auto-reloading paged instance, the hand-driven crew instance (reload, load
 * more, sort, filter), and the loading/error readouts.
 *
 * Run explicitly (not in default `deno task test`):
 *   cd packages/components && deno test --allow-read --allow-net --allow-run
 *     --allow-env --allow-sys --allow-write=/tmp --allow-import
 *     --min-dep-age=0 tests/async-list.e2e.ts
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
const PORT = 5229;
const URL = `http://127.0.0.1:${PORT}/async-list`;

/** Part ids are the recipe's scheme: `async-list:<element id>:<part>`. */
const at = (id: string, part: string): string => `[id="async-list:${id}:${part}"]`;
const CREW_LIST = at("crew", "list");
const CREW_ITEM = (value: string): string => at("crew", `item:${value}`);

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

/** The first row's text in the crew list. */
const firstRow = async (page: Page): Promise<string> =>
  (await page.locator(`${CREW_LIST} [role="listitem"]`).first().textContent()) ?? "";

/** Waits until a numeric readout grows past a floor, handing back the new count. */
async function waitGrowth(page: Page, id: string, floor: number): Promise<number> {
  for (let i = 0; i < 50; i += 1) {
    const now = Number(await readout(page, id));
    if (now > floor) return now;
    await delay(100);
  }
  throw new Error(`readout #${id} never grew past ${floor}`);
}

Deno.test("spin-async-list e2e", async () => {
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
      await page.waitForSelector(CREW_LIST, { state: "attached", timeout: 5000 });
      await waitGrowth(page, "async-list-loads", 0);
      assert.equal(await readout(page, "async-list-failures"), "0", "no load fails");
    });

    let pagedLoads = 0;
    await step("switching the dependency reloads the paged list", async () => {
      pagedLoads = Number(await readout(page, "async-list-loads"));
      await page.getByRole("button", { name: "Fragment: rift" }).click();
      pagedLoads = await waitGrowth(page, "async-list-loads", pagedLoads);
    });

    await step("reload fills the crew list", async () => {
      await page.getByRole("button", { name: "el.reload()" }).click();
      await waitGrowth(page, "async-list-crew-loads", 0);
      assert.match(await firstRow(page), /Ada/, "the first page starts at Ada");
    });

    let crewLoads = 0;
    await step("loadMore drains the next page", async () => {
      crewLoads = Number(await readout(page, "async-list-crew-loads"));
      await page.getByRole("button", { name: "el.loadMore()" }).click();
      crewLoads = await waitGrowth(page, "async-list-crew-loads", crewLoads);
      assert.notEqual(
        await page.locator(CREW_ITEM("katherine")).count(),
        0,
        "the second page arrives",
      );
    });

    await step("descending sort reorders the rows", async () => {
      // The sentinel drains on its own clock: only sort a settled list, or
      // the click lands mid-load and the machine rightly ignores it.
      for (let i = 0; i < 100; i += 1) {
        if ((await page.locator(at("crew", "root")).getAttribute("data-state")) === "idle") break;
        await delay(100);
      }
      const labels = await page.locator(`${CREW_LIST} [role="listitem"]`).allTextContents();
      assert.ok(labels.length > 0, "rows are loaded before sorting");
      const [leader] = [...labels].sort((left, right) => right.localeCompare(left));
      await page.getByRole("button", { name: "el.sort(desc)" }).click();
      for (let i = 0; i < 50; i += 1) {
        if ((await firstRow(page)) === leader) break;
        await delay(100);
      }
      assert.equal(await firstRow(page), leader, "the sort winner leads descending");
    });

    await step("filter text narrows the list", async () => {
      await page.getByRole("button", { name: 'el.setFilterText("a")' }).click();
      for (let i = 0; i < 50; i += 1) {
        if ((await page.locator(CREW_ITEM("dorothy")).count()) === 0) break;
        await delay(100);
      }
      assert.equal(
        await page.locator(CREW_ITEM("dorothy")).count(),
        0,
        "Dorothy has no A and drops out",
      );
      assert.notEqual(
        await page.locator(CREW_ITEM("ada")).count(),
        0,
        "Ada survives the filter",
      );
    });

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

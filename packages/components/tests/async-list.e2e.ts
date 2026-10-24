import { test } from "bun:test";
/**
 * E2E: the forked-FSM async list drives its machine in a real browser — the
 * auto-reloading paged instance, the hand-driven crew instance (reload, load
 * more, sort, filter), and the loading/error readouts.
 */

import { strict as assert } from "node:assert";
import { delay, runComponentSuite, step } from "./harness.ts";
import { type Page } from "playwright-core";

/** Part ids are the recipe's scheme: `async-list:<element id>:<part>`. */
const at = (id: string, part?: string): string =>
  part === undefined
    ? `[id="async-list:${id}"]`
    : `[id="async-list:${id}:${part}"]`;
const CREW_LIST = at("crew", "list");
const CREW_ITEM = (value: string): string => at("crew", `item:${value}`);

const readout = async (page: Page, id: string): Promise<string> =>
  (await page.locator(`#${id}`).textContent()) ?? "";

/** The first row's text in the crew list. */
const firstRow = async (page: Page): Promise<string> =>
  (await page.locator(`${CREW_LIST} [role="listitem"]`).first()
    .textContent()) ?? "";

/** Waits until a numeric readout grows past a floor, handing back the new count. */
async function waitGrowth(
  page: Page,
  id: string,
  floor: number,
): Promise<number> {
  for (let i = 0; i < 50; i += 1) {
    const now = Number(await readout(page, id));
    if (now > floor) return now;
    await delay(100);
  }
  throw new Error(`readout #${id} never grew past ${floor}`);
}

test("spin-async-list e2e", () =>
  runComponentSuite({
    port: 5229,
    route: "/async-list",
    ready: CREW_LIST,
    settle: async (page) => {
      await waitGrowth(page, "async-list-loads", 0);
      assert.equal(
        await readout(page, "async-list-failures"),
        "0",
        "no load fails",
      );
    },
  }, async ({ page }) => {
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
        if (
          (await page.locator(at("crew")).getAttribute("data-state")) === "idle"
        ) break;
        await delay(100);
      }
      const labels = await page.locator(`${CREW_LIST} [role="listitem"]`)
        .allTextContents();
      assert.ok(labels.length > 0, "rows are loaded before sorting");
      const [leader] = [...labels].sort((left, right) =>
        right.localeCompare(left)
      );
      await page.getByRole("button", { name: "el.sort(desc)" }).click();
      for (let i = 0; i < 50; i += 1) {
        if ((await firstRow(page)) === leader) break;
        await delay(100);
      }
      assert.equal(
        await firstRow(page),
        leader,
        "the sort winner leads descending",
      );
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
  }));

/**
 * E2E: the forked-FSM toast drives its machine in a real browser — the queue,
 * the lifecycle, the region's posture and the geometry channel.
 */

import { strict as assert } from "node:assert";
import { runComponentSuite, step } from "./harness.ts";
import { type Page } from "npm:playwright-core";

const REGION = '[id="toast:region:group"]';
const ROWS = `${REGION} [role="status"]`;
/** Rows are addressed by the machine's id scheme: `toast:<elementId>:toast:<id>`. */
const row = (id: string): string => `[id="toast:region:toast:${id}"]`;
const closeOf = (id: string): string =>
  `${row(id)} button[aria-label="Dismiss notification"]`;

const rows = (page: Page) => page.locator(ROWS);
const count = async (page: Page): Promise<number> => await rows(page).count();

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

/**
 * The host's report history: every status the element reported, in order.
 * The readout slot (`#last-action`) holds only the newest report, and the
 * newest one is often not the one a step is about — a row that starts
 * dismissing takes its own pointer with it, so the region is left and the
 * rows behind it report themselves back to `visible` within a frame of the
 * dismissal. The history keeps them all, so a wait can name its report.
 */
const reports = async (page: Page): Promise<string[]> =>
  await page.locator("#action-log [data-report]").evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute("data-report") ?? "")
  );

/** Waits until the host's history holds exactly that report. */
async function waitReport(page: Page, report: string): Promise<void> {
  await page.waitForFunction(
    (want: string) =>
      Array.from(document.querySelectorAll("#action-log [data-report]"))
        .some((node) => node.getAttribute("data-report") === want),
    report,
    { timeout: 5000 },
  );
}

Deno.test("spin-toast e2e", () =>
  runComponentSuite(
    { port: 5221, route: "/toast", ready: REGION },
    async ({ page }) => {
      await step("renders an empty region", async () => {
        const region = page.locator(REGION);
        assert.equal(
          await region.getAttribute("role"),
          "region",
          "the group is a live region",
        );
        assert.equal(
          await region.getAttribute("aria-label"),
          "Notifications, bottom",
          "the label names the placement",
        );
        assert.equal(
          await region.getAttribute("aria-live"),
          "polite",
          "and announces additions",
        );
        assert.equal(
          await region.getAttribute("data-side"),
          "bottom",
          "the side comes from the placement",
        );
        assert.equal(
          await region.getAttribute("data-align"),
          "center",
          "and so does the alignment",
        );
        assert.equal(
          await region.getAttribute("data-empty"),
          "",
          "an empty region says so",
        );
        assert.equal(await count(page), 0, "and holds no rows");
      });

      await step("a host write puts a toast in the queue", async () => {
        await page.getByRole("button", { name: "Success" }).click();
        await page.waitForSelector(row("toast-1"), {
          state: "attached",
          timeout: 5000,
        });
        await waitCount(page, 1);
        const toast = page.locator(row("toast-1"));
        assert.equal(
          await toast.getAttribute("role"),
          "status",
          "a toast is a status",
        );
        assert.equal(
          await toast.getAttribute("data-type"),
          "success",
          "the type reaches the row",
        );
        assert.equal(
          await toast.getAttribute("data-state"),
          "open",
          "the row is visible",
        );
        assert.equal(
          await toast.getAttribute("data-first"),
          "",
          "the only row is the front row",
        );
        assert.equal(
          await toast.getAttribute("data-sibling"),
          null,
          "and not a sibling",
        );
        assert.equal(
          await toast.getAttribute("tabindex"),
          "0",
          "the row is focusable",
        );
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
          await page.locator('[id="toast:region:toast:toast-1:title"]')
            .textContent(),
          "Saved",
          "the host's title is rendered",
        );
        assert.equal(
          await page.locator('[id="toast:region:toast:toast-1:description"]')
            .textContent(),
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
        assert.match(
          front ?? "",
          /transform:translateY\(0px\)/,
          "the front row sits at the origin",
        );
        assert.match(front ?? "", /z-index:3/, "the front row paints last");
        const behind = await page.locator(row("toast-1")).getAttribute("style");
        assert.match(behind ?? "", /z-index:1/, "the oldest row paints first");
      });

      await step(
        "the action trigger reports to the host and dismisses",
        async () => {
          await page.locator(`${row("toast-3")} button[aria-label="Undo"]`)
            .click();
          // The report this step is about is the dismissing one, and it is
          // gone from the readout slot within a frame: the dismissing row
          // takes its own pointer with it, so the region is left and the rows
          // behind it report themselves back to `visible`. The history keeps
          // every report, so the wait names the one it wants.
          await waitReport(page, "toast-3 → dismissing (user)");
          assert.ok(
            (await reports(page)).includes("toast-3 → dismissing (user)"),
            "the host hears the dismissal src",
          );
          await waitCount(page, 2);
          assert.equal(await count(page), 2, "the action row left the queue");
        },
      );

      await step(
        "the close trigger dismisses after the remove delay",
        async () => {
          await page.locator(closeOf("toast-1")).click();
          await page.waitForSelector(row("toast-1"), {
            state: "detached",
            timeout: 5000,
          });
          await waitCount(page, 1);
          const heard = (await reports(page)).filter((report) =>
            report.startsWith("toast-1 →")
          );
          assert.equal(
            heard.at(-1),
            "toast-1 → unmounted",
            "the departure is reported",
          );
        },
      );

      await step(
        "Escape on a focused toast dismisses it from the keyboard",
        async () => {
          // A press focuses on the way down, which is the delivery Playwright's
          // focus() call does not guarantee in this app.
          await page.locator(row("toast-2")).click();
          await page.keyboard.press("Escape");
          await waitReport(page, "toast-2 → dismissing (keyboard)");
          assert.ok(
            (await reports(page)).includes("toast-2 → dismissing (keyboard)"),
            "the src is keyboard",
          );
          await waitCount(page, 0);
        },
      );

      await step("hovering the region holds the clocks", async () => {
        await page.getByRole("button", { name: "Success" }).click();
        await page.waitForSelector(row("toast-4"), {
          state: "attached",
          timeout: 5000,
        });
        // Park the pointer away first: hovering what is already underneath
        // it moves nothing and pauses nothing.
        await page.mouse.move(0, 0);
        await page.locator(row("toast-4")).hover();
        await page.waitForSelector(`${REGION} [data-paused]`, {
          timeout: 5000,
        });
        assert.equal(
          await page.locator(row("toast-4")).getAttribute("data-paused"),
          "",
          "the row reports the pause",
        );
        assert.equal(
          await page.locator(row("toast-4")).getAttribute("data-state"),
          "open",
          "and stays open",
        );
      });

      await step("the authored overlap collapses the region", async () => {
        await page.getByRole("button", { name: "overlap: off" }).click();
        // The region is zero-area (its rows are absolute), so visibility
        // never applies: attached is the assertion.
        await page.waitForSelector(`${REGION}[data-overlap]`, {
          state: "attached",
          timeout: 5000,
        });
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
        assert.match(style ?? "", /scale:1/, "a lone toast is full size");
      });

      await step("the placement moves the region", async () => {
        await page.getByRole("button", { name: "placement: bottom" }).click();
        await page.getByRole("button", { name: "placement: bottom-end" })
          .click();
        await page.waitForSelector(`${REGION}[data-side="top"]`, {
          state: "attached",
          timeout: 5000,
        });
        assert.equal(
          await page.locator(REGION).getAttribute("data-side"),
          "top",
          "the side moved to the top",
        );
        assert.equal(
          await page.locator(REGION).getAttribute("data-align"),
          "center",
          "with the alignment it carries",
        );
        const geometry = await page.locator(REGION).getAttribute("style");
        assert.match(
          geometry ?? "",
          /gap:16px/,
          "the gap rides the style channel",
        );
        assert.match(geometry ?? "", /top:1rem/, "and so does the offset");
      });

      await step("the host command dismisses everything", async () => {
        await page.getByRole("button", { name: "el.dismissAll()" }).click();
        await page.waitForSelector(ROWS, { state: "detached", timeout: 5000 });
        await waitCount(page, 0);
        assert.equal(
          await page.locator(REGION).getAttribute("data-empty"),
          "",
          "the region is empty again",
        );
      });
    },
  ));

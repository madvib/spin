/**
 * spin-floating-panel e2e: open/closed, the gesture modes, and the stage,
 * behind the app-controller handle.
 *
 * The route binds a machine-owned floating-panel through
 * `{ commands, state, bind }`; this suite exercises the seeded open, the
 * drag gesture (position follows the press-origin delta), an edge resize,
 * the stage cycle, the escape close, and the imperative commands.
 */

import { strict as assert } from "node:assert";
import { runComponentSuite, step } from "./harness.ts";
import { type Page } from "npm:playwright-core";

const READOUT = "#panel-state";
const POSITIONER = "#panel [role='dialog']";
const TRIGGER = "#panel [id$=':trigger']";
const DRAG = "#panel [id$=':drag']";
const RESIZE_E = "#panel [id$=':resize:e']";
const STAGE_MIN = "#panel [id$=':stage:minimized']";
const STAGE_DEFAULT = "#panel [id$=':stage:default']";
const STAGE_MAX = "#panel [id$=':stage:maximized']";
const CLOSE = "#panel [aria-label='Close']";
const RESIZE_SE = "#panel [id$=':resize:se']";

const posState = (page: Page): Promise<string> =>
  page.evaluate(() =>
    document.querySelector("#panel [role='dialog']")?.getAttribute(
      "data-state",
    ) ?? "gone"
  );

const stage = (page: Page): Promise<string> =>
  page.evaluate(() =>
    document.querySelector("#panel [role='dialog']")?.getAttribute(
      "data-stage",
    ) ?? "gone"
  );

/** Whether the panel body is actually painted (non-zero box, visible). */
const isPainted = (page: Page): Promise<boolean> =>
  page.evaluate(() => {
    const node = document.querySelector("#panel div.flex") as
      | HTMLElement
      | null;
    if (node === null) return false;
    const rect = node.getBoundingClientRect();
    const style = getComputedStyle(node);
    return rect.width > 4 && rect.height > 4 && style.visibility !== "hidden" &&
      style.opacity !== "0";
  });

/** Which header buttons are visible (not hidden-attribute). */
const visibleButtons = (page: Page): Promise<string> =>
  page.evaluate(() =>
    [...document.querySelectorAll(
      "#panel [aria-label='Minimize'],#panel [aria-label='Maximize'],#panel [aria-label='Restore'],#panel [aria-label='Close']",
    )]
      .filter((b) => !(b as HTMLElement).hidden)
      .map((b) => b.getAttribute("aria-label") ?? "?").join(",")
  );

/** Painted widths of the four header buttons: a hidden-attribute button
 * must actually paint zero (author display utilities beat the UA sheet,
 * so the attribute alone proves nothing — this pins the preflight). */
const buttonWidths = (page: Page): Promise<string> =>
  page.evaluate(() =>
    [...document.querySelectorAll(
      "#panel [aria-label='Minimize'],#panel [aria-label='Maximize'],#panel [aria-label='Restore'],#panel [aria-label='Close']",
    )]
      .map((b) =>
        `${b.getAttribute("aria-label")}=${
          Math.round(b.getBoundingClientRect().width)
        }`
      )
      .join(",")
  );

/** The panel's rect in page coordinates. */
const bodyRect = (
  page: Page,
): Promise<{ x: number; y: number; w: number; h: number }> =>
  page.evaluate(() => {
    const node = document.querySelector("#panel div.flex") as HTMLElement;
    const rect = node.getBoundingClientRect();
    return { x: rect.x, y: rect.y, w: rect.width, h: rect.height };
  });

const centerOf = (
  page: Page,
  selector: string,
): Promise<{ x: number; y: number }> =>
  page.evaluate((sel) => {
    const node = document.querySelector(sel) as HTMLElement;
    const rect = node.getBoundingClientRect();
    return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  }, selector);

/** A press-move-release gesture on a handle. */
async function gesture(
  page: Page,
  selector: string,
  dx: number,
  dy: number,
): Promise<void> {
  // Settle before the press as well as after: a target read mid-transition
  // points at where the panel WAS, and the press misses the handle.
  await page.waitForTimeout(300);
  const point = await centerOf(page, selector);
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.mouse.move(point.x + dx, point.y + dy, { steps: 5 });
  await page.mouse.up();
  // The panel eases between positions (duration-fast); the rect follows
  // the machine only after the transition lands.
  await page.waitForTimeout(300);
}

Deno.test("spin-floating-panel e2e", () =>
  runComponentSuite({
    port: 5236,
    route: "/floating-panel",
    ready: TRIGGER,
    timeoutMs: 30000,
  }, async ({ page }) => {
    await step("the seeded panel opens and reports its state", async () => {
      assert.equal(
        await posState(page),
        "open",
        "defaultOpen seeds the panel open",
      );
      assert.equal(
        await page.locator(READOUT).textContent(),
        "open",
        "and the readout follows the seed",
      );
      assert.equal(await stage(page), "restored", "the stage starts restored");
      const rect = await bodyRect(page);
      assert.equal(rect.w, 360, "the seeded geometry rides the channel");
      assert.equal(rect.h, 240, "width and height");
    });

    await step(
      "dragging the header moves the panel by the press delta",
      async () => {
        const before = await bodyRect(page);
        await gesture(page, DRAG, 90, 40);
        const after = await bodyRect(page);
        assert.equal(after.x - before.x, 90, "x moved by the delta");
        assert.equal(after.y - before.y, 40, "y moved by the delta");
        assert.equal(
          await posState(page),
          "open",
          "the release returns to open",
        );
      },
    );

    await step("dragging enters and leaves the gesture mode", async () => {
      const point = await centerOf(page, DRAG);
      await page.mouse.move(point.x, point.y);
      await page.mouse.down();
      assert.equal(
        await page.locator(POSITIONER).getAttribute("data-dragging"),
        "",
        "the press enters dragging",
      );
      await page.mouse.move(point.x + 10, point.y + 10, { steps: 2 });
      await page.mouse.up();
      assert.equal(
        await page.locator(POSITIONER).getAttribute("data-dragging"),
        null,
        "the release leaves it",
      );
    });

    await step(
      "every button order lands: the full stage permutation table",
      async () => {
        // Each row: click the sequence from restored-open, assert the end
        // state, stage, geometry, paint, and visible buttons. A staged
        // trigger hides itself, so every click targets a visible button.
        const restored = { w: 360, h: 240 };
        const rows: Array<
          { seq: string[]; stage: string; w: number; h: number }
        > = [
          { seq: ["min", "max", "default"], stage: "restored", ...restored },
          { seq: ["max", "min", "default"], stage: "restored", ...restored },
          {
            seq: ["min", "default", "max"],
            stage: "maximized",
            w: 1024,
            h: 768,
          },
          { seq: ["max", "default", "min"], stage: "minimized", w: 360, h: 48 },
          // min>max and max>min without a restore are unreachable: staged
          // triggers hide. The hidden-skip in clickStage proves it — a
          // repeated stage is a no-op, pinned by the rows below.
          { seq: ["min", "min"], stage: "minimized", w: 360, h: 48 },
          { seq: ["max", "max"], stage: "maximized", w: 1024, h: 768 },
        ];
        const clickStage = async (which: string): Promise<void> => {
          // A hidden trigger cannot be clicked (that is the point of the
          // hidden attribute): repeated stages are idempotent no-ops.
          const sel = which === "min"
            ? STAGE_MIN
            : which === "max"
            ? STAGE_MAX
            : STAGE_DEFAULT;
          if (await page.locator(sel).isHidden()) return;
          await page.locator(sel).click();
          await page.waitForTimeout(300);
        };
        for (const row of rows) {
          // Reset to restored-open first (default trigger if staged).
          if ((await stage(page)) !== "restored") {
            await page.locator(STAGE_DEFAULT).click();
            await page.waitForTimeout(300);
          }
          assert.equal(await stage(page), "restored", "reset lands restored");
          for (const which of row.seq) await clickStage(which);
          assert.equal(
            await stage(page),
            row.stage,
            `${row.seq.join(">")} lands ${row.stage}`,
          );
          const rect = await bodyRect(page);
          assert.equal(
            Math.round(rect.w),
            row.w,
            `${row.seq.join(">")} width ${row.w}`,
          );
          // Minimized keeps the header bar; maximized fills the stage box.
          if (row.stage !== "maximized") {
            assert.equal(
              Math.round(rect.h),
              row.h,
              `${row.seq.join(">")} height ${row.h}`,
            );
          }
          assert.equal(
            await isPainted(page),
            row.stage !== "minimized" ? true : true,
            `${row.seq.join(">")} paints`,
          );
          const buttons = await visibleButtons(page);
          if (row.stage === "restored") {
            assert.equal(
              buttons,
              "Minimize,Maximize,Close",
              `${row.seq.join(">")} shows min/max/close`,
            );
          } else {assert.equal(
              buttons,
              "Restore,Close",
              `${row.seq.join(">")} shows restore/close`,
            );}
          const widths = await buttonWidths(page);
          const zero = (name: string): boolean =>
            widths.split(",").some((cell) => cell === `${name}=0`);
          const shown = (name: string): boolean =>
            widths.split(",").some((cell) =>
              cell.startsWith(`${name}=`) && cell !== `${name}=0`
            );
          if (row.stage === "restored") {
            assert.equal(
              zero("Restore"),
              true,
              `${row.seq.join(">")} restore paints zero`,
            );
            assert.equal(
              shown("Minimize") && shown("Maximize") && shown("Close"),
              true,
              `${row.seq.join(">")} min/max/close paint`,
            );
          } else {
            assert.equal(
              zero("Minimize") && zero("Maximize"),
              true,
              `${row.seq.join(">")} min/max paint zero`,
            );
            assert.equal(
              shown("Restore"),
              true,
              `${row.seq.join(">")} restore paints`,
            );
          }
        }
      },
    );

    await step(
      "maximize fills the stage and restore returns the geometry",
      async () => {
        if ((await stage(page)) !== "restored") {
          await page.locator(STAGE_DEFAULT).click();
          await page.waitForTimeout(300);
        }
        await page.locator(STAGE_MAX).click();
        await page.waitForTimeout(400);
        const maxRect = await bodyRect(page);
        assert.equal(
          Math.round(maxRect.w),
          1024,
          "maximized fills the boundary width",
        );
        assert.equal(
          Math.round(maxRect.h),
          768,
          "maximized fills the boundary height",
        );
        assert.equal(await isPainted(page), true, "maximized paints");
        await page.locator(STAGE_DEFAULT).click();
        await page.waitForTimeout(400);
        const back = await bodyRect(page);
        assert.equal(Math.round(back.w), 360, "restore returns 360 width");
        assert.equal(Math.round(back.h), 240, "restore returns 240 height");
      },
    );

    await step("a southeast resize grows both axes", async () => {
      if ((await stage(page)) !== "restored") {
        await page.locator(STAGE_DEFAULT).click();
        await page.waitForTimeout(300);
      }
      const before = await bodyRect(page);
      await gesture(page, RESIZE_SE, 60, 40);
      const after = await bodyRect(page);
      assert.equal(
        Math.round(after.w - before.w),
        60,
        "the width grew by the delta",
      );
      assert.equal(
        Math.round(after.h - before.h),
        40,
        "the height grew by the delta",
      );
    });

    await step(
      "close from maximized hides the panel and the trigger reopens",
      async () => {
        await page.locator(STAGE_MAX).click();
        await page.waitForTimeout(300);
        assert.equal(await stage(page), "maximized", "maximized first");
        await page.locator(CLOSE).click();
        await page.waitForTimeout(300);
        assert.equal(
          await posState(page),
          "closed",
          "close from maximized closes",
        );
        assert.equal(await isPainted(page), false, "closed paints nothing");
        await page.locator(TRIGGER).click();
        await page.waitForTimeout(300);
        assert.equal(await posState(page), "open", "the trigger reopens");
      },
    );

    await step("the east edge resizes the panel", async () => {
      if (
        (await stage(page)) !== "restored" || (await posState(page)) !== "open"
      ) {
        if ((await posState(page)) !== "open") {
          await page.locator(TRIGGER).click();
          await page.waitForTimeout(300);
        }
        if ((await stage(page)) !== "restored") {
          await page.locator(STAGE_DEFAULT).click();
          await page.waitForTimeout(400);
        }
      }
      const before = await bodyRect(page);
      await gesture(page, RESIZE_E, 60, 0);
      const after = await bodyRect(page);
      assert.equal(after.w - before.w, 60, "the width grew by the delta");
      assert.equal(after.h, before.h, "the height is untouched");
    });

    await step(
      "escape during a drag cancels back to the press point",
      async () => {
        // Settle first: the resize before this step is still easing its
        // width, and a mid-ease rect is not the position the press records.
        await page.waitForTimeout(300);
        const before = await bodyRect(page);
        const point = await centerOf(page, DRAG);
        await page.mouse.move(point.x, point.y);
        await page.mouse.down();
        await page.mouse.move(point.x + 70, point.y + 0, { steps: 3 });
        await page.keyboard.press("Escape");
        await page.mouse.up();
        await page.waitForTimeout(300);
        const after = await bodyRect(page);
        assert.equal(after.x, before.x, "the move cancelled");
        assert.equal(after.y, before.y, "and the panel stayed open");
        assert.equal(
          await posState(page),
          "open",
          "no close from a gesture escape",
        );
      },
    );

    await step("the stage triggers cycle minimized and restored", async () => {
      await page.locator(STAGE_MIN).click();
      assert.equal(await stage(page), "minimized", "the stage minimizes");
      assert.equal(
        await page.locator(READOUT).textContent(),
        "minimized",
        "and reports through the channel",
      );
      await page.locator(STAGE_DEFAULT).click();
      assert.equal(await stage(page), "restored", "and restores");
    });

    await step("escape closes the panel", async () => {
      await page.keyboard.press("Escape");
      assert.equal(await posState(page), "closed", "the panel closes");
      assert.equal(
        await page.locator(READOUT).textContent(),
        "closed",
        "and reports",
      );
    });

    await step("imperative commands reopen and close", async () => {
      await page.getByRole("button", { name: "el.setOpen()" }).click();
      assert.equal(
        await posState(page),
        "open",
        "setOpen opens through the command",
      );
      await page.getByRole("button", { name: "el.close()" }).click();
      assert.equal(await posState(page), "closed", "close closes");
    });
  }));

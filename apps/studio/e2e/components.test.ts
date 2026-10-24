/**
 * The component page's own controls: one switch per section, and a copy that
 * belongs to the code it copies.
 *
 * Everything here is the same driving the shared suite does: navigate, point
 * the pointer, read what the page says. One thing is not: the copy control's
 * contract ends at the clipboard, and reading the clipboard is a permission
 * the browser withholds — so that one test asks the shared harness for it
 * rather than driving a browser of its own.
 */

import assert, { deepStrictEqual } from "node:assert/strict";
import type { Page } from "playwright-core";
import { test, withPage } from "./harness.ts";
import { studioUrl } from "./studio.ts";

/** The clipboard the copy control's contract ends at. */
const CLIPBOARD = ["clipboard-read", "clipboard-write"];

/** The page's example sections: the ones that carry a switch. */
const SECTIONS = `#app section`;

/** What one section shows, read from the page. */
interface SectionState {
  readonly name: string;
  readonly switch: readonly (readonly [string, string | null])[];
  readonly showsCode: boolean;
  readonly copy: number;
}

/** Every section's state, read in one pass. */
async function states(page: Page): Promise<readonly SectionState[]> {
  return await page.evaluate((selector) => {
    const sections = [...document.querySelectorAll(selector)]
      .filter((section) =>
        [...section.querySelectorAll("button[aria-pressed]")].some((button) =>
          ["component", "code"].includes((button.textContent ?? "").trim())
        )
      );
    return sections.map((section) => ({
      name: (section.querySelector("h3")?.textContent ?? "").trim(),
      switch: [...section.querySelectorAll("button[aria-pressed]")]
        .filter((button) =>
          ["component", "code"].includes((button.textContent ?? "").trim())
        )
        .map((button) => [
          (button.textContent ?? "").trim(),
          button.getAttribute("aria-pressed"),
        ]),
      showsCode: section.querySelector("pre") !== null,
      copy: [...section.querySelectorAll("button")].filter((button) =>
        (button.textContent ?? "").trim().startsWith("copy")
      ).length,
    }));
  }, SECTIONS);
}

/** Open a route and wait for the page to be the page. */
async function open(page: Page, route: string): Promise<void> {
  // A dev server that is rebuilding answers with an error page, and the
  // rebuild takes as long as it takes: so the navigation is asked again, and
  // again, until the studio answers with the page and not with the error.
  for (const attempt of [1, 2, 3, 4]) {
    try {
      await page.goto(`${studioUrl()}${route}`, {
        waitUntil: "domcontentloaded",
      });
    } catch {
      // A route that never loaded is this attempt's finding, not the run's.
    }
    try {
      await page.waitForSelector("#app h1", { timeout: 15_000 });
      // The examples arrive from the daemon, so the page is not the page
      // until one of them is on screen.
      await page.waitForSelector("#app section .spin-preview", {
        timeout: 15_000,
      });
      await page.waitForTimeout(400);
      return;
    } catch {
      if (attempt === 4) throw new Error(`the studio never showed ${route}`);
      await page.reload({ waitUntil: "domcontentloaded" });
    }
  }
}

/**
 * Throw one section's switch, the way a reader would.
 *
 * The switch says which view is showing, so the switch is what is waited on:
 * the code view is on screen when the switch claims it, and the claim is
 * read rather than guessed at from a length of time.
 */
async function showCode(page: Page, index: number): Promise<void> {
  const showing = await page.evaluate(
    async ({ selector, at }) => {
      const code = () => {
        const sections = [...document.querySelectorAll(selector)]
          .filter((section) =>
            [...section.querySelectorAll("button[aria-pressed]")].some(
              (button) => (button.textContent ?? "").trim() === "code",
            )
          );
        return [
          ...(sections[at]?.querySelectorAll("button[aria-pressed]") ?? []),
        ].find((button) => (button.textContent ?? "").trim() === "code");
      };
      const button = code();
      if (button === undefined) return false;
      (button as HTMLButtonElement).click();
      const deadline = Date.now() + 10_000;
      while (button.getAttribute("aria-pressed") !== "true") {
        if (Date.now() > deadline) return false;
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      return true;
    },
    { selector: SECTIONS, at: index },
  );
  assert(showing, `the section at ${index} does not show its markup`);
}

/**
 * The copy control's state, read from the page.
 *
 * The control is reached by reaching the block it belongs to, so what the
 * page says about it changes with the pointer — and the pointer's word is
 * `pointer-events`.
 */
async function copyControl(
  page: Page,
): Promise<{ opacity: string; pointer: string } | null> {
  return await page.evaluate(() => {
    const button = [...document.querySelectorAll("#app button")].find((b) =>
      (b.textContent ?? "").trim().startsWith("copy")
    );
    if (button === undefined) return null;
    const style = getComputedStyle(button);
    return { opacity: style.opacity, pointer: style.pointerEvents };
  });
}

/**
 * Every example owns its switch.
 *
 * A switch that governed the page would answer for every section at once,
 * and a reader who wanted one example's markup would get every example's.
 * So each section carries its own, and throwing one leaves the rest alone.
 */
test("every example owns its switch", async () => {
  await withPage(async ({ page }) => {
    await open(page, "/components/button");

    const before = await states(page);
    assert(before.length > 1, "the page shows no examples to switch");
    for (const section of before) {
      deepStrictEqual(
        section.switch,
        [["component", "true"], ["code", "false"]],
        `${section.name} opens on the component, with both of its states said`,
      );
      assert(!section.showsCode, `${section.name} opens showing its markup`);
    }

    await showCode(page, 1);
    const after = await states(page);
    assert(after[1]?.showsCode === true, "the second section shows no markup");
    assert(
      after[0]?.showsCode === false,
      "the first section followed the second one's switch",
    );
    deepStrictEqual(
      after[0]?.switch,
      [["component", "true"], ["code", "false"]],
      "the first section's switch moved when the second one's did",
    );
  });
});

/**
 * The component view is as tall as the specimen it shows.
 *
 * A section that held room for the code as well left a hole beside every
 * specimen, as deep as the longest block on the page. The specimen sits
 * under its own title, and the section ends with it.
 */
test("the component view is as tall as its specimen", async () => {
  await withPage(async ({ page }) => {
    await open(page, "/components/card");

    const gaps = await page.evaluate((selector) => {
      const sections = [...document.querySelectorAll(selector)]
        .filter((section) => section.querySelector(".spin-preview") !== null);
      return sections.map((section) => {
        const specimen = section.querySelector(".spin-preview")!;
        const panel = specimen.parentElement!;
        const title = section.querySelector("h3")!;
        const header = title.parentElement!;
        const panelStyle = getComputedStyle(panel);
        const headerStyle = getComputedStyle(header);
        return {
          name: (title.textContent ?? "").trim(),
          above: panel.getBoundingClientRect().top -
            header.getBoundingClientRect().bottom,
          aboveRoom: parseFloat(headerStyle.marginBottom),
          below: section.getBoundingClientRect().bottom -
            specimen.getBoundingClientRect().bottom,
          belowRoom: parseFloat(panelStyle.paddingBottom) +
            parseFloat(panelStyle.borderBottomWidth),
        };
      });
    }, SECTIONS);

    assert(gaps.length > 0, "the page shows no specimen");
    for (const gap of gaps) {
      assert(
        gap.above <= gap.aboveRoom + 1,
        `${gap.name} leaves ${Math.round(gap.above)}px between its title and ` +
          `its specimen, where its header's margin is ${
            Math.round(gap.aboveRoom)
          }px`,
      );
      assert(
        gap.below <= gap.belowRoom + 1,
        `${gap.name} leaves ${Math.round(gap.below)}px under its specimen, ` +
          `where its panel's padding is ${Math.round(gap.belowRoom)}px`,
      );
    }
  });
});

/**
 * A long block scrolls inside its own box.
 *
 * The code view is bounded, so a block that is longer than the page cannot
 * push the page down: the content overflows and the block scrolls.
 */
test("a long block scrolls inside its own box", async () => {
  await withPage(async ({ page }) => {
    await open(page, "/components/table");
    await showCode(page, 0);

    const box = await page.evaluate(() => {
      const pre = document.querySelector("#app section pre");
      if (pre === null) return null;
      return {
        client: pre.clientHeight,
        scroll: pre.scrollHeight,
        overflow: getComputedStyle(pre).overflowY,
      };
    });
    assert(box !== null, "the table page shows no markup");
    assert(
      box.scroll > box.client,
      `the block holds its whole content (${box.scroll}px in ${box.client}px), ` +
        "so a long block grows the page",
    );
    deepStrictEqual(box.overflow, "auto", "the block does not scroll");
  });
});

/**
 * The copy belongs to the code it copies.
 *
 * It is not on the page while the component is showing — there is no markup
 * to copy — and it appears on the block itself when the pointer or the
 * keyboard reaches it. What it copies is THAT section's markup.
 */
test("the copy belongs to the code it copies", async () => {
  await withPage(async ({ page }) => {
    await open(page, "/components/button");

    const quiet = await states(page);
    assert(
      quiet.every((section) => section.copy === 0),
      "a copy control sits in the component view",
    );

    await showCode(page, 1);
    const shown = await states(page);
    assert(
      shown[1]?.copy === 1,
      "the section showing its markup carries no copy control",
    );
    assert(
      shown[0]?.copy === 0,
      "a section showing its component carries a copy control",
    );

    // The control is the block's own: it is reached by reaching the block.
    const block = page.locator("#app section pre").first();
    await block.scrollIntoViewIfNeeded();
    const hidden = await copyControl(page);
    assert(hidden !== null, "the copy control is not on the page");
    deepStrictEqual(hidden.pointer, "none", "an unseen copy control can be hit");

    await block.hover();
    await page.waitForFunction(
      () => {
        const button = [...document.querySelectorAll("#app button")].find((b) =>
          (b.textContent ?? "").trim().startsWith("copy")
        );
        return button !== undefined &&
          getComputedStyle(button).pointerEvents === "auto";
      },
      undefined,
      { timeout: 10_000 },
    );
    const seen = await copyControl(page);
    assert(seen !== null, "the copy control is not on the page");
    deepStrictEqual(seen.pointer, "auto", "the copy control cannot be hit");

    // The control that is pressed is the one in the section showing markup.
    await page
      .locator("#app section")
      .filter({ has: page.locator("pre") })
      .first()
      .locator("button", { hasText: /^copy$/ })
      .click();

    // It says it copied, and the clipboard holds the block's own markup.
    const claim = await page
      .waitForFunction(
        () => {
          const button = [...document.querySelectorAll("#app button")].find((
            b,
          ) => (b.textContent ?? "").trim() === "copied");
          return button === undefined
            ? null
            : (button.textContent ?? "").trim();
        },
        undefined,
        { timeout: 10_000 },
      )
      .then((handle) => handle.jsonValue() as Promise<string>)
      .catch(() => null);
    deepStrictEqual(claim, "copied", "the control does not say it copied");

    const copied = await page.evaluate(async () => {
      const section = [...document.querySelectorAll("#app section")].find((s) =>
        s.querySelector("pre") !== null
      );
      return {
        clipboard: await navigator.clipboard.readText(),
        shown: section?.querySelector("pre")?.textContent ?? "",
      };
    });
    deepStrictEqual(
      copied.clipboard.replace(/\s+/g, " ").trim(),
      copied.shown.replace(/\s+/g, " ").trim(),
      "the clipboard holds something other than the block's markup",
    );
  }, { permissions: CLIPBOARD });
});

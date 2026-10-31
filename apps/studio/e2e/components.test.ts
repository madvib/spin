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
import { AUDIT_GLOBAL, auditInstallScript, type AuditResult } from "@spin/check";
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
        // The header row, not the title group: the switch sits beside the
        // title in the same row, and the row's own margin is the designed
        // rhythm the gap is measured against.
        const header = title.parentElement!.parentElement!;
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

test("every component renders legible non-empty upgraded specimens", async () => {
  await withPage(async ({ page }) => {
    await page.addInitScript({ content: auditInstallScript() });
    await open(page, "/components/button");
    const routes = await page.evaluate(() => {
      const links = [...document.querySelectorAll('nav[aria-label="Components"] a[href^="/components/"]')];
      const seen = new Set<string>();
      for (const link of links) {
        const href = link.getAttribute("href") ?? "";
        if (href !== "/components" && href.startsWith("/components/")) seen.add(href.slice("/components/".length));
      }
      return [...seen].sort();
    });
    assert(routes.length >= 60, `the rail lists ${routes.length} components, expected 60+`);
    for (const route of routes) {
      await open(page, `/components/${route}`);
      const stages = await page.evaluate(() => {
        const previews = [...document.querySelectorAll("#app section .spin-preview")];
        return previews.map((preview) => {
          const first = preview.firstElementChild;
          const rect = preview.getBoundingClientRect();
          return {
            children: first === null ? -1 : first.children.length,
            text: (first?.textContent ?? "").trim().length,
            width: rect.width,
            height: rect.height,
            upgraded: first === null
              ? false
              : first.tagName.includes("-") && customElements.get(first.tagName.toLowerCase()) !== undefined,
          };
        });
      });
      assert(stages.length > 0, `${route} renders no specimen stages`);
      for (const [index, stage] of stages.entries()) {
        assert(
          stage.children > 0 || stage.text > 0,
          `${route} stage ${index} is an empty white box (${stage.children} children)`,
        );
        assert(
          stage.width >= 24,
          `${route} stage ${index} is ${stage.width}px wide`,
        );
        assert(
          stage.height >= 3,
          `${route} stage ${index} is ${stage.height}px tall`,
        );
        if (route.startsWith("component-")) {
          assert(
            stage.upgraded,
            `${route} stage ${index} mounts an un-upgraded custom element`,
          );
        }
      }
      await page.evaluate(async () => {
        for (const preview of document.querySelectorAll("#app section .spin-preview")) {
          preview.scrollIntoView({ block: "nearest" });
        }
        const pending = [...document.querySelectorAll("#app section .spin-preview img")]
          .filter((img) => !(img as HTMLImageElement).complete)
          .map((img) => new Promise((resolve) => {
            const el = img as HTMLImageElement;
            el.addEventListener("load", resolve, { once: true });
            el.addEventListener("error", resolve, { once: true });
            setTimeout(resolve, 3000);
          }));
        await Promise.all(pending);
      });
      const broken = await page.evaluate(() => {
        const out: string[] = [];
        for (const img of document.querySelectorAll("#app section .spin-preview img")) {
          const el = img as HTMLImageElement;
          if (el.getClientRects().length === 0) continue;
          if (!(el.complete && el.naturalWidth > 0)) out.push(el.getAttribute("src")?.slice(0, 60) ?? "(no src)");
        }
        return out;
      });
      assert(broken.length === 0, `${route} has broken images: ${broken.join(", ")}`);
      const fonts = await page.evaluate(() => {
        const out: string[] = [];
        for (const preview of document.querySelectorAll("#app section .spin-preview")) {
          const family = getComputedStyle(preview).fontFamily;
          if (family.includes("Times New Roman")) out.push(family);
        }
        return out;
      });
      assert(fonts.length === 0, `${route} inherits the browser default font: ${fonts[0] ?? ""}`);
      const leaking = await page.evaluate(() => {
        const out: string[] = [];
        for (const el of document.querySelectorAll("#app section .spin-preview [popover]:not(:popover-open), #app section .spin-preview [role='tooltip']")) {
          const html = el as HTMLElement;
          if (html.getClientRects().length === 0) continue;
          const style = getComputedStyle(html);
          if (style.visibility === "hidden" || Number(style.opacity) < 0.05) continue;
          out.push(html.tagName.toLowerCase());
        }
        return out;
      });
      assert(leaking.length === 0, `${route} leaks closed popovers: ${leaking.join(", ")}`);
      await page.evaluate(() => {
        const triggers = [...document.querySelectorAll("#app section .spin-preview [aria-expanded='false'], #app section .spin-preview [data-part='trigger']")];
        for (const trigger of triggers.slice(0, 3)) (trigger as HTMLElement).click();
      });
      await page.waitForTimeout(400);
      const fails = await page.evaluate((global) => {
        const audit = (globalThis as unknown as Record<string, (options: { minContrast: number; strobeMs: number }) => AuditResult>)[global]!;
        const result = audit({ minContrast: 4.5, strobeMs: 250 });
        return result.findings
          .filter((finding) => finding.kind === "contrast")
          .map((finding) => finding.kind === "contrast" ? `${finding.ratio} (need ${finding.need}) "${finding.text.slice(0, 40)}"` : "");
      }, AUDIT_GLOBAL);
      assert(fails.length === 0, `${route}: ${fails.length} contrast failures — ${fails.slice(0, 3).join("  |  ")}`);
    }
  });
}, 600_000);

/**
 * An opened picker stays in the viewport.
 *
 * The theme picker's panel positions against its trigger and shifts into
 * the viewport when the trigger sits near the right edge. The shift reads
 * the panel's painted width — which is zero while the panel is hidden —
 * so the open must re-measure after the show, not rest on the closed
 * measure. The probe opens the theme-picker specimen on its own route and
 * reads the panel's rect against the viewport: any pixel past the edge is
 * the off-screen open this test exists to catch.
 */
test("an opened picker panel stays inside the viewport", async () => {
  await withPage(async ({ page }) => {
    await open(page, "/components/component-theme-picker");
    const triggers = await page.evaluate(() =>
      [...document.querySelectorAll("#app section .spin-preview [data-part='trigger'][aria-haspopup='listbox']")]
        .map((trigger) => {
          const rect = trigger.getBoundingClientRect();
          return { x: rect.x, width: rect.width };
        })
    );
    assert(triggers.length > 0, "the theme-picker route mounts no picker triggers");
    for (const [index, trigger] of triggers.entries()) {
      await page.evaluate((at) => {
        const triggers = [...document.querySelectorAll("#app section .spin-preview [data-part='trigger'][aria-haspopup='listbox']")];
        (triggers[at] as HTMLElement).click();
      }, index);
      await page.waitForTimeout(500);
      const panel = await page.evaluate(() => {
        const panels = [...document.querySelectorAll("[data-part='positioner']:not([hidden]) [role='listbox']")];
        return panels.map((list) => {
          const rect = (list.closest("[data-part='positioner']") ?? list).getBoundingClientRect();
          return {
            right: rect.right,
            width: rect.width,
            viewport: window.innerWidth,
          };
        });
      });
      assert(panel.length > 0, `trigger ${index} at x=${Math.round(trigger.x)} opens no panel`);
      for (const rect of panel) {
        assert(
          rect.right <= rect.viewport + 1,
          `trigger ${index} at x=${Math.round(trigger.x)} opens ${Math.round(rect.width)}px wide at right=${Math.round(rect.right)} in ${rect.viewport}px`,
        );
      }
      await page.keyboard.press("Escape");
      await page.waitForTimeout(300);
    }
  });
}, 300_000);

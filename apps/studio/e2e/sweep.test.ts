/**
 * The QA sweep gates: geometry, resilience, and visibility across every
 * theme and route.
 *
 * Gate A walks every theme over every concern route and holds each page to
 * its geometry: no console errors, no failed RPC, no dead scroll below the
 * last section, and split panes that fit the viewport. Gate B dispatches a
 * window focus (the refetch trigger) and asserts projected slots survive.
 * Gate C measures the controls themselves: range heights, combobox borders
 * and icons, and the colors page's mode parity.
 */

import assert from "node:assert/strict";
import { test, withPage } from "./harness.ts";
import { type StudioPage, studioUrl } from "./studio.ts";
import { ROUTE_PATHS } from "../src/lib/routes.ts";
import { seatTheme } from "./themes.ts";

const THEMES = ["console", "neobrut", "silk", "spin", "synthwave"] as const;

const CONCERNS = [
  "/themes/colors",
  "/themes/type",
  "/themes/motion",
  "/themes/spacing",
  "/themes/style",
  "/findings",
  "/preferences",
] as const;

/** Open a route and wait for the studio to be the studio. */
async function open(page: StudioPage, route: string): Promise<void> {
  for (const attempt of [1, 2, 3, 4]) {
    try {
      await page.page.goto(`${studioUrl()}${route}`, {
        waitUntil: "domcontentloaded",
      });
    } catch {
      // A route that never loaded is this attempt's finding, not the run's.
    }
    try {
      await page.page.waitForSelector("#app h1", { timeout: 15_000 });
      await page.settle(600);
      return;
    } catch {
      if (attempt === 4) throw new Error(`the studio never showed ${route}`);
      await page.reload();
    }
  }
}

test("Gate A: every theme renders every route with no dead scroll and no errors", async () => {
  await withPage(async (studio) => {
    const failures: string[] = [];
    for (const theme of THEMES) {
      await open(studio, "/");
      const seated = await seatTheme(studio, theme);
      assert(
        seated === "seated",
        `the picker never seated ${theme} (got ${seated})`,
      );
      for (const route of CONCERNS) {
        const errors: string[] = [];
        const failed: string[] = [];
        const onError = (error: Error): void => {
          errors.push(String(error));
        };
        const onResponse = (response: { status: () => number; url: () => string }): void => {
          if (
            response.url().includes("/__spin/rpc") && response.status() >= 400
          ) {
            failed.push(`${response.status()} ${response.url()}`);
          }
        };
        studio.page.on("pageerror", onError);
        studio.page.on("response" as never, onResponse as never);
        try {
          await open(studio, route);
          const geometry = await studio.eval<{
            dead: number;
            scrollHeight: number;
            bottom: number;
          }>(
            `(() => {
              const scroller = document.querySelector("#app main") ?? document.scrollingElement;
              const sections = [...document.querySelectorAll("#app section")];
              const bottom = sections.length === 0 ? 0 : Math.max(
                ...sections.map((s) => {
                  const r = s.getBoundingClientRect();
                  return r.bottom + (document.scrollingElement?.scrollTop ?? 0);
                }),
              );
              const scrollHeight = scroller instanceof HTMLElement
                ? scroller.scrollHeight
                : document.documentElement.scrollHeight;
              return { dead: scrollHeight - bottom, scrollHeight, bottom };
            })()`,
          );
          if (geometry.dead > 48) {
            failures.push(
              `${theme} ${route}: ${geometry.dead}px of dead scroll below the last section (scrollHeight ${geometry.scrollHeight}, bottom ${geometry.bottom})`,
            );
          }
          if (errors.length > 0) {
            failures.push(`${theme} ${route}: pageerror: ${errors[0]}`);
          }
          if (failed.length > 0) {
            failures.push(`${theme} ${route}: failed RPC: ${failed[0]}`);
          }
        } finally {
          studio.page.off("pageerror", onError);
          studio.page.off("response" as never, onResponse as never);
        }
      }
    }
    assert(failures.length === 0, `geometry failures:\n${failures.join("\n")}`);
  });
}, 300_000);

test("Gate A: split panes and sidebars fit the viewport on /icons and /components/button", async () => {
  await withPage(async (studio) => {
    await open(studio, "/themes/icons");
    const iconsFit = await studio.eval<{
      bottom: number;
      viewport: number;
      pane: number;
    }>(
      `(() => {
        const pane = document.querySelector("studio-split-pane");
        const rect = pane?.getBoundingClientRect();
        const scroller = pane?.querySelector('[slot="primary"]');
        return {
          bottom: rect?.bottom ?? -1,
          viewport: window.innerHeight,
          pane: scroller instanceof HTMLElement ? scroller.clientHeight : -1,
        };
      })()`,
    );
    assert(iconsFit.bottom >= 0, "/icons renders no split pane");
    assert(
      iconsFit.bottom <= iconsFit.viewport + 2,
      `/icons split pane overflows the viewport (${iconsFit.bottom} > ${iconsFit.viewport})`,
    );
    assert(
      iconsFit.pane > 200,
      `/icons scrollable pane is ${iconsFit.pane}px tall`,
    );

    await open(studio, "/components/button");
    const compFit = await studio.eval<{
      bottom: number;
      viewport: number;
      pane: number;
      gap: number;
    }>(
      `(() => {
        const nav = document.querySelector('nav[aria-label="Components"]');
        const scroller = document.querySelector(".drawer-scroll");
        const navRect = nav?.getBoundingClientRect();
        const rect = scroller?.getBoundingClientRect();
        return {
          bottom: rect?.bottom ?? -1,
          viewport: window.innerHeight,
          pane: scroller instanceof HTMLElement ? scroller.clientHeight : -1,
          gap: navRect && rect ? Math.abs(rect.left - navRect.right) : -1,
        };
      })()`,
    );
    assert(compFit.bottom >= 0, "/components/button renders no stage scroller");
    assert(
      compFit.bottom <= compFit.viewport + 2,
      `/components/button stage overflows the viewport (${compFit.bottom} > ${compFit.viewport})`,
    );
    assert(
      compFit.pane > 200,
      `/components/button scrollable stage is ${compFit.pane}px tall`,
    );
    assert(
      compFit.gap >= 0 && compFit.gap <= 2,
      `/components/button leaves a ${compFit.gap}px gap between sidebar and stage`,
    );
  });
});

test("Gate B: window focus and refetch preserve projected slots", async () => {
  await withPage(async (studio) => {
    const probes: Record<string, string> = {
      "/themes/icons":
        `document.querySelector("studio-split-pane")?.querySelectorAll("svg").length ?? 0`,
      "/components/button":
        `document.querySelectorAll(".spin-preview").length`,
      "/components/component-slider":
        `document.querySelectorAll(".spin-preview").length`,
      "/themes/motion": `document.querySelectorAll('input[type="range"]').length`,
    };
    for (const [route, probe] of Object.entries(probes)) {
      await open(studio, route);
      const before = await studio.eval<number>(`(() => ${probe})()`);
      assert(before > 0, `${route} renders nothing to preserve`);
      await studio.eval<null>(
        `(() => { window.dispatchEvent(new Event("focus")); return null; })()`,
      );
      await studio.settle(1500);
      const after = await studio.eval<number>(`(() => ${probe})()`);
      assert(
        after === before,
        `${route} lost projected content on focus (${before} → ${after})`,
      );
    }
  });
});

test("Gate C: range inputs are grooves, not pills", async () => {
  await withPage(async (studio) => {
    for (const route of ["/themes/spacing", "/themes/style", "/themes/motion"]) {
      await open(studio, route);
      const boxes = await studio.eval<
        readonly { height: number; width: number }[]
      >(
        `(() => [...document.querySelectorAll('input[type="range"]')].map((el) => {
          const r = el.getBoundingClientRect();
          return { height: r.height, width: r.width };
        }))()`,
      );
      assert(boxes.length > 0, `${route} renders no range inputs`);
      for (const [index, box] of boxes.entries()) {
        assert(
          box.height <= 20,
          `${route} range ${index} is ${box.height}px tall`,
        );
        assert(
          box.width >= 60,
          `${route} range ${index} is ${box.width}px wide`,
        );
      }
    }
  });
});

test("Gate C: combobox inputs have borders and non-zero trigger icons", async () => {
  await withPage(async (studio) => {
    const probes: Record<string, string> = {
      "/themes/type": "studio-font-combobox",
      "/themes/colors": "studio-token-combobox",
    };
    for (const [route, tag] of Object.entries(probes)) {
      await open(studio, route);
      const states = await studio.eval<
        readonly { border: string; icon: number }[]
      >(
        `(() => [...document.querySelectorAll(${JSON.stringify(tag)})].map((host) => {
          const input = host.querySelector("input");
          const icon = host.querySelector(".i-lucide-chevron-down");
          const rect = icon?.getBoundingClientRect();
          return {
            border: input === null ? "missing" : getComputedStyle(input).borderTopWidth,
            icon: rect === undefined ? -1 : Math.min(rect.width, rect.height),
          };
        }))()`,
      );
      assert(states.length > 0, `${route} renders no ${tag}`);
      for (const [index, state] of states.entries()) {
        assert(
          state.border !== "0px" && state.border !== "missing",
          `${route} ${tag} ${index} input has no visible border (${state.border})`,
        );
        assert(
          state.icon >= 10,
          `${route} ${tag} ${index} trigger icon is ${state.icon}px`,
        );
      }
    }
  });
});

test("Gate C: /colors slots match the theme's declared modes", async () => {
  await withPage(async (studio) => {
    for (const theme of ["synthwave", "console"] as const) {
      await open(studio, "/");
      const seated = await seatTheme(studio, theme);
      assert(seated === "seated", `the picker never seated ${theme}`);
      await open(studio, "/themes/colors");
      const slots = await studio.eval<{
        modes: string;
        light: number;
        dark: number;
      }>(
        `(() => {
          const editors = [...document.querySelectorAll("#app [class]")].filter((el) =>
            ["light", "dark"].includes((el.textContent ?? "").trim().split("\\n")[0]?.trim() ?? "")
          );
          void editors;
          const labels = [...document.querySelectorAll("#app span")]
            .map((s) => (s.textContent ?? "").trim())
            .filter((t) => t === "light" || t === "dark");
          return {
            modes: document.querySelector(".spin-preview")?.getAttribute("data-theme") ?? "",
            light: labels.filter((t) => t === "light").length,
            dark: labels.filter((t) => t === "dark").length,
          };
        })()`,
      );
      if (theme === "console") {
        assert(
          slots.dark > 0 && slots.light === 0,
          `console serves dark alone but renders light:${slots.light} dark:${slots.dark}`,
        );
      } else {
        assert(
          slots.light > 0 && slots.dark > 0,
          `synthwave serves both modes but renders light:${slots.light} dark:${slots.dark}`,
        );
      }
    }
  });
});

for (const route of ROUTE_PATHS) {
  void route;
}

/**
 * Gate D: every routed specimen upgrades in the studio bundle.
 *
 * The routed component pages mount each example through its mount tag, so
 * a bundle that dropped a registration (a treeshaken eager-registration
 * glob — the proven dev-green/dist-red mode) renders that specimen as an
 * empty box. The gate walks every machine route and asserts each stage's
 * first child upgrades in the page's own registry. Registration is
 * all-or-nothing per bundle, so the studio bundle passing here plus the
 * reference paint claims passing there covers both sides of the split.
 */
test("Gate D: every routed specimen upgrades in the studio bundle", async () => {
  await withPage(async (studio) => {
    await open(studio, "/components/button");
    const routes = await studio.eval<string[]>(
      `(() => {
        const links = [...document.querySelectorAll('nav[aria-label="Components"] a[href*="/components/"]')];
        const seen = new Set();
        for (const link of links) {
          const href = link.getAttribute("href") ?? "";
          const at = href.indexOf("/components/");
          if (at < 0 || href.endsWith("/components")) continue;
          seen.add(href.slice(at));
        }
        return [...seen].sort();
      })()`,
    );
    assert(routes.length >= 60, `the rail lists ${routes.length} components, expected 60+`);
    const failures: string[] = [];
    for (const route of routes.filter((href) => href.startsWith("/components/component-"))) {
      await open(studio, route);
      const stages = await studio.eval<readonly { tag: string; upgraded: boolean }[]>(
        `(() =>
          [...document.querySelectorAll("#app section .spin-preview")].map((preview) => {
            const first = preview.firstElementChild;
            const tag = (first?.tagName ?? "").toLowerCase();
            return {
              tag,
              upgraded: first !== null && tag.includes("-") && customElements.get(tag) !== undefined,
            };
          })
        )()`,
      );
      for (const [index, stage] of stages.entries()) {
        if (stage.tag.includes("-") && !stage.upgraded) {
          failures.push(`${route} stage ${index} mounts un-upgraded <${stage.tag}>`);
        }
      }
    }
    assert(failures.length === 0, `un-upgraded specimens:\n${failures.join("\n")}`);
  });
}, 600_000);

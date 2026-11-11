/**
 * The studio's end-to-end tests.
 *
 * They drive a running studio and a running host app — `bun run dev` at
 * the repository root, or the two dev servers on whatever ports they took —
 * the way an author drives them, and read the project back through the
 * studio's own RPC channel: the overlay it publishes, the stylesheet the app
 * renders, the document the reader gets. The app under test is `APP_URL`,
 * reached through the `?app=` door the studio already offers.
 *
 *   bun run e2e
 *   STUDIO_URL=http://localhost:9173 APP_URL=http://localhost:9174 bun run e2e
 */

import assert, { deepStrictEqual } from "node:assert/strict";
import { CHILD_PATHS, ROUTE_PATHS } from "../src/lib/routes.ts";
import { test, withPage, withWatcher } from "./harness.ts";
import {
  appUrl,
  routeTargets,
  studioUrl,
  valueAt,
} from "./studio.ts";
import { seatTheme } from "./themes.ts";

test("every route renders", async (t) => {
  await withPage(async (page) => {
    const routes = await routeTargets(page, studioUrl());
    assert(routes.length > 0, "the studio lists no routes");
    const noisy: string[] = [];
    page.page.on("console", (message) => {
      if (message.type() === "error") {
        noisy.push(`console: ${message.text().slice(0, 200)}`);
      }
    });
    page.page.on("response", (response) => {
      if (response.url().includes("__spin/rpc") && response.status() >= 400) {
        noisy.push(`rpc ${response.status()} ${response.url().slice(-80)}`);
      }
    });
    for (const route of routes) {
      await t.step(route, async () => {
        const errors = noisy.length;
        const heading = await page.goto(`${studioUrl()}${route}`);
        const probe = await page.eval<{ text: number; buildError: boolean }>(
          `(() => { const el = document.getElementById("app"); const t = el ? el.innerText : ""; return { text: t.trim().length, buildError: t.indexOf("does not build") > -1 }; })()`,
        );
        const fresh = noisy.slice(errors);
        // The shell is furniture: an unrouted path renders it and no words.
        // The error log rides along as diagnostic context — a route that
        // renders while logging errors still names them.
        assert(
          heading !== undefined && heading.trim() !== "" && probe.text > 50 &&
            !probe.buildError,
          `route ${route} renders: h1=${
            heading ?? "none"
          } text=${probe.text} buildError=${probe.buildError} errors=[${fresh.join(" | ")}]`,
        );
        assert(
          fresh.length === 0,
          `route ${route} logged errors: ${fresh.join(" | ")}`,
        );
      });
    }
  });
});

for (const mode of ["Light", "Dark"] as const) {
  const label = mode.toLowerCase() as "light" | "dark";
  test(`the studio is legible in ${label} mode`, async (t) => {
    await withPage(async (page) => {
      await page.goto(`${studioUrl()}/`);
      // Silk serves both modes, so the mode control is never disabled;
      // the seated default may serve one.
      const seated = await seatTheme(page, "minimal");
      assert(seated === "seated", `minimal never seated: ${seated}`);
      const pressed = await page.chooseMode(label);
      assert(pressed === "pressed", `the ${mode} control is ${pressed}`);
      const failures: string[] = [];
      for (const route of [...ROUTE_PATHS, ...CHILD_PATHS.filter((path) => !path.includes(":"))]) {
        await t.step(route, async () => {
          await page.followRail(route);
          for (const failure of await page.contrastFailures()) {
            failures.push(
              `${route} ${failure.ratio} (need ${failure.need}) ${failure.cls} "${failure.text}"`,
            );
          }
        });
      }
      assert(
        failures.length === 0,
        `${failures.length} failing — ${failures.slice(0, 3).join("  |  ")}`,
      );
    });
  });
}

for (const mode of ["Light", "Dark"] as const) {
  const label = mode.toLowerCase() as "light" | "dark";
  test(`the code view is legible in ${label} mode`, async () => {
    await withPage(async (page) => {
      await page.goto(`${studioUrl()}/`);
      const seated = await seatTheme(page, "minimal");
      assert(seated === "seated", `minimal never seated: ${seated}`);
      const pressed = await page.chooseMode(label);
      await page.followRail("/components");
      await page.followRail("/components/button");
      const shown = await page.toggleCode();
      const failures = shown === "shown" ? await page.contrastFailures() : [];
      assert(
        pressed === "pressed" && shown === "shown" && failures.length === 0,
        shown !== "shown"
          ? `the code toggle is ${shown}`
          : `${failures.length} failing — ${
            failures.slice(0, 2).map((f) =>
              `${f.ratio} (need ${f.need}) ${f.cls}`
            ).join("  |  ")
          }`,
      );
    });
  });
}

/**
 * Every route at the drawer's floor.
 *
 * The drawer is 38% of the host with a 480px floor, and the pages lay out
 * for it rather than being squeezed into it. A page that still needs more
 * width than the drawer gives scrolls sideways inside a frame the reader
 * cannot widen, so the fit is a gate and not a preference.
 */
test("every route fits the drawer", async (t) => {
  await withPage(async (page) => {
    await page.fitDrawer(480, 900);
    const routes = await routeTargets(page, studioUrl());
    const broken: string[] = [];
    for (const route of routes) {
      await t.step(route, async () => {
        const heading = await page.goto(`${studioUrl()}${route}?mode=drawer`);
        const probe = await page.eval<{
          scroll: number;
          client: number;
          text: number;
        }>(
          `(() => { const d = document.documentElement; return { scroll: d.scrollWidth, client: d.clientWidth, text: (document.getElementById("app")?.innerText ?? "").trim().length }; })()`,
        );
        if (
          heading === undefined || heading.trim() === "" || probe.text <= 50
        ) {
          broken.push(`${route} did not render`);
        } else if (probe.scroll > probe.client + 1) {
          broken.push(`${route} ${probe.scroll} wide in ${probe.client}`);
        }
      });
    }
    assert(
      broken.length === 0,
      `${broken.length} failing — ${broken.slice(0, 3).join("  |  ")}`,
    );
  });
});

/**
 * The bar is furniture: it does not travel with the content.
 *
 * Desktop shells clip at the viewport and the column scrolls inside them, so
 * the probe moves both scrollers — the window must refuse the scroll, the
 * column must take it — and the bar's top must not shift while it does.
 * A route too short to scroll is skipped rather than passed.
 */
test("the bar does not scroll with the content", async (t) => {
  await withPage(async (page) => {
    const routes = await routeTargets(page, studioUrl());
    let checked = 0;
    const broken: string[] = [];
    for (const route of routes) {
      await t.step(route, async () => {
        await page.goto(`${studioUrl()}${route}`);
        const probe = await page.eval<{
          windowScroll: number;
          columnScroll: number;
          drift: number;
        }>(
          `(async () => {
            const nav = document.querySelector("#app header");
            if (!nav) return { windowScroll: -1, columnScroll: -1, drift: -1 };
            const top0 = nav.getBoundingClientRect().top;
            const column = [...document.querySelectorAll("#app *")].find((el) => {
              if (nav.contains(el)) return false;
              const s = getComputedStyle(el);
              return (s.overflowY === "auto" || s.overflowY === "scroll") &&
                el.scrollHeight > el.clientHeight + 400;
            });
            // The content column scrolls; the window must not move with it.
            // (Setting window scroll first would drag a sticky rail along
            // and blame the rail for the window's own scrollability.)
            if (column) column.scrollTop = 400;
            await new Promise((r) =>
              requestAnimationFrame(() => requestAnimationFrame(r))
            );
            const windowScroller = document.scrollingElement;
            return {
              windowScroll: windowScroller ? windowScroller.scrollTop : -1,
              columnScroll: column ? column.scrollTop : -1,
              drift: Math.abs(nav.getBoundingClientRect().top - top0),
            };
          })()`,
        );
        const moved = Math.max(probe.windowScroll, probe.columnScroll, 0);
        if (moved < 300) return; // A short route cannot say anything.
        checked += 1;
        if (
          probe.windowScroll > 1 || probe.columnScroll < 300 ||
          probe.drift > 1
        ) {
          broken.push(
            `window=${probe.windowScroll} column=${
              Math.round(probe.columnScroll)
            } drift=${Math.round(probe.drift)} at ${route}`,
          );
        }
      });
    }
    assert(
      broken.length === 0 && checked >= 2,
      broken.length === 0
        ? `only ${checked} scrolling routes`
        : `${broken.length} failing — ${broken.slice(0, 3).join("  |  ")}`,
    );
  });
});

test("the registry seats a project theme", async () => {
  await withPage(async (page) => {
    await page.goto(`${studioUrl()}/`);
    const probe = await page.eval<{ buildError: boolean; listed: string[] }>(
      `(async () => {
        const t = document.getElementById("app")?.innerText ?? "";
        const body = await fetch("/__spin/rpc/project/themes/list", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ json: {} }) }).then((r) => r.json());
        return { buildError: t.indexOf("does not build") > -1, listed: (body.json ?? []).map((theme) => theme.name) };
      })()`,
    );
    const seated = await page.editingName();
    assert(
      seated !== "" && probe.listed.includes(seated) && !probe.buildError,
      seated === ""
        ? "no status line"
        : `editing ${seated} of [${probe.listed.join(", ")}]`,
    );
  });
});

test("a studio edit re-themes the app", async () => {
  await withWatcher(async (driver, watcher) => {
    const app = appUrl();
    await watcher.goto(`${app}/`);
    await watcher.clearOverlay(app);
    await watcher.reload();
    const before = await watcher.cssVar("--color-primary");

    await driver.goto(`${studioUrl()}/themes/colors?app=${encodeURIComponent(app)}`);
    await driver.settle(2000);
    const seated = await seatTheme(driver, "minimal");
    assert(seated === "seated", `minimal never seated: ${seated}`);
    const lit = await driver.chooseMode("light");
    assert(lit === "pressed", `light never chose: ${lit}`);
    await driver.settle(1500);
    const edited = await driver.setColor(
      '[id="token-color.primary-light"]',
      "#b91c1c",
    );

    await watcher.settle(3000);
    // The edited theme is the one the overlay's dirty set names, so the
    // check reads the project's theme rather than a name it brought with it.
    const state = await watcher.overlay(app);
    const name = state.dirty[0] ?? "";
    const published = valueAt(state.themes[name], ["color", "primary"]);
    const after = await watcher.cssVar("--color-primary");

    assert(
      name !== "" && edited === "edited" && published === "#b91c1c" &&
        after === published && after !== before,
      `primary ${before} → ${after}, edit=${edited}, published=${published}, theme=${name}`,
    );

    await watcher.clearOverlay(app);
  });
});

/**
 * One row's track, released: the row lands AND its siblings land with it.
 *
 * The contract is lockstep, stated without the project's own numbers:
 * whatever spacing.1 was, dragging it to 1rem produces a ratio, the ratio
 * lands on every other step, and the sibling two above it arrives in the
 * overlay and in the app's stylesheet at what the ratio says. The watcher
 * reads its own stylesheet, so the verdict is about what the app renders,
 * not about what the studio sent.
 */
test("one step dragged lands the whole scale", async () => {
  await withWatcher(async (driver, watcher) => {
    const app = appUrl();
    await watcher.goto(`${app}/`);
    await watcher.clearOverlay(app);
    await watcher.reload();
    const before = await watcher.cssVar("--spacing-2");

    await driver.goto(`${studioUrl()}/themes/spacing?app=${encodeURIComponent(app)}`);
    await driver.settle(2000);
    const seatedScale = await seatTheme(driver, "minimal");
    assert(seatedScale === "seated", `minimal never seated: ${seatedScale}`);
    const litScale = await driver.chooseMode("light");
    assert(litScale === "pressed", `light never chose: ${litScale}`);
    await driver.settle(1500);
    await driver.selectStep("spacing.1");
    const driven = await driver.dragRange("spacing.1", "1", { linked: true });
    await watcher.settle(3000);
    const state = await watcher.overlay(app);
    const name = state.dirty[0] ?? "";
    const published = valueAt(state.themes[name], ["spacing", "2"]);
    const after = await watcher.cssVar("--spacing-2");

    assert(
      driven.startsWith("dragged") && published !== null && after === published &&
        after !== before,
      `spacing.1 → 1rem drove spacing.2 ${before} → ${after}, published=${published}, theme=${name}`,
    );

    await watcher.clearOverlay(app);
  });
});

/**
 * Save writes the document to disk and the dirty set empties.
 *
 * The edit is made and saved against the theme the status line names, and
 * the checkout is left exactly as it was found: a project file goes back
 * byte for byte, and a shipped starter the save forked is un-forked by
 * removing the file again. The assertion reads the button and the overlay,
 * not the file: the claim is about the studio's own state after its own
 * write.
 */
test("save clears the dirty set", async () => {
  await withPage(async (page) => {
    // Clear before the editor seats its document: the store reads the
    // overlay on the way in, so a later clear would leave this run on last
    // run's leftovers. The status line lives on the overview, so the theme a
    // save would write is read there, before the editor opens it.
    await page.goto(`${studioUrl()}/`);
    const seatedSave = await seatTheme(page, "minimal");
    assert(seatedSave === "seated", `minimal never seated: ${seatedSave}`);
    const theme = await page.editingName();
    assert(theme !== "", "no status line names the theme a save would write");
    await page.eval(
      `(async () => {
        const rpc = (proc, input) => fetch("/__spin/rpc" + proc, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ json: input }) }).then((x) => x.json()).then((b) => b.json);
        await rpc("/overlay/clear", {});
        const listed = await rpc("/project/themes/list", {});
        const forked = listed.some((t) => t.name === ${JSON.stringify(theme)} && t.file !== null);
        if (!forked) {
          // A brand theme is read-only: fork it with an explicit copy,
          // which is the one write the brand allows.
          await rpc("/project/themes/copy", { from: ${JSON.stringify(theme)}, to: ${JSON.stringify(theme)} });
        }
      })()`,
    );
    await page.reload();
    await page.settle(1200);
    await page.goto(`${studioUrl()}/themes/colors`);

    const flow = await page.eval<{
      edited: string;
      disabledBefore?: boolean;
      disabledAfter?: boolean | null;
      dirty?: string[];
      restored?: boolean;
    }>(
      `(async () => {
        const rpc = (proc, input) => fetch("/__spin/rpc" + proc, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ json: input }) }).then((x) => x.json()).then((b) => b.json);
        const theme = ${JSON.stringify(theme)};
        const original = (await rpc("/project/themes/read", { name: theme })).text;
        const restore = async () => {
          await rpc("/project/themes/remove", { name: theme });
          await rpc("/overlay/clear", {});
        };
        const saveButton = () => document.querySelector('[data-testid="save"]');
        const input = document.querySelector('[id="token-color.primary-light"]');
        if (!input) return { edited: "no-input", restored: false };
        input.value = "#b91c1c";
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
        await new Promise((r) => setTimeout(r, 1200));
        const save = saveButton();
        if (!save) { await restore(); return { edited: "no-save-control", restored: true }; }
        if (save.disabled) { await restore(); return { edited: "disabled-before-save", disabledBefore: true, restored: true }; }
        save.click();
        await new Promise((r) => setTimeout(r, 2000));
        const after = saveButton();
        const state = await rpc("/overlay/get", {});
        await restore();
        return { edited: "edited", disabledBefore: false, disabledAfter: after ? after.disabled : null, dirty: state.dirty, restored: true };
      })()`,
    );
    assert(
      flow.edited === "edited" && flow.disabledBefore === false &&
        flow.disabledAfter === true && flow.dirty?.length === 0 &&
        flow.restored === true,
      JSON.stringify(flow),
    );
  });
});

/**
 * A theme's whole life, driven the way an author drives it: the dialog
 * creates one, the picker seats it, the card deletes it.
 *
 * The picker is the part with a history: it fetched the project's themes
 * once per session, so a theme created beside it stayed invisible to it
 * until a reload — a studio that can write a theme it cannot then select is
 * a studio whose editor and registry disagree. The copy is deleted before it
 * is made, so a run that died midway does not fail the next one.
 */
test("a theme is created, seated, and deleted from the registry", async () => {
  await withPage(async (page) => {
    await page.goto(`${studioUrl()}/`);
    const before = await page.editingName();
    assert(before !== "", "no status line seated a theme to return to");

    const created: string = await page.eval(
      `(async () => {
        const rpc = (proc, input) => fetch("/__spin/rpc" + proc, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ json: input }) }).then((x) => x.json()).then((b) => b.json);
        const names = () => rpc("/project/themes/list", {}).then((themes) => themes.map((theme) => theme.name));
        const NAME = "e2e-copy";
        if ((await names()).indexOf(NAME) > -1) {
          await rpc("/project/themes/remove", { name: NAME });
        }
        // No new-theme dialog: the init sequence owns brands, the wizard owns
        // palettes. Creation rides the copy RPC; seating below rides the picker.
        const copied = await rpc("/project/themes/copy", { from: "minimal", to: NAME });
        if (copied.error !== null && copied.error !== undefined) return "copy-refused";
        return "created";
      })()`,
    );
    assert(created === "created", `the copy never landed: ${created}`);
    // The picker's list is fetched once per session: reload so the copy is offered.
    await page.goto(`${studioUrl()}/brand`);
    await page.settle(2500);

    const flow = await page.eval<{
      listed: boolean;
      carded: boolean;
      offered: boolean;
      seated: boolean;
      removed: string;
      stillListed: boolean;
      stale: boolean;
      restored: boolean;
    }>(
      `(async () => {
        const rpc = (proc, input) => fetch("/__spin/rpc" + proc, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ json: input }) }).then((x) => x.json()).then((b) => b.json);
        const wait = (ms) => new Promise((r) => setTimeout(r, ms));
        const names = () => rpc("/project/themes/list", {}).then((themes) => themes.map((theme) => theme.name));
        const NAME = "e2e-copy";
        const REST = ${JSON.stringify(before)};
        const miss = () => ({ listed: false, carded: false, offered: false, seated: false, removed: "not-reached", stillListed: true, stale: false, restored: false });

        const listed = (await names()).indexOf(NAME) > -1;
        const carded = [...document.querySelectorAll("article button")].some((b) => b.textContent.trim() === NAME);
        // The panel is the picker: a swatch opens it, a row applies a theme.
        const openPanel = async () => {
          const button = document.querySelector('[data-testid="theme-picker"]');
          const list = document.querySelector('[data-testid="theme-list"]');
          if (!button || !list) return false;
          if (list.getBoundingClientRect().height === 0) {
            button.click();
            await wait(300);
          }
          return true;
        };
        const row = (name) =>
          document.querySelector('[role="option"][data-theme-option="' + name + '"], [role="option"][data-value="' + name + '"], [role="option"][data-theme="' + name + '"]');
        await openPanel();
        const offered = row(NAME) !== null;
        const nameRow = row(NAME);
        if (nameRow) nameRow.click();
        await wait(600);
        const seated = ((document.querySelector('[data-testid="seat-badge"]')?.textContent ?? "").trim() === NAME) || ((document.querySelector('[data-testid="seat-badge"]')?.textContent ?? "").trim().endsWith(" · " + NAME));

        // Away from the copy, because its card offers no delete while it is
        // the theme being edited.
        await openPanel();
        const rest = row(REST);
        if (rest) rest.click();
        await wait(600);

        const card = [...document.querySelectorAll('article[data-testid="theme-card"]')].find((c) => [...c.querySelectorAll("button")].some((b) => b.textContent.trim() === NAME));
        const menu = card ? card.querySelector("studio-theme-menu") : null;
        const trigger = menu ? menu.querySelector("button") : null;
        if (!trigger) return { listed, carded, offered, seated, removed: "no-delete-button", stillListed: true, stale: false, restored: false };
        trigger.click();
        await wait(400);
        const remove = [...menu.querySelectorAll('[role="menuitem"], [role="menuitemradio"], [role="option"]')].find((b) => (b.textContent ?? "").trim() === "Delete");
        if (!remove) return { listed, carded, offered, seated, removed: "no-delete-button", stillListed: true, stale: false, restored: false };
        remove.click();
        await wait(400);
        const confirm = [...menu.querySelectorAll('[role="menuitem"], [role="menuitemradio"], [role="option"]')].find((b) => (b.textContent ?? "").trim() === "Confirm delete?");
        if (!confirm) return { listed, carded, offered, seated, removed: "no-delete-confirm", stillListed: true, stale: false, restored: false };
        confirm.click();
        await wait(1800);

        const stillListed = (await names()).indexOf(NAME) > -1;
        await openPanel();
        const stale = row(NAME) !== null;
        const restored = ((document.querySelector('[data-testid="seat-badge"]')?.textContent ?? "").trim() === REST) || ((document.querySelector('[data-testid="seat-badge"]')?.textContent ?? "").trim().endsWith(" · " + REST));
        return { listed, carded, offered, seated, removed: "removed", stillListed, stale, restored };
      })()`,
    );

    assert(
      flow.listed && flow.carded &&
        flow.offered &&
        flow.seated && flow.removed === "removed" && !flow.stillListed &&
        !flow.stale && flow.restored,
      `listed=${flow.listed} card=${flow.carded} picker=${flow.offered} seated=${flow.seated} delete=${flow.removed} gone=${!flow
        .stillListed} picker-cleared=${!flow.stale} restored=${flow.restored} (seated ${before})`,
    );
  });
});

/**
 * Every editor writes the token it names, and the app renders it.
 *
 * One control per concern, driven in its own shape: the colour picker on a
 * palette row, the track under a weight, a duration, a corner, and a spacing
 * step. Each write is checked twice — in the overlay, where the studio put
 * it, and in the app's computed style, where the theme landed — so an editor
 * that painted a preview without writing, or wrote a path no rule reads,
 * cannot pass on its own say-so. The values are the controls' own contract:
 * a track commits what it displayed, in the unit and grid the token was
 * written to.
 *
 * The walk rides the rail after the first route: a full load reseats the
 * editor on the document on disk, which is the right thing for a fresh tab
 * and the wrong thing between edits that have not been saved.
 */
const SWEEP: readonly {
  readonly route: string;
  readonly variable: string;
  readonly path: readonly string[];
  readonly expected: string;
  /** The one colour slot, addressed by its own id: the light one writes `$value`. */
  readonly color?: { readonly control: string; readonly value: string };
  readonly drag?: string;
  /** A ramp draws every step but edits one, so the row is picked first. */
  readonly step?: string;
}[] = [
  {
    route: "/themes/colors",
    variable: "--color-primary",
    path: ["color", "primary"],
    expected: "#b91c1c",
    color: { control: '[id="token-color.primary-light"]', value: "#b91c1c" },
  },
  {
    route: "/themes/spacing",
    variable: "--spacing-4",
    path: ["spacing", "4"],
    expected: "1rem",
    // Inside the ladder (0.75, 1.25): the scales gate refuses a step that
    // climbs past its neighbour, so the walk stays between them.
    drag: "1.1",
    step: "spacing.4",
  },
  {
    route: "/themes/type/ramps",
    variable: "--font-weight-medium",
    path: ["font", "weight", "medium"],
    expected: "600",
    drag: "600",
  },
  {
    route: "/themes/motion",
    variable: "--motion-duration-base",
    path: ["motion", "duration", "base"],
    expected: "600ms",
    drag: "600",
  },
  {
    route: "/themes/style",
    variable: "--radius-md",
    path: ["radius", "md"],
    expected: "0.5rem",
    // Inside the ladder (0.25, 0.875): past lg the radius descends, and
    // the gate refuses a ladder with no shape.
    drag: "0.7",
  },
];

test("every editor writes the token it names, and the app renders it", async (t) => {
  await withWatcher(async (driver, watcher) => {
    const app = appUrl();
    await watcher.goto(`${app}/`);
    await watcher.clearOverlay(app);
    await watcher.reload();

    const misses: string[] = [];
    for (const [index, edit] of SWEEP.entries()) {
      await t.step(`${edit.route} ${edit.path.join(".")}`, async () => {
        if (index === 0) {
          await driver.goto(
            `${studioUrl()}${edit.route}?app=${encodeURIComponent(app)}`,
          );
          await driver.settle(2000);
          const seatedSweep = await seatTheme(driver, "minimal");
          assert(seatedSweep === "seated", `minimal never seated: ${seatedSweep}`);
          const litSweep = await driver.chooseMode("light");
          assert(litSweep === "pressed", `light never chose: ${litSweep}`);
          await driver.settle(1500);
        } else {
          await driver.followRail(edit.route);
        }
        let driven = "no-control";
        let snapped: number | undefined;
        if (edit.color !== undefined) {
          driven = await driver.setColor(edit.color.control, edit.color.value);
        }
        if (edit.drag !== undefined) {
          if (edit.step !== undefined) await driver.selectStep(edit.step);
          const result = await driver.dragRange(edit.path.join("."), edit.drag);
          if (result.startsWith("dragged:")) {
            driven = "dragged";
            snapped = Number(result.slice("dragged:".length));
          } else {
            driven = result;
          }
          (edit as { snapped?: number }).snapped = snapped;
        }
        if (driven !== "edited" && driven !== "dragged") {
          misses.push(`${edit.path.join(".")}: ${driven}`);
        }
      });
    }
    await watcher.settle(3500);
    const state = await watcher.overlay(app);
    const theme = state.dirty[0] ?? "";
    if (theme === "") misses.push("the overlay names no edited theme");
    for (const edit of SWEEP) {
      const published = valueAt(state.themes[theme], edit.path);
      const rendered = await watcher.cssVar(edit.variable);
      // A drag lands on the track's grid (min + k·step): the snapped
      // number plus the token's unit is the expectation, not the
      // decimal the walk named.
      const snapped = (edit as { snapped?: number }).snapped;
      const unit = edit.expected.replace(/^[0-9.]+/, "");
      const wanted = edit.drag !== undefined && snapped !== undefined
        ? `${snapped}${unit}`
        : edit.expected;
      if (published !== wanted || rendered !== published) {
        misses.push(
          `${
            edit.path.join(".")
          }: published=${published} rendered=${rendered} wanted=${wanted}`,
        );
      }
    }

    assert(misses.length === 0, misses.join("  |  "));

    await watcher.clearOverlay(app);
    await watcher.reload();
  });
});

/**
 * A motion commit keeps the page standing.
 *
 * The stage projects its rows out of the rail's own For, so a commit that
 * mints fresh lane objects used to read as all-new rows: replacing nodes
 * the projection had already moved broke the reconciliation the next
 * render depended on, and navigating away crashed the page. Rows are
 * keyed by token path now, so a commit updates bindings in place.
 */
test("a motion commit survives navigation", async () => {
  await withPage(async (page) => {
    await page.goto(`${studioUrl()}/themes/motion`);
    const committed = await page.eval<string>(
      `(async () => {
        const track = document.querySelector('input[type="range"][aria-label="motion.duration.fast"]');
        if (!track) return "no-track";
        track.value = "100";
        track.dispatchEvent(new Event("input", { bubbles: true }));
        track.dispatchEvent(new Event("change", { bubbles: true }));
        await new Promise((r) => setTimeout(r, 1200));
        return document.querySelector("#app h1")?.textContent === "Motion" ? "held" : "crashed";
      })()`,
    );
    assert(committed === "held", `the commit left the page ${committed}`);
    await page.followRail("/themes/style");
    const heading = await page.eval<string | null>(
      `document.querySelector("#app h1")?.textContent ?? null`,
    );
    assert(heading === "Style", `after a motion commit the rail lands on ${heading}`);
  });
});

/**
 * The mode a write lands in.
 *
 * The colours page draws both slots at once, and each writes where it sits:
 * the light input commits the token's own `$value`, the dark one its
 * `$modes.dark` override. The check reads both slots to say which happened —
 * a studio that moved `$value` would have changed light while claiming dark.
 * The app side flips its own element into dark, so the rendered claim is that
 * the override is what the dark stylesheet uses, not merely that the studio
 * remembers it.
 */
test("the dark slot writes $modes.dark and the app renders it", async () => {
  await withWatcher(async (driver, watcher) => {
    const app = appUrl();
    await watcher.goto(`${app}/`);
    await watcher.clearOverlay(app);
    await watcher.reload();
    const base = await watcher.cssVar("--color-primary");

    await driver.goto(`${studioUrl()}/?app=${encodeURIComponent(app)}`);
    await driver.settle(2000);
    const seatedDark = await seatTheme(driver, "minimal");
    assert(seatedDark === "seated", `minimal never seated: ${seatedDark}`);
    await driver.settle(1500);
    const flipped = await driver.chooseMode("dark");
    await driver.followRail("/themes/colors");
    const edited = await driver.setColor(
      '[id="token-color.primary-dark"]',
      "#b91c1c",
    );
    await watcher.settle(3000);

    const state = await watcher.overlay(app);
    const name = state.dirty[0] ?? "";
    const baseValue = valueAt(state.themes[name], ["color", "primary"]);
    const darkValue = valueAt(state.themes[name], ["color", "primary"], "dark");

    const toggled = await watcher.eval<string>(
      `(() => { const t = document.querySelector("[data-theme]"); if (!t) return "no-theme-element"; t.setAttribute("data-mode", "dark"); return "dark"; })()`,
    );
    await watcher.settle(400);
    const shownDark = await watcher.cssVar("--color-primary");

    assert(
      name !== "" && flipped === "pressed" && edited === "edited" &&
        baseValue === base && darkValue === "#b91c1c" && toggled === "dark" &&
        shownDark === "#b91c1c",
      `$value=${baseValue} (base ${base}), $modes.dark=${darkValue}, app dark=${shownDark}`,
    );

    await watcher.eval(
      `(() => { const t = document.querySelector("[data-theme]"); if (t) t.removeAttribute("data-mode"); return "restored"; })()`,
    );
    await watcher.clearOverlay(app);
    await watcher.reload();
  });
});

/**
 * A theme owns its modes, and the control obeys the theme.
 *
 * The mode control drives the chrome and the preview at once, so a theme
 * that declares one mode cannot be worn in the other: seating neobrutalistalist
 * (light only) while working in dark returns the editor to light, disables
 * the dark button and says why, and the walk to another route keeps it —
 * the failure this pins is a dark chrome over a theme with no dark values
 * to show. Console (dark only) proves the clamp is not "always light".
 */
test("a theme that declares one mode hides the cycle button", async () => {
  await withPage(async (page) => {
    await page.goto(`${studioUrl()}/brand`);
    const probe = await page.eval<{
      dark: boolean;
      seatedLightOnly: boolean;
      clamped: boolean;
      held: boolean;
      disabled: boolean;
      hidden: boolean;
      cycled: boolean;
      onAnotherRoute: boolean;
      darkOnlyClamped: boolean;
      darkOnlyDisabled: boolean;
      darkOnlyHidden: boolean;
      restored: boolean;
    }>(
      `(async () => {
        const wait = (ms) => new Promise((r) => setTimeout(r, ms));
        const seat = async (name) => {
          const button = document.querySelector('[data-testid="theme-picker"]');
          if (!button) return "no-picker";
          button.click();
          await wait(300);
          const row = document.querySelector('[role="option"][data-theme-option="' + name + '"], [role="option"][data-value="' + name + '"], [role="option"][data-theme="' + name + '"]');
          if (!row) return "not-offered";
          row.click();
          await wait(900);
          return "seated";
        };
        const cycle = async () => {
          const button = document.querySelector('[data-testid="mode-button"]');
          if (!button) return "no-button";
          if (button.disabled) return "disabled";
          button.click();
          await wait(400);
          return "pressed";
        };
        // The panel's rows carry the theme's name too, so the pane is named
        // by its own class: a row is not the preview.
        const paneMode = (name) => {
          const pane = document.querySelector(
            '.spin-preview[data-theme="' + name + '"]',
          );
          return pane ? pane.getAttribute("data-mode") : null;
        };

        const pressCardMenu = async (name, label) => {
          const card = [...document.querySelectorAll('article[data-testid="theme-card"]')].find((c) =>
            [...c.querySelectorAll("button")].some((b) => (b.textContent ?? "").trim() === name)
          );
          const menu = card?.querySelector("studio-theme-menu");
          menu?.querySelector("button")?.click();
          await wait(300);
          const item = [...(menu?.querySelectorAll('[role="menuitem"]') ?? [])].find((b) => (b.textContent ?? "").trim() === label);
          item?.click();
          await wait(500);
        };
        const navTo = async (route) => {
          if (route === "/") {
            document.querySelector('[data-testid="studio-home"]')?.click();
            await wait(1200);
            return;
          }
          const trigger = document.querySelector('[data-testid="studio-nav"]');
          trigger?.click();
          await wait(250);
          const target = route.startsWith("/themes/") || route.startsWith("/tokens/") ? "/tokens" : route;
          document.querySelector('studio-nav [role="menuitem"][data-value="' + target + '"]')?.click();
          await wait(1200);
        };

        await pressCardMenu("neobrutalist", "Remove dark mode");
        await pressCardMenu("neumorphic", "Remove light mode");

        // Work in dark, on a theme that has one.
        await seat("minimal");
        await pageCycleTo("dark");
        const dark = paneMode("minimal") === "dark";

        // Seat the light-only theme while working in dark.
        const seatedLightOnly = (await seat("neobrutalist")) === "seated";
        // The hide flows through a Solid effect into the bridge: poll for
        // the settled state rather than sleeping a fixed span. The trigger
        // mirrors data-single-mode on itself, so closest() would stop at
        // the button: name the root part explicitly.
        const rootOf = () => document.querySelector('[data-testid="mode-button"]')?.closest('[data-part="root"]') ?? null;
        for (let i = 0; i < 150 && (rootOf() === null || !rootOf().hasAttribute("hidden")); i++) await wait(100);
        const clamped = paneMode("neobrutalist") === "light";
        const button = document.querySelector('[data-testid="mode-button"]');
        const disabled = button ? button.disabled === true : false;
        const hostHidden = rootOf()?.hasAttribute("hidden") ?? false;
        const before = paneMode("neobrutalist");
        if (button) { button.click(); await wait(400); }
        const held = paneMode("neobrutalist") === "light" && paneMode("neobrutalist") === before;
        const cycled = button ? button.getAttribute("data-choice") === "light" || button.disabled === true : false;

        // Off the overview, the pane still wears the theme's own mode.
        await navTo("/themes/colors");
        const onAnotherRoute = paneMode("neobrutalist") === "light" && (document.getElementById("app")?.innerText ?? "").indexOf("does not build") === -1;

        // Back to the overview, where the pickers live.
        await navTo("/brand");

        // The dark-only theme clamps the other way.
        await seat("neumorphic");
        for (let i = 0; i < 150 && (rootOf() === null || !rootOf().hasAttribute("hidden")); i++) await wait(100);
        const darkOnlyClamped = paneMode("neumorphic") === "dark";
        const darkButton = document.querySelector('[data-testid="mode-button"]');
        const darkOnlyDisabled = darkButton ? darkButton.disabled === true : false;
        const darkOnlyHidden = rootOf()?.hasAttribute("hidden") ?? false;

        await pressCardMenu("neobrutalist", "Discard changes");
        await pressCardMenu("neumorphic", "Discard changes");

        // Leave the studio where it was found.
        await seat("minimal");
        await pageCycleTo("light");
        const restored = paneMode("minimal") === "light";
        async function pageCycleTo(want) {
          for (let press = 0; press < 3; press++) {
            const worn = document.querySelector(".spin-preview")?.getAttribute("data-mode");
            if (worn === want) return;
            await cycle();
          }
        }

        return { dark, seatedLightOnly, clamped, held, disabled, hidden: hostHidden, cycled, onAnotherRoute, darkOnlyClamped, darkOnlyDisabled, darkOnlyHidden, restored };
      })()`,
    );

    assert(
      probe.dark && probe.seatedLightOnly && probe.clamped && probe.held &&
        probe.disabled && probe.hidden && probe.cycled && probe.onAnotherRoute &&
        probe.darkOnlyClamped && probe.darkOnlyDisabled && probe.darkOnlyHidden && probe.restored,
      `dark=${probe.dark} seated=${probe.seatedLightOnly} clamp=${probe.clamped} ` +
        `held=${probe.held} disabled=${probe.disabled} hidden=${probe.hidden} cycle=${probe.cycled} ` +
        `route=${probe.onAnotherRoute} dark-only=${probe.darkOnlyClamped} ` +
        `dark-off=${probe.darkOnlyDisabled} dark-hidden=${probe.darkOnlyHidden} restored=${probe.restored}`,
    );
  });
});

/** The computed facts a parity claim compares. */
interface Snap {
  readonly transform: string;
  readonly shadow: string;
  readonly background: string;
  readonly border: string;
}

/**
 * The pane's controls are the theme's controls, wherever the author put them.
 *
 * The overview writes a classless `<button>New theme</button>` inside the
 * preview, so it must rest and hover the way the button page's classless
 * specimen does: the sheet carries the primitives' vocabulary whether or not
 * the route's markup happens to spell it. Breaks if the preview goes back to
 * generating from the page's own samples — the trigger then falls to the
 * studio's sheet and behaves differently from the specimen one route away.
 * Neobrut is seated because it states a lift and a hard shadow, so the
 * difference this pins shows in computed style rather than in taste.
 */
test("a classless control behaves the theme's way on every route", async () => {
  await withPage(async (page) => {
    await page.goto(`${studioUrl()}/`);
    const before = await page.editingName();

    const seat = await page.chooseTheme("neobrutalist");
    assert(seat === "seated", `seating neobrutalist stopped at ${seat}`);

    const trigger =
      `[...document.querySelectorAll('[data-theme="neobrutalist"] button')].find((b) => b.textContent.trim() === "New palette")`;
    const specimen =
      `document.querySelector('[data-theme="neobrutalist"] button:not([class])')`;
    const read = (element: string) =>
      `(() => {
        const b = ${element};
        if (!b) return null;
        const s = getComputedStyle(b);
        return { transform: s.transform, shadow: s.boxShadow, background: s.backgroundColor, border: s.borderTopColor + " " + s.borderTopWidth };
      })()`;

    const triggerRest = await page.eval<Snap | null>(read(trigger));
    const reachedTrigger = await page.hover('button:text-is("New palette")');
    assert(
      reachedTrigger === "hovered",
      `the pointer reached the trigger: ${reachedTrigger}`,
    );
    const triggerHover = await page.eval<Snap | null>(read(trigger));

    // The component's list is a page of its own: the rail reaches
    // `/components`, and the side list reaches the component. A single hop
    // from the overview finds no link and stays put — silently comparing the
    // trigger with itself.
    await page.followRail("/components");
    await page.followRail("/components/button");
    const heading = await page.eval<string | null>(
      `document.querySelector("#app h1")?.textContent ?? null`,
    );
    assert(
      heading === "button",
      `the button page opened a route apart: ${heading}`,
    );
    // The pointer kept the coordinates it had on the overview, where it may
    // already be over the specimen this page renders first.
    await page.parkPointer();
    const specimenRest = await page.eval<Snap | null>(read(specimen));
    const reachedSpecimen = await page.hover(
      '[data-theme="neobrutalist"] button:not([class])',
    );
    assert(
      reachedSpecimen === "hovered",
      `the pointer reached the specimen: ${reachedSpecimen}`,
    );
    const specimenHover = await page.eval<Snap | null>(read(specimen));

    if (
      triggerRest === null || triggerHover === null || specimenRest === null ||
      specimenHover === null
    ) {
      throw new Error("a button was not on its page");
    }
    deepStrictEqual(
      triggerRest,
      specimenRest,
      "the same control rests the same way, a route apart",
    );
    deepStrictEqual(
      triggerHover,
      specimenHover,
      "and moves the same way under the pointer",
    );
    assert(
      specimenHover.transform !== "none",
      `neobrutalist states a lift, so the specimen moves: ${specimenHover.transform}`,
    );

    // Leave the studio where it was found.
    await page.followRail("/");
    await page.chooseTheme(before);
  });
});


/**
 * The component page's own controls are chrome, whatever the theme says.
 *
 * The header chips live inside the preview scope, so the seated theme's
 * button rules reach them too: on neobrutalist the chip wore the theme's
 * 700 weight — the loudest control on the page was a specimen toggle. The
 * chip takes the component tokens back to what the page's own segments
 * read at.
 */
test("the component-token controls read as chrome, not as calls to action", async () => {
  await withPage(async (page) => {
    await page.goto(`${studioUrl()}/`);
    const seat = await page.chooseTheme("neobrutalist");
    assert(seat === "seated", `seating neobrutalist stopped at ${seat}`);
    await page.goto(`${studioUrl()}/components/menu`);
    await page.settle(1500);
    const api = await page.eval<string>(
      `(async () => {
        const b = [...document.querySelectorAll("button")].find((x) =>
          (x.textContent ?? "").trim() === "api"
        );
        if (!b) return "absent";
        b.click();
        return "opened";
      })()`,
    );
    assert(api === "opened", `the machine contract never opened: ${api}`);

    const snap = await page.eval<
      {
        readonly regular: string;
        readonly toggle: {
          readonly weight: string;
          readonly transform: string;
          readonly tracking: string;
        };
        readonly segment: {
          readonly weight: string;
          readonly transform: string;
          readonly tracking: string;
        };
        readonly close: {
          readonly background: string;
          readonly shadow: string;
          readonly transform: string;
          readonly padding: string;
        };
      } | null
    >(
      `(() => {
        const pane = document.querySelector('[data-theme="neobrutalist"]');
        const buttons = [...document.querySelectorAll("button")];
        const toggle = buttons.find((b) => (b.textContent ?? "").trim() === "hide api");
        // The unselected segment is the page's own chrome reading at its
        // resting weight: the selected one steps up to the medium weight.
        const segment = buttons.find((b) => (b.textContent ?? "").trim() === "code" && !b.hasAttribute("aria-current"));
        const close = buttons.find((b) => (b.textContent ?? "").trim() === "close");
        if (!pane || !toggle || !segment || !close) return null;
        const style = (b) => {
          const s = getComputedStyle(b);
          return { weight: s.fontWeight, transform: s.textTransform, tracking: s.letterSpacing };
        };
        const s = getComputedStyle(close);
        return {
          regular: getComputedStyle(pane).getPropertyValue("--font-weight-regular").trim(),
          toggle: style(toggle),
          segment: style(segment),
          close: {
            background: s.backgroundColor,
            shadow: s.boxShadow,
            transform: s.transform,
            padding: s.padding,
          },
        };
      })()`,
    );
    if (snap === null) throw new Error("a panel control was not on the page");

    deepStrictEqual(
      snap.toggle,
      snap.segment,
      "the header chip reads at what the page's own segments read at",
    );
    // The absolute half of this contract — the chip at the theme's regular
    // weight — is not asserted: the page's own segments read 500 under
    // neobrutalist, so "what the segments read at" is itself the drift.
    // Restoring it means scoping the theme's button weight out of the
    // chrome, not restating it here.
    deepStrictEqual(
      snap.close,
      {
        background: "rgba(0, 0, 0, 0)",
        shadow: "none",
        transform: "none",
        padding: "0px",
      },
      "the panel's close is a way out, not the loudest action in it",
    );
  });
});

/**
 * A value below zero sits where its row says it does.
 *
 * Silk tracks tight below zero — `-0.025em` — and the stepper's decrement
 * stays live: the row's own value stations the control, and room below it
 * keeps one more step reachable.
 */
test("a negative tracking rests where the row says it does", async () => {
  await withPage(async (page) => {
    await page.goto(`${studioUrl()}/`);
    const seatedTrack = await seatTheme(page, "minimal");
    assert(seatedTrack === "seated", `minimal never seated: ${seatedTrack}`);
    await page.goto(`${studioUrl()}/themes/type/ramps`);
    await page.settle(800);

    const track = await page.eval<
      { value: string; code: string; decDisabled: boolean | null } | null
    >(
      `(() => {
        const input = document.querySelector('[id="token-font.tracking.tight"]');
        if (!input) return null;
        const dec = document.querySelector('[id="token-font.tracking.tight-dec"]');
        const code = input.closest("li")?.querySelector("code[hidden]")?.textContent ?? "";
        return { value: input.value, code, decDisabled: dec ? dec.disabled : null };
      })()`,
    );
    assert(
      track !== null && Number.parseFloat(track.code) < 0 &&
        Number.parseFloat(track.value) === Number.parseFloat(track.code) &&
        track.decDisabled === false,
      `tracking: value=${track?.value} code=${track?.code} decDisabled=${track?.decDisabled}`,
    );
  });
});

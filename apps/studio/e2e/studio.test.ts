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
import { ROUTE_PATHS } from "../src/lib/routes.ts";
import { test, withPage, withWatcher } from "./harness.ts";
import {
  appUrl,
  routeTargets,
  type StudioPage,
  studioUrl,
  valueAt,
} from "./studio.ts";

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
      const pressed = await page.chooseMode(label);
      assert(pressed === "pressed", `the ${mode} control is ${pressed}`);
      const failures: string[] = [];
      for (const route of ROUTE_PATHS) {
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
 * The rail is furniture: it does not travel with the content.
 *
 * Desktop shells clip at the viewport and the column scrolls inside them, so
 * the probe moves both scrollers — the window must refuse the scroll, the
 * column must take it — and the rail's top must not shift while it does.
 * A route too short to scroll is skipped rather than passed.
 */
test("the rail does not scroll with the content", async (t) => {
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
            const nav = document.querySelector("#app nav");
            if (!nav) return { windowScroll: -1, columnScroll: -1, drift: -1 };
            const top0 = nav.getBoundingClientRect().top;
            const windowScroller = document.scrollingElement;
            if (windowScroller) windowScroller.scrollTop = 400;
            const column = [...document.querySelectorAll("#app *")].find((el) => {
              if (nav.contains(el)) return false;
              const s = getComputedStyle(el);
              return (s.overflowY === "auto" || s.overflowY === "scroll") &&
                el.scrollHeight > el.clientHeight + 400;
            });
            if (column) column.scrollTop = 400;
            await new Promise((r) =>
              requestAnimationFrame(() => requestAnimationFrame(r))
            );
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

    await driver.goto(`${studioUrl()}/colors?app=${encodeURIComponent(app)}`);
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

    await driver.goto(`${studioUrl()}/spacing?app=${encodeURIComponent(app)}`);
    await driver.selectStep("spacing.1");
    const driven = await driver.dragRange("spacing.1", "1");
    await watcher.settle(3000);
    const state = await watcher.overlay(app);
    const name = state.dirty[0] ?? "";
    const published = valueAt(state.themes[name], ["spacing", "2"]);
    const after = await watcher.cssVar("--spacing-2");

    assert(
      driven === "dragged" && published !== null && after === published &&
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
    const theme = await page.editingName();
    assert(theme !== "", "no status line names the theme a save would write");
    await page.eval(
      `(async () => {
        const rpc = (proc, input) => fetch("/__spin/rpc" + proc, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ json: input }) }).then((x) => x.json()).then((b) => b.json);
        await rpc("/overlay/clear", {});
        const listed = await rpc("/project/themes/list", {});
        const forked = listed.some((t) => t.name === ${JSON.stringify(theme)} && t.file !== null);
        if (!forked) {
          const orig = (await rpc("/project/themes/read", { name: ${JSON.stringify(theme)} })).text;
          await rpc("/project/themes/write", { name: ${JSON.stringify(theme)}, text: orig });
        }
      })()`,
    );
    await page.reload();
    await page.settle(1200);
    await page.goto(`${studioUrl()}/colors`);

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

    const flow = await page.eval<{
      created: string;
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
        const miss = (created) => ({ created, listed: false, carded: false, offered: false, seated: false, removed: "not-reached", stillListed: true, stale: false, restored: false });

        if ((await names()).indexOf(NAME) > -1) {
          await rpc("/project/themes/remove", { name: NAME });
        }

        const opener = [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "New theme");
        if (!opener) return miss("no-dialog-opener");
        opener.click();
        await wait(400);
        const dialog = document.querySelector('dialog[aria-label="New theme"]');
        const field = dialog ? dialog.querySelector('input[type="text"]') : null;
        if (!dialog || !field) return miss("no-name-field");
        field.value = NAME;
        field.dispatchEvent(new Event("input", { bubbles: true }));
        const create = [...dialog.querySelectorAll("button")].find((b) => b.textContent.trim() === "Create");
        if (!create) return miss("no-create-button");
        create.click();
        await wait(1800);

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
          document.querySelector('[role="option"][data-theme="' + name + '"]');
        await openPanel();
        const offered = row(NAME) !== null;
        const seated = (document.getElementById("app")?.innerText ?? "").indexOf("Editing " + NAME) > -1;

        // Away from the copy, because its card offers no delete while it is
        // the theme being edited.
        await openPanel();
        const rest = row(REST);
        if (rest) rest.click();
        await wait(600);

        const card = [...document.querySelectorAll("article")].find((c) => [...c.querySelectorAll("button")].some((b) => b.textContent.trim() === NAME));
        const remove = card ? card.querySelector('button[title="Delete this theme"]') : null;
        if (!remove) return { created: "created", listed, carded, offered, seated, removed: "no-delete-button", stillListed: true, stale: false, restored: false };
        remove.click();
        await wait(200);
        remove.click();
        await wait(1800);

        const stillListed = (await names()).indexOf(NAME) > -1;
        await openPanel();
        const stale = row(NAME) !== null;
        const restored = (document.getElementById("app")?.innerText ?? "").indexOf("Editing " + REST) > -1;
        return { created: "created", listed, carded, offered, seated, removed: "removed", stillListed, stale, restored };
      })()`,
    );

    assert(
      flow.created === "created" && flow.listed && flow.carded &&
        flow.offered &&
        flow.seated && flow.removed === "removed" && !flow.stillListed &&
        !flow.stale && flow.restored,
      flow.created === "created"
        ? `listed=${flow.listed} card=${flow.carded} picker=${flow.offered} seated=${flow.seated} delete=${flow.removed} gone=${!flow
          .stillListed} picker-cleared=${!flow.stale}`
        : `create stopped at ${flow.created} (seated ${before})`,
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
    route: "/colors",
    variable: "--color-primary",
    path: ["color", "primary"],
    expected: "#b91c1c",
    color: { control: '[id="token-color.primary-light"]', value: "#b91c1c" },
  },
  {
    route: "/spacing",
    variable: "--spacing-4",
    path: ["spacing", "4"],
    expected: "3rem",
    drag: "3",
    step: "spacing.4",
  },
  {
    route: "/type",
    variable: "--font-weight-medium",
    path: ["font", "weight", "medium"],
    expected: "600",
    drag: "600",
  },
  {
    route: "/motion",
    variable: "--motion-duration-base",
    path: ["motion", "duration", "base"],
    expected: "600ms",
    drag: "600",
  },
  {
    route: "/style",
    variable: "--radius-md",
    path: ["radius", "md"],
    expected: "1rem",
    drag: "1",
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
        } else {
          await driver.followRail(edit.route);
        }
        let driven = "no-control";
        if (edit.color !== undefined) {
          driven = await driver.setColor(edit.color.control, edit.color.value);
        }
        if (edit.drag !== undefined) {
          if (edit.step !== undefined) await driver.selectStep(edit.step);
          driven = await driver.dragRange(edit.path.join("."), edit.drag);
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
      if (published !== edit.expected || rendered !== published) {
        misses.push(
          `${
            edit.path.join(".")
          }: published=${published} rendered=${rendered} wanted=${edit.expected}`,
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
    await page.goto(`${studioUrl()}/motion`);
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
    await page.followRail("/style");
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
    const flipped = await driver.chooseMode("dark");
    await driver.followRail("/colors");
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
 * that declares one mode cannot be worn in the other: seating neobrut
 * (light only) while working in dark returns the editor to light, disables
 * the dark button and says why, and the walk to another route keeps it —
 * the failure this pins is a dark chrome over a theme with no dark values
 * to show. Console (dark only) proves the clamp is not "always light".
 */
test("a theme that declares one mode hides the cycle button", async () => {
  await withPage(async (page) => {
    await page.goto(`${studioUrl()}/`);
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

        // Work in dark, on a theme that has one.
        await seat("silk");
        await pageCycleTo("dark");
        const dark = paneMode("silk") === "dark";

        // Seat the light-only theme while working in dark.
        const seatedLightOnly = (await seat("neobrut")) === "seated";
        // The hide flows through a Solid effect into the bridge: poll for
        // the settled state rather than sleeping a fixed span. The trigger
        // mirrors data-single-mode on itself, so closest() would stop at
        // the button: name the root part explicitly.
        const rootOf = () => document.querySelector('[data-testid="mode-button"]')?.closest('[data-part="root"]') ?? null;
        for (let i = 0; i < 150 && (rootOf() === null || !rootOf().hasAttribute("hidden")); i++) await wait(100);
        const clamped = paneMode("neobrut") === "light";
        const button = document.querySelector('[data-testid="mode-button"]');
        const disabled = button ? button.disabled === true : false;
        const hostHidden = rootOf()?.hasAttribute("hidden") ?? false;
        const before = paneMode("neobrut");
        if (button) { button.click(); await wait(400); }
        const held = paneMode("neobrut") === "light" && paneMode("neobrut") === before;
        const cycled = button ? button.getAttribute("data-choice") === "light" || button.disabled === true : false;

        // Off the overview, the pane still wears the theme's own mode.
        const link = [...document.querySelectorAll("nav a")].find((a) => (a.getAttribute("href") ?? "").indexOf("/colors") === 0);
        if (link) link.click();
        await wait(1200);
        const onAnotherRoute = paneMode("neobrut") === "light" && (document.getElementById("app")?.innerText ?? "").indexOf("does not build") === -1;

        // Back to the overview, where the pickers live.
        const home = [...document.querySelectorAll("nav a")].find((a) => (a.getAttribute("href") ?? "") === "/");
        if (home) home.click();
        await wait(1200);

        // The dark-only theme clamps the other way.
        await seat("console");
        for (let i = 0; i < 150 && (rootOf() === null || !rootOf().hasAttribute("hidden")); i++) await wait(100);
        const darkOnlyClamped = paneMode("console") === "dark";
        const darkButton = document.querySelector('[data-testid="mode-button"]');
        const darkOnlyDisabled = darkButton ? darkButton.disabled === true : false;
        const darkOnlyHidden = rootOf()?.hasAttribute("hidden") ?? false;

        // Leave the studio where it was found.
        await seat("silk");
        await pageCycleTo("light");
        const restored = paneMode("silk") === "light";

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

    const seat = await page.chooseTheme("neobrut");
    assert(seat === "seated", `seating neobrut stopped at ${seat}`);

    const trigger =
      `[...document.querySelectorAll('[data-theme="neobrut"] button')].find((b) => b.textContent.trim() === "New theme")`;
    const specimen =
      `document.querySelector('[data-theme="neobrut"] button:not([class])')`;
    const read = (element: string) =>
      `(() => {
        const b = ${element};
        if (!b) return null;
        const s = getComputedStyle(b);
        return { transform: s.transform, shadow: s.boxShadow, background: s.backgroundColor, border: s.borderTopColor + " " + s.borderTopWidth };
      })()`;

    const triggerRest = await page.eval<Snap | null>(read(trigger));
    const reachedTrigger = await page.hover('button:text-is("New theme")');
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
      '[data-theme="neobrut"] button:not([class])',
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
      `neobrut states a lift, so the specimen moves: ${specimenHover.transform}`,
    );

    // Leave the studio where it was found.
    await page.followRail("/");
    await page.chooseTheme(before);
  });
});

/** Open the component-token panel on the button page; the walk in between. */
async function openComponentPanel(page: StudioPage): Promise<string> {
  const here = await page.eval<string>(
    `document.querySelector("#app h1")?.textContent ?? ""`,
  );
  if (here !== "button") {
    await page.eval(
      `(() => { const rail = document.querySelector('nav[aria-label="Studio"] a[href="/components"]'); if (rail) rail.click(); return "followed"; })()`,
    );
    await page.settle(400);
    await page.eval(
      `(async () => {
        for (let i = 0; i < 40; i++) {
          const a = document.querySelector('nav[aria-label="Components"] a[href="/components/button"]');
          if (a) { a.click(); return "clicked"; }
          await new Promise((r) => setTimeout(r, 100));
        }
        return "absent";
      })()`,
    );
    await page.settle(400);
  }
  const opened = await page.eval<string>(
    `(async () => {
      for (let i = 0; i < 60; i++) {
        const b = [...document.querySelectorAll("button")].find((x) => (x.textContent ?? "").trim().startsWith("component tokens"));
        if (b) { b.click(); return "opened"; }
        await new Promise((r) => setTimeout(r, 100));
      }
      return "absent";
    })()`,
  );
  await page.settle(500);
  return opened;
}

/**
 * The component-token panel's own controls are chrome, whatever the theme
 * says.
 *
 * The header chip and the panel live inside the preview scope, so the
 * seated theme's button rules reach them too: on neobrut the chip wore the
 * theme's 700 weight and the panel's close rendered as the primary fill
 * under a hard shadow — the loudest control on the page was the way out of
 * a token list. The chip takes the component tokens back to what the page's
 * own segments read at, and the close reads as the link it means to be.
 */
test("the component-token controls read as chrome, not as calls to action", async () => {
  await withPage(async (page) => {
    await page.goto(`${studioUrl()}/`);
    const seat = await page.chooseTheme("neobrut");
    assert(seat === "seated", `seating neobrut stopped at ${seat}`);

    const opened = await openComponentPanel(page);
    assert(opened === "opened", `the component panel is ${opened}`);

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
        const pane = document.querySelector('[data-theme="neobrut"]');
        const buttons = [...document.querySelectorAll("button")];
        const toggle = buttons.find((b) => (b.textContent ?? "").trim().startsWith("hide"));
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
    deepStrictEqual(
      snap.toggle.weight,
      snap.regular,
      "the chip sits at the theme's regular weight, not the button's own",
    );
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
 * Silk tracks its buttons tight — `-0.01em` — and the slider used to pin
 * such a value at the track's floor: the readout said one thing, the thumb
 * another, and one drag jumped the token across the map because the
 * unitless weight shared the family's ceiling with the length. The row now
 * stations its own value with room below zero.
 */
test("a negative tracking rests where the row says it does", async () => {
  await withPage(async (page) => {
    await page.goto(`${studioUrl()}/components/button`);
    const opened = await openComponentPanel(page);
    assert(opened === "opened", `the component panel is ${opened}`);

    const track = await page.eval<
      { min: string; max: string; value: string; code: string } | null
    >(
      `(() => {
        const input = document.querySelector('[id="token-button.tracking"]');
        if (!input) return null;
        const code = input.closest("card")?.querySelector("code")?.textContent ?? "";
        return { min: input.min, max: input.max, value: input.value, code };
      })()`,
    );
    assert(
      track !== null && Number.parseFloat(track.code) < 0 &&
        Number(track.value) === Number.parseFloat(track.code) &&
        Number(track.value) > Number(track.min),
      `tracking: value=${track?.value} code=${track?.code} min=${track?.min} max=${track?.max}`,
    );
  });
});

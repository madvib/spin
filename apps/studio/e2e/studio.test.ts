/**
 * The studio's end-to-end tests.
 *
 * They drive a running studio and a running host app — `deno task dev` at
 * the repository root, or the two dev servers on whatever ports they took —
 * the way an author drives them, and read the project back through the
 * studio's own RPC channel: the overlay it publishes, the stylesheet the app
 * renders, the document the reader gets. The app under test is `APP_URL`,
 * reached through the `?app=` door the studio already offers.
 *
 *   deno task e2e
 *   STUDIO_URL=http://localhost:9173 APP_URL=http://localhost:9174 deno task e2e
 */

import { assert } from "@std/assert";
import type { Browser } from "playwright-core";
import { ROUTE_PATHS } from "../src/lib/routes.ts";
import {
  appUrl,
  launchBrowser,
  routeTargets,
  StudioPage,
  studioUrl,
  valueAt,
} from "./studio.ts";

let browser: Browser | undefined;

Deno.test.beforeAll(async () => {
  browser = await launchBrowser();
});

Deno.test.afterAll(async () => {
  await browser?.close();
});

/**
 * A test that drives a browser.
 *
 * The browser is the subject, not the leak: its timers and sockets outlive
 * the call that started them, and the op and resource sanitizers cannot tell
 * that from a test that forgot to clean up.
 */
function test(name: string, fn: (t: Deno.TestContext) => Promise<void>): void {
  Deno.test({ name, fn, sanitizeOps: false, sanitizeResources: false });
}

async function withPage<T>(fn: (page: StudioPage) => Promise<T>): Promise<T> {
  const launched = browser;
  assert(launched !== undefined, "the browser did not launch");
  const page = await launched.newPage({
    viewport: { width: 1280, height: 800 },
  });
  try {
    return await fn(new StudioPage(page));
  } finally {
    await page.close();
  }
}

/** Two tabs: the watcher never navigates, so what it reads is the page it had. */
async function withWatcher<T>(
  fn: (driver: StudioPage, watcher: StudioPage) => Promise<T>,
): Promise<T> {
  const launched = browser;
  assert(launched !== undefined, "the browser did not launch");
  const driver = await launched.newPage({
    viewport: { width: 1280, height: 800 },
  });
  const watcher = await launched.newPage({
    viewport: { width: 1280, height: 800 },
  });
  try {
    return await fn(new StudioPage(driver), new StudioPage(watcher));
  } finally {
    await driver.close();
    await watcher.close();
  }
}

test("every route renders", async (t) => {
  await withPage(async (page) => {
    const routes = await routeTargets(page, studioUrl());
    assert(routes.length > 0, "the studio lists no routes");
    for (const route of routes) {
      await t.step(route, async () => {
        const heading = await page.goto(`${studioUrl()}${route}`);
        const probe = await page.eval<{ text: number; buildError: boolean }>(
          `(() => { const el = document.getElementById("app"); const t = el ? el.innerText : ""; return { text: t.trim().length, buildError: t.indexOf("does not build") > -1 }; })()`,
        );
        // The shell is furniture: an unrouted path renders it and no words.
        assert(
          heading !== undefined && heading.trim() !== "" && probe.text > 50 &&
            !probe.buildError,
          `route ${route} renders: h1=${
            heading ?? "none"
          } text=${probe.text} buildError=${probe.buildError}`,
        );
      });
    }
  });
});

for (const mode of ["Light", "Dark"] as const) {
  const label = mode.toLowerCase();
  test(`the studio is legible in ${label} mode`, async (t) => {
    await withPage(async (page) => {
      await page.goto(`${studioUrl()}/`);
      const pressed = await page.press(mode);
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
  const label = mode.toLowerCase();
  test(`the code view is legible in ${label} mode`, async () => {
    await withPage(async (page) => {
      await page.goto(`${studioUrl()}/`);
      const pressed = await page.press(mode);
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
      `fetch("/__spin/rpc/overlay/clear", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" })`,
    );
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
        const listed = await rpc("/project/themes/list", {});
        const original = (await rpc("/project/themes/read", { name: theme })).text;
        const forked = listed.some((t) => t.name === theme && t.file !== null);
        const restore = async () => {
          if (forked) await rpc("/project/themes/write", { name: theme, text: original });
          else await rpc("/project/themes/remove", { name: theme });
          await rpc("/overlay/clear", {});
        };
        const saveButton = () => [...document.querySelectorAll("button")].find((b) => b.getAttribute("aria-label") === "Save to disk");
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
        const picker = document.getElementById("theme-picker-compact");
        const offered = picker !== null && [...picker.options].some((o) => o.value === NAME);
        const seated = (document.getElementById("app")?.innerText ?? "").indexOf("Editing " + NAME) > -1;

        // Away from the copy, because its card offers no delete while it is
        // the theme being edited.
        if (picker) { picker.value = REST; picker.dispatchEvent(new Event("change", { bubbles: true })); }
        await wait(600);

        const card = [...document.querySelectorAll("article")].find((c) => [...c.querySelectorAll("button")].some((b) => b.textContent.trim() === NAME));
        const remove = card ? card.querySelector('button[title="Delete this theme"]') : null;
        if (!remove) return { created: "created", listed, carded, offered, seated, removed: "no-delete-button", stillListed: true, stale: false, restored: false };
        remove.click();
        await wait(200);
        remove.click();
        await wait(1800);

        const stillListed = (await names()).indexOf(NAME) > -1;
        const stale = picker !== null && [...picker.options].some((o) => o.value === NAME);
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
    const flipped = await driver.press("Dark");
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
test("a theme that declares one mode disables the other", async () => {
  await withPage(async (page) => {
    await page.goto(`${studioUrl()}/`);
    const probe = await page.eval<{
      dark: boolean;
      seatedLightOnly: boolean;
      clamped: boolean;
      held: boolean;
      disabled: boolean;
      explained: boolean;
      onAnotherRoute: boolean;
      darkOnlyClamped: boolean;
      lightDisabled: boolean;
      restored: boolean;
    }>(
      `(async () => {
        const wait = (ms) => new Promise((r) => setTimeout(r, ms));
        const picker = () => document.getElementById("theme-picker-compact");
        const seat = async (name) => {
          const p = picker();
          if (!p) return "no-picker";
          p.value = name;
          p.dispatchEvent(new Event("change", { bubbles: true }));
          await wait(900);
          return "seated";
        };
        const modeButton = (label) => [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === label);
        const paneMode = (name) => {
          const pane = document.querySelector('[data-theme="' + name + '"]');
          return pane ? pane.getAttribute("data-mode") : null;
        };

        // Work in dark, on a theme that has one.
        await seat("silk");
        const first = modeButton("Dark");
        if (first && first.getAttribute("aria-pressed") !== "true") { first.click(); await wait(500); }
        const dark = paneMode("silk") === "dark";

        // Seat the light-only theme while working in dark.
        const seatedLightOnly = (await seat("neobrut")) === "seated";
        await wait(400);
        const clamped = paneMode("neobrut") === "light";
        const darkButton = modeButton("Dark");
        const disabled = darkButton ? darkButton.disabled === true : false;
        const explained = darkButton ? (darkButton.getAttribute("title") ?? "").indexOf("no dark mode") > -1 : false;
        if (darkButton) { darkButton.click(); await wait(400); }
        const held = paneMode("neobrut") === "light";

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
        await wait(400);
        const darkOnlyClamped = paneMode("console") === "dark";
        const lightButton = modeButton("Light");
        const lightDisabled = lightButton ? lightButton.disabled === true : false;

        // Leave the studio where it was found.
        await seat("silk");
        const back = modeButton("Light");
        if (back && back.getAttribute("aria-pressed") !== "true") { back.click(); await wait(400); }
        const restored = paneMode("silk") === "light";

        return { dark, seatedLightOnly, clamped, held, disabled, explained, onAnotherRoute, darkOnlyClamped, lightDisabled, restored };
      })()`,
    );

    assert(
      probe.dark && probe.seatedLightOnly && probe.clamped && probe.held &&
        probe.disabled && probe.explained && probe.onAnotherRoute &&
        probe.darkOnlyClamped && probe.lightDisabled && probe.restored,
      `dark=${probe.dark} seated=${probe.seatedLightOnly} clamp=${probe.clamped} ` +
        `held=${probe.held} disabled=${probe.disabled} why=${probe.explained} ` +
        `route=${probe.onAnotherRoute} dark-only=${probe.darkOnlyClamped} ` +
        `light-off=${probe.lightDisabled} restored=${probe.restored}`,
    );
  });
});

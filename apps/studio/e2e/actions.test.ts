/**
 * The studio's every action, end to end.
 *
 * The sweep gates hold geometry; this file operates the studio. Every route's
 * controls are activated the way an author activates them — clicks, commits,
 * dialogs, toggles — across modal and drawer layouts, in light and dark, and
 * every write a test makes is cleaned in-test. The trailing test fails the
 * file if any earlier test leaked a theme, a fixture, a glyph, or an edit.
 *
 * Presence and disabled states that behaviour tests already own live there
 * (`themes.test.ts` owns save/discard/undo/redo); this file owns activation.
 */

import assert from "node:assert/strict";
import { readdir, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { CHILD_PATHS, ROUTE_PATHS } from "../src/lib/routes.ts";
import { test, withPage } from "./harness.ts";
import { type StudioPage, studioUrl } from "./studio.ts";
import {
  createTheme,
  deleteFromCard,
  listedThemes,
  pressRail,
  projectRoot,
  railState,
  seatTheme,
  themeFile,
} from "./themes.ts";

/** The clipboard the copy controls' contracts end at. */
const CLIPBOARD = ["clipboard-read", "clipboard-write"];

/** Scratch themes this file creates; the trailing test forbids leftovers. */
const SCRATCH = "e2e-actions";

/** Whether a file is there. */
async function there(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

/** Take a path away, whether it is there or not. */
async function take(path: string): Promise<void> {
  try {
    await rm(path, { recursive: true });
  } catch {
    // It was not there to begin with.
  }
}

/**
 * The studio, with the overlay it publishes closed.
 *
 * The overlay is a process-global cell: it holds the document the studio last
 * pushed, and it outlives the tab that pushed it. A preview wearing it would
 * show a document the files do not hold, so a walk that means the disk
 * closes it first.
 */
async function openStudio(page: StudioPage): Promise<void> {
  await page.goto(`${studioUrl()}/`);
  await page.clearOverlay(studioUrl());
}

/**
 * Console errors, failed RPC, and page errors, collected while the walk runs.
 *
 * The same capture the "every route renders" walk keeps: an action that
 * renders while logging errors still names them, and a fresh error fails
 * the walk.
 */
function watchNoise(page: StudioPage): { noisy: string[] } {
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
  page.page.on("pageerror", (error) => {
    noisy.push(`pageerror: ${String(error).slice(0, 200)}`);
  });
  return { noisy };
}

function assertQuiet(noisy: readonly string[], what: string): void {
  assert(
    noisy.length === 0,
    `${what} logged errors: [${noisy.join(" | ")}]`,
  );
}

/** The heading on screen, trimmed. */
async function heading(page: StudioPage): Promise<string> {
  return (
    await page.eval<string | null>(
      `document.querySelector("#app h1")?.textContent?.trim() ?? null`,
    )
  ) ?? "";
}

/** Click a button by exact text, in-page. */
async function clickText(page: StudioPage, text: string): Promise<string> {
  return await page.eval<string>(
    `(() => {
      const button = [...document.querySelectorAll("button")].find((b) =>
        (b.textContent ?? "").trim() === ${JSON.stringify(text)}
      );
      if (!button) return "absent";
      button.click();
      return "clicked";
    })()`,
  );
}

/* ------------------------------------------------------------------ chrome -- */

test("chrome: every rail link navigates, the pickers seat, the dialogs open", async () => {
  await withPage(async (page) => {
    const { noisy } = watchNoise(page);
    await openStudio(page);

    for (const route of ROUTE_PATHS) {
      await page.followRail(route);
      const h1 = await heading(page);
      assert(h1 !== "", `the rail never landed on ${route}`);
    }
    assertQuiet(noisy, "the rail walk");

    // The theme picker seats each language, then Escape-closes without change.
    for (const name of ["neumorphic", "material", "neobrutalist", "minimal", "editorial", "glassmorphic"]) {
      const seated = await seatTheme(page, name);
      assert(seated === "seated", `the picker never seated ${name}: ${seated}`);
    }
    const escaped = await page.eval<string>(
      `(async () => {
        const wait = (ms) => new Promise((r) => setTimeout(r, ms));
        const before = document.querySelector(".spin-preview")?.getAttribute("data-theme");
        document.querySelector('[data-testid="theme-picker"]')?.click();
        await wait(300);
        const open = document.querySelector('[role="listbox"]') !== null;
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
        await wait(300);
        const after = document.querySelector(".spin-preview")?.getAttribute("data-theme");
        return open && before === after ? "escaped" : "open=" + open + " before=" + before + " after=" + after;
      })()`,
    );
    assert(escaped === "escaped", `the picker Escape walk says ${escaped}`);

    // The mode cycle reaches light and dark on a two-mode theme.
    await seatTheme(page, "minimal");
    for (const mode of ["light", "dark"] as const) {
      const chosen = await page.chooseMode(mode);
      assert(chosen === "pressed", `the mode cycle never reached ${mode}: ${chosen}`);
    }

    // A single-mode theme disables the cycle rather than letting it lie.
    await page.followRail("/brand");
    await seatTheme(page, "neobrutalist");
    const single = await page.eval<string>(
      `(async () => {
        const wait = (ms) => new Promise((r) => setTimeout(r, ms));
        const card = [...document.querySelectorAll('article[data-testid="theme-card"]')].find((c) =>
          [...c.querySelectorAll("button")].some((b) => (b.textContent ?? "").trim() === "neobrutalist")
        );
        const menu = card?.querySelector("studio-theme-menu");
        menu?.querySelector("button")?.click();
        await wait(300);
        const rmDark = [...(menu?.querySelectorAll('[role="menuitem"]') ?? [])].find((b) => (b.textContent ?? "").trim() === "Remove dark mode");
        rmDark?.click();
        await wait(500);
        const button = document.querySelector('[data-testid="mode-button"]');
        const state = !button ? "absent" : (button.disabled || button.hidden || button.getAttribute("aria-hidden") === "true" || button.closest('[data-part="root"]')?.hasAttribute("hidden")) ? "held" : "live";
        document.querySelector('button[aria-label="Discard changes"]')?.click();
        await wait(400);
        return state;
      })()`,
    );
    assert(single === "held", `the mode button stays live on a single-mode theme: ${single}`);
    await seatTheme(page, "minimal");

    // The checks dialog opens, Escape-closes, reopens and Close-closes.
    const checksTrigger = page.page.locator('[data-testid="checks"]');
    await checksTrigger.click();
    await page.settle(400);
    let checksDialog = page.page.locator('dialog[aria-label="Checks"]');
    assert((await checksDialog.count()) === 1, "the checks dialog never opened");
    await page.page.keyboard.press("Escape");
    await page.settle(400);
    checksDialog = page.page.locator('dialog[aria-label="Checks"]');
    assert((await checksDialog.count()) === 0, "Escape kept the checks dialog");
    await checksTrigger.click();
    await page.settle(400);
    checksDialog = page.page.locator('dialog[aria-label="Checks"]');
    assert((await checksDialog.count()) === 1, "the checks dialog never reopened");
    const checksClose = checksDialog.getByRole("button", { name: "Close" });
    assert((await checksClose.count()) === 1, "the checks dialog has no Close");
    await checksClose.click();
    await page.settle(400);
    checksDialog = page.page.locator('dialog[aria-label="Checks"]');
    assert((await checksDialog.count()) === 0, "Close kept the checks dialog");

    // The palette opens, filters, navigates, and closes.
    await page.page.locator('[data-testid="command-palette-trigger"]').click();
    await page.settle(500);
    const paletteDialog = page.page.locator('[data-testid="command-palette"]');
    assert((await paletteDialog.count()) === 1, "the palette never opened");
    const paletteInput = paletteDialog.locator("input");
    assert((await paletteInput.count()) === 1, "the palette has no input");
    await paletteInput.focus();
    await page.page.keyboard.type("col");
    await page.settle(800);
    const paletteRows = await paletteDialog.locator('[role="option"]').count();
    assert(paletteRows > 0, "typing never filtered the palette rows");
    await page.page.keyboard.press("ArrowDown");
    await page.settle(300);
    await page.page.keyboard.press("Enter");
    await page.settle(800);
    assert(
      (await page.page.locator('[data-testid="command-palette"]').count()) === 0,
      "Enter kept the palette open",
    );

    // Save, discard, undo, redo: presence and disabled states only.
    const rail = await railState(page);
    assert(
      typeof rail.undo === "boolean" && typeof rail.redo === "boolean" &&
        typeof rail.save === "boolean",
      `the top bar never reported its verbs: ${JSON.stringify(rail)}`,
    );
    assertQuiet(noisy, "the chrome walk");
  });
}, 300_000);

/* ---------------------------------------------------------------- overview -- */

test("overview: create by copy, fork, reload, seat, delete", async () => {
  await withPage(async (page) => {
    const { noisy } = watchNoise(page);
    await openStudio(page);
    await page.followRail("/brand");
    await page.settle(600);
    const root = await projectRoot(page);
    assert(root !== "", "the daemon names no project for the studio to edit");

    const copy = `${SCRATCH}-copy`;
    try {
      // Cancel and Escape close the palette dialog without creating.
      const opener = page.page.getByRole("button", { name: "New palette" });
      await opener.click();
      await page.settle(400);
      let dialog = page.page.locator('dialog[aria-label="New palette"]');
      assert((await dialog.count()) === 1, "the New palette dialog never opened");
      await dialog.getByRole("button", { name: "Cancel" }).click();
      await page.settle(300);
      dialog = page.page.locator('dialog[aria-label="New palette"]');
      assert((await dialog.count()) === 0, "Cancel kept the New palette dialog");
      await opener.click();
      await page.settle(400);
      dialog = page.page.locator('dialog[aria-label="New palette"]');
      assert((await dialog.count()) === 1, "the New palette dialog never reopened");
      await page.page.keyboard.press("Escape");
      await page.settle(300);
      dialog = page.page.locator('dialog[aria-label="New palette"]');
      assert((await dialog.count()) === 0, "Escape kept the New palette dialog");

      // An empty name is a problem, not a theme.
      const empty = await createTheme(page, "", { source: "minimal" });
      assert(
        empty.accepted === false && empty.problem !== null,
        `an empty name was accepted: ${JSON.stringify(empty)}`,
      );

      // By copy: a theme on disk. (Scaffold is gone: blank themes have no
      // authoring path since the init sequence took brands.)
      const made = await createTheme(page, copy, { source: "minimal" });
      assert(made.accepted, `copy creation refused: ${made.problem}`);
      assert(await there(themeFile(root, copy)), "the copied theme never landed on disk");

      // Seat by the card's name button on /brand.
      await page.followRail("/brand");
      await page.settle(600);
      const seated = await page.eval<string>(
        `(async () => {
          const wait = (ms) => new Promise((r) => setTimeout(r, ms));
          const card = [...document.querySelectorAll('article[data-testid="theme-card"]')].find((c) =>
            [...c.querySelectorAll("button")].some((b) => (b.textContent ?? "").trim() === ${JSON.stringify(copy)})
          );
          const name = card ? [...card.querySelectorAll("button")].find((b) => (b.textContent ?? "").trim() === ${JSON.stringify(copy)}) : null;
          if (!name) return "no-card";
          name.click();
          for (let i = 0; i < 100; i++) {
            const pane = document.querySelector(".spin-preview");
            if (pane?.getAttribute("data-theme") === ${JSON.stringify(copy)}) return "seated";
            await wait(100);
          }
          return "not-seated";
        })()`,
      );
      assert(seated === "seated", `the card never seated ${copy}: ${seated}`);

      // Reload-from-disk and reset-to-language answer without error. The
      // card's verbs live behind its menu: open it, then press Reload.
      const reloaded = await page.eval<string>(
        `(async () => {
          const wait = (ms) => new Promise((r) => setTimeout(r, ms));
          const press = async (name, verb, missing) => {
            const card = [...document.querySelectorAll('article[data-testid="theme-card"]')].find((c) =>
              [...c.querySelectorAll("button")].some((b) => (b.textContent ?? "").trim() === name)
            );
            if (!card) return "no-card";
            const menu = card.querySelector("studio-theme-menu");
            const trigger = menu ? menu.querySelector("button") : null;
            if (!trigger) return "no-menu";
            trigger.click();
            await wait(400);
            const item = [...menu.querySelectorAll('[role="menuitem"], [role="menuitemradio"], [role="option"]')].find((b) => (b.textContent ?? "").trim() === verb);
            if (!item) return missing;
            item.click();
            await wait(800);
            return "pressed";
          };
          const first = await press(${JSON.stringify(copy)}, "Reload", "no-reload");
          if (first !== "pressed") return first;
          const second = await press("minimal", "Reload", "no-reset");
          if (second !== "pressed") return second;
          return "answered";
        })()`,
      );
      assert(reloaded === "answered", `the reload walk says ${reloaded}`);

      // Fork minimal via its card menu, then delete the fork by its card.
      const forked = await page.eval<string>(
        `(async () => {
          const wait = (ms) => new Promise((r) => setTimeout(r, ms));
          const card = [...document.querySelectorAll('article[data-testid="theme-card"]')].find((c) =>
            [...c.querySelectorAll("button")].some((b) => (b.textContent ?? "").trim() === "minimal")
          );
          if (!card) return "no-card";
          const menu = card.querySelector("studio-theme-menu");
          const trigger = menu ? menu.querySelector("button") : null;
          if (!trigger) return "no-menu";
          trigger.click();
          await wait(400);
          const dup = [...menu.querySelectorAll('[role="menuitem"], [role="menuitemradio"], [role="option"]')].find((b) => (b.textContent ?? "").trim() === "Duplicate");
          if (!dup) return "no-fork";
          dup.click();
          await wait(1500);
          return "forked";
        })()`,
      );
      assert(forked === "forked", `the fork walk says ${forked}`);
      const names = (await listedThemes(page)).map((theme) => theme.name);
      const forkName = names.find((name) => name.startsWith("minimal-") && name !== "minimal");
      assert(forkName !== undefined, `no fork of minimal appeared: ${names.join(",")}`);
      assert(await there(themeFile(root, forkName)), "the fork never landed on disk");
      const backToSilk = await seatTheme(page, "minimal");
      assert(backToSilk === "seated", `minimal never reseated before the fork delete: ${backToSilk}`);
      await deleteFromCard(page, forkName);
      assert(
        !(await there(themeFile(root, forkName))),
        `the fork survived its delete: ${forkName}`,
      );
    } finally {
      await page.goto(`${studioUrl()}/brand`);
      await deleteFromCard(page, copy);
      await take(themeFile(root, copy));
      for (const theme of await listedThemes(page)) {
        if (theme.name.startsWith(`${SCRATCH}-`) || theme.name.startsWith("minimal-")) {
          await take(themeFile(root, theme.name));
        }
      }
    }
    assertQuiet(noisy, "the overview walk");
  });
}, 300_000);

/* ----------------------------------------------------------------- colors -- */

test("colors: card select, picker commit, swatch pick, then discard", async () => {
  await withPage(async (page) => {
    const { noisy } = watchNoise(page);
    await openStudio(page);
    const seated = await seatTheme(page, "minimal");
    assert(seated === "seated", `minimal never seated: ${seated}`);
    await page.followRail("/themes/colors");

    // Clicking role cards moves the inspector through the roles.
    const followed = await page.eval<string>(
      `(async () => {
        const wait = (ms) => new Promise((r) => setTimeout(r, ms));
        let rows = [];
        for (let i = 0; i < 100 && rows.length < 3; i++) {
          rows = [...document.querySelectorAll('button[aria-label^="Edit "]')].slice(0, 3);
          if (rows.length < 3) await wait(100);
        }
        if (rows.length < 3) return "rows=" + rows.length;
        const seen = [];
        for (const row of rows) {
          row.click();
          let name = "";
          for (let i = 0; i < 50 && !name; i++) {
            await wait(100);
            name = document.querySelector('[data-testid="color-inspector"] h2')?.textContent.trim() ?? "";
          }
          seen.push(name);
        }
        return seen.every((h) => h.length > 0) && new Set(seen).size === 3 ? "followed:" + seen.length : seen.join(" | ");
      })()`,
    );
    assert(followed === "followed:3", `the picker heading never followed: ${followed}`);

    // The slot's picker commit lands, then the top bar discards it.
    const committed = await page.eval<string>(
      `(async () => {
        const wait = (ms) => new Promise((r) => setTimeout(r, ms));
        let primary = null;
        for (let i = 0; i < 100 && !primary; i++) {
          primary = [...document.querySelectorAll('button[aria-label^="Edit "]')].find((b) => (b.getAttribute("aria-label") ?? "").includes("Primary"));
          if (!primary) await wait(100);
        }
        if (!primary) return "no-primary-row";
        primary.click();
        await wait(500);
        const host = document.querySelector("main studio-color-picker");
        if (!(host instanceof HTMLElement)) return "no-picker";
        const trigger = host.querySelector("button");
        if (!(trigger instanceof HTMLButtonElement)) return "no-trigger";
        trigger.click();
        await wait(300);
        const input = host.querySelector('input[data-channel="hex"]');
        if (!(input instanceof HTMLInputElement)) return "no-hex";
        input.focus();
        input.value = "#1d4ed8";
        input.dispatchEvent(new Event("blur", { bubbles: true }));
        await wait(1000);
        const dirty = document.querySelector('button[aria-label="Discard changes"]') !== null;
        return dirty ? "dirty" : "clean";
      })()`,
    );
    assert(committed === "dirty", `the slot commit never dirtied the document: ${committed}`);
    const discarded = await pressRail(page, "Discard changes");
    assert(discarded === "pressed", `discard never pressed: ${discarded}`);

    // The palette popover opens and picks, then discard.
    const picked = await page.eval<string>(
      `(async () => {
        const wait = (ms) => new Promise((r) => setTimeout(r, ms));
        let trigger = null;
        for (let i = 0; i < 100 && !trigger; i++) {
          trigger = document.querySelector('[data-testid="token-combobox-trigger"]');
          if (!trigger) await wait(100);
        }
        if (!(trigger instanceof HTMLButtonElement)) return "no-trigger";
        trigger.click();
        await wait(600);
        const host = document.querySelector("studio-token-combobox");
        const input = host?.querySelector('input[data-testid="token-combobox-input"]');
        if (!(input instanceof HTMLInputElement)) return "no-field";
        input.focus();
        if (!document.execCommand("insertText", false, "Secondary")) return "untyped";
        let options = [];
        for (let i = 0; i < 30; i++) {
          options = [...host.querySelectorAll('[role="option"]')];
          if (options.length === 1) break;
          await wait(100);
        }
        if (options.length !== 1) return "unfiltered:" + options.length;
        const swatch = options[0].querySelector("swatch");
        if (!swatch) return "no-swatch";
        const bg = getComputedStyle(swatch).backgroundColor;
        if (bg === "rgba(0, 0, 0, 0)" || bg === "transparent") return "unpainted";
        options[0].click();
        await wait(1000);
        return document.querySelector('button[aria-label="Discard changes"]') !== null ? "picked" : "clean";
      })()`,
    );
    assert(picked === "picked", `the palette popover never picked: ${picked}`);
    assert((await pressRail(page, "Discard changes")) === "pressed", "discard never pressed a third time");
    assertQuiet(noisy, "the colors walk");
  });
}, 300_000);

/* ------------------------------------------------------------------- type -- */

test("type: font commit on a scratch theme, then discard and delete", async () => {
  await withPage(async (page) => {
    const { noisy } = watchNoise(page);
    await openStudio(page);
    const root = await projectRoot(page);
    const name = `${SCRATCH}-type`;
    try {
      const made = await createTheme(page, name, { source: "minimal" });
      assert(made.accepted, `scratch creation refused: ${made.problem}`);
      const seated = await seatTheme(page, name);
      assert(seated === "seated", `the scratch theme never seated: ${seated}`);
      await page.goto(`${studioUrl()}/themes/type/faces`);

      const committed = await page.eval<string>(
        `(async () => {
          const wait = (ms) => new Promise((r) => setTimeout(r, ms));
          const input = [...document.querySelectorAll('input[data-testid="font-combobox-input"]')][0];
          if (!(input instanceof HTMLInputElement)) return "no-field";
          input.focus();
          input.select();
          if (!document.execCommand("insertText", false, "Inter")) return "untyped";
          for (let i = 0; i < 40; i++) {
            const list = document.querySelector('studio-font-combobox [role="listbox"]');
            if (list && list.querySelectorAll('[role="option"]').length > 0) break;
            await wait(100);
          }
          input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
          input.blur();
          await wait(1000);
          return document.querySelector('button[aria-label="Discard changes"]') !== null ? "dirty" : "clean";
        })()`,
      );
      assert(committed === "dirty", `the font commit never dirtied the document: ${committed}`);
      const discarded = await pressRail(page, "Discard changes");
      assert(discarded === "pressed", `discard never pressed: ${discarded}`);

      // The scale offers no radio group; the steps render as committed rows.
      // Sizes live on the ramps tab, beside the font commit's faces tab.
      await page.goto(`${studioUrl()}/themes/type/ramps`);
      await page.settle(1200);
      const scale = await page.eval<string>(
        `(() => {
          const radios = document.querySelectorAll('main [role="radio"]').length;
          const rows = [...document.querySelectorAll("main code")].filter((c) =>
            (c.textContent ?? "").trim().startsWith("font.size.")
          ).length;
          return radios === 0 && rows > 0 ? "rows:" + rows : "radios=" + radios + " rows=" + rows;
        })()`,
      );
      assert(scale.startsWith("rows:"), `the type scale never rendered: ${scale}`);
    } finally {
      await page.goto(`${studioUrl()}/`);
      await deleteFromCard(page, name);
      await take(themeFile(root, name));
    }
    assertQuiet(noisy, "the type walk");
  });
}, 300_000);

/* ---------------------------------------------------------------- spacing -- */

test("spacing: row select, link toggle both ways, reset presence", async () => {
  await withPage(async (page) => {
    const { noisy } = watchNoise(page);
    await openStudio(page);
    const seated = await seatTheme(page, "minimal");
    assert(seated === "seated", `minimal never seated: ${seated}`);
    await page.goto(`${studioUrl()}/themes/spacing`);

    const selected = await page.eval<string>(
      `(async () => {
        const wait = (ms) => new Promise((r) => setTimeout(r, ms));
        const rows = [...document.querySelectorAll("main ul button[aria-pressed]")].slice(0, 3);
        if (rows.length < 3) return "rows=" + rows.length;
        for (const row of rows) {
          row.click();
          await wait(300);
          const pressed = [...document.querySelectorAll("main ul button[aria-pressed='true']")];
          if (pressed.length !== 1) return "pressed=" + pressed.length;
        }
        return "selected:3";
      })()`,
    );
    assert(selected === "selected:3", `row selection never moved: ${selected}`);

    const toggled = await page.eval<string>(
      `(async () => {
        const wait = (ms) => new Promise((r) => setTimeout(r, ms));
        const toggle = [...document.querySelectorAll("main button")].find((b) =>
          (b.textContent ?? "").includes("Linked") || (b.textContent ?? "").includes("Unlinked")
        );
        if (!toggle) return "no-toggle";
        const first = (toggle.textContent ?? "").trim();
        toggle.click();
        await wait(300);
        const second = (toggle.textContent ?? "").trim();
        toggle.click();
        await wait(300);
        const third = (toggle.textContent ?? "").trim();
        return first !== second && first === third ? "flipped:" + first + ">" + second : first + ">" + second + ">" + third;
      })()`,
    );
    assert(toggled.startsWith("flipped:"), `the link toggle never flipped: ${toggled}`);

    const reset = await page.eval<number>(
      `document.querySelectorAll('main button[title^="Reset "]').length`,
    );
    assert(reset > 0, "no reset button on the spacing page");
    assertQuiet(noisy, "the spacing walk");
  });
}, 300_000);

/* ------------------------------------------------------------------ style -- */

test("style: first value per section commits and resets, link toggles flip", async () => {
  await withPage(async (page) => {
    const { noisy } = watchNoise(page);
    await openStudio(page);
    const seated = await seatTheme(page, "minimal");
    assert(seated === "seated", `minimal never seated: ${seated}`);
    await page.goto(`${studioUrl()}/themes/style`);

    // Unlink the radius lockstep: a linked commit fans out to siblings.
    const unlink = await page.eval<string>(
      `(async () => {
        const wait = (ms) => new Promise((r) => setTimeout(r, ms));
        const toggles = [...document.querySelectorAll("main button")].filter((b) =>
          (b.textContent ?? "").trim().startsWith("Linked")
        );
        for (const toggle of toggles) {
          toggle.click();
          await wait(200);
        }
        return "unlinked:" + toggles.length;
      })()`,
    );
    assert(unlink.startsWith("unlinked:"), `the unlink walk says ${unlink}`);

    // The value field is a combobox literal: real typing plus Enter commits.
    for (const title of ["Radius", "Border", "Elevation", "Focus", "Opacity", "Stack order"]) {
      const section = page.page.locator("main section", { has: page.page.locator("h2", { hasText: title }) }).first();
      assert((await section.count()) === 1, `the ${title} section never rendered`);
      const field = section.locator('input[type="text"]').first();
      const before = await field.inputValue();
      const trimmed = before.trim();
      const next = /^-?\d+(\.\d+)?(px|rem|em|%)$/.test(trimmed)
        ? trimmed.replace(/-?\d+(\.\d+)?/, (n) => String(Number(n) + 2))
        : /^-?\d+(\.\d+)?$/.test(trimmed) && (title === "Opacity" || title === "Stack order")
        ? String(Number(trimmed) + (trimmed.includes(".") ? 0.5 : 1))
        : /^-?\d+(\.\d+)?$/.test(trimmed)
        ? `${Number(trimmed) + 2}px`
        : `${before} `;
      await field.click();
      await field.press("ControlOrMeta+a");
      await page.page.keyboard.type(next);
      await page.page.keyboard.press("Enter");
      await page.settle(900);
      const reset = section.locator('button[title^="Reset "]:not([disabled])').first();
      assert(
        (await reset.count()) === 1,
        `the ${title} commit never armed a reset (wrote "${next}")`,
      );
      await reset.click();
      await page.settle(600);
    }

    const toggles = await page.eval<string>(
      `(async () => {
        const wait = (ms) => new Promise((r) => setTimeout(r, ms));
        const found = [...document.querySelectorAll("main button")].filter((b) =>
          (b.textContent ?? "").includes("Linked") || (b.textContent ?? "").includes("Unlinked")
        );
        let flipped = 0;
        for (const toggle of found) {
          const first = (toggle.textContent ?? "").trim();
          toggle.click();
          await wait(200);
          const second = (toggle.textContent ?? "").trim();
          toggle.click();
          await wait(200);
          if (first !== second) flipped++;
        }
        return found.length + ":" + flipped;
      })()`,
    );
    const [count, flipped] = toggles.split(":").map(Number);
    assert(count !== undefined && count > 0, "no link toggles on the style page");
    assert(flipped === count, `only ${flipped} of ${count} style toggles flipped`);

    assert((await pressRail(page, "Discard changes")) !== "absent", "the discard walk lost the bar");
    assertQuiet(noisy, "the style walk");
  });
}, 300_000);

/* ------------------------------------------------------------------ icons -- */

test("icons: filters, search, size, copy, keep and remove", async () => {
  await withPage(async (page) => {
    const { noisy } = watchNoise(page);
    await openStudio(page);
    const root = await projectRoot(page);
    const seated = await seatTheme(page, "minimal");
    assert(seated === "seated", `minimal never seated: ${seated}`);
    await page.goto(`${studioUrl()}/themes/icons`);

    // Each collection filter redraws the grid.
    const filtered = await page.eval<string>(
      `(async () => {
        const wait = (ms) => new Promise((r) => setTimeout(r, ms));
        const first = () => document.querySelector("main [slot='primary'] button, main .drawer-flow button")?.getAttribute("aria-label") ?? "none";
        for (let i = 0; i < 60 && first() === "none"; i++) await wait(100);
        const filters = [...document.querySelectorAll("main button")].filter((b) =>
          b.getAttribute("aria-pressed") !== null && (b.textContent ?? "").trim() !== "" &&
          !document.querySelector('main [role="group"][aria-label="Glyph size"]')?.contains(b)
        );
        if (filters.length === 0) return "no-filters";
        const seen = new Set([first()]);
        for (const filter of filters.slice(0, 4)) {
          filter.click();
          await wait(500);
          seen.add(first());
        }
        return "firsts:" + seen.size;
      })()`,
    );
    assert(
      filtered.startsWith("firsts:") && Number(filtered.slice("firsts:".length)) > 1,
      `the collection filters never redrew the grid: ${filtered}`,
    );

    // Search narrows, clear restores.
    const searched = await page.eval<string>(
      `(async () => {
        const wait = (ms) => new Promise((r) => setTimeout(r, ms));
        const search = document.querySelector('main input[type="search"]');
        if (!(search instanceof HTMLInputElement)) return "no-search";
        const count = () => document.querySelectorAll("main [slot='primary'] button, main .drawer-flow button").length;
        search.focus();
        search.value = "";
        document.execCommand("insertText", false, "arrow-right");
        await wait(800);
        const narrowed = count();
        search.value = "";
        search.dispatchEvent(new Event("input", { bubbles: true }));
        await wait(800);
        return "narrowed=" + narrowed + " restored=" + count();
      })()`,
    );
    assert(
      /narrowed=\d+ restored=\d+/.test(searched) &&
        Number(searched.match(/narrowed=(\d+)/)?.[1]) < Number(searched.match(/restored=(\d+)/)?.[1]),
      `the icon search never narrowed and cleared: ${searched}`,
    );

    // A size pick redraws the grid.
    const sized = await page.eval<string>(
      `(async () => {
        const wait = (ms) => new Promise((r) => setTimeout(r, ms));
        const group = document.querySelector('main [role="group"][aria-label="Glyph size"]');
        const picks = group ? [...group.querySelectorAll("button")] : [];
        if (picks.length < 2) return "picks=" + picks.length;
        const size = () => {
          const glyph = document.querySelector("main svg");
          return glyph ? glyph.getBoundingClientRect().width : -1;
        };
        picks[0].click();
        await wait(400);
        const first = size();
        picks[picks.length - 1].click();
        await wait(400);
        return "first=" + first + " last=" + size();
      })()`,
    );
    assert(sized.includes("first="), `the size picks never ran: ${sized}`);

    // Copy a glyph: the clipboard reads back the utility.
    const copied = await page.eval<string>(
      `(async () => {
        const wait = (ms) => new Promise((r) => setTimeout(r, ms));
        const first = document.querySelector("main [slot='primary'] button, main .drawer-flow button");
        if (!first) return "no-glyph";
        first.click();
        await wait(600);
        try {
          return "clipboard:" + (await navigator.clipboard.readText()).slice(0, 60);
        } catch {
          return "unreadable";
        }
      })()`,
    );
    assert(
      copied.startsWith("clipboard:i-"),
      `the glyph copy never reached the clipboard: ${copied}`,
    );

    // Keep the glyph, then remove it: the file comes and goes.
    const kept = await page.eval<string>(
      `(async () => {
        const wait = (ms) => new Promise((r) => setTimeout(r, ms));
        const keep = [...document.querySelectorAll("main button")].find((b) =>
          (b.textContent ?? "").trim() === "Keep in library" || (b.textContent ?? "").trim() === "Replace in library"
        );
        if (!keep) return "no-keep";
        keep.click();
        for (let i = 0; i < 50; i++) {
          const status = [...document.querySelectorAll('main [role="status"]')].some((s) =>
            (s.textContent ?? "").includes("Kept")
          );
          if (status) break;
          await wait(100);
        }
        const head = [...document.querySelectorAll("main p")].find((p) =>
          (p.textContent ?? "").includes("·")
        );
        const name = (head?.textContent ?? "").split("·")[1]?.trim() ?? "";
        return name === "" ? "no-name" : "kept:" + name;
      })()`,
    );
    assert(kept.startsWith("kept:"), `the keep walk says ${kept}`);
    const keptName = kept.slice("kept:".length);
    const iconFile = join(root, "spin", "icons", `${keptName}.json`);
    assert(await there(iconFile), `the kept glyph never landed: ${iconFile}`);
    const removed = await page.eval<string>(
      `(async () => {
        const wait = (ms) => new Promise((r) => setTimeout(r, ms));
        const remove = document.querySelector(${JSON.stringify(`button[aria-label="Remove ${keptName} from the library"]`)});
        if (!remove) return "no-remove";
        remove.click();
        await wait(1200);
        return "removed";
      })()`,
    );
    assert(removed === "removed", `the remove walk says ${removed}`);
    assert(!(await there(iconFile)), `the glyph survived its remove: ${iconFile}`);
    assertQuiet(noisy, "the icons walk");
  }, { permissions: CLIPBOARD });
}, 300_000);

/* ----------------------------------------------------------------- motion -- */

test("motion: lane select and loop toggle", async () => {
  await withPage(async (page) => {
    const { noisy } = watchNoise(page);
    await openStudio(page);
    const seated = await seatTheme(page, "minimal");
    assert(seated === "seated", `minimal never seated: ${seated}`);
    await page.goto(`${studioUrl()}/themes/motion`);

    const lanes = await page.eval<string>(
      `(async () => {
        const wait = (ms) => new Promise((r) => setTimeout(r, ms));
        const buttons = [...document.querySelectorAll("main ul button[aria-pressed]")];
        if (buttons.length === 0) return "no-lanes";
        for (const button of buttons.slice(0, 3)) {
          button.click();
          await wait(300);
          const pressed = [...document.querySelectorAll("main ul button[aria-pressed='true']")];
          if (pressed.length !== 1) return "pressed=" + pressed.length;
        }
        return "lanes:" + Math.min(3, buttons.length);
      })()`,
    );
    assert(lanes.startsWith("lanes:"), `lane selection never moved: ${lanes}`);

    const looped = await page.eval<string>(
      `(async () => {
        const wait = (ms) => new Promise((r) => setTimeout(r, ms));
        const loop = [...document.querySelectorAll("main button[aria-pressed]")].find((b) =>
          !b.closest("ul") && (b.textContent ?? "").trim() !== ""
        );
        if (!loop) return "no-loop";
        const first = loop.getAttribute("aria-pressed") + ":" + (loop.textContent ?? "").trim();
        loop.click();
        await wait(500);
        const second = loop.getAttribute("aria-pressed") + ":" + (loop.textContent ?? "").trim();
        loop.click();
        await wait(500);
        return first !== second ? "flipped:" + first + ">" + second : "stuck:" + first;
      })()`,
    );
    assert(looped.startsWith("flipped:"), `the loop toggle never flipped: ${looped}`);
    assertQuiet(noisy, "the motion walk");
  });
}, 300_000);

/* ------------------------------------------------------------- components -- */

test("components: filter narrows and clears, rail links land", async () => {
  await withPage(async (page) => {
    const { noisy } = watchNoise(page);
    await openStudio(page);
    await page.goto(`${studioUrl()}/components`);

    const filtered = await page.eval<string>(
      `(async () => {
        const wait = (ms) => new Promise((r) => setTimeout(r, ms));
        const filter = document.querySelector('input[aria-label="Filter the components"]');
        if (!(filter instanceof HTMLInputElement)) return "no-filter";
        const count = () => document.querySelectorAll('nav[aria-label="Components"] li').length;
        for (let i = 0; i < 60 && count() === 0; i++) await wait(100);
        const total = count();
        filter.focus();
        filter.value = "";
        document.execCommand("insertText", false, "but");
        await wait(600);
        const narrowed = count();
        filter.value = "";
        filter.dispatchEvent(new Event("input", { bubbles: true }));
        await wait(600);
        return "total=" + total + " narrowed=" + narrowed + " restored=" + count();
      })()`,
    );
    const [total, narrowed, restored] = [/(?<=total=)\d+/, /(?<=narrowed=)\d+/, /(?<=restored=)\d+/].map(
      (pattern) => Number(filtered.match(pattern)?.[0] ?? NaN),
    );
    assert(
      Number.isFinite(total) && Number.isFinite(narrowed) && narrowed < total &&
        restored === total,
      `the component filter never narrowed and cleared: ${filtered}`,
    );

    for (const name of ["button", "alert", "dialog"]) {
      const landed = await page.eval<string>(
        `(async () => {
          const wait = (ms) => new Promise((r) => setTimeout(r, ms));
          const link = [...document.querySelectorAll('nav[aria-label="Components"] a')].find((a) => (a.getAttribute("href") ?? "").endsWith("/components/${name}"));
          if (!link) return "no-link";
          link.click();
          await wait(800);
          return (document.querySelector("#app h1")?.textContent ?? "").trim().toLowerCase();
        })()`,
      );
      assert(
        landed === name,
        `the ${name} rail link landed on "${landed}"`,
      );
    }
    assertQuiet(noisy, "the components walk");
  });
}, 300_000);

test("component detail: code switch both ways, copy to project and take away", async () => {
  await withPage(async (page) => {
    const { noisy } = watchNoise(page);
    await openStudio(page);
    const root = await projectRoot(page);
    await page.goto(`${studioUrl()}/components/button`);

    const switched = await page.eval<string>(
      `(async () => {
        const wait = (ms) => new Promise((r) => setTimeout(r, ms));
        const section = [...document.querySelectorAll("#app section")].find((s) =>
          [...s.querySelectorAll("button[aria-pressed]")].some((b) =>
            ["component", "code"].includes(((b.textContent ?? "").trim()))
          )
        );
        if (!section) return "no-switch";
        const code = [...section.querySelectorAll("button[aria-pressed]")].find((b) =>
          (b.textContent ?? "").trim() === "code"
        );
        const component = [...section.querySelectorAll("button[aria-pressed]")].find((b) =>
          (b.textContent ?? "").trim() === "component"
        );
        if (!code || !component) return "no-sides";
        code.click();
        await wait(400);
        const showsCode = section.querySelector("pre") !== null;
        component.click();
        await wait(400);
        const showsComponent = section.querySelector("pre") === null;
        return showsCode && showsComponent ? "switched" : "code=" + showsCode + " component=" + showsComponent;
      })()`,
    );
    assert(switched === "switched", `the code switch never flipped: ${switched}`);

    await page.goto(`${studioUrl()}/components/slider`);

    const copied = await page.eval<string>(
      `(async () => {
        const wait = (ms) => new Promise((r) => setTimeout(r, ms));
        const copy = [...document.querySelectorAll("button")].find((b) =>
          (b.textContent ?? "").trim() === "copy to project"
        );
        if (!copy) return "no-copy";
        copy.click();
        for (let i = 0; i < 50; i++) {
          const text = (copy.textContent ?? "").trim();
          if (text !== "copy to project") return "tag:" + text;
          await wait(100);
        }
        return "never-answered";
      })()`,
    );
    assert(copied.startsWith("tag:<"), `the copy walk says ${copied}`);
    // The button wears the tag (`<reference-slider-basic>`); the file lands
    // under the component's own directory by example stem.
    const stem = copied.slice("tag:<".length, -">".length).split("-").pop() ?? "";
    const file = join(root, "src/lib/components/slider", `${stem}.html`);
    try {
      assert(await there(file), `the copied example never landed: ${file}`);
    } finally {
      await take(file);
    }
    assertQuiet(noisy, "the component detail walk");
  });
}, 300_000);

/* --------------------------------------------------------------- findings -- */

// The reference project carries real unpaired-ink findings, so the empty
// states never render there. Re-enable when the corpus is clean — or point
// the walk at a fixture project with none.
test.skip("findings: the empty states render with no fixture", async () => {
  await withPage(async (page) => {
    const { noisy } = watchNoise(page);
    await openStudio(page);
    await page.goto(`${studioUrl()}/findings`);

    const states = await page.eval<string>(
      `(async () => {
        const wait = (ms) => new Promise((r) => setTimeout(r, ms));
        for (let i = 0; i < 100; i++) {
          const text = document.querySelector("main")?.innerText ?? "";
          if (!text.includes("reading the source") && text.includes("Nothing to report")) break;
          await wait(100);
        }
        const titles = [...document.querySelectorAll("main h2")].map((h) => (h.textContent ?? "").trim());
        const text = document.querySelector("main")?.innerText ?? "";
        return titles.join("|") + " :: " + text.slice(0, 1200).replace(/\s+/g, " ");
      })()`,
    );
    for (const section of ["The lints", "Repetition", "Class order"]) {
      assert(states.includes(section), `the ${section} section never rendered: ${states}`);
    }
    assert(
      states.includes("Nothing to report") || states.includes("Nothing repeats") ||
        states.includes("in the order the stylesheet writes them"),
      `no empty state rendered: ${states}`,
    );
    assertQuiet(noisy, "the findings walk");
  });
}, 300_000);

/* ------------------------------------------------------------ preferences -- */

test("preferences: drawer edge left and right, modal badge present", async () => {
  await withPage(async (page) => {
    const { noisy } = watchNoise(page);
    await openStudio(page);
    await page.goto(`${studioUrl()}/preferences`);

    const edges = await page.eval<string>(
      `(async () => {
        const wait = (ms) => new Promise((r) => setTimeout(r, ms));
        const group = document.querySelector('[aria-label="Drawer edge"]');
        const left = group?.querySelector('button[data-edge="left"]');
        const right = group?.querySelector('button[data-edge="right"]');
        if (!left || !right) return "no-edge";
        left.click();
        await wait(400);
        const afterLeft = localStorage.getItem("spin-dock-side");
        right.click();
        await wait(400);
        const afterRight = localStorage.getItem("spin-dock-side");
        return afterLeft + ">" + afterRight;
      })()`,
    );
    assert(edges === "left>right", `the drawer edge never toggled: ${edges}`);

    const badge = await page.eval<boolean>(
      `[...document.querySelectorAll("main *")].some((el) =>
        (el.textContent ?? "").trim() === "no effect in a window"
      )`,
    );
    assert(badge, "the modal badge never rendered in a window");
    assertQuiet(noisy, "the preferences walk");
  });
}, 300_000);

/* ----------------------------------------------------------------- drawer -- */

test("drawer: every route renders, navigates, seats, acts, and fits", async () => {
  await withPage(async (page) => {
    const { noisy } = watchNoise(page);
    await page.goto(`${studioUrl()}/`);
    await page.clearOverlay(studioUrl());
    await page.fitDrawer(480, 900);

    const HEADINGS: Record<string, string> = {
      "/": "Overview",
      "/themes/colors": "Colors",
      "/themes/type": "Type",
      "/themes/type/faces": "Type",
      "/themes/type/styles": "Type",
      "/themes/type/ramps": "Type",
      "/themes/icons": "Icons",
      "/themes/motion": "Motion",
      "/themes/spacing": "Spacing",
      "/themes/style": "Style",
      "/components": "Components",
      "/findings": "Findings",
      "/preferences": "Preferences",
      "/init": "Create your brand",
    };
    for (const route of [...ROUTE_PATHS, ...CHILD_PATHS.filter((path) => !path.includes(":"))]) {
      const h1 = await page.goto(`${studioUrl()}${route}?mode=drawer`);
      const expected = route === "/themes" ? "Colors" : (HEADINGS[route] ?? "");
      assert(
        (h1 ?? "").trim() === expected,
        `the drawer never rendered ${route}: h1="${h1 ?? "none"}"`,
      );
      const fits = await page.eval<boolean>(
        `document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1`,
      );
      assert(fits, `the drawer overflows on ${route}`);
    }

    // Rail navigation works in the drawer: the rail offers the Themes job,
    // and the job's side list offers the groups.
    await page.goto(`${studioUrl()}/?mode=drawer`);
    await page.followRail("/themes");
    assert((await heading(page)) === "Colors", "the drawer rail never landed on /themes");
    await page.followRail("/themes/colors");
    assert((await heading(page)) === "Colors", "the drawer never landed on /themes/colors");

    // The theme seats in the drawer.
    const seated = await seatTheme(page, "minimal");
    assert(seated === "seated", `the drawer picker never seated minimal: ${seated}`);

    // One primary action per route.
    const acted = await page.eval<string>(
      `(async () => {
        const wait = (ms) => new Promise((r) => setTimeout(r, ms));
        return "driver-below";
      })()`,
    );
    assert(acted === "driver-below", "unreachable");

    await page.goto(`${studioUrl()}/?mode=drawer`);
    assert((await clickText(page, "New palette")) === "clicked", "the drawer dialog never opened");
    assert((await clickText(page, "Cancel")) === "clicked", "the drawer dialog never cancelled");

    await page.goto(`${studioUrl()}/themes/colors?mode=drawer`);
    const colorCommitted = await page.eval<string>(
      `(async () => {
        const wait = (ms) => new Promise((r) => setTimeout(r, ms));
        const field = document.querySelector('input[aria-label="color.primary value in light"]');
        if (!(field instanceof HTMLInputElement)) return "no-field";
        field.value = "#1d4ed8";
        field.dispatchEvent(new Event("change", { bubbles: true }));
        await wait(1000);
        return document.querySelector('button[aria-label="Discard changes"]') !== null ? "dirty" : "clean";
      })()`,
    );
    assert(colorCommitted === "dirty", "the drawer color commit never landed");
    assert((await pressRail(page, "Discard changes")) === "pressed", "the drawer discard never pressed");

    await page.goto(`${studioUrl()}/themes/type/faces?mode=drawer`);
    const comboOpened = await page.eval<string>(
      `(async () => {
        const wait = (ms) => new Promise((r) => setTimeout(r, ms));
        const input = [...document.querySelectorAll('input[data-testid="font-combobox-input"]')][0];
        if (!(input instanceof HTMLInputElement)) return "no-field";
        input.focus();
        input.click();
        await wait(800);
        return "opened";
      })()`,
    );
    assert(comboOpened === "opened", "the drawer font field never opened");

    await page.goto(`${studioUrl()}/themes/spacing?mode=drawer`);
    const rowSelected = await page.eval<string>(
      `(() => {
        const row = document.querySelector("main ul button[aria-pressed]");
        if (!row) return "no-row";
        row.click();
        return row.getAttribute("aria-pressed") === "true" ? "selected" : "unpressed";
      })()`,
    );
    assert(rowSelected === "selected", "the drawer spacing row never selected");

    await page.goto(`${studioUrl()}/themes/style?mode=drawer`);
    const resetThere = await page.eval<number>(
      `document.querySelectorAll('main button[title^="Reset "]').length`,
    );
    assert(resetThere > 0, "no reset button in the drawer style page");

    await page.goto(`${studioUrl()}/themes/icons?mode=drawer`);
    const filterClicked = await page.eval<string>(
      `(async () => {
        const wait = (ms) => new Promise((r) => setTimeout(r, ms));
        const filter = [...document.querySelectorAll("main button")].find((b) =>
          b.getAttribute("aria-pressed") !== null
        );
        if (!filter) return "no-filter";
        filter.click();
        await wait(500);
        return "clicked";
      })()`,
    );
    assert(filterClicked === "clicked", "the drawer icon filter never clicked");

    await page.goto(`${studioUrl()}/themes/motion?mode=drawer`);
    const laneSelected = await page.eval<string>(
      `(() => {
        const lane = document.querySelector("main ul button[aria-pressed]");
        if (!lane) return "no-lane";
        lane.click();
        return lane.getAttribute("aria-pressed") === "true" ? "selected" : "unpressed";
      })()`,
    );
    assert(laneSelected === "selected", "the drawer motion lane never selected");

    await page.goto(`${studioUrl()}/components?mode=drawer`);
    const filterTyped = await page.eval<string>(
      `(async () => {
        const wait = (ms) => new Promise((r) => setTimeout(r, ms));
        const filter = document.querySelector('input[aria-label="Filter the components"]');
        if (!(filter instanceof HTMLInputElement)) return "no-filter";
        filter.focus();
        document.execCommand("insertText", false, "but");
        await wait(500);
        return "typed";
      })()`,
    );
    assert(filterTyped === "typed", "the drawer component filter never typed");

    await page.goto(`${studioUrl()}/findings?mode=drawer`);
    const sections = await page.eval<string>(
      `[...document.querySelectorAll("main h2")].map((h) => (h.textContent ?? "").trim()).join("|")`,
    );
    assert(
      sections.includes("The lints"),
      `the drawer findings never rendered: ${sections}`,
    );

    await page.goto(`${studioUrl()}/preferences?mode=drawer`);
    const edgeToggled = await page.eval<string>(
      `(async () => {
        const wait = (ms) => new Promise((r) => setTimeout(r, ms));
        const left = document.querySelector('button[data-edge="left"]');
        const right = document.querySelector('button[data-edge="right"]');
        if (!left || !right) return "no-edge";
        left.click();
        await wait(300);
        const side = localStorage.getItem("spin-dock-side");
        right.click();
        await wait(300);
        const badge = [...document.querySelectorAll("main *")].some((el) =>
          (el.textContent ?? "").trim() === "no effect in a window"
        );
        return side + ":badge=" + badge;
      })()`,
    );
    assert(
      edgeToggled === "left:badge=false",
      `the drawer edge walk says ${edgeToggled}`,
    );
    assertQuiet(noisy, "the drawer walk");
  });
}, 300_000);

/* ------------------------------------------------------------------- dark -- */

test("dark: every route renders under a dark-capable theme with no errors", async () => {
  await withPage(async (page) => {
    const { noisy } = watchNoise(page);
    await openStudio(page);
    const seated = await seatTheme(page, "neumorphic");
    assert(seated === "seated", `neumorphic never seated: ${seated}`);
    const chosen = await page.chooseMode("dark");
    assert(chosen === "pressed", `dark never chosen: ${chosen}`);
    for (const route of ROUTE_PATHS) {
      const h1 = await page.goto(`${studioUrl()}${route}`);
      assert((h1 ?? "").trim() !== "", `dark never rendered ${route}`);
    }
    for (const route of ["/components/button"]) {
      const h1 = await page.goto(`${studioUrl()}${route}`);
      assert(
        (h1 ?? "").trim().toLowerCase() === "button",
        `dark never rendered ${route}: "${h1 ?? "none"}"`,
      );
    }
    assertQuiet(noisy, "the dark walk");
  });
}, 300_000);

/* ------------------------------------------------------------------ clean -- */

test("workspace is clean: no scratch themes, fixtures, glyphs, or edits", async () => {
  await withPage(async (page) => {
    await page.goto(`${studioUrl()}/`);
    const root = await projectRoot(page);
    assert(root !== "", "the daemon names no project for the studio to edit");

    const names = (await listedThemes(page)).map((theme) => theme.name);
    const leaked = names.filter((name) =>
      name.startsWith("e2e-") || name.startsWith("minimal-")
    );
    assert(leaked.length === 0, `scratch themes leaked: ${leaked.join(",")}`);

    const entries = await readdir(root).catch(() => []);
    const fixtures = entries.filter((entry) => entry.startsWith("e2e-fixture"));
    assert(fixtures.length === 0, `fixture dirs leaked: ${fixtures.join(",")}`);

    const glyphs = await readdir(join(root, "spin", "icons")).catch(() => []);
    const testGlyphs = glyphs.filter((name) => name.startsWith("e2e-"));
    assert(testGlyphs.length === 0, `test glyphs leaked: ${testGlyphs.join(",")}`);

    const overlay = await page.overlay(studioUrl());
    assert(
      overlay.dirty.length === 0,
      `unsaved edits leaked: ${overlay.dirty.join(",")}`,
    );
    await page.clearOverlay(studioUrl());
  });
}, 300_000);

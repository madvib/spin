/**
 * The studio's interaction mechanism, end to end.
 *
 * The other suites ask what the studio WRITES. This one asks what it FEELS
 * like to write it: that a gesture paints before it commits, that a commit
 * leaves exactly one step of history, that undo/redo/reset put every control
 * back on the document's word, that the keyboard reaches the surplus the bar
 * and the panels carry, and that the seat an author is working in survives a
 * reload.
 *
 * The distinction matters because the two failures look nothing alike: a
 * studio that writes the wrong value is caught by reading the file, and a
 * studio that writes the right value with a dead preview is caught only by
 * watching the pane while the pointer is down.
 *
 *   STUDIO_URL=http://localhost:5174 bun run e2e
 */

import assert, { deepStrictEqual } from "node:assert/strict";
import { test, withPage } from "./harness.ts";
import { StudioPage, studioUrl } from "./studio.ts";
import { seatTheme } from "./themes.ts";

/**
 * The studio's own RPC, asked from inside the page.
 *
 * The daemon's procedures are the ones the studio itself calls, so the test
 * reads the project through the same channel — no second contract, and no
 * test-only door.
 */
async function rpc<T>(
  page: StudioPage,
  path: string,
  input: unknown = {},
): Promise<T> {
  const body = JSON.stringify({ json: input });
  return await page.eval<T>(
    `fetch(${
      JSON.stringify(`/__spin/rpc${path}`)
    }, { method: "POST", headers: { "content-type": "application/json" }, body: ${
      JSON.stringify(body)
    } }).then((response) => response.json()).then((box) => box.json)`,
  );
}

/** The themes the project serves, in the picker's own order. */
async function themeNames(page: StudioPage): Promise<string[]> {
  const listed = await rpc<{ name: string; file: string | null }[]>(
    page,
    "/project/themes/list",
  );
  return listed.map((theme) => theme.name);
}

/** What the bar says about the document: the theme, the mode, the file. */
interface State {
  readonly name: string;
  readonly mode: string;
  readonly saved: boolean;
  readonly undo: boolean;
}

/**
 * Re-read the bar.
 *
 * The state is one sentence, and a sentence is read the way a reader reads
 * it: the name after `Editing`, the mode after the first separator, and the
 * word the file ends on. The undo control says whether history exists, which
 * is the other half of a gesture having landed.
 */
async function state(page: StudioPage): Promise<State> {
  const read = await page.eval<{
    line: string;
    undo: boolean;
    redo: boolean;
  }>(
    `(() => {
      const text = document.getElementById("app")?.innerText ?? "";
      const line = (text.split("\\n").find((row) => row.trim().indexOf("Editing") === 0) ?? "").trim();
      const undo = document.querySelector('button[aria-label="Undo"]');
      const redo = document.querySelector('button[aria-label="Redo"]');
      return { line, undo: undo ? !undo.disabled : false, redo: redo ? !redo.disabled : false };
    })()`,
  );
  const parts = read.line.split("·").map((part) => part.trim());
  const name = parts[0]?.replace(/^Editing\s+/, "") ?? "";
  return {
    name,
    mode: parts[1] ?? "",
    saved: (parts[3] ?? "").indexOf("saved") === 0,
    undo: read.undo,
  };
}

/**
 * A gesture paints the preview BEFORE it commits, and leaves one step behind.
 *
 * The pane is the contract: every utility resolves through the token's own
 * custom property, so a drag that works sets that property on the preview
 * surface while the pointer is down — before any edit reaches the document.
 * The state sentence is the other half: a paint is not an edit, so the file
 * still says "saved" and undo is still empty while the gesture is in flight.
 * The cancel path is the third: an abandoned gesture takes its paint with it
 * and leaves the document exactly as it was.
 */
test("a drag paints the pane before it commits", async () => {
  await withPage(async (page) => {
    try {
      await page.goto(`${studioUrl()}/themes/spacing`);
      await page.settle(1500);
      const seated = await seatTheme(page, "silk");
      assert(seated === "seated", `silk never seated: ${seated}`);
      const lit = await page.chooseMode("light");
      assert(lit === "pressed", `light never chose: ${lit}`);
      // The ramp draws every step but edits the one a row selects.
      const selected = await page.eval<string>(
        `(() => {
          const code = [...document.querySelectorAll("code")].find((c) => (c.textContent ?? "").trim() === "spacing.4");
          const button = code ? code.closest("button") : null;
          if (button === null) return "no-row";
          button.click();
          return "selected";
        })()`,
      );
      assert(selected === "selected", `the scaling row is ${selected}`);
      await page.settle(500);

      const probe = await page.eval<
        {
          error?: string;
          before?: string;
          during?: string;
          duringUntouched?: boolean;
          after?: string;
          afterDirty?: boolean;
          afterUndo?: boolean;
          focused?: string | null;
          cancelled?: string;
          afterCancel?: string;
        }
      >(`(async () => {
        const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
        // A commit re-renders the row, so the control is looked up again
        // rather than held: a node captured before the edit is a node the
        // page has already replaced.
        const track = () => document.querySelector('input[type="range"][aria-label="spacing.4"]');
        const pane = document.querySelector('.spin-preview[data-theme]');
        if (!track() || !pane) return { error: "no-track" };
        const read = () => getComputedStyle(pane).getPropertyValue("--spacing-4").trim();
        const text = () => document.getElementById("app")?.innerText ?? "";
        const saved = () => {
          const line = (text().split("\\n").find((row) => row.trim().indexOf("Editing") === 0) ?? "").trim();
          const parts = line.split("·").map((part) => part.trim());
          return parts[3] === "saved";
        };
        const undo = () => document.querySelector('button[aria-label="Undo"]');

        // The author is holding the track: the gesture starts under focus,
        // and a commit that rebuilt the row must put them back on it.
        track().focus();
        const before = read();
        track().value = "5";
        track().dispatchEvent(new Event("input", { bubbles: true }));
        const during = read();
        const duringUntouched = saved() === true && (undo() ? undo().disabled : false);

        track().dispatchEvent(new Event("change", { bubbles: true }));
        await wait(1200);
        const after = read();
        const afterDirty = !saved();
        const afterUndo = undo() ? !undo().disabled : false;
        const focused = document.activeElement ? document.activeElement.id : null;

        // A second gesture, abandoned: the paint goes, the document stands.
        track().value = "2";
        track().dispatchEvent(new Event("input", { bubbles: true }));
        const cancelled = read();
        track().dispatchEvent(new Event("pointercancel", { bubbles: true }));
        await wait(500);
        const afterCancel = read();

        return { before, during, duringUntouched, after, afterDirty, afterUndo, focused, cancelled, afterCancel };
      })()`);

      assert(probe.error === undefined, `the track is ${probe.error}`);
      // While the pointer is down the pane already shows the proposal —
      // on the track's own grid (min + k·step), not on the decimal named.
      assert(
        probe.during !== probe.before && probe.during === "5.0625rem",
        `in flight ${probe.before} → ${probe.during} (wanted 5.0625rem)`,
      );
      // ...and the document has not moved: still saved, still no undo.
      assert(
        probe.duringUntouched === true,
        `the gesture marked the document while it was only painting`,
      );
      // The release lands the value, once.
      assert(
        probe.after === probe.during && probe.afterDirty === true &&
          probe.afterUndo === true,
        `release: pane=${probe.after} dirty=${probe.afterDirty} undo=${probe.afterUndo}`,
      );
      // The row was rebuilt with the new value; the pointer's control is the
      // one the author is still in.
      deepStrictEqual(
        probe.focused,
        "token-spacing.4",
        "the commit did not keep focus on the control",
      );
      // The abandoned gesture painted, then took its paint with it.
      assert(
        probe.cancelled === "2.0625rem" && probe.afterCancel === probe.after,
        `cancel: painted=${probe.cancelled} after=${probe.afterCancel} (wanted ${probe.after})`,
      );
    } finally {
      await page.clearOverlay(studioUrl());
    }
  });
});

/**
 * A slider is the theme's own groove, not the browser's blue.
 *
 * The groove reads `color.surface-sunken` and the fill reads
 * `color.primary`, both live off the seated theme: change the theme and
 * the computed colors change with it. The test reads both sides at
 * runtime — the tokens from `:root`, the paint from the control — so no
 * theme name or hex value is pinned.
 */
test("a slider paints its groove and fill from the seated theme", async () => {
  await withPage(async (page) => {
    await page.goto(`${studioUrl()}/themes/spacing`);
    await page.settle(1500);
    const seated2 = await seatTheme(page, "silk");
    assert(seated2 === "seated", `silk never seated: ${seated2}`);
    const lit2 = await page.chooseMode("light");
    assert(lit2 === "pressed", `light never chose: ${lit2}`);
    for (const theme of ["silk", "synthwave"] as const) {
      const seated = await page.chooseTheme(theme);
      assert(seated === "seated", `seating ${theme} stopped at ${seated}`);
      const probe = await page.eval<{
        groove: string;
        fill: string;
        sunken: string;
        primary: string;
      }>(
        `(() => {
          const track = document.querySelector('input[type="range"]');
          const root = document.querySelector("[data-theme]");
          if (!track || !root) return { groove: "missing", fill: "missing", sunken: "missing", primary: "missing" };
          const painted = getComputedStyle(track);
          const tokens = getComputedStyle(root);
          return {
            groove: painted.backgroundColor,
            fill: painted.backgroundImage,
            sunken: tokens.getPropertyValue("--color-surface-sunken").trim(),
            primary: tokens.getPropertyValue("--color-primary").trim(),
          };
        })()`,
      );
      assert(
        probe.groove !== "missing",
        `no range control on /spacing under ${theme}`,
      );
      // The groove IS the sunken token, read live on both sides in the
      // track's own theme scope (the first data-theme on the page is the
      // chrome's, not the preview's).
      const sunken = await page.eval<string>(
        `(() => {
          const track = document.querySelector('input[type="range"]');
          const scope = track?.closest("[data-theme]") ?? document.querySelector("[data-theme]");
          const probe = document.createElement("div");
          probe.style.color = "var(--color-surface-sunken)";
          scope?.appendChild(probe);
          const out = getComputedStyle(probe).color;
          probe.remove();
          return out;
        })()`,
      );
      assert(
        probe.groove === sunken && probe.sunken.length > 0,
        `${theme} groove ${probe.groove} is not the sunken token ${sunken}`,
      );
      assert(
        probe.fill.includes("linear-gradient"),
        `${theme} fill is not a drawn gradient: ${probe.fill.slice(0, 80)}`,
      );
    }
    await page.chooseTheme("silk");
  });
});

/**
 * Undo, redo and reset put the CONTROL back, not only the document.
 *
 * A field that keeps the word it was mounted with is a field that disagrees
 * with the document the moment the author presses undo — and the word it
 * shows is the one they will act on next. The shadow row is the case where
 * the control is five fields over one value.
 */
test("undo, redo and reset put the field back on the document's word", async () => {
  await withPage(async (page) => {
    try {
      await page.goto(`${studioUrl()}/themes/style`);
      await page.settle(1500);
      const seated3 = await seatTheme(page, "silk");
      assert(seated3 === "seated", `silk never seated: ${seated3}`);
      const lit3 = await page.chooseMode("light");
      assert(lit3 === "pressed", `light never chose: ${lit3}`);
      const probe = await page.eval<
        {
          error?: string;
          before?: string;
          committed?: string;
          afterReset?: string;
          edited?: string;
          afterUndo?: string;
          afterRedo?: string;
        }
      >(`(async () => {
        const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
        // Every commit re-renders the row, so every read looks the control
        // up again. A node held across a commit is a node the page replaced.
        const reset = () => [...document.querySelectorAll('button[aria-label^="Reset shadow."]')][0];
        const field = () => reset()?.parentElement?.querySelector('input[type="text"]');
        const commit = (value) => {
          const input = field();
          if (!input) return false;
          input.value = value;
          input.dispatchEvent(new Event("change", { bubbles: true }));
          return true;
        };
        if (!field()) return { error: "no-shadow-field" };

        const before = field().value;
        commit("2px");
        await wait(700);
        const committed = field().value;

        reset().click();
        await wait(700);
        const afterReset = field().value;

        commit("3px");
        await wait(700);
        const edited = field().value;
        document.querySelector('button[aria-label="Undo"]')?.click();
        await wait(700);
        const afterUndo = field().value;
        document.querySelector('button[aria-label="Redo"]')?.click();
        await wait(700);
        const afterRedo = field().value;

        return { before, committed, afterReset, edited, afterUndo, afterRedo };
      })()`);

      assert(probe.error === undefined, `the shadow row is ${probe.error}`);
      deepStrictEqual(probe.committed, "2px", "the field took the edit");
      deepStrictEqual(
        probe.afterReset,
        probe.before,
        "reset put the field back on the theme's value",
      );
      deepStrictEqual(probe.edited, "3px", "the second edit landed");
      deepStrictEqual(
        probe.afterUndo,
        probe.before,
        "undo moved the field with the document",
      );
      deepStrictEqual(
        probe.afterRedo,
        "3px",
        "redo moved the field with the document",
      );
    } finally {
      await page.clearOverlay(studioUrl());
    }
  });
});

/**
 * A refused value goes back, and the refusal is said beside the role.
 *
 * The gate is the theme's own judgement: a value that would put the body ink
 * below its contrast floor never reaches the document. The field has to say
 * what the document holds — a box that keeps the refused word is a box the
 * author will act on next — and the reason has to be where the author is
 * looking, which is the role's picker rather than the top of the page.
 */
test("a refused colour goes back, and the refusal is said beside the role", async () => {
  await withPage(async (page) => {
    await page.goto(`${studioUrl()}/themes/colors`);
    await page.settle(1500);
    const seated4 = await seatTheme(page, "silk");
    assert(seated4 === "seated", `silk never seated: ${seated4}`);
    const lit4 = await page.chooseMode("light");
    assert(lit4 === "pressed", `light never chose: ${lit4}`);
    const probe = await page.eval<
      {
        error?: string;
        before?: string;
        after?: string;
        said?: string;
        saved?: boolean;
      }
    >(`(async () => {
      const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      // The picker edits one role at a time; the body ink is the role with
      // the floor this test is about.
      const swatch = document.querySelector('button[aria-label="Edit Text"], button[aria-label="Edit text"]');
      if (!swatch) return { error: "no-text-role" };
      swatch.click();
      await wait(600);
      const field = () => document.querySelector('input[aria-label="color.text value in light"]');
      if (!field()) return { error: "no-field" };
      const before = field().value;

      field().value = "#eeeeee";
      field().dispatchEvent(new Event("change", { bubbles: true }));
      await wait(900);

      const line = (document.getElementById("app")?.innerText ?? "")
        .split("\\n").find((row) => row.trim().indexOf("Editing") === 0) ?? "";
      const parts = line.split("·").map((part) => part.trim());
      const said = [...document.querySelectorAll('[role="alert"]')]
        .map((node) => (node.textContent ?? "").trim()).join(" | ");
      return { before, after: field()?.value ?? null, said, saved: parts[3] === "saved" };
    })()`);

    assert(probe.error === undefined, `the role picker is ${probe.error}`);
    deepStrictEqual(
      probe.after,
      probe.before,
      "the refused colour stayed in the field",
    );
    assert(
      (probe.said ?? "").includes("color.text") &&
        (probe.said ?? "").includes("text needs"),
      `no refusal beside the role: "${probe.said ?? ""}"`,
    );
    deepStrictEqual(
      probe.saved,
      true,
      "a refused value moved the document",
    );
  });
});

/**
 * The font field's results are reachable from the keyboard.
 *
 * The field used to close its list on `blur`, deferred so a mouse click
 * could land — which is a list a keyboard cannot enter, because Tab is a
 * blur. Now the field opens the list with an arrow, the arrows walk it,
 * Escape closes it and returns to the field, and a pointer elsewhere is what
 * dismisses it.
 */
test("the font field hands its list to the keyboard", async () => {
  await withPage(async (page) => {
    await page.goto(`${studioUrl()}/themes/type`);
    await page.settle(1500);
    const seated5 = await seatTheme(page, "silk");
    assert(seated5 === "seated", `silk never seated: ${seated5}`);
    const lit5 = await page.chooseMode("light");
    assert(lit5 === "pressed", `light never chose: ${lit5}`);
    const field = `input[data-testid="font-combobox-input"]`;
    const found = await page.eval<string>(
      `(() => {
        const input = [...document.querySelectorAll(${JSON.stringify(field)})][0];
        if (!(input instanceof HTMLInputElement)) return "no-field";
        input.focus();
        input.select();
        const typed = document.execCommand("insertText", false, "Inter");
        return typed ? "typed" : "untyped";
      })()`,
    );
    assert(found === "typed", `the font field is ${found}`);

    // The catalogue is a round trip; the list arrives when it answers.
    const listed = await page.eval<number>(
      `(async () => {
        const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
        for (let index = 0; index < 40; index++) {
          const list = document.querySelector('studio-font-combobox [role="listbox"]');
          const count = list ? list.querySelectorAll('[role="option"]').length : 0;
          if (count > 0) return count;
          await wait(100);
        }
        return 0;
      })()`,
    );
    assert(listed > 0, "the font list never answered");

    // The list opens where the reader can see it: inside the viewport,
    // not spilling past the edge the field sits near.
    const box = await page.eval<{
      within: boolean;
      x: number;
      right: number;
      width: number;
    }>(
      `(() => {
        const list = document.querySelector('studio-font-combobox [role="listbox"]');
        if (!list) return { within: false, x: -1, right: -1, width: -1 };
        const rect = list.getBoundingClientRect();
        return {
          within: rect.left >= 0 && rect.right <= window.innerWidth + 1,
          x: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(window.innerWidth),
        };
      })()`,
    );
    assert(
      box.within,
      `the font list spills out of the viewport: x=${box.x} right=${box.right} viewport=${box.width}`,
    );

    await page.page.keyboard.press("ArrowDown");
    await page.settle(300);
    const inside = await page.eval<{ inList: boolean; focused: string }>(
      `(() => {
        const input = document.querySelector(${JSON.stringify(field)});
        const list = document.querySelector('studio-font-combobox [role="listbox"]');
        const active = input ? input.getAttribute("aria-activedescendant") : null;
        return {
          inList: active !== null && list !== null && active.length > 0,
          focused: active ?? "",
        };
      })()`,
    );
    deepStrictEqual(
      inside.inList,
      true,
      `ArrowDown did not walk the list (focus: "${inside.focused}")`,
    );

    await page.page.keyboard.press("Escape");
    await page.settle(300);
    const closed = await page.eval<{ open: boolean; focus: string }>(
      `(() => {
        const input = document.querySelector(${JSON.stringify(field)});
        const panel = document.querySelector('studio-font-combobox [class*="origin-top"]');
        const active = document.activeElement;
        return {
          open: panel ? !panel.className.includes("invisible") : false,
          focus: active === input ? "field" : "elsewhere",
        };
      })()`,
    );
    deepStrictEqual(closed.open, false, "Escape did not close the list");
    deepStrictEqual(
      closed.focus,
      "field",
      "Escape did not return the reader to the field",
    );
  });
});

/**
 * The keyboard drives the studio's verbs.
 *
 * `Mod+Z` and `Mod+Shift+Z` are the document's history when the focus is not
 * in a field, and a field keeps its own undo — the two histories are
 * different, and a studio that stole the field's would make typing into a
 * token dangerous. `Mod+S` is the exception: saving the document is the only
 * thing it can mean here, and the browser's "save page" never is.
 *
 * The file is restored to what it was: a test that edits the project must
 * leave the checkout where it found it.
 */
test("the keyboard drives undo, redo and save", async () => {
  await withPage(async (page) => {
    await page.goto(`${studioUrl()}/`);
    const seated = await seatTheme(page, "silk");
    assert(seated === "seated", `silk never seated: ${seated}`);
    const lit = await page.chooseMode("light");
    assert(lit === "pressed", `light never chose: ${lit}`);
    const name = await page.editingName();
    assert(name !== "", "the bar names no theme to edit");

    const listed = await rpc<{ name: string; file: string | null }[]>(
      page,
      "/project/themes/list",
    );
    const forked = listed.some((theme) =>
      theme.name === name && theme.file !== null
    );
    const original = await rpc<{ text: string | null }>(
      page,
      "/project/themes/read",
      { name },
    );
    if (!forked && original.text !== null) {
      await rpc(page, "/project/themes/copy", { from: name, to: name });
      await page.reload();
      await page.settle(1200);
    }
    try {
      await page.goto(`${studioUrl()}/themes/style`);
      await page.settle(1500);
      const seated6 = await seatTheme(page, "silk");
      assert(seated6 === "seated", `silk never seated: ${seated6}`);
      const lit6 = await page.chooseMode("light");
      assert(lit6 === "pressed", `light never chose: ${lit6}`);
      const flow = await page.eval<
        {
          error?: string;
          before?: string;
          typed?: string;
          afterUndo?: string;
          afterRedo?: string;
          afterSave?: string;
        }
      >(`(async () => {
        const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
        const field = () => [...document.querySelectorAll('button[aria-label^="Reset shadow."]')][0]
          ?.parentElement?.querySelector('input[type="text"]');
        if (!field()) return { error: "no-field" };
        const before = field().value;
        field().value = "3px";
        field().dispatchEvent(new Event("change", { bubbles: true }));
        await wait(700);
        return { before, typed: field().value };
      })()`);
      assert(flow.error === undefined, `the field is ${flow.error}`);
      assert(flow.typed === "3px", `the edit landed as ${flow.typed}`);

      // Focus leaves the field: the document's history is the document's.
      await page.page.click("h1");
      await page.page.keyboard.press("Control+z");
      await page.settle(600);
      const afterUndo = await page.eval<string>(
        `[...document.querySelectorAll('button[aria-label^="Reset shadow."]')][0]?.parentElement?.querySelector('input[type="text"]')?.value ?? ""`,
      );
      deepStrictEqual(
        afterUndo,
        flow.before,
        "Mod+Z did not move the field with the document",
      );

      await page.page.keyboard.press("Control+Shift+z");
      await page.settle(600);
      const afterRedo = await page.eval<string>(
        `[...document.querySelectorAll('button[aria-label^="Reset shadow."]')][0]?.parentElement?.querySelector('input[type="text"]')?.value ?? ""`,
      );
      deepStrictEqual(afterRedo, "3px", "Mod+Shift+Z did not redo the edit");

      await page.page.keyboard.press("Control+s");
      await page.settle(1600);
      const bar = await state(page);
      assert(
        bar.saved === true && bar.name === name,
        `save left ${bar.name} ${bar.saved ? "saved" : "unsaved"}`,
      );
      const written = await rpc<{ text: string | null }>(
        page,
        "/project/themes/read",
        { name },
      );
      assert(
        (written.text ?? "").includes("3px"),
        "the file on disk does not hold the edit the keyboard saved",
      );
    } finally {
      // Put the checkout back: a forked starter loses the file, a project
      // theme gets its original text.
      if (forked && original.text !== null) {
        await rpc(page, "/project/themes/write", {
          name,
          text: original.text,
        });
      } else if (!forked) {
        await rpc(page, "/project/themes/remove", { name });
      }
      await page.clearOverlay(studioUrl());
    }
  });
});

/**
 * The pickers are menus, and a menu has a keyboard contract.
 *
 * ArrowDown opens the theme panel and lands on the theme in force, the arrows
 * walk the rows, Escape closes and returns the reader to the control that
 * opened it, and Enter chooses. The same contract on the mode menu: a panel a
 * keyboard cannot enter is a panel that does not exist for half its readers.
 */
test("the theme and mode panels take the keyboard", async () => {
  await withPage(async (page) => {
    await page.goto(`${studioUrl()}/`);
    const seated = await seatTheme(page, "silk");
    assert(seated === "seated", `silk never seated: ${seated}`);
    const lit = await page.chooseMode("light");
    assert(lit === "pressed", `light never chose: ${lit}`);
    const names = await themeNames(page);
    const current = await page.editingName();
    assert(current !== "", "no theme is seated to start from");
    const at = names.indexOf(current);
    assert(at >= 0, `the seated theme ${current} is not in [${names}]`);
    const next = names[(at + 1) % names.length]!;

    await page.eval(
      `document.querySelector('[data-testid="theme-picker"]')?.focus()`,
    );
    await page.page.keyboard.press("ArrowDown");
    await page.settle(400);
    const opened = await page.eval<{ open: boolean }>(
      `(() => {
        const panel = document.querySelector('[data-testid="theme-list"]');
        return { open: panel ? !panel.hasAttribute("hidden") : false };
      })()`,
    );
    deepStrictEqual(opened.open, true, "ArrowDown did not open the panel");

    // The listbox takes focus when opened from the keyboard: arrows walk
    // the highlight tracked by aria-activedescendant, starting at the
    // theme in force.
    await page.eval(
      `document.querySelector('[data-testid="theme-list"]')?.focus()`,
    );
    await page.settle(300);
    const landed = await page.eval<{ actived: string | null }>(`(() => {
        const panel = document.querySelector('[data-testid="theme-list"]');
        return { actived: panel?.getAttribute("aria-activedescendant") ?? null };
      })()`);
    assert(
      landed.actived !== null && landed.actived.indexOf(current) > -1,
      `the panel did not land on the theme in force (actived=${landed.actived})`,
    );

    await page.page.keyboard.press("ArrowDown");
    await page.settle(200);
    const moved = await page.eval<string | null>(
      `document.querySelector('[data-testid="theme-list"]')?.getAttribute("aria-activedescendant") ?? null`,
    );
    assert(
      moved !== null && moved.indexOf(next) > -1,
      `ArrowDown did not walk the rows (actived=${moved} next=${next})`,
    );

    await page.page.keyboard.press("Enter");
    await page.settle(900);
    const nowSeated = await page.editingName();
    deepStrictEqual(
      nowSeated,
      next,
      "Enter did not seat the row the keyboard was on",
    );

    // The mode control is a single cycle button: Enter/Space presses it,
    // and the preview wears the next mode in the cycle.
    const beforeMode = await page.eval<string | null>(
      `document.querySelector(".spin-preview")?.getAttribute("data-mode") ?? null`,
    );
    await page.eval(
      `document.querySelector('[data-testid="mode-button"]')?.focus()`,
    );
    await page.page.keyboard.press("Enter");
    await page.settle(400);
    const afterMode = await page.eval<string | null>(
      `document.querySelector(".spin-preview")?.getAttribute("data-mode") ?? null`,
    );
    assert(
      beforeMode !== null && afterMode !== null && afterMode !== beforeMode,
      `Enter did not cycle the mode (before=${beforeMode} after=${afterMode})`,
    );

    // Leave the studio where it was found.
    await page.chooseTheme(current);
  });
});

/**
 * A seat survives a reload.
 *
 * The theme and the mode are where the author is working, not facts about a
 * page: a reload that returned to a different theme would make every refresh
 * a decision about the project. The registry is re-read on the way in, so a
 * name the project no longer holds falls back to what it does hold.
 */
test("the theme and mode survive a reload", async () => {
  await withPage(async (page) => {
    await page.goto(`${studioUrl()}/`);
    const seated = await page.chooseTheme("synthwave");
    assert(seated === "seated", `seating synthwave stopped at ${seated}`);
    const flipped = await page.chooseMode("dark");
    assert(flipped === "pressed", `the dark control is ${flipped}`);
    const before = await state(page);
    deepStrictEqual(before.name, "synthwave", "the wrong theme was seated");
    deepStrictEqual(before.mode, "dark", "the wrong mode was chosen");

    await page.reload();
    const after = await state(page);
    deepStrictEqual(after.name, "synthwave", "the reload lost the seated theme");
    deepStrictEqual(after.mode, "dark", "the reload lost the chosen mode");
  });
});

/**
 * A shipped starter forks into the project from its own card.
 *
 * A starter is read-only: the save forks it, but an author looking at one has
 * no obvious way to start, and a theme that is only ever edited in memory
 * never reaches a build. The card offers the fork and names the copy.
 *
 * The new-theme dialog's source is a list of radio rows rather than a native
 * select: the studio does not wear the browser's idea of a control, and the
 * rows carry the keyboard contract the platform already gives a radio group.
 */
test("a shipped starter forks, and the dialog names its source with radios", async () => {
  await withPage(async (page) => {
    let made: string | undefined;
    try {
      await page.goto(`${studioUrl()}/`);
    const seated = await seatTheme(page, "silk");
    assert(seated === "seated", `silk never seated: ${seated}`);
    const lit = await page.chooseMode("light");
    assert(lit === "pressed", `light never chose: ${lit}`);
      const names = await themeNames(page);

      // The dialog's source, as the rows the studio draws.
      const dialog = await page.eval<{ rows: number; expected: number }>(
        `(async () => {
          const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
          const opener = [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "New theme");
          if (opener) opener.click();
          await wait(400);
          const dialog = document.querySelector('dialog[aria-label="New theme"]');
          const expected = ${JSON.stringify(names.length)};
          // The registry is a resource: the rows arrive with its answer.
          // The template step offers one button per served theme, plus
          // Blank — a button per starter, not a radio row.
          let rows = -1;
          for (let index = 0; index < 30; index++) {
            const group = dialog ? dialog.querySelector('[role="group"][aria-label="Template"]') : null;
            rows = group ? group.querySelectorAll("button").length : -1;
            if (rows === expected + 1) break;
            await wait(100);
          }
          [...(dialog?.querySelectorAll("button") ?? [])].find((b) => b.textContent.trim() === "Cancel")?.click();
          await wait(200);
          return { rows, expected };
        })()`,
      );
      deepStrictEqual(
        dialog.rows,
        dialog.expected + 1,
        "the dialog did not offer one template button per theme, plus Blank",
      );

      const starter = await page.eval<string>(
        `(() => {
          const card = [...document.querySelectorAll('article[data-testid="theme-card"]')].find((article) =>
            article.querySelector("studio-theme-menu")
          );
          return card ? (card.querySelector('button[title="Switch to this theme"]')?.textContent ?? "").trim() : "";
        })()`,
      );
      assert(starter !== "", "no theme card offers a menu");

      const clicked = await page.eval<string>(
        `(async () => {
          const wait = (ms) => new Promise((r) => setTimeout(r, ms));
          const card = [...document.querySelectorAll('article[data-testid="theme-card"]')].find((article) =>
            (article.querySelector('button[title="Switch to this theme"]')?.textContent ?? "").trim() === ${JSON.stringify(starter)}
          );
          const menu = card ? card.querySelector("studio-theme-menu") : null;
          const trigger = menu ? menu.querySelector("button") : null;
          if (!trigger) return "no-menu";
          trigger.click();
          await wait(400);
          const dup = [...menu.querySelectorAll('[role="menuitem"], [role="menuitemradio"], [role="option"]')].find((b) => (b.textContent ?? "").trim() === "Duplicate");
          if (!dup) return "no-fork";
          dup.click();
          return "clicked";
        })()`,
      );
      await page.settle(1800);

      const listed = await rpc<{ name: string; file: string | null }[]>(
        page,
        "/project/themes/list",
      );
      const forked = listed.find((theme) =>
        theme.file !== null && theme.name.startsWith(`${starter}-copy`)
      );
      assert(
        forked !== undefined,
        `no project file for ${starter}: [${
          listed.map((theme) => `${theme.name}:${theme.file}`)
        }]`,
      );
      made = forked.name;
      const nowSeated = await page.editingName();
      deepStrictEqual(nowSeated, made, "the fork was made but not seated");
    } finally {
      if (made !== undefined) {
        await rpc(page, "/project/themes/remove", { name: made });
      }
      await page.clearOverlay(studioUrl());
    }
  });
});

/**
 * Every range slider has an editable text readout beside it, and the type
 * page's element map uses keyboard-navigable step panels with a reset to the
 * ladder rather than native `<select>` controls.
 */
test("a range readout accepts typed numbers and the element map picks and resets steps", async () => {
  await withPage(async (page) => {
    try {
      await page.goto(`${studioUrl()}/themes/spacing`);
      await page.settle(1500);
      const seated7 = await seatTheme(page, "silk");
      assert(seated7 === "seated", `silk never seated: ${seated7}`);
      const lit7 = await page.chooseMode("light");
      assert(lit7 === "pressed", `light never chose: ${lit7}`);
      await page.selectStep("spacing.4");
      await page.settle(400);

      const typed = await page.eval<{
        error?: string;
        thumb?: string;
        pane?: string;
      }>(`(async () => {
        const wait = (ms) => new Promise((r) => setTimeout(r, ms));
        const text = () => document.querySelector('input[aria-label="spacing.4 value"]');
        const track = () => document.querySelector('input[type="range"][aria-label="spacing.4"]');
        const pane = document.querySelector('.spin-preview[data-theme]');
        if (!text() || !track() || !pane) return { error: "no-controls" };
        // Typing a bare number adopts the token's unit ("rem") and moves
        // the thumb — on the track's grid (min 0.0625, step 0.125).
        text().value = "1.8125";
        text().dispatchEvent(new Event("change", { bubbles: true }));
        await wait(900);
        return {
          thumb: track()?.value ?? "",
          pane: getComputedStyle(pane).getPropertyValue("--spacing-4").trim(),
        };
      })()`);
      deepStrictEqual(typed.error, undefined);
      deepStrictEqual(typed.thumb, "1.8125");
      deepStrictEqual(typed.pane, "1.8125rem");

      await page.goto(`${studioUrl()}/themes/type`);
      await page.settle(1500);
      const seated8 = await seatTheme(page, "silk");
      assert(seated8 === "seated", `silk never seated: ${seated8}`);
      const lit8 = await page.chooseMode("light");
      assert(lit8 === "pressed", `light never chose: ${lit8}`);
      const elementMap = await page.eval<{
        error?: string;
        before?: string;
        picked?: string;
        hasReset?: boolean;
        afterReset?: string;
      }>(`(async () => {
        const wait = (ms) => new Promise((r) => setTimeout(r, ms));
        const trigger = () => document.querySelector('button[aria-haspopup="listbox"][aria-label="font.element.h1.size"]');
        if (!trigger()) return { error: "no-trigger" };
        const before = (trigger().textContent ?? "").trim();
        trigger().click();
        await wait(300);
        const list = document.querySelector('div[aria-label="font.element.h1.size"] studio-step-list [role="listbox"]');
        const option = list ? [...list.querySelectorAll('[role="option"]')].find((o) => (o.querySelector("span")?.textContent ?? "").trim() === "sm") : null;
        if (!option) return { error: "no-option" };
        option.click();
        await wait(800);
        const picked = (trigger()?.textContent ?? "").trim();
        const reset = document.querySelector('button[aria-label="Reset h1 to the ladder"]');
        const hasReset = reset !== null;
        if (reset) reset.click();
        await wait(800);
        const afterReset = (trigger()?.textContent ?? "").trim();
        return { before, picked, hasReset, afterReset };
      })()`);
      deepStrictEqual(elementMap.error, undefined);
      deepStrictEqual(elementMap.picked, "sm");
      deepStrictEqual(elementMap.hasReset, true);
      deepStrictEqual(elementMap.afterReset, elementMap.before);
    } finally {
      await page.clearOverlay(studioUrl());
    }
  });
});

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
 *   STUDIO_URL=http://localhost:5174 deno task e2e
 */

import { assert, assertEquals } from "@std/assert";
import { test, withPage } from "./harness.ts";
import { StudioPage, studioUrl } from "./studio.ts";

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
      await page.goto(`${studioUrl()}/spacing`);
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
      // While the pointer is down the pane already shows the proposal...
      assert(
        probe.during !== probe.before && probe.during === "5rem",
        `in flight ${probe.before} → ${probe.during} (wanted 5rem)`,
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
      assertEquals(
        probe.focused,
        "token-spacing.4",
        "the commit did not keep focus on the control",
      );
      // The abandoned gesture painted, then took its paint with it.
      assert(
        probe.cancelled === "2rem" && probe.afterCancel === probe.after,
        `cancel: painted=${probe.cancelled} after=${probe.afterCancel} (wanted ${probe.after})`,
      );
    } finally {
      await page.clearOverlay(studioUrl());
    }
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
      await page.goto(`${studioUrl()}/style`);
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
      assertEquals(probe.committed, "2px", "the field took the edit");
      assertEquals(
        probe.afterReset,
        probe.before,
        "reset put the field back on the theme's value",
      );
      assertEquals(probe.edited, "3px", "the second edit landed");
      assertEquals(
        probe.afterUndo,
        probe.before,
        "undo moved the field with the document",
      );
      assertEquals(
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
    await page.goto(`${studioUrl()}/colors`);
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
      const swatch = document.querySelector('button[aria-label="Edit text"]');
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
    assertEquals(
      probe.after,
      probe.before,
      "the refused colour stayed in the field",
    );
    assert(
      (probe.said ?? "").includes("color.text") &&
        (probe.said ?? "").includes("floor"),
      `no refusal beside the role: "${probe.said ?? ""}"`,
    );
    assertEquals(
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
    await page.goto(`${studioUrl()}/type`);
    const field = `input[aria-label="font.family.body"]`;
    const found = await page.eval<string>(
      `(() => {
        const input = document.querySelector(${JSON.stringify(field)});
        if (!input) return "no-field";
        input.focus();
        input.value = "Inter";
        input.dispatchEvent(new Event("input", { bubbles: true }));
        return "typed";
      })()`,
    );
    assert(found === "typed", `the font field is ${found}`);

    // The catalogue is a round trip; the list arrives when it answers.
    const listed = await page.eval<number>(
      `(async () => {
        const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
        for (let index = 0; index < 40; index++) {
          const list = document.querySelector('ul[aria-label="Font families"]');
          const count = list ? list.querySelectorAll("button").length : 0;
          if (count > 0) return count;
          await wait(100);
        }
        return 0;
      })()`,
    );
    assert(listed > 0, "the font list never answered");

    await page.page.keyboard.press("ArrowDown");
    await page.settle(300);
    const inside = await page.eval<{ inList: boolean; focused: string }>(
      `(() => {
        const active = document.activeElement;
        const list = document.querySelector('ul[aria-label="Font families"]');
        return {
          inList: list ? list.contains(active) : false,
          focused: active ? (active.textContent ?? "").trim().slice(0, 24) : "",
        };
      })()`,
    );
    assertEquals(
      inside.inList,
      true,
      `ArrowDown did not enter the list (focus: "${inside.focused}")`,
    );

    await page.page.keyboard.press("Escape");
    await page.settle(300);
    const closed = await page.eval<{ open: boolean; focus: string }>(
      `(() => {
        const input = document.querySelector(${JSON.stringify(field)});
        const list = document.querySelector('ul[aria-label="Font families"]');
        return {
          open: list !== null,
          focus: document.activeElement === input ? "field" : "elsewhere",
        };
      })()`,
    );
    assertEquals(closed.open, false, "Escape did not close the list");
    assertEquals(
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
    const name = await page.eval<string>(`(() => {
      const text = document.getElementById("app")?.innerText ?? "";
      const line = (text.split("\\n").find((row) => row.trim().indexOf("Editing") === 0) ?? "").trim();
      return line.replace(/^Editing\\s+/, "").split("·")[0].trim();
    })()`);
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

    try {
      await page.goto(`${studioUrl()}/style`);
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
      assertEquals(
        afterUndo,
        flow.before,
        "Mod+Z did not move the field with the document",
      );

      await page.page.keyboard.press("Control+Shift+z");
      await page.settle(600);
      const afterRedo = await page.eval<string>(
        `[...document.querySelectorAll('button[aria-label^="Reset shadow."]')][0]?.parentElement?.querySelector('input[type="text"]')?.value ?? ""`,
      );
      assertEquals(afterRedo, "3px", "Mod+Shift+Z did not redo the edit");

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
    const opened = await page.eval<{
      open: boolean;
      active: string | null;
      focus: string;
    }>(
      `(() => {
        const panel = document.querySelector('[data-testid="theme-list"]');
        const active = document.activeElement;
        return {
          open: panel ? !panel.hasAttribute("hidden") : false,
          active: active ? active.getAttribute("data-theme") : null,
          focus: active ? (active.getAttribute("data-testid") ?? active.getAttribute("data-theme") ?? active.tagName) : "",
        };
      })()`,
    );
    assertEquals(opened.open, true, "ArrowDown did not open the panel");
    assertEquals(
      opened.active,
      current,
      "the panel did not land on the theme in force",
    );

    await page.page.keyboard.press("ArrowDown");
    await page.settle(200);
    const moved = await page.eval<string | null>(
      `document.activeElement?.getAttribute("data-theme") ?? null`,
    );
    assertEquals(moved, next, "ArrowDown did not walk the rows");

    await page.page.keyboard.press("Escape");
    await page.settle(300);
    const closed = await page.eval<{ open: boolean; focus: string }>(
      `(() => {
        const panel = document.querySelector('[data-testid="theme-list"]');
        const active = document.activeElement;
        return {
          open: panel ? !panel.hasAttribute("hidden") : false,
          focus: active ? (active.getAttribute("data-testid") ?? "") : "",
        };
      })()`,
    );
    assertEquals(closed.open, false, "Escape did not close the panel");
    assertEquals(
      closed.focus,
      "theme-picker",
      "Escape did not return the reader to the control",
    );

    // Open, walk, choose.
    await page.page.keyboard.press("ArrowDown");
    await page.settle(300);
    await page.page.keyboard.press("ArrowDown");
    await page.page.keyboard.press("Enter");
    await page.settle(900);
    const seated = await page.editingName();
    assertEquals(
      seated,
      next,
      "Enter did not seat the row the keyboard was on",
    );

    // The mode menu: the current answer is where the keyboard lands.
    await page.eval(
      `document.querySelector('[data-testid="mode-button"]')?.focus()`,
    );
    await page.page.keyboard.press("ArrowDown");
    await page.settle(300);
    const modeOpen = await page.eval<{ open: boolean; current: boolean }>(
      `(() => {
        const panel = document.querySelector('[data-testid="mode-menu"]');
        const active = document.activeElement;
        return {
          open: panel ? !panel.hasAttribute("hidden") : false,
          current: active ? active.getAttribute("aria-current") === "true" : false,
        };
      })()`,
    );
    assertEquals(modeOpen.open, true, "ArrowDown did not open the mode menu");
    assertEquals(
      modeOpen.current,
      true,
      "the mode menu did not land on the mode in force",
    );
    await page.page.keyboard.press("Escape");
    await page.settle(200);

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
    assertEquals(before.name, "synthwave", "the wrong theme was seated");
    assertEquals(before.mode, "dark", "the wrong mode was chosen");

    await page.reload();
    const after = await state(page);
    assertEquals(after.name, "synthwave", "the reload lost the seated theme");
    assertEquals(after.mode, "dark", "the reload lost the chosen mode");
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
          let rows = -1;
          for (let index = 0; index < 30; index++) {
            rows = dialog ? dialog.querySelectorAll('input[name="new-theme-source-theme"]').length : -1;
            if (rows === expected) break;
            await wait(100);
          }
          [...(dialog?.querySelectorAll("button") ?? [])].find((b) => b.textContent.trim() === "Cancel")?.click();
          await wait(200);
          return { rows, expected };
        })()`,
      );
      assertEquals(
        dialog.rows,
        dialog.expected,
        "the dialog did not offer one source row per theme",
      );

      const starter = await page.eval<string>(
        `(() => {
          const card = [...document.querySelectorAll("article")].find((article) =>
            [...article.querySelectorAll("button")].some((button) => button.textContent.trim() === "Fork")
          );
          return card ? (card.querySelector('button[title="Switch to this theme"]')?.textContent ?? "").trim() : "";
        })()`,
      );
      assert(starter !== "", "no shipped starter offers a fork");

      const clicked = await page.eval<string>(
        `(() => {
          const card = [...document.querySelectorAll("article")].find((article) =>
            [...article.querySelectorAll("button")].some((button) => button.textContent.trim() === "Fork")
          );
          const fork = card ? [...card.querySelectorAll("button")].find((button) => button.textContent.trim() === "Fork") : null;
          if (!fork) return "no-fork";
          fork.click();
          return "clicked";
        })()`,
      );
      assert(clicked === "clicked", `the fork is ${clicked}`);
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
      const seated = await page.editingName();
      assertEquals(seated, made, "the fork was made but not seated");
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
      await page.goto(`${studioUrl()}/spacing`);
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
        // Typing a bare number adopts the token's unit ("rem") and moves the thumb.
        text().value = "1.75";
        text().dispatchEvent(new Event("change", { bubbles: true }));
        await wait(900);
        return {
          thumb: track()?.value ?? "",
          pane: getComputedStyle(pane).getPropertyValue("--spacing-4").trim(),
        };
      })()`);
      assertEquals(typed.error, undefined);
      assertEquals(typed.thumb, "1.75");
      assertEquals(typed.pane, "1.75rem");

      await page.goto(`${studioUrl()}/type`);
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
        const panel = document.querySelector('div[role="listbox"][aria-label="font.element.h1.size"]');
        const option = panel ? [...panel.querySelectorAll('button[role="option"]')].find((o) => (o.querySelector("span")?.textContent ?? "").trim() === "sm") : null;
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
      assertEquals(elementMap.error, undefined);
      assertEquals(elementMap.picked, "sm");
      assertEquals(elementMap.hasReset, true);
      assertEquals(elementMap.afterReset, elementMap.before);
    } finally {
      await page.clearOverlay(studioUrl());
    }
  });
});

import { readFile, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
/**
 * The studio's theme actions, end to end.
 *
 * Every action an author takes on a theme — create, copy, edit, save, undo,
 * seat, mode, delete — is driven through the studio's own controls and read
 * back where the outcome is observable: the file on disk, the registry the
 * project serves, and the preview the studio renders.
 *
 * The project is the one the studio's dev server mounts, and it is found
 * through the daemon rather than assumed, so a test never has to know where
 * the project lives. Every theme a test creates is taken away again.
 */

import assert, { deepStrictEqual } from "node:assert/strict";
import { test, withPage } from "./harness.ts";
import { type StudioPage, studioUrl } from "./studio.ts";
import {
  cardText,
  chromeVar,
  createTheme,
  declaredValue,
  deleteFromCard,
  editingLine,
  listedThemes,
  pressRail,
  previewMode,
  previewVar,
  projectRoot,
  railState,
  seatTheme,
  themeFile,
  tokenValue,
  waitForEditing,
  writeToken,
} from "./themes.ts";

/** The light slot of the primary colour, in the editor's own control. */
const PRIMARY = '[id="token-color.primary-light"]';

/** Whether a file is there. */
async function there(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

/** Take a file away, whether it is there or not. */
async function take(path: string): Promise<void> {
  try {
    await rm(path);
  } catch {
    // It was not there to begin with.
  }
}

/**
 * The studio, with the overlay it publishes closed.
 *
 * The overlay is a process-global cell: it holds the document the studio
 * last pushed, and it outlives the tab that pushed it. A preview that
 * generated against it would show a document the studio is not editing, so
 * a test that reads the preview's colours clears it first and seats its
 * theme afterwards.
 */
async function openStudio(page: StudioPage): Promise<void> {
  await page.goto(`${studioUrl()}/`);
  await page.clearOverlay(studioUrl());
}

/**
 * The studio, and the project it edits.
 *
 * The daemon reports the project it serves, so a test never has to know
 * where the project lives: it asks, and the answer is the directory the
 * studio's themes are written to.
 */
async function openProject(page: StudioPage): Promise<string> {
  await openStudio(page);
  const root = await projectRoot(page);
  assert(root !== "", "the daemon names no project for the studio to edit");
  return root;
}

/**
 * A theme, created through the studio's own dialog.
 *
 * The name is the one the studio asks for, and the copy is the one the
 * dialog offers: a theme the project serves.
 */
async function createThroughStudio(
  page: StudioPage,
  name: string,
  source = "silk",
): Promise<void> {
  const made = await createTheme(page, name, { source });
  assert(
    made.accepted,
    `the studio did not take the name "${name}": ${
      made.problem ?? "no message"
    }`,
  );
  const line = await waitForEditing(page, name);
  assert(
    line.startsWith(`Editing ${name}`),
    `the studio is editing "${line}" after creating "${name}"`,
  );
}

test("a theme created from the studio lands on disk, in the registry, and seated", async () => {
  await withPage(async (page) => {
    const name = "e2e-created";
    const root = await openProject(page);
    const file = themeFile(root, name);
    await take(file);
    try {
      await createThroughStudio(page, name);

      // the registry the project serves names it, and names where it lives
      const listed = await listedThemes(page);
      const created = listed.find((theme) => theme.name === name);
      assert(
        created !== undefined,
        `the registry does not list the theme the studio created: ${
          listed.map((theme) => theme.name).join(", ")
        }`,
      );
      assert(
        created.file === `spin/${name}.json`,
        `the registry lists it as ${created.file}`,
      );

      // the file on disk is the theme it was copied from, byte for byte
      const source = listed.find((theme) => theme.name === "silk");
      assert(source !== undefined, "the registry lists no theme to copy");
      const written = await readFile(file, "utf8");
      deepStrictEqual(
        written,
        source.text,
        "the copy on disk is the theme it was copied from",
      );

      // and the studio says where each theme lives
      const card = await cardText(page, name);
      assert(
        card.includes(`spin/${name}.json`),
        `the card does not name the project's file: ${card}`,
      );
      const starter = await cardText(page, "silk");
      assert(
        starter.includes("@spinjs/theme"),
        `the card does not name the starter's home: ${starter}`,
      );
    } finally {
      await take(file);
    }
  });
});

test("a copy is independent of the theme it was copied from", async () => {
  await withPage(async (page) => {
    const origin = "e2e-origin";
    const derived = "e2e-derived";
    const root = await openProject(page);
    const originFile = themeFile(root, origin);
    const derivedFile = themeFile(root, derived);
    await take(originFile);
    await take(derivedFile);
    try {
      await createThroughStudio(page, origin);

      // edit the origin and save it
      await page.followRail("/colors");
      await page.settle(1200);
      assert(
        await writeToken(page, PRIMARY, "#b91c1c") === "written",
        "the colour control took no value",
      );
      assert(
        await pressRail(page, "Save to disk") === "pressed",
        "the save control was not available for the edit",
      );
      await page.settle(1200);
      const originText = await readFile(originFile, "utf8");
      assert(
        declaredValue(originText, ["color", "primary"]) === "#b91c1c",
        "the origin's file does not hold the edit that was saved",
      );

      // copy it, and edit the copy
      await page.followRail("/");
      await page.settle(800);
      await createThroughStudio(page, derived, origin);
      await page.followRail("/colors");
      await page.settle(1200);
      assert(
        await writeToken(page, PRIMARY, "#166534") === "written",
        "the colour control took no value",
      );
      assert(
        await pressRail(page, "Save to disk") === "pressed",
        "the save control was not available for the edit",
      );
      await page.settle(1200);

      const derivedText = await readFile(derivedFile, "utf8");
      assert(
        declaredValue(derivedText, ["color", "primary"]) === "#166534",
        "the copy's file does not hold the edit that was saved",
      );
      deepStrictEqual(
        await readFile(originFile, "utf8"),
        originText,
        "the origin's file changed when the copy was edited",
      );
    } finally {
      await take(originFile);
      await take(derivedFile);
    }
  });
});

test("an edit is dirty until it is saved, and the save reaches the disk", async () => {
  await withPage(async (page) => {
    const name = "e2e-dirty";
    const root = await openProject(page);
    const file = themeFile(root, name);
    await take(file);
    try {
      await createThroughStudio(page, name);
      await page.followRail("/colors");
      await page.settle(1200);
      assert(
        await writeToken(page, PRIMARY, "#b91c1c") === "written",
        "the colour control took no value",
      );

      // the overview says the theme is not on disk yet
      await page.followRail("/");
      await page.settle(800);
      const dirty = await editingLine(page);
      assert(
        dirty.endsWith("unsaved changes"),
        `the overview says "${dirty}" about an unsaved edit`,
      );
      const card = await cardText(page, name);
      assert(card.includes("unsaved"), `the card says "${card}"`);

      // saving writes the file and clears the badge
      assert(
        await pressRail(page, "Save to disk") === "pressed",
        "the save control was not available for the edit",
      );
      await page.settle(1200);
      const written = await readFile(file, "utf8");
      assert(
        declaredValue(written, ["color", "primary"]) === "#b91c1c",
        "the file on disk does not hold the edit that was saved",
      );
      const saved = await editingLine(page);
      assert(saved.endsWith("· saved"), `the overview says "${saved}"`);
      const state = await railState(page);
      assert(!state.save, "the save control still offers to write the theme");
    } finally {
      await take(file);
    }
  });
});

test("an edit undone and redone ends where the edit left it", async () => {
  await withPage(async (page) => {
    const name = "e2e-undo";
    const root = await openProject(page);
    const file = themeFile(root, name);
    await take(file);
    try {
      await createThroughStudio(page, name);
      await page.followRail("/colors");
      await page.settle(1200);
      const original = await tokenValue(page, PRIMARY);
      assert(original !== null, "the colour control is not on the page");
      assert(
        await writeToken(page, PRIMARY, "#b91c1c") === "written",
        "the colour control took no value",
      );
      await page.settle(1500);
      assert(
        await previewVar(page, "--color-primary") === "#b91c1c",
        "the preview did not repaint with the edit",
      );

      // undo takes the document back, and the preview with it
      assert(
        await pressRail(page, "Undo") === "pressed",
        "the undo control was not available for the edit",
      );
      await page.settle(1500);
      assert(
        await tokenValue(page, PRIMARY) === original,
        "the document is not where it was before the edit",
      );
      assert(
        await previewVar(page, "--color-primary") === original,
        "the preview did not follow the undo",
      );

      // redo puts the edit back
      assert(
        await pressRail(page, "Redo") === "pressed",
        "the redo control was not available after the undo",
      );
      await page.settle(1500);
      assert(
        await tokenValue(page, PRIMARY) === "#b91c1c",
        "the document is not where the edit left it",
      );
      assert(
        await previewVar(page, "--color-primary") === "#b91c1c",
        "the preview did not follow the redo",
      );
    } finally {
      await take(file);
    }
  });
});

test("undo reaches an edit made on another route", async () => {
  await withPage(async (page) => {
    const name = "e2e-undo-route";
    const root = await openProject(page);
    const file = themeFile(root, name);
    await take(file);
    try {
      await createThroughStudio(page, name);
      await page.followRail("/colors");
      await page.settle(1200);
      const original = await tokenValue(page, PRIMARY);
      assert(original !== null, "the colour control is not on the page");
      assert(
        await writeToken(page, PRIMARY, "#b91c1c") === "written",
        "the colour control took no value",
      );
      await page.settle(1500);

      // the walk to another route keeps the edit
      await page.followRail("/spacing");
      await page.settle(1200);
      assert(
        await previewVar(page, "--color-primary") === "#b91c1c",
        "the preview lost the edit on the way to another route",
      );
      assert(
        await pressRail(page, "Undo") === "pressed",
        "the undo control was not available on another route",
      );
      await page.settle(1500);
      assert(
        await previewVar(page, "--color-primary") === original,
        "the undo on another route did not take the edit back",
      );
    } finally {
      await take(file);
    }
  });
});

test("undo is the seated theme's history, and leaves the other theme alone", async () => {
  await withPage(async (page) => {
    const name = "e2e-undo-theme";
    const root = await openProject(page);
    const file = themeFile(root, name);
    await take(file);
    try {
      await createThroughStudio(page, name);
      await page.followRail("/colors");
      await page.settle(1200);
      const original = await tokenValue(page, PRIMARY);
      assert(original !== null, "the colour control is not on the page");
      assert(
        await writeToken(page, PRIMARY, "#b91c1c") === "written",
        "the colour control took no value",
      );
      await page.settle(1500);

      // another theme's history is its own
      await page.followRail("/");
      await page.settle(800);
      const seated = await seatTheme(page, "neobrut");
      assert(
        seated === "seated",
        `the studio did not seat the other theme: ${seated}`,
      );
      await page.settle(1500);
      const other = await previewVar(page, "--color-primary");
      const declared = (await listedThemes(page)).find((theme) =>
        theme.name === "neobrut"
      );
      assert(declared !== undefined, "the registry lists no neobrut");
      assert(
        other === declaredValue(declared.text, ["color", "primary"]),
        `the other theme renders ${other}`,
      );
      await pressRail(page, "Undo");
      await page.settle(1500);
      assert(
        await previewVar(page, "--color-primary") === other,
        "the undo reached a theme it does not belong to",
      );

      // and the theme it does belong to still has its edit to undo
      const reseated = await seatTheme(page, name);
      assert(
        reseated === "seated",
        `the studio did not seat the edited theme again: ${reseated}`,
      );
      await page.settle(1500);
      assert(
        await pressRail(page, "Undo") === "pressed",
        "the undo control was not available for the edited theme",
      );
      await page.settle(1500);
      assert(
        await previewVar(page, "--color-primary") === original,
        "the undo did not take the theme's own edit back",
      );
    } finally {
      await take(file);
    }
  });
});

test("seating a theme repaints the preview and leaves the studio's chrome alone", async () => {
  await withPage(async (page) => {
    await openStudio(page);
    const listed = await listedThemes(page);
    const spin = listed.find((theme) => theme.name === "spin");
    assert(spin !== undefined, "the registry lists no spin");
    const before = await previewVar(page, "--color-primary");
    const chromeBefore = await chromeVar(page, "--color-primary");
    const chromePaper = await chromeVar(page, "--color-surface");
    assert(
      before !== null && chromeBefore !== null && chromePaper !== null,
      "the studio rendered no colours to compare",
    );

    const seated = await seatTheme(page, "spin");
    assert(
      seated === "seated",
      `the studio did not seat the theme: ${seated}`,
    );
    await page.settle(1500);
    const after = await previewVar(page, "--color-primary");
    assert(
      after === declaredValue(spin.text, ["color", "primary"]),
      `the preview renders ${after}`,
    );
    assert(after !== before, "the preview did not repaint");

    // the chrome wears the studio's own theme, whatever the project says
    assert(
      await chromeVar(page, "--color-primary") === chromeBefore,
      "the chrome repainted with the project theme",
    );
    assert(
      await chromeVar(page, "--color-surface") === chromePaper,
      "the chrome's paper repainted with the project theme",
    );
  });
});

test("a theme with two modes renders the mode the control names", async () => {
  await withPage(async (page) => {
    await openStudio(page);
    const listed = await listedThemes(page);
    const silk = listed.find((theme) => theme.name === "silk");
    assert(silk !== undefined, "the registry lists no silk");
    const seated = await seatTheme(page, "silk");
    assert(
      seated === "seated",
      `the studio did not seat the theme: ${seated}`,
    );
    await page.settle(1200);

    // light
    assert(
      await page.chooseMode("light") === "pressed",
      "the light control is absent",
    );
    await page.settle(1200);
    assert(
      await previewMode(page) === "light",
      `the preview is in ${await previewMode(page)} mode`,
    );
    assert(
      await previewVar(page, "--color-primary") ===
        declaredValue(silk.text, ["color", "primary"]),
      "the preview does not render the theme's own light value",
    );

    // dark
    assert(
      await page.chooseMode("dark") === "pressed",
      "the dark control is absent",
    );
    await page.settle(1200);
    assert(
      await previewMode(page) === "dark",
      `the preview is in ${await previewMode(page)} mode`,
    );
    assert(
      await previewVar(page, "--color-primary") ===
        declaredValue(silk.text, ["color", "primary"], "dark"),
      "the preview does not render the theme's own dark value",
    );

    // and the studio is left in the light, where it was found
    assert(
      await page.chooseMode("light") === "pressed",
      "the light control is absent",
    );
    await page.settle(800);
  });
});

test("a theme scaffolded from the required roles lands on disk and builds", async () => {
  await withPage(async (page) => {
    const name = "e2e-scaffold";
    const root = await openProject(page);
    const file = themeFile(root, name);
    await take(file);
    try {
      const made = await createTheme(page, name, { scaffold: true });
      assert(
        made.accepted,
        `the studio did not take the name "${name}": ${
          made.problem ?? "no message"
        }`,
      );
      const line = await waitForEditing(page, name);
      assert(
        line.startsWith(`Editing ${name}`),
        `the studio is editing "${line}" after scaffolding "${name}"`,
      );

      // the file holds the roles every theme must declare
      const written = await readFile(file, "utf8");
      assert(
        declaredValue(written, ["color", "text"]) !== null,
        "the scaffold does not declare the text role",
      );
      assert(
        declaredValue(written, ["color", "primary"]) !== null,
        "the scaffold does not declare the primary role",
      );

      // and the studio renders what it wrote
      await page.settle(1500);
      const primary = await previewVar(page, "--color-primary");
      assert(
        primary === declaredValue(written, ["color", "primary"]),
        `the preview renders ${primary}`,
      );
    } finally {
      await take(file);
    }
  });
});

test("a theme deleted from the registry leaves the disk", async () => {
  await withPage(async (page) => {
    const name = "e2e-deleted";
    const root = await openProject(page);
    const file = themeFile(root, name);
    await take(file);
    try {
      await createThroughStudio(page, name);
      assert(await there(file), "the created theme is not on disk");

      // the card offers the delete for a theme that is not being edited
      const seated = await seatTheme(page, "silk");
      assert(
        seated === "seated",
        `the studio did not seat another theme: ${seated}`,
      );
      await page.settle(1200);
      assert(
        await deleteFromCard(page, name) === "pressed",
        "the card offered no delete for the theme",
      );
      await page.settle(1200);

      await deepStrictEqual(
        await there(file),
        false,
        "the file the delete removed is still on disk",
      );
      // the theme that was being edited is untouched by the delete
      const line = await waitForEditing(page, "silk");
      assert(
        line.startsWith("Editing silk"),
        `the studio is editing "${line}" after the delete`,
      );
    } finally {
      await take(file);
    }
  });
});

test("a theme file that is not valid JSON is reported, not swallowed", async () => {
  await withPage(async (page) => {
    const name = "e2e-broken";
    const root = await openProject(page);
    const file = themeFile(root, name);
    await take(file);
    try {
      await writeFile(file, "{ not json at all\n");
      await page.reload();
      await page.settle(1500);
      const seated = await seatTheme(page, name);
      assert(
        seated === "seated",
        `the studio did not seat the theme on disk: ${seated}`,
      );
      await page.settle(1500);

      // The checks are a verdict in the rail's foot; the detail is a panel.
      const reported = await page.eval<string>(
        `(() => {
          const trigger = document.querySelector(
            'nav[aria-label="Studio"] [data-testid="checks"]',
          );
          trigger?.click();
          const panel = document.querySelector('dialog[aria-label="Checks"]');
          return (panel?.innerText ?? "").trim();
        })()`,
      );
      assert(
        reported.includes("invalid JSON"),
        `the overview reports "${reported}"`,
      );
      const card = await cardText(page, name);
      assert(card.includes("issue"), `the card says "${card}"`);
    } finally {
      await take(file);
    }
  });
});

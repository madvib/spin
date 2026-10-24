import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
/**
 * The studio's newest surfaces, end to end.
 *
 * Five surfaces the rest of the studio's tests do not reach: the findings
 * panel (what the lints say about the project's own source, and the fix the
 * panel applies on demand), the composite-type editors (a typography taken
 * apart into the theme's own steps), the saved-icons library (the project's
 * own glyphs, and the API that lists them), the colours page's picker (the
 * role a swatch names, and the value the document ends up holding), and the
 * rail's hover (the row the pointer is on).
 *
 * Every action is taken the way an author takes it — through the studio's own
 * controls — and every outcome is read where it is observable: the file on
 * disk, the daemon's own procedures, the document the editor holds, and the
 * page a reader looks at. Nothing here asserts on the studio's internals.
 */

import assert, { deepStrictEqual } from "node:assert/strict";
import { join } from "node:path";
import { test, withPage } from "./harness.ts";
import { type StudioPage, studioUrl } from "./studio.ts";
import {
  declaredValue,
  listedThemes,
  previewVar,
  projectRoot,
  seatTheme,
} from "./themes.ts";

/* -------------------------------------------------------------- the project -- */

/**
 * The studio, with the overlay it publishes closed.
 *
 * The overlay is a process-global cell: it holds the document the studio last
 * pushed, and it outlives the tab that pushed it. A preview generated against
 * it would show a document the studio is not editing, so a test that reads
 * the preview's colours clears it first.
 */
async function openStudio(page: StudioPage): Promise<void> {
  await page.goto(`${studioUrl()}/`);
  await page.clearOverlay(studioUrl());
}

/**
 * The studio, and the project it edits.
 *
 * The daemon reports the project it serves, so a test never has to know where
 * the project lives: it asks, and the answer is the directory the studio's
 * themes and icons are written to.
 */
async function openProject(page: StudioPage): Promise<string> {
  await openStudio(page);
  const root = await projectRoot(page);
  assert(root !== "", "the daemon names no project for the studio to edit");
  return root;
}

/* -------------------------------------------------------------------- the api -- */

/** Where the daemon's procedures live, on the studio's own origin. */
function rpc(path: string): string {
  return new URL(`/__spin/rpc/${path}`, studioUrl()).toString();
}

/**
 * One procedure's answer, read over the API.
 *
 * The same wire the MCP server speaks: a procedure asked here is a procedure
 * an agent asks there, so a fact the studio writes is a fact the API can be
 * asked about.
 */
async function call<T>(path: string): Promise<T> {
  const response = await fetch(rpc(path), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ json: {} }),
  });
  const answer = await response.json() as { json?: T };
  return answer.json as T;
}

/** One finding, as the daemon carries it. */
interface Finding {
  readonly file: string;
  readonly line: number;
  readonly column: number;
  readonly ruleId: string;
  readonly message: string;
  readonly remedy: string | null;
  readonly severity: string;
  readonly fixable: boolean;
}

/** The findings one rule has. */
interface RuleGroup {
  readonly ruleId: string;
  readonly title: string;
  readonly findings: readonly Finding[];
}

/** What the lints say about the project's source. */
interface FindingsReport {
  readonly groups: readonly RuleGroup[];
  readonly unreadable: readonly string[];
  readonly files: number;
}

/** What the lints say about the project's source. */
function findings(): Promise<FindingsReport> {
  return call<FindingsReport>("findings/list");
}

/** A composition the source repeats. */
interface Repetition {
  readonly classes: readonly string[];
  readonly count: number;
  readonly files: readonly string[];
  readonly suggested: string;
}

/** One class list that is not in the order the sheet writes it. */
interface ClassOrderAttribute {
  readonly classes: readonly string[];
  readonly ordered: readonly string[];
}

/** The class lists of one file that are not in order. */
interface ClassOrderFile {
  readonly file: string;
  readonly attributes: readonly ClassOrderAttribute[];
}

/** What the corpus holds about the project's source. */
interface CorpusReport {
  readonly repetition: readonly Repetition[];
  readonly order: readonly ClassOrderFile[];
}

/** The corpus: the repetitions, and the class lists out of order. */
function corpus(): Promise<CorpusReport> {
  return call<CorpusReport>("findings/corpus");
}

/** An icon the project has saved. */
interface SavedIcon {
  readonly name: string;
  readonly markup: string;
  readonly attribution: {
    readonly collection: string | null;
    readonly author: string | null;
    readonly license: string | null;
  };
}

/** The icons the project has saved — what the `savedIcon` tool lists. */
function savedIcons(): Promise<SavedIcon[]> {
  return call<SavedIcon[]>("icons/saved/list");
}

/* ------------------------------------------------------------------- waiting -- */

/**
 * Wait for a reading to become true.
 *
 * A page that answers after a moment is a page that is working: the studio
 * writes to the daemon and reads the answer back, so a test that read once
 * would read a question that had not been answered yet.
 */
async function until<T>(
  read: () => Promise<T>,
  ready: (value: T) => boolean,
  what: string,
  timeoutMs = 20_000,
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await read();
    if (ready(value)) return value;
    if (Date.now() > deadline) {
      throw new Error(`the ${what} did not arrive within ${timeoutMs}ms`);
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
}

/* --------------------------------------------------------------- the fixture -- */

/**
 * A class the theme cannot produce.
 *
 * The rule's own example of one: nothing generates it, so it styles nothing,
 * and the rule that says so can drop it.
 */
const UNKNOWN_CLASS = "e2e-not-a-real-class";

/** The rule that says a class the theme cannot produce is dead weight. */
const VOCABULARY_RULE = "spin/closed-vocabulary";

/** The directory the fixture lives in, inside the project the studio edits. */
function fixtureDir(root: string): string {
  return join(root, "e2e-fixture");
}

/**
 * A source file the lints have something to say about.
 *
 * The project is the studio's own, and it is lint-clean, so a test that wants
 * a finding writes one: a file with a class the theme cannot produce. The
 * file is written before the panel reads the source and taken away after, so
 * the test never depends on the project's source staying dirty.
 */
async function writeFixture(root: string): Promise<string> {
  const dir = fixtureDir(root);
  await mkdir(dir, { recursive: true });
  const file = join(dir, "dirty.tsx");
  await writeFile(
    file,
    `export const Dirty = () => <div class="${UNKNOWN_CLASS}">dirty</div>;\n`,
  );
  return file;
}

/** Take the fixture away, and the directory it lived in with it. */
async function removeFixture(root: string): Promise<void> {
  try {
    await rm(fixtureDir(root), { recursive: true });
  } catch {
    // It was not there to begin with.
  }
}

/** Whether a file is there. */
async function there(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

/* ---------------------------------------------------------------- the panel -- */

/** The group the panel draws for one rule. */
interface DrawnGroup {
  readonly ruleId: string;
  readonly title: string;
  readonly messages: readonly string[];
}

/**
 * The rule groups the panel draws, read off the page.
 *
 * A group is one rule's findings, and it is drawn inside the lints section —
 * so the groups are the sections under it, each named by the rule that said
 * them.
 */
async function drawnGroups(page: StudioPage): Promise<DrawnGroup[]> {
  return await page.eval<DrawnGroup[]>(
    `(() => {
      const lints = document.querySelector('section[aria-label="The lints"]');
      if (!lints) return [];
      return [...lints.querySelectorAll("section[aria-label]")].map((group) => ({
        ruleId: group.getAttribute("aria-label") ?? "",
        title: (group.querySelector("h2")?.textContent ?? "").trim(),
        messages: [...group.querySelectorAll("p")].map((p) => (p.textContent ?? "").trim()),
      }));
    })()`,
  );
}

/** What the lints section says. */
async function lintsText(page: StudioPage): Promise<string> {
  return await page.eval<string>(
    `(() => {
      const lints = document.querySelector('section[aria-label="The lints"]');
      return (lints?.innerText ?? "").trim();
    })()`,
  );
}

/**
 * The panel agrees with the lints.
 *
 * The panel draws a group for every rule the lints named, under the rule's
 * own title, and says so plainly when the lints have nothing to say. The
 * report is read from the daemon, so the panel is measured against the truth
 * rather than against a count written down here.
 */
async function assertPanelAgrees(
  page: StudioPage,
  report: FindingsReport,
): Promise<void> {
  const drawn = await drawnGroups(page);
  deepStrictEqual(
    drawn.length,
    report.groups.length,
    `the panel draws ${drawn.length} groups and the lints named ${report.groups.length}`,
  );
  for (const group of report.groups) {
    const one = drawn.find((candidate) => candidate.ruleId === group.ruleId);
    assert(
      one !== undefined,
      `the panel draws no group for ${group.ruleId}`,
    );
    deepStrictEqual(
      one.title,
      group.title,
      `the group for ${group.ruleId} is not titled by the rule`,
    );
  }
  const said = await lintsText(page);
  if (report.groups.length === 0) {
    assert(
      said.includes("Nothing to report"),
      `the lints section reads "${said}"`,
    );
  }
}

/* ------------------------------------------------------------ the findings -- */

test("the findings panel groups what the lints say by the rule that said it", async () => {
  await withPage(async (page) => {
    const root = await openProject(page);
    await writeFixture(root);
    try {
      await page.followRail("/findings");
      await page.settle(2000);

      const report = await findings();
      const group = report.groups.find((candidate) =>
        candidate.ruleId === VOCABULARY_RULE
      );
      assert(
        group !== undefined,
        `the lints said nothing about the class the fixture carries: ${
          report.groups.map((candidate) => candidate.ruleId).join(", ")
        }`,
      );
      const finding = group.findings.find((candidate) =>
        candidate.message.includes(UNKNOWN_CLASS)
      );
      assert(
        finding !== undefined,
        `no finding names the class the fixture carries: ${
          group.findings.map((candidate) => candidate.message).join(" | ")
        }`,
      );

      // the group is named by the rule, and titled in the rule's own words
      const drawn = await drawnGroups(page);
      const one = drawn.find((candidate) => candidate.ruleId === group.ruleId);
      assert(one !== undefined, `the panel draws no group for ${group.ruleId}`);
      deepStrictEqual(
        one.title,
        group.title,
        "the group is not titled by the rule",
      );

      // and the finding carries the rule's own sentence
      assert(
        one.messages.includes(finding.message),
        `the finding does not carry the rule's own message: ${
          one.messages.join(" | ")
        }`,
      );

      // the corpus's two facts stand beside the findings
      const facts = await corpus();
      const repetitions = await page.eval<{ classes: string; text: string }[]>(
        `(() => {
          const section = document.querySelector('section[aria-label="Repetition"]');
          if (!section) return [];
          return [...section.querySelectorAll("li")].map((row) => ({
            classes: (row.querySelector("code")?.textContent ?? "").trim(),
            text: (row.innerText ?? "").trim(),
          }));
        })()`,
      );
      for (const repetition of facts.repetition) {
        const row = repetitions.find((candidate) =>
          candidate.classes === repetition.classes.join(" ")
        );
        assert(
          row !== undefined,
          `the repetition section does not list ${
            repetition.classes.join(" ")
          }`,
        );
        assert(
          row.text.includes(`${repetition.count} times`),
          `the repetition of ${
            repetition.classes.join(" ")
          } does not say how often it is written`,
        );
      }

      const orders = await page.eval<{ file: string; text: string }[]>(
        `(() => {
          const section = document.querySelector('section[aria-label="Class order"]');
          if (!section) return [];
          return [...section.querySelectorAll("li")].map((row) => ({
            file: (row.querySelector("code")?.textContent ?? "").trim(),
            text: (row.innerText ?? "").trim(),
          }));
        })()`,
      );
      for (const file of facts.order) {
        const row = orders.find((candidate) => candidate.file === file.file);
        assert(
          row !== undefined,
          `the class order section does not list ${file.file}`,
        );
        for (const attribute of file.attributes) {
          assert(
            row.text.includes(attribute.ordered.join(" ")),
            `the class order section does not say how ${file.file} reads in order`,
          );
        }
      }
    } finally {
      await removeFixture(root);
    }
  });
});

test("the findings panel reads the truth when the lints have nothing to say", async () => {
  await withPage(async (page) => {
    await openStudio(page);
    await page.followRail("/findings");
    await page.settle(2000);

    const report = await findings();
    await assertPanelAgrees(page, report);
  });
});

test("a fix applied from the panel changes the file, and the finding goes away", async () => {
  await withPage(async (page) => {
    const root = await openProject(page);
    const file = await writeFixture(root);
    try {
      await page.followRail("/findings");
      await page.settle(2000);

      const report = await findings();
      const group = report.groups.find((candidate) =>
        candidate.ruleId === VOCABULARY_RULE
      );
      assert(group !== undefined, "the lints said nothing about the fixture");
      const finding = group.findings.find((candidate) =>
        candidate.message.includes(UNKNOWN_CLASS)
      );
      assert(
        finding !== undefined,
        "no finding names the class the fixture carries",
      );
      assert(
        finding.remedy !== null,
        "the rule offers no way out for the finding",
      );

      // the panel offers the rule's own way out, on the finding's own row
      const pressed = await page.eval<string>(
        `(async () => {
          const group = document.querySelector('section[aria-label=${
          JSON.stringify(VOCABULARY_RULE)
        }]');
          if (!group) return "no-group";
          const row = [...group.querySelectorAll("li")].find((li) =>
            (li.innerText ?? "").includes(${JSON.stringify(finding.message)})
          );
          if (!row) return "no-row";
          const button = [...row.querySelectorAll("button")].find((b) =>
            (b.getAttribute("title") ?? "") === ${
          JSON.stringify(finding.remedy)
        }
          );
          if (!button) return "no-offer";
          button.click();
          await new Promise((resolve) => setTimeout(resolve, 2500));
          return "pressed";
        })()`,
      );
      deepStrictEqual(
        pressed,
        "pressed",
        "the panel offered no fix for the finding",
      );

      // the file on disk no longer carries the class the rule said to drop
      const written = await until(
        async () => await readFile(file, "utf8"),
        (text) => !text.includes(UNKNOWN_CLASS),
        "the fix on the disk",
      );
      assert(
        !written.includes(UNKNOWN_CLASS),
        "the file on disk still carries the class the rule said to drop",
      );

      // and the lints have nothing to say about it any more
      const after = await until(
        findings,
        (report) =>
          !report.groups.some((candidate) =>
            candidate.findings.some((entry) =>
              entry.file === finding.file &&
              entry.message.includes(UNKNOWN_CLASS)
            )
          ),
        "the finding to go away",
      );
      await assertPanelAgrees(page, after);
    } finally {
      await removeFixture(root);
    }
  });
});

/* -------------------------------------------------------------- the composite -- */

/** One part of a composite, as the editor shows it. */
interface CompositeRow {
  readonly path: string;
  readonly value: string;
  readonly parts: Record<string, string>;
}

/**
 * The composite token's row, read off the type page.
 *
 * The row carries the token's path, the value the theme holds for it, and the
 * four parts the editor took it apart into — each named by the step the theme
 * calls that part.
 */
async function compositeRow(
  page: StudioPage,
  path: string,
): Promise<CompositeRow | null> {
  return await page.eval<CompositeRow | null>(
    `(() => {
      const section = document.querySelector('section[aria-label="Type in one token"]');
      if (!section) return null;
      const row = [...section.querySelectorAll("li")].find((li) =>
        (li.querySelector("code")?.textContent ?? "").trim() === ${
      JSON.stringify(path)
    }
      );
      if (!row) return null;
      const codes = [...(row.firstElementChild?.querySelectorAll("code") ?? [])]
        .map((code) => (code.textContent ?? "").trim());
      const parts = {};
      for (const label of row.querySelectorAll("label")) {
        const name = (label.firstChild?.textContent ?? "").trim();
        const trigger = label.querySelector('button[aria-haspopup="listbox"]');
        parts[name] = (trigger?.getAttribute("aria-label") ?? "").split(": ")[1] ?? "";
      }
      return { path: codes[0] ?? "", value: codes[1] ?? "", parts };
    })()`,
  );
}

/** One step the editor offers, as the panel draws it. */
interface StepOption {
  readonly name: string;
  readonly value: string;
  readonly selected: boolean;
}

/**
 * The steps the editor offers for one part.
 *
 * The panel is opened the way a reader opens it — the trigger, then the
 * option — and the steps are read off the panel the theme's own ladder
 * filled.
 */
async function openSteps(
  page: StudioPage,
  part: string,
): Promise<StepOption[]> {
  return await page.eval<StepOption[]>(
    `(async () => {
      const trigger = document.querySelector('button[aria-haspopup="listbox"][aria-label^=${
      JSON.stringify(`${part}: `)
    }]');
      if (!trigger) return [];
      trigger.click();
      await new Promise((resolve) => setTimeout(resolve, 400));
      const panel = document.querySelector('div[role="listbox"][aria-label^=${
      JSON.stringify(`${part}: `)
    }]');
      if (!panel) return [];
      return [...panel.querySelectorAll('button[role="option"]')].map((option) => {
        const spans = [...option.querySelectorAll("span")];
        return {
          name: (spans[0]?.textContent ?? "").trim(),
          value: (spans[1]?.textContent ?? "").trim(),
          selected: option.getAttribute("aria-selected") === "true",
        };
      });
    })()`,
  );
}

/** The step the editor is holding, and the one to hold next. */
async function pickStep(
  page: StudioPage,
  part: string,
  name: string,
): Promise<string> {
  return await page.eval<string>(
    `(async () => {
      const panel = document.querySelector('div[role="listbox"][aria-label^=${
      JSON.stringify(`${part}: `)
    }]');
      if (!panel) return "no-panel";
      const option = [...panel.querySelectorAll('button[role="option"]')].find((o) =>
        (o.querySelector("span")?.textContent ?? "").trim() === ${
      JSON.stringify(name)
    }
      );
      if (!option) return "no-step";
      option.click();
      await new Promise((resolve) => setTimeout(resolve, 1200));
      return "picked";
    })()`,
  );
}

test("a composite token opens an editor of the theme's own steps, and one part written back leaves the rest", async () => {
  await withPage(async (page) => {
    await openStudio(page);
    const seated = await seatTheme(page, "synthwave");
    deepStrictEqual(
      seated,
      "seated",
      "the studio did not seat the theme under edit",
    );
    await page.followRail("/type");
    await page.settle(2000);

    // the theme under edit, and the value it declares for the token
    const themes = await listedThemes(page);
    const theme = themes.find((candidate) => candidate.name === "synthwave");
    assert(theme !== undefined, "the registry lists no synthwave");
    const declared = declaredValue(theme.text, ["font", "typography", "body"]);
    assert(declared !== null, "synthwave declares no font.typography.body");

    // the row shows the theme's own value
    const row = await compositeRow(page, "font.typography.body");
    assert(row !== null, "the type page draws no row for font.typography.body");
    deepStrictEqual(
      row.value,
      declared,
      "the row does not show the theme's own value",
    );

    // and each part is the theme's own step
    deepStrictEqual(
      row.parts,
      { Family: "sans", Size: "lg", Weight: "regular", Tracking: "normal" },
      "the editor's parts are not the theme's own steps",
    );

    // the size step offers the theme's own ladder
    const steps = await openSteps(page, "Size");
    const sizes = Object.entries(
      JSON.parse(theme.text).font.size as Record<string, { $value: unknown }>,
    )
      .filter(([name]) => !name.startsWith("$"))
      .map(([name, leaf]) => ({ name, value: String(leaf.$value) }));
    deepStrictEqual(
      steps.map((step) => ({ name: step.name, value: step.value })),
      sizes,
      "the editor does not offer the theme's own size steps",
    );

    // a step the theme declares and the token does not hold yet
    const held = steps.find((step) => step.selected);
    assert(held !== undefined, "the editor holds no step");
    const next = sizes.find((step) => step.value !== held.value);
    assert(next !== undefined, "the theme declares no other size step");

    const picked = await pickStep(page, "Size", next.name);
    deepStrictEqual(picked, "picked", "the editor did not take the step");

    // the token is written back in the theme's own spelling
    assert(
      declared.split(held.value).length === 2,
      "the size the token holds appears more than once in its value",
    );
    const written = await compositeRow(page, "font.typography.body");
    assert(
      written !== null,
      "the type page draws no row for font.typography.body",
    );
    assert(written.value !== declared, "the edit did not move the token");
    deepStrictEqual(
      written.value,
      declared.replace(held.value, next.value),
      "the token is not written back in the theme's spelling",
    );

    // and the parts it did not touch are the parts that were there
    deepStrictEqual(
      {
        Family: written.parts.Family,
        Weight: written.parts.Weight,
        Tracking: written.parts.Tracking,
      },
      { Family: "sans", Weight: "regular", Tracking: "normal" },
      "the parts the edit did not touch have moved",
    );
    deepStrictEqual(
      written.parts.Size,
      next.name,
      "the editor does not hold the step that was picked",
    );

    await page.clearOverlay(studioUrl());
  });
});

/* --------------------------------------------------------------- the library -- */

/** The glyph the library test keeps, and the collection it comes from. */
const GLYPH = "flame";
const COLLECTION = "lucide";

/** The file one saved icon is written to. */
function iconFile(root: string, name: string): string {
  return join(root, "spin", "icons", `${name}.json`);
}

/** The icons the project holds on disk, by name. */
async function iconsOnDisk(root: string): Promise<string[]> {
  const dir = join(root, "spin", "icons");
  const names: string[] = [];
  try {
    for await (const entry of await readdir(dir)) {
      if (entry.isFile && entry.name.endsWith(".json")) {
        names.push(entry.name.replace(/\.json$/, ""));
      }
    }
  } catch {
    // A project with no library has no directory.
  }
  return names.sort();
}

test("the saved icons library keeps what the studio saved, and the api lists it", async () => {
  await withPage(async (page) => {
    const root = await openProject(page);
    const file = iconFile(root, GLYPH);
    await rm(file).catch(() => {
      // It was not there to begin with.
    });
    try {
      await page.followRail("/icons");
      await page.settle(2500);

      // find the glyph, and look at it
      const found = await page.eval<string>(
        `(async () => {
          const search = document.querySelector('input[type="search"]');
          if (!search) return "no-search";
          search.value = ${JSON.stringify(GLYPH)};
          search.dispatchEvent(new Event("input", { bubbles: true }));
          await new Promise((resolve) => setTimeout(resolve, 900));
          const glyph = document.querySelector(${
          JSON.stringify(`button[aria-label="Copy i-${COLLECTION}-${GLYPH}"]`)
        });
          if (!glyph) return "no-glyph";
          glyph.click();
          await new Promise((resolve) => setTimeout(resolve, 900));
          return "chosen";
        })()`,
      );
      deepStrictEqual(found, "chosen", "the glyph was not chosen");

      // keep it
      const kept = await page.eval<string>(
        `(async () => {
          const button = [...document.querySelectorAll("button")].find((b) =>
            b.textContent.trim() === "Keep in library"
          );
          if (!button) return "no-offer";
          button.click();
          await new Promise((resolve) => setTimeout(resolve, 2000));
          return "kept";
        })()`,
      );
      deepStrictEqual(kept, "kept", "the page offered no way to keep the glyph");

      // the project holds the glyph, on disk
      const written = JSON.parse(
        await until(
          async () => await readFile(file, "utf8"),
          (text) => text.includes("<svg"),
          "the saved icon on the disk",
        ),
      ) as { markup: string; attribution: { collection: string | null } };
      assert(
        written.markup.includes("<svg"),
        "the file does not hold the glyph's markup",
      );
      deepStrictEqual(
        written.attribution.collection,
        COLLECTION,
        "the file does not say where the glyph came from",
      );

      // and the api lists what the studio saved — the `savedIcon` tool's answer
      const listed = await until(
        savedIcons,
        (icons) => icons.some((icon) => icon.name === GLYPH),
        "the saved icon in the api",
      );
      deepStrictEqual(
        listed.map((icon) => icon.name),
        await iconsOnDisk(root),
        "the api does not list the icons the project holds",
      );
      const icon = listed.find((candidate) => candidate.name === GLYPH);
      assert(
        icon !== undefined,
        "the api does not list the icon the studio saved",
      );
      deepStrictEqual(icon.markup, written.markup, "the api holds other markup");

      // and the page's library says so
      const library = await page.eval<string>(
        `(() => {
          const section = [...document.querySelectorAll("section")].find((s) =>
            (s.querySelector("h2")?.textContent ?? "") === "Saved icons"
          );
          return (section?.innerText ?? "").trim();
        })()`,
      );
      assert(
        library.includes(GLYPH),
        `the library does not list the glyph: ${library}`,
      );

      // take it away again
      const removed = await page.eval<string>(
        `(async () => {
          const button = document.querySelector(${
          JSON.stringify(
            `button[aria-label="Remove ${GLYPH} from the library"]`,
          )
        });
          if (!button) return "no-offer";
          button.click();
          await new Promise((resolve) => setTimeout(resolve, 2000));
          return "removed";
        })()`,
      );
      deepStrictEqual(
        removed,
        "removed",
        "the library offered no way to remove the glyph",
      );

      // the api lists exactly the icons the project holds — which is none
      const after = await until(
        savedIcons,
        (icons) => icons.every((icon) => icon.name !== GLYPH),
        "the saved icon to leave the api",
      );
      deepStrictEqual(
        after.map((icon) => icon.name),
        await iconsOnDisk(root),
        "the api still lists an icon the project does not hold",
      );
      deepStrictEqual(
        await there(file),
        false,
        "the file the remove took away is still on disk",
      );
      const emptied = await page.eval<string>(
        `(() => {
          const section = [...document.querySelectorAll("section")].find((s) =>
            (s.querySelector("h2")?.textContent ?? "") === "Saved icons"
          );
          return (section?.innerText ?? "").trim();
        })()`,
      );
      assert(
        emptied.includes("Nothing kept yet"),
        `the library does not say it is empty: ${emptied}`,
      );
    } finally {
      await rm(file).catch(() => {
        // It was not there to begin with.
      });
      // The drawer the daemon made for the library goes with it, when the
      // library was the only thing in it.
      await rm(join(root, "spin", "icons")).catch(() => {
        // Another icon is in there, or it was never made.
      });
    }
  });
});

/* ---------------------------------------------------------------- the colours -- */

/** The role the colours page's picker is pointed at. */
const ROLE = "accent";

/** The value the picker writes, in the theme's own spelling. */
const WRITTEN = "oklch(40% 0.1 220)";

/** The token the role is pointed at, and the colour that answers. */
const REFERENCE = "color.secondary";

test("the colours page's picker opens for the role the swatch names, and writes the theme's own spelling", async () => {
  await withPage(async (page) => {
    await openStudio(page);
    await page.followRail("/colors");
    await page.settle(2000);

    // the swatch hands its role to the picker
    const heading = await page.eval<string>(
      `(async () => {
        const swatch = document.querySelector(${
        JSON.stringify(`button[aria-label="Edit ${ROLE}"]`)
      });
        if (!swatch) return "no-swatch";
        swatch.click();
        await new Promise((resolve) => setTimeout(resolve, 600));
        const title = [...document.querySelectorAll("h3")].find((h) =>
          (h.textContent ?? "").startsWith("Editing")
        );
        return (title?.textContent ?? "").trim();
      })()`,
    );
    deepStrictEqual(
      heading,
      `Editing ${ROLE}`,
      "the picker did not open for the role",
    );

    // the value the picker writes lands as the theme's own spelling
    const wrote = await page.eval<string>(
      `(async () => {
        const field = document.querySelector(${
        JSON.stringify(`input[aria-label="color.${ROLE} value in light"]`)
      });
        if (!field) return "no-field";
        field.value = ${JSON.stringify(WRITTEN)};
        field.dispatchEvent(new Event("input", { bubbles: true }));
        field.dispatchEvent(new Event("change", { bubbles: true }));
        await new Promise((resolve) => setTimeout(resolve, 1200));
        return "written";
      })()`,
    );
    deepStrictEqual(wrote, "written", "the picker took no value");
    deepStrictEqual(
      await previewVar(page, "--color-accent"),
      WRITTEN,
      "the document does not hold the value the picker wrote",
    );

    // a reference can be pointed at another token
    const pointed = await page.eval<string>(
      `(async () => {
        const field = document.querySelector('input[aria-label="color.accent value in light"]');
        if (!field) return "no-field";
        const slot = field.closest("div.rounded-md");
        const target = slot
          ? [...slot.querySelectorAll("button[title]")].find((b) =>
            b.getAttribute("title") === ${JSON.stringify(REFERENCE)}
          )
          : undefined;
        if (!target) return "no-target";
        target.click();
        await new Promise((resolve) => setTimeout(resolve, 1200));
        return "pointed";
      })()`,
    );
    deepStrictEqual(pointed, "pointed", "the picker offered no token to point at");

    // the role now reads as computed, and holds the reference
    const role = await page.eval<{ raw: string; slot: string; hex: string }>(
      `(() => {
        const field = document.querySelector('input[aria-label="color.accent value in light"]');
        const box = field?.closest("div.rounded-md")?.parentElement?.parentElement;
        const title = [...document.querySelectorAll("h3")].find((h) =>
          (h.textContent ?? "").startsWith("Editing")
        );
        const picker = title?.closest("div.rounded-md");
        const lines = picker
          ? [...picker.querySelectorAll("p")].map((p) => (p.textContent ?? "").trim())
          : [];
        const hex = picker?.querySelector('button[aria-label^="Copy "]');
        return {
          raw: field?.value ?? "",
          slot: lines.find((line) => line.startsWith("computed")) ?? "",
          hex: hex?.getAttribute("aria-label") ?? "",
        };
      })()`,
    );
    deepStrictEqual(
      role.raw,
      `{${REFERENCE}}`,
      "the document does not hold the reference the picker was pointed at",
    );
    assert(
      role.slot.includes(REFERENCE),
      `the picker does not say the role is computed: ${role.slot}`,
    );

    // and the role reads as the colour it now points at
    const themes = await listedThemes(page);
    const theme = themes.find((candidate) => candidate.name === "silk");
    assert(theme !== undefined, "the registry lists no silk");
    const referenced = declaredValue(
      theme.text,
      REFERENCE.split("."),
    );
    assert(referenced !== null, "the theme declares no color.secondary");
    deepStrictEqual(
      role.hex,
      `Copy ${referenced}`,
      "the role does not read as the colour it points at",
    );

    await page.clearOverlay(studioUrl());
  });
});

/* ------------------------------------------------------------------- the rail -- */

/**
 * The background a rail row wears.
 *
 * The row is read at rest and under the pointer: the rail marks the row the
 * pointer is on, and the mark is the theme's own surface.
 */
async function rowBackground(page: StudioPage): Promise<string | null> {
  return await page.eval<string | null>(
    `(() => {
      const row = document.querySelector('nav a[href^="/findings"]');
      if (!row) return null;
      return getComputedStyle(row).backgroundColor;
    })()`,
  );
}

/** The colour the studio's own surface paints, as the browser resolves it. */
async function chromeSurface(page: StudioPage): Promise<string | null> {
  return await page.eval<string | null>(
    `(() => {
      const chrome = document.querySelector('[data-theme="studio"]');
      if (!chrome) return null;
      const probe = document.createElement("div");
      probe.style.background = "var(--color-surface)";
      chrome.appendChild(probe);
      const painted = getComputedStyle(probe).backgroundColor;
      probe.remove();
      return painted;
    })()`,
  );
}

test("the rail marks the row the pointer is on, and lets it go when the pointer parks", async () => {
  await withPage(async (page) => {
    await openStudio(page);
    const resting = await rowBackground(page);
    assert(resting !== null, "the rail draws no row for the findings page");
    deepStrictEqual(
      resting,
      "rgba(0, 0, 0, 0)",
      "the rail row wears a paint of its own at rest",
    );

    const hovered = await page.hover('nav a[href^="/findings"]');
    deepStrictEqual(hovered, "hovered", "the rail row could not be hovered");
    const marked = await rowBackground(page);
    const surface = await chromeSurface(page);
    assert(surface !== null, "the studio's chrome wears no surface of its own");
    deepStrictEqual(
      marked,
      surface,
      "the hovered rail row does not wear the theme's surface",
    );

    await page.parkPointer();
    await page.settle(400);
    deepStrictEqual(
      await rowBackground(page),
      resting,
      "the rail row keeps the hover mark after the pointer parks",
    );
  });
});

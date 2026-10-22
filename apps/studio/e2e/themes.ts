/**
 * The studio's theme actions, driven the way an author drives them.
 *
 * The vocabulary the theme tests speak: the dialog that creates a theme, the
 * picker that seats one, the card that deletes one, the rail's save, and the
 * project's own themes directory — read from the daemon the studio is
 * talking to, so a test never has to know where the project lives.
 *
 * Every step here is one an author can take in a tab against the running
 * dev server. Nothing is a test hook: the studio is driven through the
 * controls it draws, and the outcome is read where it is observable.
 */

import { join } from "node:path";
import type { StudioPage } from "./studio.ts";

/** The directory a project's themes live in, under the project root. */
const THEMES_DIR = "spin";

/** The project the studio is editing, as the daemon reports it. */
export async function projectRoot(page: StudioPage): Promise<string> {
  const report = await page.eval<{ root?: string } | null>(
    `(async () => {
      const body = await fetch("/__spin/rpc/project/current", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ json: {} }),
      }).then((r) => r.json());
      return body.json ?? null;
    })()`,
  );
  return report?.root ?? "";
}

/** One theme's file in the project's themes directory. */
export function themeFile(root: string, name: string): string {
  return join(root, THEMES_DIR, `${name}.json`);
}

/** A theme the project serves. */
export interface ListedTheme {
  /** The file stem, and the name the studio knows it by. */
  readonly name: string;
  /** The document, as the registry read it. */
  readonly text: string;
  /** The project's path, or `null` for a starter the project has not forked. */
  readonly file: string | null;
}

/** The themes the project serves, as the studio's own registry lists them. */
export async function listedThemes(page: StudioPage): Promise<ListedTheme[]> {
  return await page.eval<ListedTheme[]>(
    `(async () => {
      const body = await fetch("/__spin/rpc/project/themes/list", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ json: {} }),
      }).then((r) => r.json());
      return body.json ?? [];
    })()`,
  );
}

/** The line the overview names the editor with. */
export async function editingLine(page: StudioPage): Promise<string> {
  return await page.eval<string>(
    `(() => {
      const t = document.getElementById("app")?.innerText ?? "";
      const line = (t.split("\\n").find((l) => l.trim().indexOf("Editing") === 0) || "").trim();
      return line === "" ? "no status line: " + t.slice(0, 200).replace(/\\s+/g, " ") : line;
    })()`,
  );
}

/**
 * The line the overview names the editor with, once the studio has drawn it.
 *
 * The overview waits for the registry before it draws, and the registry is
 * refetched after every create and every delete — so the page is briefly
 * not there while the project answers again. Waiting for the line is
 * waiting for the studio, not for the test.
 */
export async function waitForEditing(
  page: StudioPage,
  name: string,
  timeoutMs = 10_000,
): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const line = await editingLine(page);
    if (line.startsWith(`Editing ${name}`)) return line;
    if (Date.now() > deadline) return line;
    await page.settle(200);
  }
}

/** The card one theme's summary is drawn on. */
export async function cardText(
  page: StudioPage,
  name: string,
): Promise<string> {
  return await page.eval<string>(
    `(() => {
      const card = [...document.querySelectorAll("article")].find((c) =>
        [...c.querySelectorAll("button")].some((b) => b.textContent.trim() === ${
      JSON.stringify(name)
    })
      );
      return (card?.innerText ?? "").trim();
    })()`,
  );
}

/**
 * Seat a theme through the panel, and wait for the preview to wear it.
 *
 * The panel is the studio's own control for this — a swatch opens it, a row
 * applies a theme — and the preview's `data-theme` is what the studio
 * renders the seated theme under, so both are read here rather than the
 * studio's internal state.
 *
 * The registry is refetched after every create and every delete, so a theme
 * the panel does not offer yet is a theme the registry has not answered
 * with: the row is waited for before the answer is taken for a no.
 */
export async function seatTheme(
  page: StudioPage,
  name: string,
): Promise<string> {
  return await page.eval<string>(
    `(async () => {
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      const button = document.querySelector('[data-testid="theme-picker"]');
      if (!button) return "no-picker";
      button.click();
      await wait(300);
      const selector = '[role="option"][data-theme=' + ${
      JSON.stringify(name)
    } + ']';
      const deadline = Date.now() + 15000;
      while (!document.querySelector(selector)) {
        if (Date.now() > deadline) return "not-offered";
        await wait(100);
      }
      document.querySelector(selector).click();
      for (let i = 0; i < 150; i++) {
        const pane = document.querySelector(".spin-preview");
        if (pane && pane.getAttribute("data-theme") === ${
      JSON.stringify(name)
    }) return "seated";
        await wait(100);
      }
      return "not-seated";
    })()`,
  );
}

/** What the studio says about a creation it was asked to make. */
export interface CreateOutcome {
  /** The dialog closed: the studio took the name. */
  readonly accepted: boolean;
  /** What the studio said, when it said anything. */
  readonly problem: string | null;
}

/**
 * The "New theme" dialog, filled in and sent.
 *
 * The two ways in are the dialog's own: a copy of a theme the project
 * serves, or a scaffold of the required roles. `source` names the theme to
 * copy; `scaffold` asks for the other one.
 */
export async function createTheme(
  page: StudioPage,
  name: string,
  options: { readonly source?: string; readonly scaffold?: boolean } = {},
): Promise<CreateOutcome> {
  return await page.eval<CreateOutcome>(
    `(async () => {
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      const opener = [...document.querySelectorAll("button")].find((b) =>
        b.textContent.trim() === "New theme"
      );
      if (!opener) return { accepted: false, problem: "no-opener" };
      opener.click();
      await wait(500);
      const dialog = document.querySelector('dialog[aria-label="New theme"]');
      if (!dialog) return { accepted: false, problem: "no-dialog" };
      const field = dialog.querySelector('input[type="text"]');
      if (!field) return { accepted: false, problem: "no-field" };
      field.value = ${JSON.stringify(name)};
      field.dispatchEvent(new Event("input", { bubbles: true }));
      ${
      options.scaffold === true
        ? `const radios = [...dialog.querySelectorAll('input[type="radio"]')];
      const scaffold = radios.find((r) =>
        (r.parentElement?.innerText ?? "").indexOf("Scaffold") > -1
      );
      if (!scaffold) return { accepted: false, problem: "no-scaffold-choice" };
      scaffold.click();
      await wait(200);`
        : `// The source is a radio per theme: a native select is drawn by the
      // browser, and the studio does not wear the browser's idea of a
      // control. The rows arrive with the registry's answer.
      const source = ${JSON.stringify(options.source ?? "")};
      let radio = null;
      for (let i = 0; i < 50; i++) {
        const rows = [...dialog.querySelectorAll(
          'input[name="new-theme-source-theme"]',
        )];
        if (rows.length === 0) return { accepted: false, problem: "no-source-chooser" };
        radio = rows.find((row) => row.value === source) ?? null;
        if (radio) break;
        await wait(100);
      }
      if (!radio) return { accepted: false, problem: "no-source-choice" };
      radio.click();
      await wait(200);`
    }
      const create = [...dialog.querySelectorAll("button")].find((b) =>
        b.textContent.trim() === "Create"
      );
      if (!create) return { accepted: false, problem: "no-create-button" };
      create.click();
      for (let i = 0; i < 80; i++) {
        const alert = document.querySelector(
          'dialog[aria-label="New theme"] [role="alert"]',
        );
        if (alert) {
          return { accepted: false, problem: (alert.textContent ?? "").trim() };
        }
        if (!document.querySelector('dialog[aria-label="New theme"]')) {
          return { accepted: true, problem: null };
        }
        await wait(100);
      }
      return { accepted: false, problem: "the dialog stayed open" };
    })()`,
  );
}

/**
 * Delete a theme from its card.
 *
 * The card's control asks once: the first press arms it, the second
 * removes it. The outcome is what the studio does with the file, so the
 * answer is the file's own.
 */
export async function deleteFromCard(
  page: StudioPage,
  name: string,
): Promise<string> {
  return await page.eval<string>(
    `(async () => {
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      const card = [...document.querySelectorAll("article")].find((c) =>
        [...c.querySelectorAll("button")].some((b) => b.textContent.trim() === ${
      JSON.stringify(name)
    })
      );
      if (!card) return "no-card";
      const remove = card.querySelector('button[title="Delete this theme"]');
      if (!remove) return "no-delete-control";
      remove.click();
      await wait(400);
      remove.click();
      await wait(1500);
      return "pressed";
    })()`,
  );
}

/** The rail's own controls, and whether each one is available. */
export interface RailState {
  readonly undo: boolean;
  readonly redo: boolean;
  readonly save: boolean;
}

/** What the top bar offers: undo, redo and save, each enabled or not. */
export async function railState(page: StudioPage): Promise<RailState> {
  return await page.eval<RailState>(
    `(() => {
      const bar = document.querySelector('header[aria-label="Document controls"]');
      const one = (label) => {
        const b = [...(bar?.querySelectorAll("button") ?? [])].find((x) =>
          x.getAttribute("aria-label") === label
        );
        return b === undefined ? false : b.disabled === false;
      };
      return { undo: one("Undo"), redo: one("Redo"), save: one("Save to disk") };
    })()`,
  );
}

/**
 * Press one of the top bar's controls.
 *
 * The bar's controls are glyphs: they are named by their `aria-label`, not by
 * a text a press could look for. The rail is navigation; the verbs that
 * answer the editing state live in the top bar.
 */
export async function pressRail(
  page: StudioPage,
  label: string,
): Promise<string> {
  return await page.eval<string>(
    `(async () => {
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      const bar = document.querySelector('header[aria-label="Document controls"]');
      const b = [...(bar?.querySelectorAll("button") ?? [])].find((x) =>
        x.getAttribute("aria-label") === ${JSON.stringify(label)}
      );
      if (!b) return "absent";
      if (b.disabled) return "disabled";
      b.click();
      await wait(1200);
      return "pressed";
    })()`,
  );
}

/** A custom property, as the preview pane renders it. */
export async function previewVar(
  page: StudioPage,
  name: string,
): Promise<string | null> {
  return await page.eval<string | null>(
    `(() => {
      const pane = document.querySelector(".spin-preview");
      if (!pane) return null;
      return getComputedStyle(pane).getPropertyValue(${
      JSON.stringify(name)
    }).trim();
    })()`,
  );
}

/** A custom property, as the studio's own chrome renders it. */
export async function chromeVar(
  page: StudioPage,
  name: string,
): Promise<string | null> {
  return await page.eval<string | null>(
    `(() => {
      const chrome = document.querySelector('[data-theme="studio"]');
      if (!chrome) return null;
      return getComputedStyle(chrome).getPropertyValue(${
      JSON.stringify(name)
    }).trim();
    })()`,
  );
}

/** The mode the preview is rendered in. */
export async function previewMode(page: StudioPage): Promise<string | null> {
  return await page.eval<string | null>(
    `(() => {
      const pane = document.querySelector(".spin-preview");
      return pane ? pane.getAttribute("data-mode") : null;
    })()`,
  );
}

/** The colour the editor's own control for a token holds. */
export async function tokenValue(
  page: StudioPage,
  control: string,
): Promise<string | null> {
  return await page.eval<string | null>(
    `(() => {
      const input = document.querySelector(${JSON.stringify(control)});
      return input ? input.value : null;
    })()`,
  );
}

/**
 * Write a token's value through the editor's own control.
 *
 * The control is addressed by its own id — the light slot of a colour is a
 * different control from the dark one — so the write lands where the author
 * aimed it.
 */
export async function writeToken(
  page: StudioPage,
  control: string,
  value: string,
): Promise<string> {
  return await page.eval<string>(
    `(async () => {
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      const input = document.querySelector(${JSON.stringify(control)});
      if (!input) return "no-control";
      input.value = ${JSON.stringify(value)};
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      await wait(1200);
      return "written";
    })()`,
  );
}

/** The colour a theme declares for a role, in the mode asked for. */
export function declaredValue(
  theme: string,
  path: readonly string[],
  mode?: string,
): string | null {
  let node: unknown = JSON.parse(theme);
  for (const segment of path) {
    if (typeof node !== "object" || node === null) return null;
    node = (node as Record<string, unknown>)[segment];
  }
  if (typeof node !== "object" || node === null) return null;
  const leaf = node as { $value?: unknown; $modes?: Record<string, unknown> };
  const value = mode === undefined ? leaf.$value : leaf.$modes?.[mode];
  return typeof value === "string" ? value : null;
}

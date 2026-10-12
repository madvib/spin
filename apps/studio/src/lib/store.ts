/**
 * The working set of project themes.
 *
 * Three states, kept as one record so a theme is never in two of them at once:
 * `docs` is what the editor shows, `saved` is what was last written to disk,
 * and the gap between them is the dirty set the UI reports. This is editor
 * state, not the registry: the registry answers "what exists", the store
 * answers "what changed".
 */

import { createEffect, createResource, createSignal } from "solid-js";
import { listPrimitives, type RpcComponent } from "./primitives.ts";
import { analyzeTheme } from "./theme.ts";
import { parseTokens, validateLegibility } from "@spin/theme";
import { indexTree } from "@spin/theme";
import type { ValidationIssue } from "@spin/theme";
import { listProjectThemes } from "./themes.ts";
import type { StudioTheme } from "./themes.ts";

/**
 * Every theme on disk at load. Refresh is explicit: the user picks it up.
 *
 * Lazy, because this module also loads on the server: a resource created at
 * module scope runs during SSR, where there is no request context for it to
 * resolve under. Creating it on first read keeps the browser the only place
 * it ever runs.
 */
let registryCache:
  | ReturnType<
    typeof createResource<Awaited<ReturnType<typeof listProjectThemes>>>
  >
  | undefined;

function registryResource() {
  if (registryCache === undefined) {
    registryCache = createResource(listProjectThemes);
  }
  return registryCache;
}

/** The registry resource, created on first read. */
export function registry() {
  return registryResource()[0]();
}

export function refetchThemes(): void {
  registryResource()[1].refetch();
}

/**
 * Seat the active theme on something that exists.
 *
 * The registry is the answer to "what is there", and it arrives after first
 * paint — a signal seeded with a name nobody writes would otherwise have the
 * editor editing a theme the project does not have, with empty text and an
 * invalid-JSON banner. When the current name is absent from what the daemon
 * listed, take the first thing it did list rather than guessing.
 */
createEffect(() => {
  const listed = registry();
  if (listed === undefined || listed.length === 0) return;
  const known = listed.some((theme) => theme.name === activeName());
  if (!known) setActiveName(listed[0]!.name);
});

/**
 * The component registry, read once and shared.
 *
 * The side list and the component page both need it, and a resource per
 * caller would fetch the payload twice for one page load. Created lazily so
 * it never runs under SSR.
 */
let libraryCache:
  | ReturnType<
    typeof createResource<Awaited<ReturnType<typeof listPrimitives>>>
  >
  | undefined;

function libraryResource() {
  if (libraryCache === undefined) {
    libraryCache = createResource(listPrimitives);
  }
  return libraryCache;
}

/** Every component the daemon knows, or `undefined` before it answers. */
export function library(): readonly RpcComponent[] | undefined {
  return libraryResource()[0]();
}

export function refetchLibrary(): void {
  libraryResource()[1].refetch();
}

/**
 * The markup a route is about to render, so the stylesheet can be generated
 * for it.
 *
 * Uno scans source text for tokens — which is how a real application gets its
 * CSS — so a preview that generates for a list of utility names emits
 * utilities and nothing else, and every primitive renders unstyled. The route
 * that owns the markup registers it; the stylesheet generator reads it. One
 * writer at a time, because one route is mounted at a time.
 */
const [markup, setMarkup] = createSignal("");

/** The markup the mounted route renders. */
export function renderedMarkup(): string {
  return markup();
}

/** Declare the markup this route renders. */
export function registerMarkup(html: string): void {
  setMarkup(html);
}

/** The editor text per theme, seeded from disk on first read. */
const [docs, setDocs] = createSignal<Record<string, string>>({});

/** The last-written text per theme. Equal to `docs` means clean. */
const [saved, setSaved] = createSignal<Record<string, string>>({});

/** How many snapshots a theme keeps. A bounded stack means undo cannot eat a tab. */
const UNDO_LIMIT = 100;

/**
 * The theme's own rules, applied to a proposed document.
 *
 * Local, and deliberately: the gate runs on every commit, and an edit that
 * waits on a round trip is an edit that lags. The AUTHORITY is still the
 * daemon — `preview.css` re-judges the whole document and refuses what
 * breaks a floor, so a theme that clears this gate and then fails generation
 * is one the author sees immediately with a reason. Early refusal is a
 * courtesy; the daemon is the guarantee.
 */
function legibilityIssues(text: string): readonly ValidationIssue[] {
  try {
    const parsed = parseTokens(text);
    if (!parsed.ok) return [{ path: "", message: parsed.error }];
    return validateLegibility(parsed.tree);
  } catch {
    // Unparseable text is never a legibility problem, and the gate is about
    // legibility; a broken document is caught by generation.
    return [];
  }
}

const [activeName, setActiveName] = createSignal("default");
const [activeMode, setActiveMode] = createSignal("light");

export { activeMode, activeName, setActiveMode, setActiveName };

/** Seed the editor from the registry entry when it first becomes visible. */
function seed(name: string): string | undefined {
  const fromDisk = registry()?.find(
    (theme: StudioTheme) => theme.name === name,
  )?.text;
  if (fromDisk === undefined) return docs()[name];
  if (docs()[name] === undefined) {
    setDocs((prev) => ({ ...prev, [name]: fromDisk }));
    setSaved((prev) => ({ ...prev, [name]: fromDisk }));
  }
  return docs()[name] ?? fromDisk;
}

/** True when the editor holds edits that have not been written to disk. */
export function isDirty(name: string): boolean {
  seed(name);
  return docs()[name] !== saved()[name];
}

/** What the editor shows for the active theme. */
export function themeText(): string {
  return seed(activeName()) ?? "";
}

/**
 * The undo/redo stack, per theme.
 *
 * A theme is a text document, so history is a stack of texts: an edit pushes,
 * undo pops backwards and redo replays. The document is small enough that
 * keeping whole snapshots is cheaper than inventing an inverse-operation
 * scheme, and a snapshot stack is undo that cannot desynchronise — there is
 * no partial op to misapply.
 */
interface History {
  /** Snapshots behind the current one, oldest first. */
  past: readonly string[];
  /** Snapshots ahead, newest first. Empty while editing. */
  future: readonly string[];
  /** The document as it stands. */
  present: string;
}

const [history, setHistory] = createSignal<Record<string, History>>({});

/**
 * The stack for a theme, seeded from the document it stands in front of.
 *
 * Seeding `present` from the DOCUMENT rather than from the text being applied
 * is the whole point: a stack seeded with the new text has nothing behind it,
 * so the first edit returns "nothing to undo" and undo never works at all.
 */
function historyFor(name: string): History {
  return history()[name] ?? { past: [], future: [], present: themeText() };
}

/**
 * Why the last edit was refused.
 *
 * An edit that would break the theme does not enter the document: the gate
 * runs the theme's own legibility rule on the proposed text and refuses,
 * which is validation by construction rather than by discovery. A document
 * that fails a floor has no build to fall back to — the preset throws — so
 * letting it in would leave the author with a broken theme and no idea which
 * edit did it.
 */
const [refusal, setRefusal] = createSignal<string | undefined>();

export function lastRefusal(): string | undefined {
  return refusal();
}

/** Replaces the editor text for the active theme. Not a write to disk. */
export function setThemeText(next: string): boolean {
  const name = activeName();
  // The rule is the theme's, not the studio's: the same one `spinPreset`
  // applies when it generates, so the two cannot disagree.
  const issues = legibilityIssues(next);
  if (issues.length > 0) {
    setRefusal(issues[0]!.message);
    return false;
  }
  setRefusal(undefined);

  // History is recorded BEFORE the document moves. Reading the document
  // afterwards would seed `present` with the new text, and a stack whose
  // first entry is the current state has nothing behind it — undo would be
  // enabled and do nothing.
  const at = historyFor(name);
  const before = themeText();
  if (at.present === next) return true;
  setHistory((prev) => ({
    ...prev,
    [name]: {
      past: [...at.past, before].slice(-UNDO_LIMIT),
      future: [],
      present: next,
    },
  }));
  setDocs((prev) => ({ ...prev, [name]: next }));
  return true;
}

/** Whether an undo is available. */
export function canUndo(): boolean {
  return historyFor(activeName()).past.length > 0;
}

/** Whether a redo is available. */
export function canRedo(): boolean {
  return historyFor(activeName()).future.length > 0;
}

export function undo(): void {
  const name = activeName();
  const at = historyFor(name);
  const previous = at.past[at.past.length - 1];
  if (previous === undefined) return;
  setHistory((prev) => ({
    ...prev,
    [name]: {
      past: at.past.slice(0, -1),
      future: [at.present, ...at.future],
      present: previous,
    },
  }));
  setDocs((prev) => ({ ...prev, [name]: previous }));
}

export function redo(): void {
  const name = activeName();
  const at = historyFor(name);
  const next = at.future[0];
  if (next === undefined) return;
  setHistory((prev) => ({
    ...prev,
    [name]: {
      past: [...at.past, at.present],
      future: at.future.slice(1),
      present: next,
    },
  }));
  setDocs((prev) => ({ ...prev, [name]: next }));
}

/** Discards the editor text since the last write. */
export function revertToSaved(name: string): void {
  const snapshot = saved()[name];
  if (snapshot === undefined) return;
  setDocs((prev) => ({ ...prev, [name]: snapshot }));
}

/** Marks the active theme written. The caller persists; this updates state. */
export function markSaved(name: string): void {
  const current = docs()[name];
  if (current === undefined) return;
  setSaved((prev) => ({ ...prev, [name]: current }));
}

/** The preview mode, read from the active theme's declared modes. */
export function activeModes(): string[] {
  try {
    const doc = JSON.parse(themeText()) as Record<string, unknown>;
    const modes = doc["modes"];
    if (
      Array.isArray(modes) &&
      modes.length > 0 &&
      modes.every((mode) => mode === "light" || mode === "dark")
    ) {
      return modes as string[];
    }
  } catch {
    return ["light", "dark"];
  }
  return ["light", "dark"];
}

/** The preview component selection, read from the active theme's raw text. */
export function activeComponents(): string[] | undefined {
  try {
    const doc = JSON.parse(themeText()) as Record<string, unknown>;
    const spin = ((doc["$extensions"] ?? {}) as Record<string, unknown>)[
      "spin"
    ] as Record<string, unknown> | undefined;
    const components = spin?.["components"];
    if (
      Array.isArray(components) &&
      components.every((component) => typeof component === "string")
    ) {
      return components as string[];
    }
  } catch {
    return undefined;
  }
  return undefined;
}

export interface ThemeSwatch {
  name: string;
  value: string;
}

export interface ThemeSummary {
  name: string;
  file: string;
  tokens: number;
  dirty: boolean;
  valid: boolean;
  issues: string[];
  swatches: ThemeSwatch[];
}

/** One card per theme on disk, with its editor state attached. */
export function themeSummaries(): ThemeSummary[] {
  return (registry() ?? []).map((theme: StudioTheme) => {
    const text = seed(theme.name) ?? theme.text;
    const state = analyzeTheme(text);
    const leaves = state.tree
      ? Object.values(indexTree(state.tree).leaves)
      : [];
    return {
      name: theme.name,
      file: theme.file,
      tokens: leaves.length,
      dirty: docs()[theme.name] !== saved()[theme.name],
      valid: state.error === undefined && state.issues.length === 0,
      issues: [
        ...(state.error ? [state.error] : []),
        ...state.issues.map((issue) =>
          `${issue.path || "(document)"}: ${issue.message}`
        ),
      ],
      swatches: leaves
        .filter((leaf) => {
          const rest = leaf.path.slice(1).join(".");
          return (
            ["primary", "secondary", "accent"].includes(rest) ||
            leaf.path[1] === "semantic"
          );
        })
        .slice(0, 8)
        .map((leaf) => ({
          name: leaf.path.slice(1).join("-").toLowerCase(),
          value: String(leaf.value),
        })),
    };
  });
}

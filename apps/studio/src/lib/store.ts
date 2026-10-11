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
import { analyzeTheme } from "./theme.ts";
import { indexTree } from "@spin/theme";
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

/** The editor text per theme, seeded from disk on first read. */
const [docs, setDocs] = createSignal<Record<string, string>>({});

/** The last-written text per theme. Equal to `docs` means clean. */
const [saved, setSaved] = createSignal<Record<string, string>>({});

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

/** Replaces the editor text for the active theme. Not a write to disk. */
export function setThemeText(next: string): void {
  const name = activeName();
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

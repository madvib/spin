/**
 * The working set of project themes.
 *
 * Three states, kept as one record so a theme is never in two of them at once:
 * `docs` is what the editor shows, `saved` is what was last written to disk,
 * and the gap between them is the dirty set the UI reports. This is editor
 * state, not the registry: the registry answers "what exists", the store
 * answers "what changed".
 */

import { createEffect, createResource, createSignal, untrack } from "solid-js";
import { listPrimitives, type RpcComponent } from "./primitives.ts";
import { summarySwatches, type SwatchGroup } from "./overview.ts";
import {
  analyzeTheme,
  declaredModes,
  fileMoved,
  fileState,
  resolveMode,
} from "./theme.ts";
import type { FileState } from "./theme.ts";
import { indexTree } from "@spin/theme";
import type { Mode } from "@spin/theme";
import { documentFailure, editRefusal } from "./live-edit.ts";
import { keepFocus } from "./keep-focus.ts";
import {
  currentProject,
  listProjectThemes,
  loadProjectTheme,
  problemText,
  type ProjectReport,
  saveTheme,
} from "./themes.ts";
import { spinClient, spinClientAt } from "./client.ts";
import type { StudioTheme } from "./themes.ts";

/**
 * Every theme the project serves, at load. Refresh is explicit: the user picks it up.
 *
 * Module scope, because there is no server: the studio is a static bundle,
 * so the browser is the only place this ever runs.
 */
const [registryData, { refetch: refetchResource }] = createResource(
  listProjectThemes,
);

/** The registry, or `undefined` before it answers. */
export function registry() {
  return registryData();
}

export function refetchThemes(): void {
  refetchResource();
}

/**
 * The registry, re-read when the studio comes back to the window.
 *
 * A theme created or deleted in another tab is a change the daemon knows
 * about and this tab does not: a list fetched once is a list only a reload
 * can mend, and an author who comes back to the studio finds a project
 * that moved underneath it. The focus event is the moment the author is
 * back, so it is the moment the list is worth re-reading — and the moment
 * the document becomes visible again is the same moment, for a browser
 * that says so instead.
 */
if (typeof window !== "undefined") {
  globalThis.addEventListener("focus", () => refetchThemes());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") refetchThemes();
  });
}

/**
 * The project the daemon serves.
 *
 * A project is a place on disk with a `spin/` directory in it, and the
 * daemon is the only one who can look. The studio asks rather than
 * assumes: a folder that is not a project renders exactly like one until
 * something writes to it and fails.
 */
const [projectData, { refetch: refetchProjectResource }] = createResource(
  currentProject,
);

/** The project the daemon serves, or `undefined` before it answers. */
export function project(): ProjectReport | undefined {
  return projectData();
}

/** Why the project could not be read, when it could not be read. */
export function projectFailure(): unknown {
  return projectData.error;
}

/** Asks the daemon about the project again. */
export function refetchProject(): void {
  refetchProjectResource();
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
  // A refetch in flight is a list that is about to change, and answering
  // against the one still on screen would undo a seat its own write just
  // made: a create appends to the registry, then seats the new name, and the
  // stale list does not have it yet. Wait for the answer, then judge.
  if (registryData.loading) return;
  const listed = registry();
  if (listed === undefined || listed.length === 0) return;
  const known = listed.some((theme) => theme.name === activeName());
  if (!known) setActiveName(listed[0]!.name);
});

/**
 * The component registry, read once and shared.
 *
 * The side list and the component page both need it, and a resource per
 * caller would fetch the payload twice for one page load.
 */
const [libraryData, { refetch: refetchLibraryResource }] = createResource(
  listPrimitives,
);

/** Every component the API knows, or `undefined` before it answers. */
export function library(): readonly RpcComponent[] | undefined {
  return libraryData();
}

export function refetchLibrary(): void {
  refetchLibraryResource();
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
 * A preference the browser is asked to keep, when it will.
 *
 * The studio is a tool an author leaves and comes back to, and the theme
 * they were editing is not a fact about a page — it is where they were
 * working. Kept in the browser rather than in the document: a project is
 * edited by several people and none of them owns the other's seat.
 */
function stored(key: string): string | undefined {
  try {
    return localStorage.getItem(key) ?? undefined;
  } catch {
    // Private mode: the session keeps it.
    return undefined;
  }
}

/** Ask the browser to keep a preference. */
function remember(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Private mode: the session keeps it.
  }
}

const [activeName, setActiveNameSignal] = createSignal(
  stored("spin-theme") ?? "silk",
);

/**
 * Seat a theme, and remember the seat.
 *
 * A reload is not a new session: the author was editing a theme, and the
 * theme they were editing is the one they come back to. A name the project
 * no longer holds is clamped by the seat effect when the registry answers.
 */
export function setActiveName(name: string): void {
  setActiveNameSignal(name);
  remember("spin-theme", name);
}

const [dockSide, setDockSideSignal] = createSignal<"left" | "right">(
  stored("spin-dock-side") === "left" ? "left" : "right",
);

export { activeName, dockSide };

/**
 * The mode the author chose, kept across themes.
 *
 * A theme owns the modes it serves: a theme that serves one of them cannot
 * be shown in the other, so the studio clamps itself rather than render a
 * theme's values under a name the theme does not use. The clamp must not
 * cost the author the mode they were working in — the choice is kept here,
 * and the theme that serves it gives it back.
 *
 * The choice has three answers, not two: light, dark, and SYSTEM — the
 * studio following whatever the operating system asks for. The third answer
 * is the studio's own rather than the theme's: a theme declares the modes it
 * can be shown in, and the studio decides which of them it wears.
 */
export type ModeChoice = "light" | "dark" | "system";

/** The mode an author can choose: the theme's two lights, or the machine's. */
function modeChoiceFrom(value: string | undefined): ModeChoice {
  return value === "dark" || value === "system" ? value : "light";
}

const [chosenMode, setChosenMode] = createSignal<ModeChoice>(
  modeChoiceFrom(stored("spin-mode")),
);

/**
 * What the operating system asks for.
 *
 * The studio reads the preference and follows it while the choice is
 * `system`, and the reading is live: an author who switches their machine
 * to dark sees the studio follow, without touching the studio at all.
 */
const [osMode, setOsMode] = createSignal<Mode>(
  systemPrefersDark() ? "dark" : "light",
);

/** Whether the system asks for a dark studio. */
function systemPrefersDark(): boolean {
  return typeof matchMedia === "function" &&
    matchMedia("(prefers-color-scheme: dark)").matches;
}

if (typeof window !== "undefined" && typeof matchMedia === "function") {
  const query = matchMedia("(prefers-color-scheme: dark)");
  query.addEventListener(
    "change",
    () => setOsMode(query.matches ? "dark" : "light"),
  );
}

/**
 * The mode the studio is showing.
 *
 * The theme's constraint and the author's choice, in that order: a theme
 * that serves the chosen mode wears it, and a theme that does not wears
 * its own first mode. The choice itself is not spent by the clamp — it is
 * the mode the studio comes back to when a theme that serves it is seated
 * again, so a theme that serves one mode cannot cost the author the other.
 *
 * A choice of `system` is the author's way of saying "whatever the machine
 * says", so it is resolved to the machine's answer BEFORE the theme's
 * constraint is applied: a theme that serves only light stays light even on
 * a machine that asks for dark, because the theme's answer is the one that
 * has to hold.
 */
export function activeMode(): Mode {
  const modes = activeModes();
  const choice = chosenMode();
  const wanted = choice === "system" ? osMode() : choice;
  return resolveMode(modes, wanted);
}

/** The choice the author made: light, dark, or the system's own answer. */
export function modeChoice(): ModeChoice {
  return chosenMode();
}

/** What the operating system asks for. */
export function systemMode(): Mode {
  return osMode();
}

/** The mode the author chose, remembered across the themes they seat. */
export function setActiveMode(mode: ModeChoice): void {
  setChosenMode(mode);
  remember("spin-mode", mode);
}

/** The drawer edge. Persisted: a handedness choice, not a session one. */
export function setDockSide(side: "left" | "right"): void {
  setDockSideSignal(side);
  try {
    localStorage.setItem("spin-dock-side", side);
  } catch {
    // Private mode: the session keeps it.
  }
}

/**
 * The text the file holds, as the studio last heard.
 *
 * Three texts per theme: `docs` is what the editor shows, `saved` is what
 * the studio last wrote, and this is what the file holds. The studio's own
 * writes move `saved` and this together; anything else that moves this is
 * the world changing underneath — a file edited elsewhere, a branch
 * checked out — and the studio says so rather than claim to be saved.
 */
const [onDisk, setOnDisk] = createSignal<Record<string, string>>({});

/**
 * The file's text, as the registry last read it.
 *
 * The registry is the studio's picture of the disk, and it is re-read when
 * the world moves: a refetch that brings back different text is a file
 * that changed under the studio. The document the author is editing is
 * NOT touched — their work is theirs — but the file's text is what the
 * studio compares against, and the difference is what it reports.
 */
createEffect(() => {
  const listed = registry();
  if (listed === undefined) return;
  // What the studio knows is read untracked: the effect answers to the
  // registry, not to the studio's own reading of a file. A file the studio
  // read for itself — before a save, to see what it would write over — is
  // fresher than the registry's bulk read, and an effect that watched the
  // studio's answer would push the older one back over the newer.
  const known = untrack(onDisk);
  const next: Record<string, string> = { ...known };
  let moved = false;
  for (const theme of listed) {
    if (next[theme.name] !== theme.text) {
      next[theme.name] = theme.text;
      moved = true;
    }
  }
  if (moved) setOnDisk(next);
});

/** Seed the editor from the registry entry when it first becomes visible. */
function seed(name: string): string | undefined {
  const fromDisk = registry()?.find(
    (theme: StudioTheme) => theme.name === name,
  )?.text;
  if (fromDisk === undefined) return docs()[name];
  if (docs()[name] === undefined) {
    setDocs((prev) => ({ ...prev, [name]: fromDisk }));
    setSaved((prev) => ({ ...prev, [name]: fromDisk }));
    setOnDisk((prev) => ({ ...prev, [name]: fromDisk }));
  }
  return docs()[name] ?? fromDisk;
}

/** True when the editor holds edits that have not been written to disk. */
export function isDirty(name: string): boolean {
  seed(name);
  return docs()[name] !== saved()[name];
}

/**
 * What the studio knows about a theme's file.
 *
 * The edited text, the last written text, and the text the file holds —
 * three texts, one answer. The answer is what the status line reads and
 * what the card wears.
 */
export function fileStateOf(name: string): FileState {
  seed(name);
  return fileState(docs()[name], saved()[name], onDisk()[name]);
}

/**
 * Whether the file moved under the studio.
 *
 * The file holds something the studio did not write: another tool saved it,
 * a branch was checked out, a second tab wrote it. The editor's own document
 * is the author's and is left alone — but the file is no longer the thing the
 * studio last wrote, and writing over it would destroy a change the studio
 * never saw.
 *
 * This is the world's fact, not the author's: it can hold while the editor
 * holds unsaved edits, and when it does, the save that would overwrite the
 * file has to be refused.
 */
export function divergedFromDisk(name: string): boolean {
  seed(name);
  return fileMoved(saved()[name], onDisk()[name]);
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
 * runs the theme module's own judgement on the proposed text and refuses,
 * which is validation by construction rather than by discovery. A document
 * that does not build has no stylesheet to fall back to — the preset throws,
 * and in development the throw takes the studio's OWN stylesheet with it,
 * because both are generated in the same process — so letting the value in
 * would leave the author with a blank studio and no idea which edit did it.
 *
 * What the gate refuses is an edit that BREAKS the theme. A document that
 * already fails stays editable, because the studio is where an author
 * repairs one: a gate that refused every edit to a broken theme would make
 * the repair impossible, and the finding that names the fix would be an
 * offer the studio cannot honour.
 *
 * A refusal is kept per theme and per token: the chrome's banner says what
 * the studio refused last, and the token's own row says why THIS value was
 * refused — addressed by the token's path, so the message can be read where
 * the value is shown, beside the control that asked for it, and not only in
 * a banner.
 */
const [refusals, setRefusals] = createSignal<
  Readonly<Record<string, Readonly<Record<string, string>>>>
>({});

/** The token whose value was refused last, in the theme being edited. */
const [lastRefused, setLastRefused] = createSignal<string | undefined>();

/**
 * Why the document being edited does not build, when it does not.
 *
 * The gate refuses an edit that would break the theme, but a document can
 * arrive broken from outside: a hand-edited file, a value that slipped
 * through, a merge that landed badly. The studio says so rather than
 * pretending the document is fine — and the last good stylesheet stays in
 * force, so the studio is alive while the author repairs it.
 */
const [buildFailure, setBuildFailure] = createSignal<string | undefined>();

/**
 * What the studio last refused, and what it last found broken.
 *
 * The refusal is what the author did most recently; the failure is what the
 * document is. The refusal comes first: it is the answer to the gesture the
 * author has just made, and the failure is the standing condition behind
 * it.
 */
export function lastRefusal(): string | undefined {
  const path = lastRefused();
  const message = path === undefined
    ? undefined
    : refusals()[activeName()]?.[path];
  return message ?? buildFailure();
}

/**
 * Why this token's value was refused, when it was.
 *
 * Addressed by the token's path — `radius.none` — which is the path the
 * control that edits it carries, so the message can be read where the value
 * is shown.
 */
export function refusalFor(path: string): string | undefined {
  return refusals()[activeName()]?.[path];
}

/**
 * Record why an edit did not land — the gate or the document says so.
 *
 * A refusal that is about no particular token is kept under the empty path:
 * it is the studio's own sentence about the last thing it did, and the
 * banner is what reads it.
 */
export function noteRefusal(message: string): void {
  refuse(message, "");
}

/**
 * Record a refusal, and where it belongs.
 *
 * The token's message is dropped when the value lands — a refusal about a
 * value that is now in the document is a stale sentence.
 */
function refuse(message: string, path: string): void {
  const theme = activeName();
  setRefusals((prev) => ({
    ...prev,
    [theme]: { ...prev[theme], [path]: message },
  }));
  setLastRefused(path);
}

/** The token's refusal is stale once the value it was about has landed. */
function clearRefusal(paths: readonly string[]): void {
  if (paths.length === 0) return;
  const theme = activeName();
  setRefusals((prev) => {
    const held = prev[theme];
    if (held === undefined) return prev;
    const next = { ...held };
    for (const path of paths) delete next[path];
    return { ...prev, [theme]: next };
  });
  if (paths.includes(lastRefused() ?? "")) setLastRefused(undefined);
}

/**
 * A refusal is about a gesture, and a gesture that was undone is not
 * standing: the document went back to a state the gate would have taken,
 * so the sentence about the refused value is a stale one.
 */
function forgetRefusals(): void {
  const theme = activeName();
  setRefusals((prev) => {
    if (prev[theme] === undefined) return prev;
    const next = { ...prev };
    delete next[theme];
    return next;
  });
  setLastRefused(undefined);
}

/**
 * What the studio last did about a theme's file.
 *
 * The refusal says what went wrong; this says what was done about it — the
 * file reloaded, the unsaved edits dropped. It is the other half of the same
 * conversation, and it is said beside the state rather than in place of it.
 */
const [notice, setNotice] = createSignal<string | undefined>();

/** What the studio last did about a theme's file, when it did something. */
export function lastNotice(): string | undefined {
  return notice();
}

/** Say what the studio did about the file. */
export function note(message: string): void {
  setNotice(message);
}

/**
 * Replaces the editor text for the active theme. Not a write to disk.
 *
 * The `touched` paths are the tokens the edit is about: the gate refuses an
 * edit that leaves one of them broken, and the refusal is recorded against
 * it, so the message belongs to the value the author is holding.
 *
 * The gate is LOCAL, and deliberately: it runs on every commit, and an edit
 * that waits on a round trip is an edit that lags. The judge is the theme
 * module's — the same `validateTheme` the daemon's analysis procedure asks —
 * and it is the judge the stylesheet is generated from, so a refusal here is
 * a refusal the build would agree with. The AUTHORITY is still the daemon:
 * `preview.css` re-judges the whole document, so a theme that clears this
 * gate and then fails generation is one the author sees immediately with a
 * reason. Early refusal is a courtesy; the daemon is the guarantee.
 *
 * The arithmetic lives in `live-edit.ts`: it is pure, and it is the same
 * arithmetic a control needs while an author is dragging a value.
 */
export function setThemeText(
  next: string,
  touched: readonly string[] = [],
): boolean {
  const name = activeName();
  // The rule is the theme's, not the studio's: the same judgement
  // `spinPreset` applies when it generates, so the two cannot disagree.
  // What is refused is the edit that BREAKS the theme — a problem the
  // document already had is the author's to repair, and the studio is where
  // they repair it.
  const refused = editRefusal(themeText(), next, touched);
  if (refused !== undefined) {
    refuse(refused.message, refused.path);
    return false;
  }
  // The value landed, so a refusal about it is a stale sentence; and the
  // studio has nothing to refuse about the gesture that just succeeded.
  clearRefusal(touched);
  setLastRefused(undefined);

  // A commit rebuilds the row, and the control the author is holding is a
  // new element afterwards. Put focus back on the control with the same id
  // BEFORE the document moves — the capture has to see the old element.
  keepFocus();

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
  void pushOverlay(name, next);
  return true;
}

/**
 * The running app re-themes on every committed edit.
 *
 * Fire-and-forget: the editor already moved and the overlay is a preview
 * channel, not a write — a failed push leaves the text intact and the next
 * edit retries. Unparseable text never reaches the cell; the document the
 * app shows is always one the preset can generate from.
 */
async function pushOverlay(name: string, text: string): Promise<void> {
  // The overlay is what the running app wears, and the app's stylesheet is
  // generated from it — in development, in the SAME process the studio's own
  // stylesheet is generated in. A document that does not build therefore
  // does not only fail the app's sheet: it takes the studio's own sheet
  // with it, the studio's page never renders, and the author is left with a
  // white window and no error to read.
  //
  // So a document that does not build never goes into the overlay: the last
  // good one stays in force, and the studio says what is wrong instead.
  if (documentFailure(text) !== undefined) return;
  let document: unknown;
  try {
    document = JSON.parse(text);
  } catch {
    return;
  }
  try {
    // The overlay belongs to the process showing it. Mounted, that is this
    // origin; standalone, it is the app `?app=` names — a second server
    // with its own cell, which this origin's overlay would never reach.
    const base = new URLSearchParams(location.search).get("app");
    const client = base !== null
      ? await spinClientAt(new URL("/__spin/rpc", base).toString())
      : await spinClient();
    await client.overlay.set({ themes: { [name]: document } });
  } catch {
    // Preview channel only; the text is the source of truth.
  }
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
  forgetRefusals();
  void pushOverlay(name, previous);
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
  forgetRefusals();
  void pushOverlay(name, next);
}

/**
 * The history a theme keeps after its document was replaced.
 *
 * A document that was replaced is not an edit: the edits that led to it
 * are gone with it, and a stack that still held them would undo into a
 * document nobody is looking at any more.
 */
function forgetHistory(name: string, text: string): void {
  setHistory((prev) => ({
    ...prev,
    [name]: { past: [], future: [], present: text },
  }));
}

/**
 * Discards the editor text since the last write.
 *
 * The author's own undo: the edits that were never written are dropped and
 * the document goes back to what the file last held. The file is not
 * touched — this is about what the editor shows.
 */
export function revertToSaved(name: string): void {
  const snapshot = saved()[name];
  if (snapshot === undefined) return;
  setDocs((prev) => ({ ...prev, [name]: snapshot }));
  forgetHistory(name, snapshot);
  forgetRefusals();
  void pushOverlay(name, snapshot);
}

/**
 * Re-reads one theme from disk, and shows what the file holds.
 *
 * The file moved under the studio — a branch checked out, an editor saved
 * it, another tab wrote it — and the studio's document is a document that
 * no longer exists on disk. This replaces the editor's text with the
 * file's and reports what it found: a file that differs from what the
 * studio last wrote is a change the author has to know about before the
 * next save overwrites it.
 */
export async function reloadFromDisk(name: string): Promise<FileState> {
  const text = await loadProjectTheme(name);
  if (text === undefined) return fileStateOf(name);
  const moved = text !== saved()[name];
  setDocs((prev) => ({ ...prev, [name]: text }));
  setSaved((prev) => ({ ...prev, [name]: text }));
  setOnDisk((prev) => ({ ...prev, [name]: text }));
  forgetHistory(name, text);
  forgetRefusals();
  void pushOverlay(name, text);
  return moved ? "changed" : "saved";
}

/**
 * Marks the active theme written. The caller persists; this updates state.
 *
 * The file now holds what the editor holds, so the two move together: a
 * studio that remembered the old text would claim the file changed under
 * it the moment it had written it itself.
 */
export function markSaved(name: string): void {
  const current = docs()[name];
  if (current === undefined) return;
  setSaved((prev) => ({ ...prev, [name]: current }));
  setOnDisk((prev) => ({ ...prev, [name]: current }));
  // The daemon has the change now: the registry is re-read so the studio's
  // picture of the disk is the daemon's, and a theme created or deleted
  // anywhere else arrives with it.
  refetchThemes();
}

/**
 * What a save did.
 */
export interface SaveOutcome {
  /** Whether the document reached the disk. */
  readonly written: boolean;
  /** Why it did not, when it did not. */
  readonly problem: string | null;
}

/**
 * Writes a theme's document to disk — unless the file moved under the studio.
 *
 * A save is the one act that destroys: the studio's document is written over
 * whatever the file holds, and a change made outside the studio is gone the
 * moment the save lands. So the file is read again first, and a file that is
 * no longer what the studio wrote refuses the write and says why — the author
 * chooses between taking the file's word for it (reload) and keeping their
 * own edits, which means writing over the file on purpose.
 *
 * The read is what makes the refusal honest: the studio's picture of the
 * disk is only as fresh as its last look at it, and a save that trusted a
 * stale picture would destroy exactly the change it had not seen yet.
 */
export async function saveThemeToDisk(name: string): Promise<SaveOutcome> {
  seed(name);
  const document = docs()[name];
  if (document === undefined) {
    const problem = "the studio holds no document to write";
    noteRefusal(problem);
    return { written: false, problem };
  }

  // The file's own text, read now.
  let disk: string | undefined;
  try {
    disk = await loadProjectTheme(name);
  } catch (err) {
    const problem = `the file could not be read: ${problemText(err)}`;
    noteRefusal(problem);
    return { written: false, problem };
  }
  if (disk !== undefined) {
    // The studio's picture of the disk is now the file's own answer, not the
    // registry's older one.
    setOnDisk((prev) => ({ ...prev, [name]: disk }));
  }

  // A file the project held and no longer holds is a file that moved too:
  // the read falls back to a shipped starter, and there is nothing there to
  // write over — the author has to know before the save makes one.
  const moved = fileMoved(saved()[name], disk) ||
    (disk === undefined && hasProjectFile(name));
  if (moved) {
    const problem = `${name} changed on disk — reload from disk first.`;
    noteRefusal(problem);
    return { written: false, problem };
  }

  const result = await saveTheme(name, document);
  if (result.error !== null) {
    noteRefusal(result.error);
    return { written: false, problem: result.error };
  }
  markSaved(name);
  setLastRefused(undefined);
  return { written: true, problem: null };
}

/**
 * Whether the project holds a file for this theme.
 *
 * The registry says so, and it is what tells a deleted file from a theme
 * that never had one.
 */
function hasProjectFile(name: string): boolean {
  const listed = registry()?.find((theme) => theme.name === name);
  return listed !== undefined && listed.file !== null;
}

/**
 * How many tokens the active theme's document declares.
 *
 * The count the studio shows about a theme is the count of its leaves, read
 * from the same analysis the overview reads: two answers to one question
 * have to be one answer.
 */
export function activeTokenCount(): number {
  const state = analyzeTheme(themeText());
  if (state.tree === undefined) return 0;
  return Object.values(indexTree(state.tree).leaves).length;
}

/** The modes the active theme declares. */
export function activeModes(): Mode[] {
  return declaredModes(themeText());
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

export interface ThemeSummary {
  name: string;
  file: string | null;
  tokens: number;
  dirty: boolean;
  /**
   * What the file holds, as far as the studio knows.
   *
   * `changed` means the file moved under the studio: the author has no
   * unsaved edits, and the file is not what they last wrote. It is the
   * state a card wears beside "unsaved", because the two can hold at once
   * and the one that is not the author's own is the one that is easiest
   * to miss.
   */
  state: FileState;
  valid: boolean;
  issues: string[];
  /**
   * The palette as strips, one per mode the theme declares.
   *
   * The same curated rows the overview's palette card uses, because a strip
   * of the colours a theme is *for* is a different question from "which
   * tokens happen to be colours" — and answering the second one twice, here
   * and on the card, is how the two answers start to disagree. Each group
   * carries ITS theme's resolved values: a summary sits beside every other
   * theme, and a utility would paint all of them with the active one.
   */
  swatches: SwatchGroup[];
}

/** One card per theme the project serves, with its editor state attached. */
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
      state: fileStateOf(theme.name),
      valid: state.error === undefined && state.issues.length === 0,
      issues: [
        ...(state.error ? [state.error] : []),
        ...state.issues.map((issue) =>
          `${issue.path || "(document)"}: ${issue.message}`
        ),
      ],
      swatches: summarySwatches(text),
    };
  });
}

/**
 * The document being edited, judged as it stands.
 *
 * The studio's gate refuses an edit that would break the theme, so a
 * document that does not build is one that arrived broken: a hand-edited
 * file, a value that slipped through, a merge that landed badly. The studio
 * says so where the author reads it — the chrome's banner — and says what
 * to do about it, because the studio that cannot show you its own error is
 * a studio you cannot trust.
 *
 * The stylesheet is not at stake here: a document that does not build never
 * reaches the overlay, so the last good one stays in force and the studio
 * keeps rendering while the author repairs the document.
 *
 * It lives at the foot of the module because it reads what the rest of it
 * declares: an effect that runs while the module is still being evaluated
 * would find the theme, the document and the state it keeps still in their
 * birth.
 */
createEffect(() => {
  const name = activeName();
  const text = seed(name);
  if (text === undefined) {
    setBuildFailure(undefined);
    return;
  }
  const failure = documentFailure(text);
  setBuildFailure(
    failure === undefined
      ? undefined
      : `${name} does not build: ${failure}. The last good stylesheet is ` +
        "still in force — fix the token and the theme comes back.",
  );
});

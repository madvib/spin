import { validateTheme } from "@spinjs/spin/theme";
import type { Mode, ThemeReport } from "@spinjs/spin/theme";

/**
 * What the studio knows about a theme's document.
 *
 * The theme module's own answer under the studio's name: the tree, the
 * problems, and the verdict. The studio does not parse a theme, does not
 * judge one, and does not decide whether one is valid — it asks the module
 * that owns those facts and reads the answer back.
 */
export type ThemeState = ThemeReport;

/**
 * Ask the theme module what is wrong with this document.
 *
 * The judgement is the module's: it owns the token language, the roles a
 * theme owes, the values a browser will take and the contrast floors those
 * roles must meet. The studio asks it here, in the browser, because the
 * analysis runs on every commit and an edit that waited on a round trip
 * would lag behind the author.
 *
 * The words are the module's, so the panel and the daemon — which asks the
 * same operation over RPC — cannot say different things about one document.
 */
export function analyzeTheme(text: string): ThemeState {
  return validateTheme(text);
}

/**
 * The modes a document declares.
 *
 * `modes` is metadata at the document's root: the modes the theme serves.
 * A document that declares none serves both — the pair is the system's own
 * default — and a document that cannot be read at all is caught by the
 * parse, not by the mode list.
 */
export function declaredModes(text: string): Mode[] {
  let doc: Record<string, unknown>;
  try {
    doc = JSON.parse(text) as Record<string, unknown>;
  } catch {
    return ["light", "dark"];
  }
  const modes = doc["modes"];
  if (
    Array.isArray(modes) &&
    modes.length > 0 &&
    modes.every((mode) => mode === "light" || mode === "dark")
  ) {
    return modes as Mode[];
  }
  // A document that declares no `modes` array is not necessarily single-mode:
  // it may still carry dark overrides on individual tokens. Infer from
  // content so a Blank scaffold (no modes, no overrides) reports one mode.
  let hasDark = false;
  const walk = (node: unknown, depth: number): void => {
    if (depth > 24 || typeof node !== "object" || node === null) return;
    if (Array.isArray(node)) {
      for (const item of node) walk(item, depth + 1);
      return;
    }
    const record = node as Record<string, unknown>;
    const modesNode = record["$modes"];
    if (
      typeof modesNode === "object" &&
      modesNode !== null &&
      !Array.isArray(modesNode) &&
      Object.prototype.hasOwnProperty.call(modesNode, "dark")
    ) {
      hasDark = true;
    }
    for (const key of Object.keys(record)) {
      walk(record[key], depth + 1);
    }
  };
  walk(doc, 0);
  return hasDark ? ["light", "dark"] : ["light"];
}

export function addMode(text: string, mode: "light" | "dark"): string {
  const doc = JSON.parse(text) as Record<string, unknown>;
  const current = declaredModes(text);
  const next = current.includes(mode) ? current : [...current, mode];
  doc["modes"] = next;
  return JSON.stringify(doc, null, 2);
}

export function removeMode(text: string, mode: "light" | "dark"): string {
  const doc = JSON.parse(text) as Record<string, unknown>;
  const current = declaredModes(text);
  const next = current.filter((m) => m !== mode);
  if (next.length === 0) throw new Error("cannot remove the last mode");
  doc["modes"] = next;
  const strip = (node: unknown, depth: number): void => {
    if (depth > 24 || typeof node !== "object" || node === null) return;
    if (Array.isArray(node)) {
      for (const item of node) strip(item, depth + 1);
      return;
    }
    const record = node as Record<string, unknown>;
    const modesNode = record["$modes"];
    if (
      typeof modesNode === "object" &&
      modesNode !== null &&
      !Array.isArray(modesNode)
    ) {
      delete (modesNode as Record<string, unknown>)[mode];
      if (Object.keys(modesNode as Record<string, unknown>).length === 0) {
        delete record["$modes"];
      }
    }
    for (const key of Object.keys(record)) {
      strip(record[key], depth + 1);
    }
  };
  strip(doc, 0);
  return JSON.stringify(doc, null, 2);
}

/**
 * The mode a theme can be shown in.
 *
 * The theme's constraint and the author's choice, in that order: a theme
 * that serves the chosen mode wears it, and a theme that does not wears its
 * own first mode. The choice itself is not spent by the clamp — it is the
 * mode the studio comes back to when a theme that serves it is seated
 * again, so a theme that serves one mode cannot cost the author the other.
 */
export function resolveMode(
  modes: readonly Mode[],
  wanted: Mode,
): Mode {
  if (modes.includes(wanted)) return wanted;
  return modes[0] ?? "light";
}

/**
 * What the studio knows about a theme's file.
 *
 * Three texts, three answers. `unsaved` is the author's own: the editor
 * holds edits the file does not. `changed` is the world's: the file holds
 * something the studio did not write. `saved` is the only state where the
 * editor, the studio's last write and the file all say the same thing — so
 * it is the only state in which the studio may claim to be saved.
 *
 * The world's answer comes first, because the world's is the one that
 * bites: a file that moved under the studio refuses the save that would
 * overwrite it, and that refusal has to be visible even while the author
 * holds edits of their own.
 */
export type FileState = "saved" | "unsaved" | "changed";

/**
 * What the studio knows about a theme's file, from three texts.
 *
 * The edited text, the last written text, and the text the file holds.
 * Pure, so the rule can be read — and tested — without a browser: the
 * studio's own state is the input, and the answer is the same wherever it
 * is asked.
 */
export function fileState(
  edited: string | undefined,
  written: string | undefined,
  onDisk: string | undefined,
): FileState {
  // The world's fact first. The file holds something the studio did not
  // write — another tool saved it, a branch was checked out, a second tab
  // wrote it — and the save that would overwrite it is refused. The
  // author's own edits are beside that question: they can hold at the same
  // time, and they do not make the file less moved.
  if (onDisk !== undefined && written !== undefined && onDisk !== written) {
    return "changed";
  }
  // The author's own: the editor holds edits the file does not.
  if (edited !== written) return "unsaved";
  return "saved";
}

/**
 * Whether the file moved under the studio.
 *
 * The file holds something the studio did not write: another tool saved it,
 * a branch was checked out, a second tab wrote it. The two texts are the
 * studio's last write and the file's current one, and they differ exactly
 * when the world moved underneath.
 *
 * A file the studio has never written, or one it cannot see, has not moved:
 * there is nothing for it to have moved away from. That is why the answer
 * needs both texts — one of them alone cannot tell a moved file from a file
 * the studio has no claim on.
 */
export function fileMoved(
  written: string | undefined,
  onDisk: string | undefined,
): boolean {
  if (written === undefined || onDisk === undefined) return false;
  return written !== onDisk;
}

/** The words the studio's status line reads for a state. */
export function stateLabel(state: FileState): string {
  if (state === "unsaved") return "unsaved changes";
  if (state === "changed") return "changed on disk";
  return "saved";
}

/**
 * A value string as the JSON the token's own slot says it is.
 *
 * A control speaks strings — a track, a field, a switch all hand back text —
 * but the document's JSON type is what every reader asks first: a boolean
 * written as `"true"` is a string to the tree, the validator and every rule,
 * and a number written as `"500"` quietly stops comparing like one. Where the
 * token's own type can say, the value lands as that type; where it cannot,
 * the string passes through and the theme's validation is the judge.
 */
function coerceValue(current: unknown, value: string): unknown {
  if (typeof current === "boolean") {
    if (value.trim() === "true") return true;
    if (value.trim() === "false") return false;
  }
  if (
    typeof current === "number" && value.trim() !== "" &&
    !Number.isNaN(Number(value))
  ) {
    return Number(value);
  }
  return value;
}

/**
 * Where a value can live on a token.
 *
 * `"base"` is the token's own `$value` — the value the document's first
 * served mode wears — and a mode name is that mode's restatement in
 * `$modes`, now that the modes live on the token rather than in a group
 * beside it. The two are the only places a value can live.
 */
export type EditSlot = "base" | "light" | "dark";

/**
 * Set one token's value, in one slot.
 *
 * A mode value that equals the base is dropped rather than stored: a mode
 * that restates the base value says nothing changed, and the reader should
 * have to say something did.
 */
export function setToken(
  text: string,
  path: string[],
  value: string,
  mode: EditSlot,
): string {
  const doc = JSON.parse(text) as Record<string, unknown>;
  let node: unknown = doc;
  for (const segment of path) {
    if (typeof node !== "object" || node === null) {
      throw new Error(`token ${path.join(".")} does not resolve to a value`);
    }
    node = (node as Record<string, unknown>)[segment];
  }
  if (typeof node !== "object" || node === null || !("$value" in node)) {
    throw new Error(`token ${path.join(".")} has no editable value`);
  }
  const leaf = node as Record<string, unknown>;
  const next = coerceValue(leaf["$value"], value);

  if (mode === "base") {
    // The base moves and the dark value stays: a mode is an override of
    // whatever the base is, so it survives the base changing.
    leaf["$value"] = next;
    return JSON.stringify(doc, null, 2);
  }

  const modes = (leaf["$modes"] ?? {}) as Record<string, unknown>;
  if (next === leaf["$value"]) {
    delete modes[mode];
  } else {
    modes[mode] = next;
  }
  if (Object.keys(modes).length === 0) {
    delete leaf["$modes"];
  } else {
    leaf["$modes"] = modes;
  }
  return JSON.stringify(doc, null, 2);
}

/**
 * Apply several token edits to one document, or none of them.
 *
 * A group moved by one factor is ONE edit as far as the author is
 * concerned: six snapshots for six steps would make a single gesture six
 * presses of undo. And the batch is refused as a whole when any path
 * fails, because a scale that half-landed leaves a group whose ratios the
 * factor never actually set.
 */
export function applyEdits(
  text: string,
  edits: readonly { path: readonly string[]; value: string }[],
  mode: EditSlot,
): string {
  let doc = text;
  for (const edit of edits) {
    doc = setToken(doc, [...edit.path], edit.value, mode);
  }
  return doc;
}

/** The scaffold a creation lands, as the JSON type the declared type means. */
function coerceScaffold(type: string, value: string): unknown {
  if (type === "boolean") {
    if (value.trim() === "true") return true;
    if (value.trim() === "false") return false;
  }
  if (
    type === "number" && value.trim() !== "" && !Number.isNaN(Number(value))
  ) {
    return Number(value);
  }
  return value;
}

/**
 * Insert a token at a path the document does not have yet, with its type.
 *
 * Creation, not editing: the path may stand on groups nobody wrote — a
 * component token belongs to the manifest's vocabulary, and the theme only has
 * to spell it once an author decides the default is not theirs. The groups a
 * missing path needs are built on the way down.
 *
 * An existing token under the path is refused rather than rewritten: the
 * scaffold is what a token STARTS at, never what it is reset to. The
 * refusal is a throw, the same word `setToken` gives a path that does not
 * resolve — a caller only asks to create what the theme is missing, so
 * anything else arriving here is the caller's mistake, and saying so beats
 * handing back a document that silently kept the old value.
 */
export function createToken(
  text: string,
  path: readonly string[],
  type: string,
  value: string,
): string {
  const doc = JSON.parse(text) as Record<string, unknown>;
  let node = doc;
  for (const segment of path.slice(0, -1)) {
    const next = node[segment];
    if (next === undefined) {
      const group: Record<string, unknown> = {};
      node[segment] = group;
      node = group;
    } else if (
      typeof next === "object" && next !== null && !("$value" in next)
    ) {
      node = next as Record<string, unknown>;
    } else {
      throw new Error(
        `token ${path.join(".")} cannot stand inside token ${
          path.slice(0, -1).join(".")
        }`,
      );
    }
  }
  const last = path[path.length - 1];
  if (last === undefined) {
    throw new Error("createToken needs a path to create at");
  }
  if (node[last] !== undefined) {
    throw new Error(`token ${path.join(".")} already exists`);
  }
  node[last] = { $type: type, $value: coerceScaffold(type, value) };
  return JSON.stringify(doc, null, 2);
}

/**
 * Remove a token leaf from a document, and any group along its path that now
 * holds nothing.
 *
 * A theme that creates a style leaf (`font.style.body.size`) or a component
 * token (`card.radius`) during an editing session must be able to return
 * that decision to the style or shared scale by removing the leaf rather
 * than leaving an empty group in the JSON. (TYPE-c: per-field per-element
 * overrides are gone — re-point the element's style or declare a new one.)
 */
export function deleteToken(
  text: string,
  path: readonly string[],
): string {
  const doc = JSON.parse(text) as Record<string, unknown>;
  function removeAt(
    node: Record<string, unknown>,
    segments: readonly string[],
  ): boolean {
    const [head, ...tail] = segments;
    if (head === undefined) return false;
    const child = node[head];
    if (typeof child !== "object" || child === null) return false;
    if (tail.length === 0) {
      if (!("$value" in child)) return false;
      delete node[head];
      return true;
    }
    if ("$value" in child) return false;
    const group = child as Record<string, unknown>;
    if (!removeAt(group, tail)) return false;
    const remaining = Object.keys(group).filter((k) => !k.startsWith("$"));
    if (remaining.length === 0) {
      delete node[head];
    }
    return true;
  }
  removeAt(doc, path);
  return JSON.stringify(doc, null, 2);
}

export function rootDescription(text: string): string {
  try {
    const doc = JSON.parse(text) as Record<string, unknown>;
    return typeof doc["$description"] === "string"
      ? (doc["$description"] as string)
      : "";
  } catch {
    return "";
  }
}

export function setRootDescription(text: string, value: string): string {
  const doc = JSON.parse(text) as Record<string, unknown>;
  if (value.trim() === "") {
    delete doc["$description"];
  } else {
    doc["$description"] = value;
  }
  return JSON.stringify(doc, null, 2);
}

import {
  parseTokens,
  requiredPaths,
  validateLegibility,
  validateTokens,
} from "@spin/theme";
import type { Mode, TokenTree, ValidationIssue } from "@spin/theme";

export interface ThemeState {
  tree: TokenTree | undefined;
  error: string | undefined;
  issues: ValidationIssue[];
}

/**
 * Parse and validate a document, locally.
 *
 * Still the studio's own, and that is a known remainder rather than a
 * decision: the analysis runs on every keystroke-adjacent commit across eight
 * call sites, so it would have to become async everywhere at once to move
 * behind RPC — a refactor of its own, not a move to fold into this one. The
 * cost is bounded (@spin/theme is pure TS with no dependencies), and the
 * AUTHORITY is already the daemon: `preview.css` re-judges the whole document
 * when it generates and refuses what breaks a floor.
 */
export function analyzeTheme(text: string): ThemeState {
  let doc: unknown;
  try {
    doc = JSON.parse(text);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return { tree: undefined, error: `invalid JSON: ${detail}`, issues: [] };
  }
  const parsed = parseTokens(doc);
  if (!parsed.ok) return { tree: undefined, error: parsed.error, issues: [] };
  // The required roles, because the daemon judges the document by them: the
  // preset refuses a theme that is missing one, and a panel that said
  // "nothing to report" about such a theme was answering a weaker question
  // than the one the preview asks. The roles are the theme package's, so
  // the studio and the daemon cannot disagree about what a theme owes.
  const report = validateTokens(parsed.tree, { required: requiredPaths() });
  const issues = [...report.issues, ...validateLegibility(parsed.tree)];
  return { tree: parsed.tree, error: undefined, issues };
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
  try {
    const doc = JSON.parse(text) as Record<string, unknown>;
    const modes = doc["modes"];
    if (
      Array.isArray(modes) &&
      modes.length > 0 &&
      modes.every((mode) => mode === "light" || mode === "dark")
    ) {
      return modes as Mode[];
    }
  } catch {
    return ["light", "dark"];
  }
  return ["light", "dark"];
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
 * Set one token's value, in one mode.
 *
 * `mode` is `"base"` for the token's own `$value` and `"dark"` for its
 * `$modes.dark` — which are the only two places a value can live, now that
 * the dark side lives on the token rather than in a group beside it. A dark
 * value that equals the base is dropped rather than stored: a mode that
 * restates the light value says nothing changed, and the reader should have
 * to say something did.
 */
export function setToken(
  text: string,
  path: string[],
  value: string,
  mode: "base" | "dark",
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
    delete modes["dark"];
  } else {
    modes["dark"] = next;
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
  mode: "base" | "dark",
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

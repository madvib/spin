import { parseTokens, validateLegibility, validateTokens } from "@spin/theme";
import type { TokenTree, ValidationIssue } from "@spin/theme";

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
  const report = validateTokens(parsed.tree);
  const issues = [...report.issues, ...validateLegibility(parsed.tree)];
  return { tree: parsed.tree, error: undefined, issues };
}

function coerceValue(current: unknown, value: string): unknown {
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

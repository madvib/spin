import { parseTokens, validateLegibility, validateTokens } from "@spin/theme";
import type { TokenTree, ValidationIssue } from "@spin/theme";

export interface ThemeState {
  tree: TokenTree | undefined;
  error: string | undefined;
  issues: ValidationIssue[];
}

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

export function setTokenValue(
  text: string,
  path: string[],
  value: string,
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
  leaf["$value"] = coerceValue(leaf["$value"], value);
  return JSON.stringify(doc, null, 2);
}

export function setDarkValue(
  text: string,
  path: string[],
  value: string,
): string {
  const doc = JSON.parse(text) as Record<string, unknown>;
  let dark = doc["dark"];
  if (typeof dark !== "object" || dark === null || Array.isArray(dark)) {
    dark = {};
    doc["dark"] = dark;
  }
  let node: Record<string, unknown> = dark as Record<string, unknown>;
  for (const segment of path.slice(0, -1)) {
    let next = node[segment];
    if (typeof next !== "object" || next === null || Array.isArray(next)) {
      next = {};
      node[segment] = next;
    }
    node = next as Record<string, unknown>;
  }
  const leafName = path[path.length - 1] as string;
  const existing = node[leafName];
  if (
    typeof existing === "object" && existing !== null && "$value" in existing
  ) {
    const leaf = existing as Record<string, unknown>;
    leaf["$value"] = coerceValue(leaf["$value"], value);
  } else {
    node[leafName] = { $value: coerceValue(undefined, value) };
  }
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

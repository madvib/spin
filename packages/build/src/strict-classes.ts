type RuntimeSyntax = Pick<
  typeof import("@spinjs/components/runtime"),
  "classTokens" | "expandVariantGroups" | "parse"
>;

let syntaxCache: RuntimeSyntax | undefined | null;
async function syntax(): Promise<RuntimeSyntax | undefined> {
  if (syntaxCache === undefined) {
    syntaxCache = await import("@spinjs/components/runtime").catch(() => null) ?? null;
  }
  return syntaxCache ?? undefined;
}

function splitTokens(text: string, runtime: RuntimeSyntax | undefined): string[] {
  const expanded = runtime === undefined ? text : runtime.expandVariantGroups(text);
  return expanded.split(/\s+/).filter((token) => token.length > 0);
}
import { relative } from "node:path";
import type { UserShortcuts } from "@unocss/core";
import { engineAnswers } from "@spinjs/preset";
import { rawTypeSeverity, type RawTypeSeverity } from "@spinjs/diagnostics";
import { deriveVocabulary } from "@spinjs/diagnostics/vocabulary";
import { suggestTypeStyle } from "@spinjs/diagnostics";
import type { ContentMap } from "./content.ts";
import {
  parseTokens,
  type ThemeDocument,
} from "@spinjs/theme";

/**
 * The build's unknown-class error (`strictClasses`).
 *
 * The generator reports which tokens resolved (`matched`); the sources say
 * which classes the author wrote. A class the author wrote that nothing
 * resolved styles nothing, so the build says so — with the file, the class,
 * and what to write instead.
 */

export interface StrictClassesInput {
  /** Every scanned source, keyed by absolute path. */
  readonly files: ContentMap;
  /**
   * The scanned sources that belong to the project under the root.
   *
   * The toolchain's own sources (kit, primitive examples, machine
   * recipes) are content in every app so their utilities resolve,
   * but they are not the project's to answer for: the preset ships
  * no compositions and each app declares its own, so judging
  * internal files by the app's shortcuts would flag the
  * toolchain's vocabulary as the project's typo. Only files at
  * or under the root are checked; the toolchain's own tree is
  * covered by `scripts/uno-class-check.ts` instead.
   */
  /** The tokens the generator resolved. */
  readonly matched: ReadonlySet<string>;
  /** The themes the sheet was generated from. */
  readonly themes: Record<string, ThemeDocument>;
  /** The project's own shortcuts, as passed to the preset. */
  readonly shortcuts?: UserShortcuts;
  /** The flag's spelling: error always, error in builds, or silence. */
  readonly strict?: boolean;
  /**
   * How removed raw type utilities (`text-*` sizes, `font-*`
   * families/weights) report. Omitted, the migration window decides: warn
   * before the gate minor, error after it. A genuine typo is an error either
   * way — the window covers the rename, not the vocabulary.
   */
  readonly rawType?: RawTypeSeverity;
  /** Whether the sheet is served or built. */
  readonly envMode: "dev" | "build";
  /** The project root the file paths are read against. */
  readonly root: string;
  /** Where the dev warning goes. Builds throw instead. */
  readonly report: (message: string) => void;
}

/** One class that generates no CSS, and where it was written. */
export interface DeadClass {
  readonly file: string;
  readonly cls: string;
  readonly suggestion: string | undefined;
  /** The shortcut that spends the dead class, when that is the problem. */
  readonly shortcut: string | undefined;
  /**
   * Whether the class is a removed raw type utility travelling under the
   * migration window: it warns while the window is open and errors past
   * the gate, where every other dead class errors in builds either way.
   */
  readonly removedType?: boolean;
}

/**
 * Fail the build on classes the theme cannot produce, or warn in dev.
 *
 * `strict === false` restores silence. Otherwise a production build (or an
 * explicit `true`) throws with every dead class; the dev server reports the
 * same payload and keeps serving. Removed raw type utilities follow the
 * migration window instead: they warn while the window is open, even in a
 * production build, and join the error past the gate.
 */
export async function checkStrictClasses(input: StrictClassesInput): Promise<void> {
  if (input.strict === false) return;
  const dead = await deadClasses(input);
  if (dead.length === 0) return;
  const windowed = rawTypeSeverity(input.rawType);
  if (windowed === "warn") {
    const removed = dead.filter((entry) => isRemovedTypeEntry(entry));
    const rest = dead.filter((entry) => !isRemovedTypeEntry(entry));
    if (removed.length > 0) input.report(formatStrictClassesError(removed));
    if (rest.length === 0) return;
    const message = formatStrictClassesError(rest);
    if (input.strict === true || input.envMode === "build") {
      throw new Error(message);
    }
    input.report(message);
    return;
  }
  const message = formatStrictClassesError(dead);
  if (input.strict === true || input.envMode === "build") {
    throw new Error(message);
  }
  input.report(message);
}

/**
 * Whether a dead class travels under the migration window rather than with
 * the ordinary dead: a removed raw type utility, marked where the class was
 * read with the prefixes and values in hand.
 */
function isRemovedTypeEntry(entry: DeadClass): boolean {
  return entry.removedType === true;
}

/** Every class the sources name that nothing produces. */
export async function deadClasses(input: Omit<StrictClassesInput, "strict" | "envMode" | "report">): Promise<DeadClass[]> {
  const trees = Object.values(input.themes).flatMap((document) => {
    const parsed = parseTokens(
      document as Parameters<typeof parseTokens>[0],
    );
    return parsed.ok ? [parsed.tree] : [];
  });
  // The one derivation both surfaces read: the lint's prefixes and values
  // come from this same call, so the build error and the lint cannot
  // disagree. The oracle needs the engine's families, so they are answered
  // from the project's own themes first — the families are what the sheet
  // was generated from, not the languages the lint falls back to.
  const oracle = deriveVocabulary({
    trees,
    answers: engineAnswers(Object.values(input.themes)),
    generated: new Set(),
    shortcuts: {
      shortcuts: Object.fromEntries(
        Object.keys(input.shortcuts ?? {}).map((name) => [name, []]),
      ),
      unreadable: false,
    },
  });
  const prefixes = oracle.prefixes;
  // The theme's resolved values, for the removed-type suggestion: a dead
  // `text-sm` names the style that reads that way, the way the lint remedy
  // does. Read from the oracle, so the two suggestions cannot disagree.
  const values = oracle.values;
  // The vocabulary is the utilities AND the variants: the old set folded
  // the catalog, the primitives' own variants, the animation layer, and
  // the shortcut names into one membership the `known` check reads.
  // `matched` stays OUT of the oracle's `generated`: the generator's own
  // resolutions are an allowlist `known` reads separately, not vocabulary —
  // folding them in would let `suggestFor` offer a token the generator
  // happened to resolve instead of the nearest producible class.
  const vocabulary = new Set<string>([...oracle.utilities, ...oracle.variants]);
  const known = (token: string): boolean => {
    if (input.matched.has(token)) return true;
    if (vocabulary.has(token)) return true;
    const core = coreOf(token, prefixes);
    if (input.matched.has(core)) return true;
    if (vocabulary.has(core)) return true;
    return false;
  };
  const seen = new Map<string, Set<string>>();
  // Bare values the `variant="…"` scan emitted with their compounds, so
  // the dead check can ride them together (see `consider`).
  const variantBares = new Set<string>();
  const variantCompounds = new Map<string, Set<string>>();
  for (const [, text] of input.files) {
    for (
      const match of text.matchAll(
        /<([a-z][a-z0-9-]*)[^>]*\svariant\s*=\s*"([^"]*)"/g,
      )
    ) {
      const element = match[1] as string;
      for (const token of (match[2] ?? "").split(/\s+/)) {
        if (token.length === 0) continue;
        variantBares.add(token);
        const set = variantCompounds.get(token) ?? new Set<string>();
        set.add(`${element}-${token}`);
        variantCompounds.set(token, set);
      }
    }
  }
  const consider = (file: string, cls: string): void => {
    if (cls.length === 0 || /[{}]/.test(cls)) return;
    // A class ending in a dash is never vocabulary — only ever the static
    // half of a dynamic hole (`` bg-${suffix} ``). Computed names stay
    // silent by the documented boundary.
    if (cls.endsWith("-")) return;
    // Icon glyphs come from the icon preset, not the token vocabulary.
    if (coreOf(cls, prefixes).startsWith("i-")) return;
    // Variant markers name no CSS of their own: `group`/`peer` exist so a
    // variant has something to read (`group-hover:`, `peer-focus:`). The
    // sheet names them in the selectors it writes, so dropping one would
    // break the variant that reads it.
    if (cls === "group" || cls === "peer") return;
    if (known(cls)) return;
    // A bare variant value (`success` from `variant="success"`) resolves
    // through whatever the extractor emits beside it — the bare token or
    // the compound (`badge-success`) — so it is dead only when neither
    // resolves.
    const compounds = variantCompounds.get(cls);
    if (compounds !== undefined) {
      if ([...compounds].some((c) => input.matched.has(c))) return;
      if (input.matched.has(cls)) return;
    }
    const files = seen.get(cls) ?? new Set<string>();
    files.add(file);
    seen.set(cls, files);
  };
  const runtime = await syntax();
  for (const [path, text] of input.files) {
    const file = relative(input.root, path);
    if (file.startsWith("..")) continue;
    for (const cls of candidatesInFile(path, text, runtime)) consider(file, cls);
  }
  // A removed raw type utility names the style that reads that way — the
  // same suggestion the lint remedy carries — rather than the nearest
  // neighbour by spelling, which would never reach across the rename. The
  // entry carries the window marker with it, so the check can split the
  // migration warning from the ordinary dead without re-deriving anything.
  const suggest = (cls: string): { suggestion: string | undefined; removedType: boolean } => {
    const style = suggestTypeStyle(coreOf(cls, prefixes), values);
    if (style !== undefined) return { suggestion: style, removedType: true };
    return { suggestion: suggestFor(cls, prefixes, vocabulary), removedType: false };
  };
  const out: DeadClass[] = [];
  for (const [cls, files] of [...seen].sort(([a], [b]) => a < b ? -1 : 1)) {
    const { suggestion, removedType } = suggest(cls);
    for (const file of [...files].sort()) {
      out.push({
        file,
        cls,
        suggestion,
        shortcut: undefined,
        ...(removedType ? { removedType: true as const } : {}),
      });
    }
  }
  // A shortcut that spends a class the theme cannot make styles nothing,
  // wherever it is written. The name is vocabulary; what it expands to is
  // checked the way the lint checks it.
  for (const [name, value] of Object.entries(input.shortcuts ?? {})) {
    const parts = typeof value === "string"
      ? value.split(/\s+/).filter(Boolean)
      : Array.isArray(value)
      ? (value as readonly unknown[]).filter((part): part is string =>
        typeof part === "string"
      )
      : [];
    for (const part of parts) {
      if (coreOf(part, prefixes).startsWith("i-")) continue;
      if (known(part)) continue;
      const { suggestion, removedType } = suggest(part);
      out.push({
        file: "the project configuration",
        cls: part,
        suggestion,
        shortcut: name,
        ...(removedType ? { removedType: true as const } : {}),
      });
    }
  }
  return out;
}

/**
 * The class a variant prefix leaves behind.
 *
 * `hover:bg-primary` is `bg-primary` under a state. A prefix the vocabulary
 * does not know is left alone: `md:flex` is only a variant if `md:` is a
 * breakpoint the theme declares. Mirrors the core's reading exactly.
 */
function coreOf(cls: string, prefixes: ReadonlySet<string>): string {
  const parts = cls.split(":");
  if (parts.length === 1) return cls;
  for (const part of parts.slice(0, -1)) {
    // wind4's attribute variants ride in the preset (`data-[…]:`,
    // `aria-[…]:`, `group-*:`/`peer-*:`): the bracket carries the
    // selector, so any `data-`/`aria-` head is a prefix by shape.
    if (/^(data|aria)-/.test(part)) continue;
    if (/^(group|peer)(-.+)?$/.test(part)) continue;
    if (!prefixes.has(`${part}:`)) return cls;
  }
  return parts[parts.length - 1] as string;
}

/** What to write instead, by edit distance over what the theme produces. */
export function suggestFor(
  cls: string,
  prefixes: ReadonlySet<string>,
  vocabulary: ReadonlySet<string>,
): string | undefined {
  const chain: string[] = [];
  const rest = cls.split(":");
  while (rest.length > 1 && prefixes.has(`${rest[0]}:`)) {
    chain.push(rest.shift() as string);
  }
  const core = rest.join(":");
  const near = nearestSuggestion(core, vocabulary);
  if (near === undefined) return undefined;
  return chain.length === 0 ? near : [...chain, near].join(":");
}

/** The closest producible class, or nothing close enough to offer. */
export function nearestSuggestion(
  cls: string,
  vocabulary: ReadonlySet<string>,
): string | undefined {
  let best: string | undefined;
  let bestDistance = 4;
  for (const candidate of [...vocabulary].sort()) {
    if (Math.abs(candidate.length - cls.length) > 3) continue;
    const distance = editDistance(cls, candidate);
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return best;
}

/** Two names apart, by insertions, deletions, and swaps. */
function editDistance(a: string, b: string): number {
  const previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diagonal = previous[0] as number;
    previous[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const above = previous[j] as number;
      previous[j] = Math.min(
        (previous[j - 1] as number) + 1,
        above + 1,
        diagonal + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      diagonal = above;
    }
  }
  return previous[b.length] as number;
}

/** The error a dead class fails the build with. */
export function formatStrictClassesError(dead: readonly DeadClass[]): string {
  const shown = dead.slice(0, 20);
  const lines = shown.map((entry) =>
    entry.shortcut === undefined
      ? entry.suggestion === undefined
      ? `[spin] \`${entry.cls}\` in ${entry.file} generates no CSS — it is not in the spin vocabulary. Drop it.`
      : `[spin] \`${entry.cls}\` in ${entry.file} generates no CSS — it is not in the spin vocabulary. Did you mean \`${entry.suggestion}\`?`
      : `[spin] \`${entry.shortcut}\` in ${entry.file} expands to \`${entry.cls}\`, which the theme cannot produce. The shortcut would style nothing.`
  );
  if (dead.length > shown.length) {
    lines.push(`…and ${dead.length - shown.length} more.`);
  }
  return lines.join("\n");
}

/** Every class a file means, in the file's own order. */
export function candidatesInFile(path: string, text: string, runtime?: RuntimeSyntax): string[] {
  if (path.endsWith(".html") && runtime !== undefined) {
    try {
      const stripped = text
        .replace(/<!--[\s\S]*?-->/g, "")
        .replace(/<script(\s[^>]*)?>[\s\S]*?<\/script>\s*/g, "");
      return [
        ...runtime.classTokens(runtime.parse(stripped)),
        ...variantValues(text),
      ].flatMap((token) => splitTokens(token, runtime))
        .filter((token) => token.length > 0);
    } catch {
      // Not a component: fall through to the text scan below.
    }
  }
  const out: string[] = [];
  // Displayed markup first: a single-line template literal containing
  // `<…>` is a code sample naming classes to talk about them
  // (`` `<p class="p-13">` ``), never worn classes — worn templates
  // hold class lists, not elements. Blanked, not deleted, so positions
  // and token boundaries survive. Single-line only: a multiline span
  // would eat real markup between two far-apart backticks.
  const prose = text.replace(/`[^`\n]*<[^`\n]*`/g, (m) => " ".repeat(m.length));
  // A class attribute is a string, a template, or a list. The scan mirrors
  // the vocabulary's own (`diagnostics/generated.ts`): quoted values name
  // classes, template expressions name their static text, and a list names
  // its string elements and object keys. Bare identifiers are conditions,
  // not classes, and computed keys are out of scope — both stay silent.
  for (const match of prose.matchAll(CLASS_ATTRIBUTE)) {
    // Displayed code, not applied markup: a `class="…"` pattern that
    // opens inside a string literal (`badCode: 'class="p-13"'`) is a
    // demo snippet naming classes to talk about them, not to wear
    // them. Applied JSX never quotes the attribute name itself.
    const before = match.index === undefined ? "" : prose[match.index - 1] ?? "";
    if (before === '"' || before === "'" || before === "`") continue;
    const quoted = match[1] ?? match[2];
    if (quoted !== undefined) {
      pushTokens(quoted, out, runtime);
      continue;
    }
    pushTokens(staticText(match[3] ?? ""), out, runtime);
  }
  for (
    const match of text.matchAll(
      /(?:class|className)\s*=\s*\{\s*\[([\s\S]*?)\]\s*\}/g,
    )
  ) {
    for (const literal of (match[1] ?? "").matchAll(/"([^"]*)"|'([^']*)'/g)) {
      pushTokens(literal[1] ?? literal[2] ?? "", out, runtime);
    }
  }
  for (const value of variantValues(text)) pushTokens(value, out, runtime);
  return out;
}

/** The classes a file's markup declares (see `candidatesInFile`). */
const CLASS_ATTRIBUTE =
  /(?:class|className)\s*=\s*\{?\s*(?:"([^"]*)"|'([^']*)'|`([^`]*)`)/g;

/** A template literal apart from its expressions. */
function staticText(text: string): string {
  // Depth-aware holes, kept silent: `${…}` nests (a ternary choosing
  // between two templates), and a flat split would leak identifiers
  // like `props.running` out as phantom classes. String literals
  // inside a hole are NOT extracted — a comparand (`x === "disabled"`)
  // is indistinguishable from a worn arm (`c ? "p-4" : "p-2"`) without
  // parsing the expression, and guessing punishes honest code. Holes
  // are code; computed names stay silent by the documented boundary.
  let out = "";
  let i = 0;
  while (i < text.length) {
    const hole = text.indexOf("${", i);
    if (hole === -1) {
      out += text.slice(i);
      break;
    }
    out += text.slice(i, hole);
    let depth = 1;
    let j = hole + 2;
    while (j < text.length && depth > 0) {
      if (text[j] === "{") depth++;
      else if (text[j] === "}") depth--;
      j++;
    }
    out += " ";
    i = j;
  }
  return out;
}

/** The values `variant="…"` attributes name. */
function variantValues(text: string): string[] {
  const out: string[] = [];
  for (
    const match of text.matchAll(
      /<([a-z][a-z0-9-]*)[^>]*\svariant\s*=\s*"([^"]*)"/g,
    )
  ) {
    // Bare values only: the compound (`badge-success`) is extractor
    // exhaust, not something the author wrote. Whether the value
    // resolves is decided in `consider`, which sees both.
    for (const token of (match[2] ?? "").split(/\s+/)) {
      if (token.length === 0) continue;
      out.push(token);
    }
  }
  return out;
}

function pushTokens(text: string, out: string[], runtime?: RuntimeSyntax): void {
  for (const token of splitTokens(text, runtime)) out.push(token);
}

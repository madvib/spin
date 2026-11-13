/**
 * The classes the preset produces that the catalog does not name.
 *
 * The catalog describes spin's own rules. The preset also layers wind4
 * underneath them, and wind4 answers for the utilities spin does not own —
 * `truncate`, `bg-transparent`, an arbitrary `w-[16rem]`. Those classes
 * generate CSS, so the closed-vocabulary rule must not call them unknown.
 *
 * The answer comes from the generator itself: the same resolver the daemon
 * and the editor ask, so a rule's answer and the editor's answer cannot
 * disagree.
 *
 * Bounded on purpose: a linter's visitor asks about the classes in the
 * file it is reading — never about a tree walk. The resolutions are cached
 * per project root, so repeated reads cost nothing and an unbounded
 * directory walk never runs.
 *
 * Nothing here can fail the lint: a generator that cannot be built, a
 * class that cannot be read — each one leaves the answer empty, and the
 * vocabulary falls back to the catalog.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import { designLanguages } from "@spinjs/theme";

/**
 * A component parse that outran its budget.
 *
 * Well-formed files parse in milliseconds; a parse past the budget is
 * pathological input, not a large file. The lint catches this and falls
 * back to the regex scan, so one bad file degrades rather than hangs.
 */
export class ParseBudgetError extends Error {
  readonly file: string;
  constructor(file: string) {
    super(`parsing ${file} exceeded the 2000ms budget`);
    this.name = "ParseBudgetError";
    this.file = file;
  }
}

/**
 * The class names the generated stylesheet names.
 *
 * A class the sheet names is a class the project produces, even when the
 * class styles nothing by itself: the marker a variant looks for (`peer`) is
 * named in the selector the variant writes, and a rule that dropped it would
 * break the variant that reads it.
 *
 * The names are read off the sheet, so the answer cannot disagree with what
 * the browser is handed.
 */
function namedIn(css: string): Set<string> {
  const out = new Set<string>();
  for (
    const match of css.matchAll(
      /(?<![\w-])\.((?:[a-zA-Z0-9_-]|\\.)+)/g,
    )
  ) {
    out.add((match[1] as string).replace(/\\(.)/g, "$1"));
  }
  return out;
}

/** The candidates one generator pass answers for: the CSS of a chunk fits in memory whatever the project holds. */
const RESOLVE_CHUNK = 2000;

/**
 * The classes the preset generates, asked of the generator.
 *
 * The probe builds over the design languages alone: a project's own theme
 * documents are partial by design (layers over a language), and one the
 * build would judge incomplete must not poison the resolutions the
 * languages give. Chunked: one generator, one pass per chunk, so the
 * stylesheet of a pass stays small no matter how many candidates the root
 * holds.
 */
async function resolve(
  candidates: ReadonlySet<string>,
): Promise<ReadonlySet<string>> {
  try {
    if (candidates.size === 0) return new Set<string>();
    const { createGenerator } = await import("@unocss/core");
    const { spinPreset } = await import("@spinjs/preset");
    const generator = await createGenerator({
      presets: [
        spinPreset({ themes: { ...designLanguages } }),
      ],
    });
    const out = new Set<string>();
    const list = [...candidates];
    for (let at = 0; at < list.length; at += RESOLVE_CHUNK) {
      const { matched, css } = await generator.generate(
        new Set(list.slice(at, at + RESOLVE_CHUNK)),
      );
      for (const cls of matched) out.add(cls);
      for (const cls of namedIn(css)) out.add(cls);
    }
    return out;
  } catch {
    // The vocabulary is the catalog's alone; the rules abstain rather than
    // guess, and a generator that cannot be built is not a reason to stop.
    return new Set<string>();
  }
}

/**
 * The classes the preset produces that the catalog does not name, resolved
 * for the candidates a linted file actually wears.
 *
 * Bounded: the generator answers for the given tokens only — the caller
 * passes what it read from the file it is judging, never a tree walk.
 * Resolutions accumulate per root, so a token asked once is never asked
 * again and repeated reads cost nothing.
 */
export async function resolveWind4Tokens(
  root: string,
  candidates: ReadonlySet<string>,
): Promise<ReadonlySet<string>> {
  await warmVocabulary(root, candidates);
  return vocabularyOf(root) ?? new Set<string>();
}

/**
 * The vocabulary a project is judged by, kept per project root.
 *
 * The classes the preset produces beyond the catalog are wind4's, and
 * wind4 answers for the classes a project writes: `truncate` is a class the
 * project produces if the project writes it. So the vocabulary belongs to
 * the project, and a project is judged by the classes its own source
 * declares — not by the classes some other tree happens to declare.
 */
const byRoot = new Map<string, ReadonlySet<string>>();
const candidatesByRoot = new Map<string, Set<string>>();

/**
 * The classes the preset produces for a project's own source.
 *
 * Asked of the generator, once per project per distinct candidate: the
 * generator is the only one that knows what a class the catalog does not
 * name resolves to. Additive — only candidates the root has not seen are
 * resolved, and their resolutions union into the root's set — because
 * unrelated files outside any project share the empty root, and the first
 * file warmed must not fix the vocabulary for the rest.
 */
export async function warmVocabulary(
  root: string,
  candidates: Iterable<string>,
): Promise<void> {
  const known = candidatesByRoot.get(root) ?? new Set<string>();
  const fresh = new Set<string>();
  for (const candidate of candidates) {
    if (known.has(candidate)) continue;
    known.add(candidate);
    fresh.add(candidate);
  }
  candidatesByRoot.set(root, known);
  if (fresh.size === 0) return;
  const resolved = await resolve(fresh);
  const kept = byRoot.get(root) ?? new Set<string>();
  byRoot.set(root, new Set([...kept, ...resolved]));
}

/**
 * The vocabulary a project is judged by, when it has been warmed.
 *
 * Absent means the project has not been asked yet: nothing resolved, and
 * the caller reads the catalog alone.
 */
export function vocabularyOf(
  root: string,
): ReadonlySet<string> | undefined {
  return byRoot.get(root);
}

/* ------------------------------------------------------- the candidates -- */

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

function expandGroups(text: string, runtime: RuntimeSyntax | undefined): string[] {
  if (runtime === undefined) {
    return text.split(/\s+/).filter((token) => token.length > 0);
  }
  return runtime.expandVariantGroups(text).split(/\s+/).filter((token) => token.length > 0);
}

/** A component parse past this long is pathological, not large. */
const PARSE_BUDGET_MS = 2000;

/** The files a scope walk reads. */
const SOURCE = /\.(?:tsx?|jsx?|mjs|cjs|vue|svelte|astro|html?)$/;

/**
 * The classes a file's markup declares.
 *
 * A class attribute is either a string or a template: a template's static
 * text is still the classes the author wrote, and the expressions in it are
 * the author's own arithmetic. Both are read, because the generator has to
 * be asked about every class the project writes — a class nobody asks
 * about is a class the vocabulary cannot vouch for.
 */
const CLASS_ATTRIBUTE =
  /(?:class|className|:class|v-bind:class)\s*=\s*\{?\s*(?:"([^"]*)"|'([^']*)'|`([^`]*)`)/g;

/** The classes a template literal spells, apart from its expressions. */
function staticClasses(text: string): string[] {
  const out: string[] = [];
  for (const part of text.split(/\$\{[^}]*\}/)) {
    for (const cls of part.split(/\s+/)) {
      if (cls.length > 0) out.push(cls);
    }
  }
  return out;
}

/**
 * Every class a set of files declares.
 *
 * The files are given, never walked to: the caller names the scope — the
 * linted files, the argv scope — and only those files are read.
 */
export async function candidatesIn(files: readonly string[]): Promise<Set<string>> {
  const runtime = await syntax();
  const out = new Set<string>();
  for (const file of files) {
    for (const cls of classesIn(file, runtime)) out.add(cls);
  }
  return out;
}

/** The classes one file declares. */
function classesIn(path: string, runtime: RuntimeSyntax | undefined): string[] {
  let text: string;
  try {
    text = readFileSync(path, "utf8") as string;
  } catch {
    return [];
  }
  if (/\.(?:html?|vue|svelte|astro)$/.test(path)) {
    try {
      const stripped = text
        .replace(/^---[\s\S]*?---/, "")
        .replace(/<!--[\s\S]*?-->/g, "")
        .replace(/<script(\s[^>]*)?>[\s\S]*?<\/script>\s*/g, "")
        .replace(/<style(\s[^>]*)?>[\s\S]*?<\/style>\s*/g, "")
        .replace(/<\/?template(\s[^>]*)?>/g, "");
      if (runtime !== undefined) {
        const start = Date.now();
        const ir = runtime.parse(stripped);
        if (Date.now() - start > PARSE_BUDGET_MS) throw new ParseBudgetError(path);
        return runtime.classTokens(ir);
      }
    } catch {
      // Not a component: fall through to the regex scan below.
    }
  }
  const out: string[] = [];
  for (const match of text.matchAll(CLASS_ATTRIBUTE)) {
    const quoted = match[1] ?? match[2];
    if (quoted !== undefined) {
      for (const cls of expandGroups(quoted, runtime)) out.push(cls);
      continue;
    }
    for (const cls of staticClasses(match[3] ?? "")) out.push(cls);
  }
  for (
    const match of text.matchAll(
      /(?:class|className|classList)\s*=\s*\{([\s\S]*?)\}(?=\s+[a-zA-Z_:/-]|\s*\/?>)/g,
    )
  ) {
    for (const literal of (match[1] ?? "").matchAll(/"([^"]*)"|'([^']*)'/g)) {
      const value = literal[1] ?? literal[2] ?? "";
      for (const cls of expandGroups(value, runtime)) out.push(cls);
    }
  }
  return out;
}

/* ------------------------------------------------------- the argv scope -- */

/** The directories a scope walk never enters: version control and installs are never linted. */
const NEVER_ENTERED = new Set([".git", "node_modules"]);

/**
 * The files under a scope entry: the file itself, or the sources under a
 * named directory.
 *
 * The scope is what the invocation named — the paths on the command line —
 * never the tree around them: linting one file warms one file, and linting
 * a directory warms what the linter will visit. Flags, globs, and missing
 * paths name nothing.
 */
function scopeFiles(entries: readonly string[]): string[] {
  const out: string[] = [];
  const stack = [...entries];
  while (stack.length > 0) {
    const entry = stack.pop() as string;
    if (entry.startsWith("-") || entry.includes("*")) continue;
    let stat: { isFile(): boolean; isDirectory(): boolean };
    try {
      stat = statSync(entry);
    } catch {
      continue;
    }
    if (stat.isFile()) {
      if (SOURCE.test(entry)) out.push(entry);
      continue;
    }
    if (!stat.isDirectory()) continue;
    let names: { name: string; isDirectory(): boolean }[];
    try {
      names = readdirSync(entry, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const name of names) {
      if (name.isDirectory() && NEVER_ENTERED.has(name.name)) continue;
      stack.push(join(entry, name.name));
    }
  }
  return out;
}

/**
 * The classes the invocation's own scope declares, resolved per project.
 *
 * Read once at plugin load: linter visitors are synchronous with no async
 * hook, so the resolutions they read are warmed before the first visitor
 * runs. Grouped by project root — each root is judged by its own source —
 * and each root resolves only candidates it has not seen.
 */
export async function warmArgvScope(argv: readonly string[] = process.argv.slice(2)): Promise<void> {
  const files = scopeFiles(argv);
  if (files.length === 0) return;
  const { findProjectRootIn, projectRootFor } = await import("./project.ts");
  const toolRoot = findProjectRootIn(process.cwd(), process.cwd()) ?? "";
  const byScopeRoot = new Map<string, string[]>();
  for (const file of files) {
    const root = projectRootFor(file) ?? toolRoot;
    const list = byScopeRoot.get(root) ?? [];
    list.push(file);
    byScopeRoot.set(root, list);
  }
  for (const [root, group] of byScopeRoot) {
    await warmVocabulary(root, await candidatesIn(group));
  }
}

/**
 * Whether the plugin was loaded by a linter: an argv entry naming the
 * linter's own binary.
 *
 * The basename pins the binary — `oxlint`, `oxlint@1.85.0` under bunx,
 * `eslint`, `eslint.js` — so a test file that merely mentions a linter
 * (`eslint.test.ts`) never warms a scope it never asked for.
 */
function hostedByLinter(argv: readonly string[]): boolean {
  return argv.some((entry) => /^(?:oxlint|eslint)(?:@.*|\.js|\.exe)?$/.test(basename(entry)));
}

/**
 * Warm the invocation's scope when a linter hosts the plugin, else nothing.
 *
 * Plugin entries await this at load: under `oxlint` or `eslint` the named
 * scope is resolved before the first visitor runs, and everywhere else —
 * unit tests, the LSP, the bundler — import stays fast.
 */
export async function warmIfLinterHost(): Promise<void> {
  if (!hostedByLinter(process.argv)) return;
  await warmArgvScope();
}

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
 * disagree. It is asynchronous and a linter's visitor is not, so it is
 * asked once — before the first file is linted — about the classes the
 * project's own markup contains.
 *
 * Nothing here can fail the lint: a generator that cannot be built, a tree
 * that cannot be walked, a class that cannot be read — each one leaves the
 * answer empty, and the vocabulary falls back to the catalog.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { readShortcuts } from "@spinjs/server/project";
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

/** A component parse past this long is pathological, not large. */
const PARSE_BUDGET_MS = 2000;

/** The directories a scan does not walk into. */
const SKIPPED = new Set([
  ".git",
  ".output",
  ".vite",
  "coverage",
  "dist",
  "node_modules",
  "out",
  "public",
]);

/** The files a scan reads. */
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
 * Every class the project's markup declares.
 *
 * The whole tree under the tool's root, because the tool's root is the
 * project the lint runs in.
 */
async function declaredClasses(root: string): Promise<Set<string>> {
  const runtime = await syntax();
  const out = new Set<string>();
  const stack: string[] = [root];
  while (stack.length > 0) {
    const dir = stack.pop() as string;
    let entries: { name: string; isDirectory(): boolean }[];
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!SKIPPED.has(entry.name)) stack.push(path);
        continue;
      }
      if (/^(?:vite|uno)\.config\.[cm]?[jt]s$/.test(entry.name)) {
        for (const parts of Object.values(readShortcuts(dir).shortcuts)) {
          for (const part of parts) out.add(part);
        }
      }
      if (!SOURCE.test(entry.name)) continue;
      for (const cls of classesIn(path, runtime)) out.add(cls);
    }
  }
  return out;
}

/**
 * Every class a set of files declares.
 *
 * The files are the project's own source, so the vocabulary is the
 * project's: a class the project writes is a class the generator is asked
 * about, and a class nothing else writes is a class this project does not
 * produce.
 */
export async function declaredClassesIn(files: readonly string[]): Promise<Set<string>> {
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
  // A `.html` component names its classes in expressions (`class={[...]}`),
  // so read them through the syntax the components are compiled with. The
  // text walk below only sees static `class="..."`, which is why this goes
  // first: fall back to it when the file is not a component (a document, a
  // fragment the parser rejects).
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
  // A dynamic list (`class={["...", { "cls": cond }]}`) in JSX names its
  // utilities in string literals the static attribute above never sees. The
  // build must produce those too, so the literals are passed to the
  // generator with them.
  // Dynamic expressions (`class={...}`, `className={...}`, `classList={...}`)
  // name utilities inside ternaries, arrays, and conditional objects.
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

/** The classes the preset generates, asked of the generator. */
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
    const { matched, css } = await generator.generate(new Set(candidates));
    return new Set([...matched, ...namedIn(css)]);
  } catch {
    // The vocabulary is the catalog's alone; the rules abstain rather than
    // guess, and a generator that cannot be built is not a reason to stop.
    return new Set<string>();
  }
}

/**
 * The classes the preset produces beyond the catalog, for the tool's own
 * tree.
 *
 * Lazy on purpose: the computation walks the whole tree under the cwd and
 * asks the generator about every class it declares, so running it at
 * import time would tax every host — the CLI, the LSP, both editor
 * plugins, the bundler — before any of them lint a file. The first read
 * pays; synchronous callers that read before any lint ran get the empty
 * vocabulary, and the rules abstain rather than guess.
 */
let cwdClasses: ReadonlySet<string> | undefined;
let cwdWarming: Promise<ReadonlySet<string>> | undefined;

/** Whether the cwd vocabulary has finished warming. */
export function generatedClassesReady(): boolean {
  return cwdClasses !== undefined;
}

/** Warm the cwd vocabulary once, returning the shared promise. */
export function ensureCwdWarmed(): Promise<ReadonlySet<string>> {
  if (cwdClasses !== undefined) return Promise.resolve(cwdClasses);
  cwdWarming ??= warmCwd();
  return cwdWarming;
}

/** The cwd vocabulary, warming it in the background on first read. */
export function generatedClassesNow(): ReadonlySet<string> {
  if (cwdClasses !== undefined) return cwdClasses;
  cwdWarming ??= warmCwd();
  return new Set<string>();
}

async function warmCwd(): Promise<ReadonlySet<string>> {
  const warmed = await resolve(await declaredClasses(process.cwd()));
  cwdClasses = warmed;
  return warmed;
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
 * Asked of the generator, once per project per distinct candidate set:
 * the generator is the only one that knows what a class the catalog does
 * not name resolves to. Additive — new candidates union into the root's
 * set and re-resolve only when the set grows — because unrelated files
 * outside any project share the empty root, and the first file warmed
 * must not fix the vocabulary for the rest.
 */
export async function warmVocabulary(
  root: string,
  candidates: Iterable<string>,
): Promise<void> {
  const known = candidatesByRoot.get(root) ?? new Set<string>();
  let grown = false;
  for (const candidate of candidates) {
    if (known.has(candidate)) continue;
    known.add(candidate);
    grown = true;
  }
  candidatesByRoot.set(root, known);
  if (!grown && byRoot.has(root)) return;
  byRoot.set(root, await resolve(known));
}

/**
 * The vocabulary a project is judged by, when it has been warmed.
 *
 * Absent means the project has not been asked yet, and the caller falls
 * back to the tree's own vocabulary.
 */
export function vocabularyOf(
  root: string,
): ReadonlySet<string> | undefined {
  return byRoot.get(root);
}

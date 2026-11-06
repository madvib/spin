/**
 * The recipe check: structural traps the class check cannot see.
 *
 * Two rules, both learned the hard way:
 *
 * - A `border`/`border-2` width without a style utility (`border-solid`
 *   et al) paints nothing — the browser default style is `none`. The
 *   angle-slider's dial ring shipped invisible this way.
 * - A static `style="..."` on an element carrying a `{...bag}` spread is
 *   stripped on the spread's first run (it prunes attributes the bag does
 *   not carry). Positioning must live in the bag's style object.
 * - `type="button"` on an element carrying a `{...bag}` spread is dead:
 *   35 defs emit `type` from the bag (a trigger inside a consumer's form
 *   must not submit it), and the machine cannot see its ancestors so it
 *   assumes the worst. The static attr never fires.
 * - A bagless `<button>` inside a `<form>` without `type=` is a submit by
 *   default. The only place the attr does anything is in a form.
 * - A `data-testid` in an example ships in the code users copy. Tests select
 *   by part (`[data-part="trigger"]`) or mount tag (`<machine-stem>`); the
 *   studio's own components keep their testids for e2e.
 *
 *   deno run -A scripts/recipe-check.ts
 *
 * The exit code is the point: this belongs beside `deno check`, not in a
 * human's memory of which patterns break.
 */

import { readdir, readFile } from "node:fs/promises";
import { readdirSync, readFileSync } from "node:fs";
import * as components from "../packages/components/src/index.ts";

/** No recipe may spell `var(--x)`: custom properties are framework
 * transport (defs, actions), never author markup. */
const VAR_GRANDFATHERED: ReadonlySet<string> = new Set([]);
const ROOT = "packages/components/src";
const STUDIO_COMPONENTS = "apps/studio/src/lib/components";
async function* walkFiles(root: string, exts: string[]): AsyncGenerator<{ path: string; isFile: boolean }> {
  const entries = await readdir(root, { withFileTypes: true });
  for (const e of entries) {
    const p = `${root}/${e.name}`;
    if (e.isDirectory()) yield* walkFiles(p, exts);
    else if (e.isFile() && exts.some((x) => e.name.endsWith(x))) yield { path: p, isFile: true };
  }
}
type Manifest = {
  readonly parts: readonly string[];
  readonly slots: readonly string[];
  readonly readers: readonly string[];
  readonly methods: readonly string[];
  readonly commands: readonly string[];
};

const cap = (name: string): string =>
  name.length === 0 ? name : name[0]!.toUpperCase() + name.slice(1);

/** Every callable/readable member an example may touch on the machine. */
function membersOf(manifest: Manifest): Set<string> {
  const out = new Set<string>([
    ...(manifest.readers ?? []),
    ...(manifest.methods ?? []),
    ...(manifest.commands ?? []),
  ]);
  for (const part of [...(manifest.parts ?? []), ...(manifest.slots ?? [])]) {
    out.add(`get${cap(part)}Props`);
  }
  for (const slot of manifest.slots ?? []) out.add(`get${cap(slot)}Indexes`);
  return out;
}

/** Reader checking: `binding.member` must name a real reader, method,
 * channel, or derived bag getter. A misspelled reader renders empty and
 * nothing fails — this is the check that fails instead. For-bound rows
 * (`as={row}`) carry view data, not machine state, so `row.*` is out of
 * scope; bare identifiers are script bindings or row passthrough. */
async function readersOf(path: string, source: string): Promise<void> {
  const script = /<script(\s[^>]*)?>([\s\S]*?)<\/script>/.exec(source);
  if (script === null) return;
  const body = script[2] ?? "";
  // Factory name -> its module specifier, so a file outside the catalog
  // (a studio element naming its own machine) resolves beside itself.
  const specifiers = new Map<string, string>();
  for (const match of body.matchAll(/import\s*\{([^}]*)\}\s*from\s*["']([^"']+)["']/g)) {
    for (const name of (match[1] ?? "").split(",")) {
      const trimmed = name.trim().split(/\s+as\s+/).pop() ?? "";
      if (trimmed.length > 0) specifiers.set(trimmed, match[2] ?? "");
    }
  }
  for (
    const match of body.matchAll(
      /const\s+(\w+)\s*=\s*(\w+)\s*\(/g,
    )
  ) {
    const binding = match[1] ?? "";
    const factory = match[2] ?? "";
    if (factory === "consume") continue;
    // Controllers and hand-rolled bridges export a sibling `<name>Manifest`.
    const ns = components as Record<string, unknown>;
    const handle = ns[factory] as { readonly manifest?: Manifest } | undefined;
    const sibling = ns[`${factory}Manifest`] as Manifest | undefined;
    let manifest = handle?.manifest ?? sibling;
    if (manifest === undefined) {
      // Not the catalog: resolve the factory's own module beside the file.
      const spec = specifiers.get(factory);
      if (spec !== undefined && (spec.startsWith("./") || spec.startsWith("../"))) {
        try {
          const url = new URL(spec, `file://${process.cwd()}/${path}`).href;
          const mod = await import(url) as Record<string, unknown>;
          const named = mod[factory] as { readonly manifest?: Manifest } | undefined;
          manifest = named?.manifest;
        } catch {
          // Unresolvable here; the unknown-factory finding below says so.
        }
      }
    }
    if (manifest === undefined) {
      problems.push(`${path}: unknown script factory \`${factory}\``);
      continue;
    }
    const valid = membersOf(manifest);
    const expressions: string[] = [];
    for (const m of source.matchAll(/\{([^{}]*?)\}/g)) {
      expressions.push(m[1] ?? "");
    }
    const refs = expressions.join("\n");
    const pattern = new RegExp(
      `(?<![a-zA-Z])${binding}\\.([a-zA-Z][a-zA-Z0-9_]*)`,
      "g",
    );
    for (const m of refs.matchAll(pattern)) {
      const member = m[1] ?? "";
      if (!valid.has(member)) {
        problems.push(`${path}: unknown member \`${binding}.${member}\``);
      }
    }
  }
}

const problems: string[] = [];

/** The attributes a component writes: the facts it declares and the
 * attributes its parts spell. */
function writtenHooks(dir: string): Set<string> {
  const hooks = new Set<string>();
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    if (!/\.(presentation|controller-def)\.ts$/.test(entry.name)) continue;
    const source = readFileSync(`${dir}/${entry.name}`, "utf8");
    // the facts the component declares
    const facts = /export const facts = \{([\s\S]*?)\n\};/.exec(source);
    if (facts) {
      for (
        const match of (facts[1] ?? "").matchAll(
          /^ {2}(?:"([^"]+)"|([a-zA-Z_$][\w$]*)):/gm,
        )
      ) {
        hooks.add(`data-${match[1] ?? match[2] ?? ""}`);
      }
    }
    // the attributes the parts spell, in either form: a bag entry
    // (`"data-x": value`) or an assignment (`attrs["data-x"] = value`)
    for (const match of source.matchAll(/"(data-[a-z-]+)"\s*[:\]]/g)) {
      hooks.add(match[1] ?? "");
    }
  }
  return hooks;
}

/** The class hooks: a `data-[name]` variant names an attribute the
 * component writes. A name it does not write is a dead rule — the style
 * never applies, and nothing says so. */
function hooksOf(path: string, source: string): void {
  const at = path.indexOf("/examples/");
  if (at < 0) return;
  const dir = path.slice(0, at);
  const hooks = writtenHooks(dir);
  if (hooks.size === 0) return;
  for (
    const match of source.matchAll(/data-\[([a-z][a-z0-9-]*)(?:=([^\]]*))?\]/g)
  ) {
    const name = `data-${match[1] ?? ""}`;
    if (!hooks.has(name)) {
      problems.push(`${path}: \`${name}\` — the component never writes it`);
    }
    const value = match[2];
    if (value === undefined) continue;
    // An attribute selector's unquoted value must be an identifier: a
    // number is not one, and the minifier rejects the whole sheet.
    if (/^['"].*['"]$/.test(value)) continue;
    if (!/^-?[A-Za-z_][\w-]*$/.test(value)) {
      problems.push(
        `${path}: \`data-[${
          match[1]
        }=${value}]\` — an unquoted attribute value must be an identifier`,
      );
    }
  }
}

/** No example ships a `data-testid`: it would copy into user projects. */
function testidsOf(path: string, source: string): void {
  const at = path.indexOf("/examples/");
  if (at < 0) return;
  const match = /data-testid="([^"]*)"/.exec(source);
  if (match !== null) {
    problems.push(
      `${path}: \`data-testid="${match[1] ?? ""}"\` — select by part or mount tag instead`,
    );
  }
}

/** Every element's literal class list and attribute text, per recipe. */
function elementsOf(path: string, source: string): void {
  // Form depth: a `<form>` ancestor is the only place a button's type
  // does anything. Void and self-closing tags never change depth.
  const voids = new Set(["input", "img", "br", "hr", "meta", "link"]);
  let formDepth = 0;
  const tagPattern = /<(\/)?([a-z][a-z0-9-]*)((?:"[^"]*"|[^>"'])*?)(\/)?>/gi;
  for (const match of source.matchAll(tagPattern)) {
    const closing = match[1] === "/";
    const tag = match[2] ?? "?";
    const attrs = match[3] ?? "";
    const selfClosing = match[4] === "/" || voids.has(tag);
    if (tag === "form" && !selfClosing) formDepth += closing ? -1 : 1;
    if (closing) continue;
    const classAttr = attrs.match(/class="([^"]*)"/)?.[1] ?? "";
    const classes = classAttr.split(/\s+/).filter((token) => token.length > 0);
    const hasSpread = /\{\.\.\.[^}]+\}/.test(attrs);
    const staticStyle = attrs.match(/style="([^"]*)"/)?.[1];

    // Width without style paints nothing.
    const width = classes.find((token) => /^border(-[1-9][0-9]*)?$/.test(token));
    const style = classes.find((token) =>
      /^border-(solid|dashed|dotted|double|hidden|none)$/.test(token)
    );
    if (width !== undefined && style === undefined) {
      problems.push(
        `${path}: <${tag}> ${width} without a border style paints nothing`,
      );
    }
    // A static style on a spread element is stripped on first run. A
    // style carrying a template expression is a reactive binding, not a
    // static attribute, and survives.
    // Custom properties are framework transport, never author markup.
    // Geometry and offsets arrive through bags (menu chrome) or actions
    // (anchor writes position itself); a recipe spelling var(--x) is
    // routing around the typed boundary.
    const varUse = attrs.match(/var\(--[a-z0-9-]+/)?.[0];
    if (varUse !== undefined && !VAR_GRANDFATHERED.has(path)) {
      problems.push(
        `${path}: <${tag}> ${varUse} in authored markup — vars live in defs/actions, not recipes`,
      );
    }
    // The bag owns `type` on spread elements; a static one never fires.
    // Off-spread, the attr only matters inside a form (submit default).
    if (tag === "button") {
      const staticType = attrs.match(/type="([^"]*)"/)?.[1];
      if (hasSpread && staticType !== undefined) {
        problems.push(
          `${path}: <button> static type is dead — the bag owns it`,
        );
      }
      if (!hasSpread && staticType === undefined && formDepth > 0) {
        problems.push(
          `${path}: <button> in a form without type= submits by default`,
        );
      }
    }
  }
}
function classObjectsOf(path: string, source: string): void {
  if (source.includes("data:image/")) {
    problems.push(
      `${path}: inline data:image/ URI in authored example — use token-driven markup or initials instead`,
    );
  }
  for (const match of source.matchAll(/class=\{\[([\s\S]*?)\]\}/g)) {
    const inner = match[1] ?? "";
    for (const objMatch of inner.matchAll(/\{([^{}]+)\}/g)) {
      const obj = objMatch[1] ?? "";
      const seen = new Set<string>();
      for (
        const pair of obj.matchAll(
          /(?:"([^"]+)"|'([^']+)'|([A-Za-z0-9_-]+))\s*:\s*([^,}]+)/g,
        )
      ) {
        const cond = (pair[4] ?? "").trim();
        if (cond.length === 0) continue;
        if (seen.has(cond)) {
          problems.push(
            `${path}: duplicate class condition \`${cond}\` — group classes under one key`,
          );
        }
        seen.add(cond);
      }
    }
  }
}


// Vocabulary is uno-class-check's job (generator truth, same preset +
// themes the app builds with). This file keeps the structural traps only.
for await (const entry of walkFiles(ROOT, [".html"])) {
  const source = await readFile(entry.path, "utf8");
  elementsOf(entry.path, source);
  await readersOf(entry.path, source);
  hooksOf(entry.path, source);
  testidsOf(entry.path, source);
}
for await (const entry of walkFiles(STUDIO_COMPONENTS, [".html"])) {
  const source = await readFile(entry.path, "utf8");
  elementsOf(entry.path, source);
  await readersOf(entry.path, source);
  classObjectsOf(entry.path, source);
}

// The bindings' shape: no channels apparatus, no global DOM lookups, no
// JSON.parse, no var(-- emitted. Text scan only; if a rule ever needs
// parsing the bindings as more than text, stop and record the limitation
// rather than grow this into a parser.
//
// These rules named the DEFS, and the defs are gone — so they enforced
// nothing since the split. They name the bindings now.
for await (const entry of walkFiles(ROOT, [".ts"])) {
  if (!/\.presentation\.ts$/.test(entry.path)) continue;
  const source = await readFile(entry.path, "utf8");
  // The scan is over CODE: a comment that says "never the global
  // document" is not a document access. The block comments are stripped
  // first, then the line comments — a `//` inside a string is neither.
  const withoutBlocks = source.replace(
    /\/\*[\s\S]*?\*\//g,
    (block) => block.replace(/[^\n]/g, " "),
  );
  const lines = withoutBlocks.split("\n").map((line) => {
    const at = line.indexOf("//");
    if (at < 0) return line;
    const before = line.slice(0, at);
    const quotes = (before.match(/["'`]/g) ?? []).length;
    return quotes % 2 === 0 ? before : line;
  });
  // channels apparatus
  for (let i = 0; i < lines.length; i++) {
    if (/\bchannels\s*:\s*\{/.test(lines[i]!)) {
      problems.push(
        `${entry.path}:${i + 1}: channels apparatus in the bindings`,
      );
    }
  }
  // JSON.parse
  for (let i = 0; i < lines.length; i++) {
    if (/JSON\.parse/.test(lines[i]!)) {
      problems.push(`${entry.path}:${i + 1}: JSON.parse in the bindings`);
    }
  }
  // document. — the GLOBAL document, not the platform's. A DOM read
  // that walks the page (querySelector on a host selector) or asks the
  // window (activeElement, hasFocus) is the platform's, and it is
  // allowed; a read that should have gone through the framework's id
  // path is not.
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (!/\bdocument\./.test(line)) continue;
    if (/\bdocument\.(activeElement|hasFocus)\b/.test(line)) continue;
    if (/\bdocument\.querySelector(All)?\(/.test(line)) continue;
    problems.push(`${entry.path}:${i + 1}: document. in the bindings`);
  }
  // var(-- emitted
  for (let i = 0; i < lines.length; i++) {
    if (/var\(--/.test(lines[i]!)) {
      problems.push(`${entry.path}:${i + 1}: var(-- emitted from the bindings`);
    }
  }
}

if (problems.length > 0) {
  console.error(`recipe: ${problems.length} violation(s):`);
  for (const problem of problems) console.error(`  ${problem}`);
  process.exit(1);
}
console.log("recipe: all clear");

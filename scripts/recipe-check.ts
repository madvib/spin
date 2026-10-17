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
 *
 *   deno run -A scripts/recipe-check.ts
 *
 * The exit code is the point: this belongs beside `deno check`, not in a
 * human's memory of which patterns break.
 */

import { walk } from "@std/fs/walk";
import * as components from "../packages/components/src/index.ts";

const ROOT = "packages/components/src";

type Manifest = {
  readonly parts: readonly string[];
  readonly slots: readonly string[];
  readonly readers: readonly string[];
  readonly methods: readonly string[];
  readonly channels: readonly string[];
};

const cap = (name: string): string =>
  name.length === 0 ? name : name[0]!.toUpperCase() + name.slice(1);

/** Every callable/readable member an example may touch on the machine. */
function membersOf(manifest: Manifest): Set<string> {
  const out = new Set<string>([...manifest.readers, ...manifest.methods, ...manifest.channels]);
  for (const part of [...manifest.parts, ...manifest.slots]) out.add(`get${cap(part)}Props`);
  for (const slot of manifest.slots) out.add(`get${cap(slot)}Indexes`);
  return out;
}

/** Reader checking: `machine.member` must name a real reader, method,
 * channel, or derived bag getter. A misspelled reader renders empty and
 * nothing fails — this is the check that fails instead. For-bound rows
 * (`as={row}`) carry view data, not machine state, so `row.*` is out of
 * scope; bare identifiers are scope props or row passthrough. */
function readersOf(path: string, source: string): void {
  const scope = source.match(/<scope>props=\{([^}]*)\}\s*consume=\{\s*(\w+)\s*\}/);
  if (scope === null) return;
  const machine = scope[2] ?? "";
  // Controllers and hand-rolled bridges export a sibling `<name>Manifest`.
  const ns = (components as Record<string, unknown>);
  const handle = ns[machine] as { readonly manifest?: Manifest } | undefined;
  const sibling = ns[`${machine}Manifest`] as Manifest | undefined;
  const manifest = handle?.manifest ?? sibling;
  if (manifest === undefined) {
    problems.push(`${path}: unknown consume machine \`${machine}\``);
    return;
  }
  const valid = membersOf(manifest);
  const rows = new Set<string>();
  for (const match of source.matchAll(/as=\{(\w+)\}/g)) rows.add(match[1] ?? "");
  // Machine-rooted refs inside expressions only (a class like
  // `avatar.cc` is paint, not a member read): spreads, show, text,
  // for-sources, attribute expressions.
  const expressions: string[] = [];
  for (const match of source.matchAll(/\{([^{}]*?)\}/g)) expressions.push(match[1] ?? "");
  const body = expressions.join("\n");
  const pattern = new RegExp(`(?<![a-zA-Z])${machine}\\.([a-zA-Z][a-zA-Z0-9_]*)`, "g");
  for (const match of body.matchAll(pattern)) {
    const member = match[1] ?? "";
    if (!valid.has(member)) {
      problems.push(`${path}: unknown member \`${machine}.${member}\``);
    }
  }
  void rows;
}

const problems: string[] = [];

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
    const width = classes.find((token) => /^border(-[0-9]+)?$/.test(token));
    const style = classes.find((token) =>
      /^border-(solid|dashed|dotted|double|hidden|none)$/.test(token)
    );
    if (width !== undefined && style === undefined) {
      problems.push(`${path}: <${tag}> ${width} without a border style paints nothing`);
    }
    // A static style on a spread element is stripped on first run. A
    // style carrying a template expression is a reactive binding, not a
    // static attribute, and survives.
    if (hasSpread && staticStyle !== undefined && !staticStyle.includes("{")) {
      problems.push(`${path}: <${tag}> static style is stripped by the spread`);
    }
    // The bag owns `type` on spread elements; a static one never fires.
    // Off-spread, the attr only matters inside a form (submit default).
    if (tag === "button") {
      const staticType = attrs.match(/type="([^"]*)"/)?.[1];
      if (hasSpread && staticType !== undefined) {
        problems.push(`${path}: <button> static type is dead — the bag owns it`);
      }
      if (!hasSpread && staticType === undefined && formDepth > 0) {
        problems.push(`${path}: <button> in a form without type= submits by default`);
      }
    }
  }
}

// Vocabulary is uno-class-check's job (generator truth, same preset +
// themes the app builds with). This file keeps the structural traps only.
for await (const entry of walk(ROOT, { exts: [".html"] })) {
  if (!entry.isFile) continue;
  const source = await Deno.readTextFile(entry.path);
  elementsOf(entry.path, source);
  readersOf(entry.path, source);
}

if (problems.length > 0) {
  console.error(`recipe: ${problems.length} violation(s):`);
  for (const problem of problems) console.error(`  ${problem}`);
  Deno.exit(1);
}
console.log("recipe: all clear");

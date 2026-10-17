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

const ROOT = "packages/components/src";

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
  elementsOf(entry.path, await Deno.readTextFile(entry.path));
}

if (problems.length > 0) {
  console.error(`recipe: ${problems.length} violation(s):`);
  for (const problem of problems) console.error(`  ${problem}`);
  Deno.exit(1);
}
console.log("recipe: all clear");

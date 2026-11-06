/**
 * The class check: every utility the sources name must have a rule.
 *
 * Uno resolves a class against the preset and, when nothing matches, emits
 * nothing — silently. A CSS property that never lands looks like a bug in
 * the browser, not in the vocabulary, and the theme's spacing scale once
 * dropped the entire named mid-range (`px-6`, `gap-6`, `h-14`) without a
 * word. This walks the sources, hands every named class to the generator,
 * and fails on the ones nothing claims.
 *
 *   deno task -f check:classes
 *
 * The exit code is the point: this belongs beside `deno check`, not in a
 * human's memory of which utilities exist.
 */

import { createGenerator } from "@unocss/core";
import presetIcons from "@unocss/preset-icons";
import lucide from "@iconify-json/lucide/icons.json" with { type: "json" };
import { readdir, readFile } from "node:fs/promises";
import { classTokens, expandVariantGroups, parse } from "../packages/runtime/src/syntax/index.ts";
import { spinPreset } from "../packages/spin/src/compiler/index.ts";
import { starterThemes } from "../packages/spin/src/theme/themes/index.ts";
import { spinCompositions } from "../packages/spin/src/compositions.ts";

/** Where the classes live: the recipes (markup) and the specimens (Solid). */
const SOURCES = [
  "packages/components/src",
  "apps/studio/src/lib/components",
  "apps/docs/examples",
  "apps/docs/src/lib/components",
];

/** A `class="..."` attribute's value, minus anything dynamic. */
function classesOf(source: string): string[] {
  const out: string[] = [];
  for (
    const match of expandVariantGroups(source).matchAll(/class="([^"]*)"/g)
  ) {
    for (const token of (match[1] ?? "").split(/\s+/)) {
      // A dynamic value (`class={...}`) is not literal text; the emitter's
      // own output is checked by the build, not here.
      if (token.length === 0 || token.includes("{")) continue;
      out.push(token);
    }
  }
  return out;
}

/** The classes a markup file names, expressions included: a dynamic
 * class names its utilities in its string literals, and those are
 * utilities the build must have. */
function classesOfMarkup(source: string): string[] {
  const stripped = expandVariantGroups(
    source
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/<script(\s[^>]*)?>[\s\S]*?<\/script>\s*/g, ""),
  );
  return classTokens(parse(stripped));
}

async function* walkFiles(root: string, exts: string[]): AsyncGenerator<string> {
  const entries = await readdir(root, { withFileTypes: true });
  for (const e of entries) {
    const p = `${root}/${e.name}`;
    if (e.isDirectory()) yield* walkFiles(p, exts);
    else if (e.isFile() && exts.some((x) => e.name.endsWith(x))) yield p;
  }
}
const tokens = new Set<string>();
for (const root of SOURCES) {
  for await (const entryPath of walkFiles(root, [".html", ".tsx", ".ts"])) {
    const source = await readFile(entryPath, "utf8");
    const found = entryPath.endsWith(".html")
      ? classesOfMarkup(source)
      : classesOf(source);
    for (const token of found) tokens.add(token);
  }
}

// The same generator the specimens app builds with: a class the app can
// compile is a class that passes, and nothing else counts.
// The `animate-*` utilities are not Uno rules — they ship as plain CSS from
// `@spinjs/animation`'s preflight — so they are allowlisted rather than
// generated: the generator would never match them either way.
import { animationVariants } from "../packages/spin/src/animation/index.ts";
const ANIMATED = animationVariants();
/** Scope markers: not utilities, but load-bearing hooks the sheet reads. */
const SCOPED = new Set(["spin-preview"]);
const uno = await createGenerator({
  presets: [
    spinPreset({ themes: starterThemes, shortcuts: { ...spinCompositions } }),
    presetIcons({ collections: { lucide } as never }),
  ],
});

const generated = await uno.generate(new Set(tokens), { preflights: false });
const dead = [...tokens].filter((token) =>
  !generated.matched.has(token) && !ANIMATED.has(token) && !SCOPED.has(token)
)
  .sort();

if (dead.length > 0) {
  console.error(`uno: ${dead.length} class(es) match no rule:`);
  for (const token of dead) console.error(`  ${token}`);
  process.exit(1);
}

// A class that matches but reads a variable no theme declares is dead in
// the browser: `rounded-xl` emits `var(--radius-xl)` and only one starter
// declares it. Every `var()` a matched rule reads without a fallback must
// be declared by EVERY starter theme.
const declaredBy = new Map<string, Set<string>>();
for (const [name, doc] of Object.entries(starterThemes)) {
  const scoped = await createGenerator({
    presets: [spinPreset({ themes: { [name]: doc } })],
  });
  const { css } = await scoped.generate("x", { preflights: true });
  for (const match of css.matchAll(/(--[\w-]+)\s*:/g)) {
    const set = declaredBy.get(match[1]) ?? new Set<string>();
    set.add(name);
    declaredBy.set(match[1], set);
  }
}
const names = new Set(Object.keys(starterThemes));
const undeclared = new Set<string>();
for (const match of generated.css.matchAll(/var\((--[\w-]+)\)/g)) {
  const owners = declaredBy.get(match[1]);
  if (owners === undefined || owners.size !== names.size) undeclared.add(match[1]);
}
// Wind4's own internals (`--un-*`) are registered by the engine, not the theme.
for (const name of [...undeclared]) {
  if (name.startsWith("--un-")) undeclared.delete(name);
}
if (undeclared.size > 0) {
  console.error(
    `uno: ${undeclared.size} variable(s) read but not declared by every starter theme:`,
  );
  for (const name of [...undeclared].sort()) console.error(`  ${name}`);
  process.exit(1);
}
console.log(`uno: ${tokens.size} classes, all matched`);

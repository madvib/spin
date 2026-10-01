/**
 * Emits `packages/primitives/src/styles.ts` and `packages/primitives/src/manifest.ts`
 * from the CSS sources.
 *
 * The stylesheets stay real `.css` files (highlighting, formatting, linting),
 * but nothing at runtime imports them: bundlers outside Deno — Rolldown in
 * particular — refuse to bundle CSS-as-text, and `with { type: "text" }`
 * doesn't exist in browsers at all. The generated module is plain strings,
 * loadable everywhere including vent.
 *
 * The manifest is the contract the CSS owns. `tags` and `character` are
 * authored — they record decisions the stylesheets cannot speak to (why a
 * component claims an element, which reads are character rather than scale).
 * `variants` and `reads` are derived here from the CSS by the same scans
 * `primitives.test.ts` uses to check the file has not gone stale.
 *
 * Run after editing any `*.css` in this directory. `primitives.test.ts` fails
 * when the checked-in output disagrees with a fresh derive.
 */

const HERE = new URL("./src/", import.meta.url);
const STYLES_OUT = new URL("./src/styles.ts", import.meta.url);
const MANIFEST_OUT = new URL("./src/manifest.ts", import.meta.url);
const COMPONENTS = [
  "button",
  "form",
  "content",
  "disclosure",
  "layout",
  "nav",
  "group",
  "feedback",
  "card",
] as const;

/**
 * Every `--token` the given CSS reads, deduplicated, without the leading `--`.
 * Shared with `primitives.test.ts`, which fails when the checked-in manifest
 * disagrees with a fresh derive.
 */
export function deriveReads(css: string): string[] {
  return [
    ...new Set(
      [...css.matchAll(/var\((--[a-z0-9-]+)\)/g)].map((m) => m[1].slice(2)),
    ),
  ];
}

/**
 * Every class the given CSS defines, deduplicated. Shared with
 * `primitives.test.ts` for the same staleness check as `deriveReads`.
 */
export function deriveVariants(css: string): string[] {
  // Comments name classes in prose (`radius.md`), so they are stripped
  // before the scan — only selectors count.
  const selectors = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const out = new Set<string>();
  for (const m of selectors.matchAll(/(?:^|[},)])\s*(\.[a-z][a-z0-9-]*)/gim)) {
    out.add(m[1].slice(1).toLowerCase());
  }
  for (const m of selectors.matchAll(/\)\.([a-z][a-z0-9-]*)/gi)) {
    out.add(m[1].toLowerCase());
  }
  for (
    const m of selectors.matchAll(/\b[a-z][a-z0-9-]*\.([a-z][a-z0-9-]*)/gi)
  ) {
    out.add(m[1].toLowerCase());
  }
  return [...out];
}

/**
 * Keep the hand order for entries that still exist; append new ones the derive
 * discovered. Re-running codegen on unchanged CSS is therefore a no-op.
 */
function merge(
  previous: readonly string[],
  derived: readonly string[],
): string[] {
  const derivedSet = new Set(derived);
  const kept = previous.filter((x) => derivedSet.has(x));
  const added = derived.filter((x) => !previous.includes(x));
  return [...kept, ...added];
}

/** Render a string array the way deno fmt would: inline if short, else wrapped. */
function renderArray(key: string, values: readonly string[]): string {
  if (values.length === 0) return `    ${key}: [],`;
  const inline = `    ${key}: [${
    values.map((v) => JSON.stringify(v)).join(", ")
  }],`;
  if (inline.length <= 80) return inline;
  return [
    `    ${key}: [`,
    ...values.map((v) => `      ${JSON.stringify(v)},`),
    `    ],`,
  ].join("\n");
}

/** The values inside a `[...]` array literal, as data. */
function arrayValues(text: string): string[] {
  const m = /\[([^\]]*)\]/.exec(text);
  if (!m) return [];
  return m[1]
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => s.slice(1, -1));
}

/** The authored parts of one component block, as raw text. */
interface Authored {
  /** Comment lines immediately before `tags:`, verbatim. */
  comment: string;
  tags: string;
  variants: string;
  reads: string;
  character: string;
}

const NO_AUTHORED: Authored = {
  comment: "",
  tags: "    tags: [],",
  variants: "    variants: [],",
  reads: "    reads: [],",
  character: "    character: [],",
};

/**
 * Pull the authored fields out of the checked-in manifest. Codegen rewrites
 * only `variants` and `reads`; tags, character, and their comments are hand
 * knowledge the CSS cannot speak to.
 */
function parseAuthored(text: string): Map<string, Authored> {
  const out = new Map<string, Authored>();
  const blockRe = /^ {2}([a-z-]+): \{\n([\s\S]*?)^ {2}\},$/gm;
  for (const m of text.matchAll(blockRe)) {
    const body = m[2];
    const comment = /^(?:[ \t]*\/\/.*\n)*/.exec(body)?.[0] ?? "";
    const tags = new RegExp(`^ *tags: \\[[^\\]]*\\],?`, "m").exec(body)?.[0] ??
      NO_AUTHORED.tags;
    const variants = new RegExp(`^ *variants: \\[[^\\]]*\\],?`, "m").exec(body)
      ?.[0] ?? NO_AUTHORED.variants;
    const reads =
      new RegExp(`^ *reads: \\[[^\\]]*\\],?`, "m").exec(body)?.[0] ??
        NO_AUTHORED.reads;
    const character =
      new RegExp(`^ *character: \\[[^\\]]*\\],?`, "m").exec(body)
        ?.[0] ?? NO_AUTHORED.character;
    out.set(m[1], { comment, tags, variants, reads, character });
  }
  return out;
}

const DECL =
  "export const primitiveContracts: Record<string, PrimitiveContract> = {";

/**
 * The header (doc comment + interface) for a bootstrap with no checked-in
 * manifest. Once the file exists, codegen preserves its header verbatim and
 * only rewrites the contracts object.
 */
const DEFAULT_HEADER = `/**
 * Primitives manifest — the contract the CSS owns, written down.
 *
 * \`tags\` and \`character\` are authored: they record decisions the stylesheets
 * cannot speak to (why a component claims an element, which reads are character
 * rather than scale). \`variants\` and \`reads\` are derived from the CSS by
 * \`codegen.ts\`; \`primitives.test.ts\` fails the suite when the checked-in
 * file disagrees with a fresh derive.
 *
 * \`tags\` are bare elements the component styles; a utility class on one is a
 * conflict, enforced by the lint plugin. \`variants\` are the classes an author
 * may write. \`reads\` are the custom properties the CSS consumes, without the
 * leading \`--\`: every entry must resolve against the theme contract.
 */

export interface PrimitiveContract {
  /** Bare tag names the component styles, e.g. \`button\`, \`h1\`. */
  tags: readonly string[];
  /** Class names the component defines, e.g. \`secondary\`. */
  variants: readonly string[];
  /** Custom properties the stylesheet reads, without the leading \`--\`. */
  reads: readonly string[];
  /**
   * Theme-authored character tokens the component declares, as dotted paths,
   * e.g. \`button.weight\`. Empty when every read is a spent scale step rather
   * than a decision a theme might answer differently.
   */
  character: readonly string[];
}

/** The contract per component, keyed by file stem. */
`;

/**
 * Rebuild the manifest from the CSS plus the authored fields of the checked-in
 * file. Pure, so it can be exercised without writing anything.
 */
function renderManifest(
  cssByName: ReadonlyMap<string, string>,
  existingText: string,
): string {
  const headerEnd = existingText.indexOf(DECL);
  const header = headerEnd >= 0
    ? existingText.slice(0, headerEnd)
    : DEFAULT_HEADER;
  const authored = parseAuthored(existingText);
  const blocks: string[] = [];
  for (const name of COMPONENTS) {
    const css = cssByName.get(name);
    if (css === undefined) continue;
    const a = authored.get(name) ?? NO_AUTHORED;
    const variants = merge(arrayValues(a.variants), deriveVariants(css));
    const reads = merge(arrayValues(a.reads), deriveReads(css));
    blocks.push(
      [
        `  ${name}: {`,
        a.comment.trimEnd(),
        a.tags,
        renderArray("variants", variants),
        renderArray("reads", reads),
        a.character,
        `  },`,
      ].filter((s) => s.length > 0).join("\n"),
    );
  }
  return header + [DECL, ...blocks, "};", ""].join("\n");
}

async function main(): Promise<void> {
  const parts: string[] = [
    "// Generated by `deno task codegen` in packages/primitives. Do not edit.",
    "// Source of truth is the *.css files beside it.",
    "",
  ];
  const cssByName = new Map<string, string>();
  for (const name of COMPONENTS) {
    const css = await Deno.readTextFile(new URL(`./${name}.css`, HERE));
    cssByName.set(name, css);
    parts.push(`export const ${name}Css: string = ${JSON.stringify(css)};`, "");
  }
  parts.push(
    "/** The stylesheets, keyed by component name. */",
    "export const primitiveStyles: Record<string, string> = {",
  );
  for (const name of COMPONENTS) parts.push(`  ${name}: ${name}Css,`);
  parts.push("};", "");
  await Deno.writeTextFile(STYLES_OUT, parts.join("\n"));

  let existing = "";
  try {
    existing = await Deno.readTextFile(MANIFEST_OUT);
  } catch {
    // First run: no checked-in manifest yet. The header falls back to the
    // embedded default and every component starts with empty authored fields.
  }
  await Deno.writeTextFile(MANIFEST_OUT, renderManifest(cssByName, existing));
  console.log(
    `styles.ts and manifest.ts written (${COMPONENTS.length} components)`,
  );
}

if (import.meta.main) await main();

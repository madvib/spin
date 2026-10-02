/**
 * Emits `src/styles.ts` and `src/manifest.ts` from the `.css` sources.
 *
 * The stylesheets are authored against the utility vocabulary — `--at-apply:
 * inline-flex items-center gap-2` rather than three hand-written declarations.
 * Expansion happens here, once, through the same preset a consumer uses, so
 * there is exactly one token-to-class pipeline rather than two that can
 * disagree.
 *
 * The expansion theme only decides which utilities *resolve*; the output is
 * `var(--token)` either way, so which theme is used here is cosmetic. What is
 * not cosmetic is a utility that fails to resolve: scale steps are absent from
 * a role-only document, so `p-4` would expand to nothing and the component
 * would ship with no padding and no error. That is why a silent drop is a
 * hard failure rather than a warning.
 */

import type { UnocssPluginContext } from "@unocss/core";
import { createGenerator } from "@unocss/core";
import MagicString from "magic-string";
import { spinPreset } from "../preset/src/index.ts";

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

/** The document used to resolve utilities while expanding. */
const EXPANSION_THEME = new URL(
  "../theme/examples/default/light.json",
  import.meta.url,
);

/** Every `--token` the given CSS reads, deduplicated, without the leading `--`. */
export function deriveReads(css: string): string[] {
  const out = new Set<string>();
  for (const match of css.matchAll(/var\((--[a-z0-9-]+)\)/g)) {
    out.add((match[1] as string).slice(2));
  }
  return [...out].sort();
}

/** Every class the given CSS defines, deduplicated. */
export function deriveVariants(css: string): string[] {
  const out = new Set<string>();
  const selectors = css.replace(/\/\*[\s\S]*?\*\//g, "");
  for (const m of selectors.matchAll(/(?:^|[},)])\s*(\.[a-z][a-z0-9-]*)/gim)) {
    out.add((m[1] as string).slice(1).toLowerCase());
  }
  for (const m of selectors.matchAll(/\)\.([a-z][a-z0-9-]*)/gi)) {
    out.add((m[1] as string).toLowerCase());
  }
  for (
    const m of selectors.matchAll(/\b[a-z][a-z0-9-]*\.([a-z][a-z0-9-]*)/gi)
  ) {
    out.add((m[1] as string).toLowerCase());
  }
  return [...out].sort();
}

/** The utilities a component asks for, as written in `--at-apply`. */
export function appliedUtilities(css: string): string[] {
  const out: string[] = [];
  for (const m of css.matchAll(/--at-apply:\s*([^;]+);/g)) {
    for (const token of (m[1] as string).split(/\s+/)) {
      if (token.length > 0) out.push(token);
    }
  }
  return [...new Set(out)];
}

/**
 * Expand, then fail if any requested utility the generator cannot produce.
 *
 * A dropped utility is not a smaller stylesheet, it is a component that
 * renders wrong with no diagnostic. The check asks the generator directly
 * rather than looking for the utility's selector in the output: expansion
 * inlines a utility's *declarations* into the rule that used it, so the class
 * never survives into the result and finding it there would fail every time.
 */
export async function expandStrict(
  css: string,
  component: string,
): Promise<string> {
  const theme = JSON.parse(await Deno.readTextFile(EXPANSION_THEME));
  const preset = spinPreset({ themes: { light: theme } });
  const uno = await createGenerator({ presets: [preset] });

  const requested = appliedUtilities(css).filter((u) => !u.includes("["));
  const probe = await uno.generate(requested.join(" "));
  const unresolved = requested.filter(
    (utility) => !probe.css.includes(`.${utility.replace(/([:/])/g, "\\$1")}`),
  );
  if (unresolved.length > 0) {
    throw new Error(
      `${component}: --at-apply names utilities the theme does not resolve: ${
        unresolved.join(", ")
      }`,
    );
  }

  const code = new MagicString(css);
  const transformer = preset.transformers?.[0];
  if (transformer === undefined) {
    throw new Error("the preset carries no directives transformer");
  }
  await transformer.transform(code, "primitive.css", {
    uno,
  } as unknown as UnocssPluginContext);
  return code.toString();
}

/**
 * Keep the hand order for entries that still exist; append new ones the derive
 * discovered. Re-running codegen on unchanged CSS is therefore a no-op.
 */
function merge(
  previous: readonly string[],
  derived: readonly string[],
): string[] {
  const kept = previous.filter((entry) => derived.includes(entry));
  const added = derived.filter((entry) => !previous.includes(entry));
  return [...kept, ...added];
}

/** Render a string array the way deno fmt would: inline if short, else wrapped. */
function renderArray(key: string, values: readonly string[]): string {
  if (values.length === 0) return `${key}: [],`;
  const inline = values.map((v) => JSON.stringify(v)).join(", ");
  if (`    ${key}: [${inline}],`.length <= 80) return `  ${key}: [${inline}],`;
  return [
    `  ${key}: [`,
    ...values.map((v) => `    ${JSON.stringify(v)},`),
    "  ],",
  ].join("\n");
}

/** The values inside a `[...]` array literal, as data. */
function arrayValues(text: string): string[] {
  return [...text.matchAll(/"([^"]*)"/g)].map((m) => m[1] as string);
}

/** The authored parts of one component block, as raw text. */
interface Authored {
  readonly header: string;
  readonly tags: string;
  readonly variants: readonly string[];
  readonly character: string;
  readonly comment: string;
}

const NO_AUTHORED: Authored = {
  header: "",
  tags: "[]",
  variants: [],
  character: "[]",
  comment: "",
};

/**
 * Pull the authored fields out of the checked-in manifest. Codegen rewrites
 * only `variants` and `reads`; tags and character are hand knowledge the CSS
 * cannot speak to.
 */
function parseAuthored(text: string): Map<string, Authored> {
  const out = new Map<string, Authored>();
  const block = /export const primitiveContracts[^=]*= \{([\s\S]*?)\n\};/.exec(
    text,
  );
  if (!block) return out;
  const body = block[1] as string;
  const parts = body.split(/\n(?=  \w+: \{)/).slice(1);
  for (const part of parts) {
    const name = /^  (\w+): \{/.exec(part)?.[1];
    if (!name) continue;
    const header = /\/\*[\s\S]*?\*\/\n(?=  \w+: \{)/.exec(part)?.[0] ?? "";
    const comment = /  \/\*[\s\S]*?\*\/\n(?=  \w+:)/.exec(part)?.[0] ?? "";
    out.set(name, {
      header: header.replace(/\n+$/, ""),
      tags: renderArray(
        "tags",
        arrayValues(/tags: \[([^\]]*)\]/.exec(part)?.[1] ?? ""),
      ),
      variants: arrayValues(/variants: \[([^\]]*)\]/.exec(part)?.[1] ?? ""),
      character: /character: \[[\s\S]*?\],/.exec(part)?.[0] ?? "character: [],",
      comment: comment.replace(/\n+$/, ""),
    });
  }
  return out;
}

const DECL =
  "export const primitiveContracts: Record<string, PrimitiveContract> = {";

const DEFAULT_HEADER = `/**
 * Primitives manifest — the contract the CSS owns, written down.
 *
 * Tags and character tokens are hand knowledge: a stylesheet cannot say which
 * elements a component claims or which tokens a theme genuinely authors for
 * it. Variants and reads are derived from the CSS by \`deno task codegen\`, and
 * \`primitives.test.ts\` fails when the checked-in file goes stale.
 */

export interface PrimitiveContract {
  tags: readonly string[];
  variants: readonly string[];
  reads: readonly string[];
  character: readonly string[];
}

`;

/** The variants a component's checked-in block already listed, for stable order. */
function previousVariants(
  name: string,
  authored: Map<string, Authored>,
): readonly string[] {
  return authored.get(name)?.variants ?? [];
}

function renderManifest(
  cssByName: ReadonlyMap<string, string>,
  existingText: string,
): string {
  const authored = parseAuthored(existingText);
  // Codegen rewrites derived fields. If it cannot read the authored ones back
  // it would quietly write them empty, and hand knowledge is exactly what it
  // is not allowed to lose.
  if (existingText.length > 0 && authored.size === 0) {
    throw new Error(
      "could not read the authored fields out of the checked-in manifest",
    );
  }
  const header = existingText.slice(0, existingText.indexOf(DECL)).trimEnd() ||
    DEFAULT_HEADER.trimEnd();
  const blocks = [...cssByName.entries()].map(([name, css]) => {
    const mine = authored.get(name) ?? NO_AUTHORED;
    return [
      mine.comment,
      `  ${name}: {`,
      mine.header ? mine.header + "\n" : "",
      mine.tags,
      renderArray(
        "variants",
        merge(previousVariants(name, authored), deriveVariants(css)),
      ),
      renderArray("reads", deriveReads(css)),
      mine.character,
      "  },",
    ].filter((line) => line !== "").join("\n");
  });
  return [header, "", DECL, ...blocks, "};", ""].join("\n");
}

async function main(): Promise<void> {
  const parts: string[] = [
    "// Generated by `deno task codegen` in packages/primitives. Do not edit.",
    "// Source of truth is the *.css files beside it, expanded through the preset.",
    "",
  ];
  const cssByName = new Map<string, string>();
  for (const name of COMPONENTS) {
    const source = await Deno.readTextFile(new URL(`./${name}.css`, HERE));
    const expanded = await expandStrict(source, name);
    cssByName.set(name, expanded);
    parts.push(
      `export const ${name}Css: string = ${JSON.stringify(expanded)};`,
      "",
    );
  }
  parts.push(
    "/** The expanded stylesheets, keyed by component name. */",
    "export const primitiveStyles: Record<string, string> = {",
  );
  for (const name of COMPONENTS) parts.push(`  ${name}: ${name}Css,`);
  parts.push("};", "");
  await Deno.writeTextFile(STYLES_OUT, parts.join("\n"));

  let existing = "";
  try {
    existing = await Deno.readTextFile(MANIFEST_OUT);
  } catch {
    // First run: no checked-in manifest yet.
  }
  await Deno.writeTextFile(MANIFEST_OUT, renderManifest(cssByName, existing));
  console.log(
    `styles.ts and manifest.ts written (${COMPONENTS.length} components)`,
  );
}

if (import.meta.main) await main();

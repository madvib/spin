/**
 * Classify every custom property a primitive spends.
 *
 * The vocabulary is the contract: a token the preset can express is a utility a
 * consumer gets for free, and a token it cannot express is a gap in the contract
 * rather than a property the CSS had to reach around. This reports the second
 * kind, so the missing families are an explicit work list rather than something
 * discovered one component at a time.
 *
 * Run after editing any `*.css` in `src/`:
 *
 *     deno task inventory
 *
 * The utility list is derived, never written: the preset's own catalog names
 * the families, and a token is "covered" when the generator emits some utility
 * that spends it. A hand-written probe list would drift from the vocabulary,
 * which is the same mistake in a different place.
 */

import { createGenerator } from "@unocss/core";
import { describeCatalog, spinPreset } from "../preset/src/index.ts";
import { parseTokens, resolveAliases } from "../theme/src/index.ts";

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

const THEME = new URL("../theme/examples/default/light.json", import.meta.url);

/** Every utility the generator produces, keyed by the var it spends. */
async function coverage(): Promise<Map<string, string[]>> {
  const theme = JSON.parse(await Deno.readTextFile(THEME));
  const preset = spinPreset({ themes: { light: theme } });
  const uno = await createGenerator({ presets: [preset] });

  // Ask the catalog rather than guessing a probe list, then confirm by asking
  // the generator. A utility the catalog names but the generator will not emit
  // is a bug in its own right, and this is where it shows up.
  const parsed = parseTokens(theme);
  if (!parsed.ok) throw new Error(`expansion theme: ${parsed.error}`);
  const wanted = describeCatalog(resolveAliases(parsed.tree).tree)
    .flatMap((section) => section.utilities);
  const { css } = await uno.generate(wanted.join(" "));

  // Utilities land in the `default` layer; the preflight layers above it are
  // element and attribute selectors, not vocabulary.
  const layer = css.split("/* layer: default */")[1] ?? "";
  const out = new Map<string, string[]>();
  for (const [, selector, body] of layer.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    for (const part of selector.split(",")) {
      const trimmed = part.trim();
      if (!trimmed.startsWith(".")) continue;
      const name = trimmed.replace(/^\./, "").replace(/\\(.)/g, "$1");
      for (const token of body.matchAll(/var\((--[a-z0-9-]+)\)/g)) {
        const bare = (token[1] as string).slice(2);
        if (!out.has(bare)) out.set(bare, []);
        out.get(bare)?.push(name);
      }
    }
  }
  return out;
}

/** The tokens a stylesheet spends by hand, and where. */
export function spentDirectly(css: string): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  for (
    const m of css.matchAll(
      /(?:^|[;{])\s*([a-z-]+):[^;{}]*var\((--[a-z0-9-]+)\)/g,
    )
  ) {
    const token = (m[2] as string).slice(2);
    if (!out.has(token)) out.set(token, new Set());
    out.get(token)?.add(m[1] as string);
  }
  return out;
}

async function main(): Promise<void> {
  const covered = await coverage();
  const gaps: string[] = [];
  let direct = 0;

  for (const name of COMPONENTS) {
    const css = await Deno.readTextFile(
      new URL(`./src/${name}.css`, import.meta.url),
    );
    for (const [token, properties] of [...spentDirectly(css)].sort()) {
      direct++;
      if (covered.has(token)) continue;
      gaps.push(
        `  ${name.padEnd(10)} ${token.padEnd(26)} ${
          [...properties].sort().join(", ")
        }`,
      );
    }
  }

  console.log(`hand-spent token references: ${direct}`);
  console.log(`  with a utility   : ${direct - gaps.length}`);
  console.log(`  without one      : ${gaps.length}\n`);
  if (gaps.length > 0) {
    console.log("no utility spends these — the vocabulary is missing them:\n");
    for (const gap of gaps) console.log(gap);
  }
}

/**
 * A hand-written `var()` is only justified where no utility could express the
 * declaration: a composite, or a value that is itself a composite. Everything
 * else is a vocabulary gap and belongs in the preset, where a consumer gets
 * the utility too.
 */
const JUSTIFIED = new Set([
  "border-width", // a component token that IS a width, not a scale
  "box-shadow", // the button's own shadow, which is character
  "min-height", // a composite of three scales
  "outline-offset", // the focus ring's offset, a theme-wide decision
  "outline-width", // the ring itself: one token governs every component
  "text-transform", // character, until a theme declares a case scale
  "letter-spacing", // character, same
  "transform", // a composite of the hover-lift tokens
  "margin-inline-start", // a group join, which no single utility expresses
  "inset-inline-start", // a control inside a group, likewise
  "border-block-end-width", // a table rule, likewise
  "translate", // the switch travel, a composite of two scale steps
  // A custom property declaration mints a component-local binding, exactly as
  // `--grid-gutter` does. It spends a token; it is not one.
  "--switch-travel",
  "--grid-gutter",
]);

async function unjustified(): Promise<string[]> {
  const covered = await coverage();
  const out: string[] = [];
  for (const name of COMPONENTS) {
    const css = await Deno.readTextFile(
      new URL(`./src/${name}.css`, import.meta.url),
    );
    for (const [token, properties] of spentDirectly(css)) {
      if (covered.has(token)) continue;
      for (const property of properties) {
        if (!JUSTIFIED.has(property)) {
          out.push(`${name}: ${token} as ${property}`);
        }
      }
      // A minted binding is justified by being one, whatever property the
      // scan attributes it to.
      if (token.startsWith("--")) continue;
    }
  }
  return out;
}

export { coverage, unjustified };

if (import.meta.main) await main();

/**
 * @spin/primitives — finished elements from tokens, no utilities required.
 *
 * The components are authored as real `.css` files, but this module never
 * imports them: CSS-as-text exists in Deno only, and bundlers and browsers
 * both refuse it. `deno task codegen` emits the sources into `styles.ts` as
 * plain strings — plain `.css` files on disk that any runtime (Rolldown, vent
 * and its node-compatible VFS included) resolves as stylesheets — and that
 * generated module is what ships. Edit the CSS, re-run codegen, commit both.
 *
 * The contract each component owns — which elements it styles, which classes
 * an author may write, which tokens it reads — lives beside the CSS in
 * `manifest.ts`, written by the author who wrote the selector, and
 * `primitives.test.ts` fails the suite when the two disagree. No CSS parsing
 * at runtime, no dependencies.
 */

import {
  buttonCss,
  cardCss,
  contentCss,
  disclosureCss,
  feedbackCss,
  formCss,
  groupCss,
  layoutCss,
  navCss,
  primitiveStyles,
} from "./styles.ts";
import { primitiveContracts } from "./manifest.ts";
import type { CharacterToken, PrimitiveContract } from "./manifest.ts";

export type { CharacterToken, PrimitiveContract };
export { primitiveContracts };
export {
  buttonCss,
  cardCss,
  contentCss,
  disclosureCss,
  feedbackCss,
  formCss,
  groupCss,
  layoutCss,
  navCss,
};

/** The stylesheets, keyed by component name. */
export const primitiveModules: Record<string, string> = primitiveStyles;

/**
 * A component's contract, declared in the manifest beside its stylesheet.
 *
 * `tags` is what the component styles and therefore owns: a utility class on
 * one of these is a conflict rather than an extension. `reads` is every custom
 * property the stylesheet consumes, which is the set a theme has to satisfy.
 */
export interface PrimitiveComponent extends PrimitiveContract {
  /** Component name, matching the file stem. */
  name: string;
  /** The stylesheet. */
  css: string;
}

/** Every component's contract, keyed by name. Joined once at module load. */
export const primitiveComponents: Record<string, PrimitiveComponent> = Object
  .fromEntries(
    Object.entries(primitiveContracts).map(([name, contract]) => [
      name,
      { ...contract, name, css: primitiveModules[name] as string },
    ]),
  );

/**
 * Tags any component owns. A utility class on one of these is a conflict,
 * because the component already decides how that element looks.
 */
export function claimedElements(): Set<string> {
  const out = new Set<string>();
  for (const component of Object.values(primitiveComponents)) {
    for (const tag of component.tags) out.add(tag);
  }
  return out;
}

/** Every class name the primitives define, across all components. */
export function primitiveVariants(): Set<string> {
  const out = new Set<string>();
  for (const component of Object.values(primitiveComponents)) {
    for (const variant of component.variants) out.add(variant);
  }
  return out;
}

/**
 * Custom properties the primitives read, grouped by the top-level token
 * group they belong to (`button`, `color`, `font`, ...).
 */
export function primitiveReadsByGroup(): Record<string, string[]> {
  const out: Record<string, Set<string>> = {};
  for (const component of Object.values(primitiveComponents)) {
    for (const token of component.reads) {
      const [group, ...rest] = token.split("-");
      // A multi-segment name like `on-primary` belongs to the group that
      // precedes it; a single-segment name like `white` has no group.
      const key = rest.length > 0 ? group : "color";
      (out[key] ??= new Set<string>()).add([key, ...rest].join("-"));
    }
  }
  return Object.fromEntries(
    Object.entries(out).map(([k, v]) => [k, [...v].sort()]),
  );
}

/**
 * Concatenate the selected stylesheets. `undefined` means all of them; the
 * preset's `primitives` option passes straight through.
 */
export function generatePrimitivesCss(components?: string[]): string {
  const selected = components ?? Object.keys(primitiveModules);
  return selected
    .filter((name) => name in primitiveModules)
    .map((name) => primitiveModules[name])
    .join("\n\n");
}

// Procedures live in `./contract.ts` + `./procedures.ts` (oRPC + valibot).
// Re-exported here (unlike styles): the guard polices shipped-file imports,
// and contract/procedures import only oRPC/valibot plus sibling modules —
// no CSS text enters a JS bundle through them.
export { primitivesContract } from "./contract.ts";
export { primitivesRouter } from "./procedures.ts";

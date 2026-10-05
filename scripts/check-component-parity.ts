/**
 * Every tag a component renders is one Spin's preset claims, or is a plain
 * structural tag that claims nothing.
 *
 * Why this exists, borrowed from PLAN §4 and §9. The whole argument for this
 * runtime is that a Zag component renders *plain semantic elements* and Spin
 * already knows how to style them, so a component file contains no class names
 * at all. That argument has a failure mode, and PLAN §9 names it: Zag emits a
 * `<div>` where Spin wants a `<button>`, and the styling story quietly breaks.
 * Nothing throws. The element renders, unstyled, and the screenshot gate in
 * phase 4 catches it once — for one component, on one day.
 *
 * **The rule, stated in full:**
 *
 * 1. A component's rendered tags are the tag names inside its **string and
 *    template literals** — `<button>` in a template, `"div"` as the argument of
 *    a `createElement` / `querySelector` / `closest` call. Literals only:
 *    scanning raw source would read `Record<string, string>` as a `<string>`
 *    element, and a gate that cries wolf on every generic is a gate that gets
 *    switched off. A tag assembled at runtime cannot be read statically, and
 *    is not this gate's business.
 * 2. A tag is **allowed** when Spin's preset manifest claims it — it appears in
 *    a `tags:` array in `packages/primitives/src/manifest.ts`. Spin styles that
 *    element for every consumer, so rendering it costs no classes and buys the
 *    whole primitive.
 * 3. A tag is **allowed** when it is in `STRUCTURAL_TAGS` below. These are
 *    flow containers and text-level marks with no visual contract of their
 *    own: a `div` wrapper is a box, not a styling decision. The exception is
 *    enumerated here rather than derived, on purpose — a derived exception is
 *    a loophole, because everything Spin happens not to claim would pass.
 * 4. A component's own custom tag (`spin-*`) is **allowed**: that is the
 *    component's public surface, not something the preset styles.
 * 5. **Anything else is a finding, not a silence.** A component rendering an
 *    unclaimed, non-structural tag means Spin has no opinion about how that
 *    element looks, so the component ships an unstyled element and no error.
 *    The report names both fixes, because both are real work: claim the tag in
 *    the manifest (`tags:` beside the CSS that styles it), or render a tag Spin
 *    already claims. The point of the gate is that this surfaces here rather
 *    than in a screenshot weeks later.
 *
 *     deno task check:component-parity
 */

import { primitiveContracts } from "../packages/primitives/src/manifest.ts";
import {
  elementRegistrations,
  position,
  relative,
  report,
  stripComments,
  ROOT,
  workspacePackages,
} from "./lib/packages.ts";

/**
 * Plain HTML structural tags: containers, breaks and text-level marks with no
 * style of their own. Kept explicit — see rule 3 in the header.
 */
const STRUCTURAL_TAGS = [
  "br",
  "div",
  "em",
  "hr",
  "li",
  "ol",
  "p",
  "small",
  "span",
  "strong",
  "ul",
  "wbr",
] as const;

/** Where the preset's claimed tags are authored, most specific first. */
const MANIFEST_PATH = "packages/primitives/src/manifest.ts";

/** A tag a component renders, and the site that renders it. */
interface RenderedTag {
  readonly tag: string;
  readonly file: URL;
  readonly at: string;
}

/**
 * A tag in markup: `<button>` or `</button>`, matched inside a literal only.
 * Run against whole source this would read `Record<string, string>` as a
 * `<string>` element, so it never is.
 */
const RENDERED_MARKUP = /<\/?([a-z][a-z0-9-]*)\b/g;

/**
 * A tag handed to the DOM: the first string argument of a `createElement`,
 * `createElementNS`, `querySelector`, `closest` or `getElementsBy*` call.
 * Matched against comment-stripped source rather than a literal, because the
 * call's name is code and its argument is the literal — neither half is
 * visible from inside the other.
 */
const DOM_CALL_TAG =
  /\b(?:createElementNS|createElement|querySelector|closest|getElementsBy\w+)\s*\(\s*(?:[A-Za-z_$][\w$.]*\s*,\s*)?["'`]([a-z][a-z0-9-]*)["'`]/g;

/** A string or template literal, and where it starts in the file. */
interface Literal {
  readonly text: string;
  readonly offset: number;
}

/**
 * Every string and template literal in a source file, with its offset so a
 * finding can point at a line.
 *
 * A small scanner rather than a regex over the whole file, because the two
 * things a regex cannot separate are comments — where `<button>` in prose is
 * not a tag — and the literal delimiters themselves. `${…}` inside a template
 * is opaque: a tag built from an expression is not statically knowable, so it
 * is not counted here.
 */
function literalsIn(source: string): Literal[] {
  const literals: Literal[] = [];
  let index = 0;
  while (index < source.length) {
    const char = source[index];
    const next = source[index + 1];
    if (char === "/" && next === "/") {
      const end = source.indexOf("\n", index);
      index = end === -1 ? source.length : end;
      continue;
    }
    if (char === "/" && next === "*") {
      const end = source.indexOf("*/", index + 2);
      index = end === -1 ? source.length : end + 2;
      continue;
    }
    if (char !== '"' && char !== "'" && char !== "`") {
      index++;
      continue;
    }
    // Walk to the closing delimiter, tracking escapes and template nesting so
    // a quote inside `${…}` cannot end the literal early.
    const start = index + 1;
    let depth = 0;
    index++;
    while (index < source.length) {
      const current = source[index];
      if (current === "\\") {
        index += 2;
        continue;
      }
      if (char === "`" && current === "$" && source[index + 1] === "{") {
        depth++;
        index += 2;
        continue;
      }
      if (char === "`" && current === "}" && depth > 0) {
        depth--;
        index++;
        continue;
      }
      if (current === char && depth === 0) break;
      index++;
    }
    literals.push({ text: source.slice(start, index), offset: start });
    index++;
  }
  return literals;
}

/**
 * The tags Spin claims, read from the manifest.
 *
 * Static import, not a runtime path search: the manifest is a module in this
 * workspace, and a gate that picks its input by string matching a filename
 * would go quiet the day the file moved. `primitiveContracts[].tags` is the
 * authored list — `claimedElements()` in the main checkout is a fold over
 * exactly these arrays, so the union is the same set either way.
 *
 * The text fallback covers a manifest that fails to load: a parity check that
 * reports nothing when it cannot read its own input is worse than no gate.
 */
async function claimedTags(): Promise<{ tags: Set<string>; parsed: boolean }> {
  const tags = new Set<string>();
  for (const contract of Object.values(primitiveContracts)) {
    for (const tag of contract.tags ?? []) tags.add(tag);
  }
  if (tags.size > 0) return { tags, parsed: false };

  const source = await Deno.readTextFile(new URL(MANIFEST_PATH, ROOT)).catch(() => undefined);
  if (source === undefined) {
    console.error(
      `✖ component parity\n\n  ${MANIFEST_PATH} could not be read and no claim list came with it.\n` +
        `  A component parity check with no claimed tags would pass every tag in the ` +
        `workspace, so this fails instead.`,
    );
    Deno.exit(1);
  }
  for (const match of source.matchAll(/tags:\s*\[([^\]]*)\]/g)) {
    for (const tag of match[1].matchAll(/["'`]([a-z][a-z0-9-]*)["'`]/g)) tags.add(tag[1]);
  }
  return { tags, parsed: true };
}

async function main(): Promise<void> {
  const claimed = await claimedTags();
  const structural = new Set<string>(STRUCTURAL_TAGS);
  const manifestNote = claimed.parsed ? `${MANIFEST_PATH} (parsed)` : MANIFEST_PATH;
  const findings: string[] = [];
  let rendered = 0;
  let components = 0;

  // Only component packages are in scope. A package that calls `define` ships
  // DOM; every other package is infrastructure whose strings — CSS selectors,
  // token names, HTML in a docblock — are not a rendered document, and
  // reporting them would bury the real findings.
  for (const pkg of await workspacePackages()) {
    if ((await elementRegistrations(pkg)).length === 0) continue;
    const tags = new Map<string, RenderedTag>();
    for (const file of pkg.sources) {
      if (file.pathname.endsWith(".test.ts")) continue;
      const source = await Deno.readTextFile(file);
      const code = stripComments(source);
      const record = (tag: string, offset: number): void => {
        if (tags.has(tag)) return;
        tags.set(tag, { tag, file, at: position(source, offset) });
      };
      for (const match of code.matchAll(DOM_CALL_TAG)) record(match[1], match.index ?? 0);
      // Markup is matched inside a literal only, so a hit's offset is the
      // literal's own offset plus the match inside it.
      for (const literal of literalsIn(code)) {
        for (const match of literal.text.matchAll(RENDERED_MARKUP)) {
          record(match[1], literal.offset + (match.index ?? 0));
        }
      }
    }
    // A component package with no rendered tags renders nothing to be wrong
    // about; check-registries is the gate that notices such a package is empty.
    if (tags.size === 0) continue;
    components++;
    rendered += tags.size;

    for (const [tag, site] of [...tags].sort(([a], [b]) => a.localeCompare(b))) {
      if (claimed.tags.has(tag) || structural.has(tag) || tag.startsWith("spin-")) continue;
      findings.push(
        `packages/${pkg.stem} renders <${tag}> at ${relative(site.file)}:${site.at}, and Spin ` +
          `claims no such tag.\n` +
          `      Either claim it — add "${tag}" to the tags: array of the primitive that ` +
          `should style it, in ${manifestNote} —\n` +
          `      or render a tag the preset already claims. A claimed tag costs zero ` +
          `classes, which is the whole argument.`,
      );
    }
  }

  report(
    "component parity",
    findings,
    `${components} component package${components === 1 ? "" : "s"} render ` +
      `${rendered} distinct tag${rendered === 1 ? "" : "s"}, every one either claimed by ` +
      `${manifestNote} (${claimed.tags.size} claimed) or structural. The ${structural.size} ` +
      `exempt tags: ${[...structural].sort().join(", ")}.`,
  );
}

if (import.meta.main) await main();
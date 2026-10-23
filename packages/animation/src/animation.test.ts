import { assert, assertEquals } from "@std/assert";
import { animationCss, primitiveContracts } from "./index.ts";

/**
 * The manifest and the stylesheet are two halves of one contract: the
 * manifest says what the stylesheet defines, and the stylesheet is what
 * ships. A disagreement is invisible in the sheet — a keyframe nothing names,
 * a class the lint plugin forbids, a custom property a theme is asked to
 * supply and nothing reads — so it is checked here, where both are visible.
 *
 * The stylesheet of record is `animation.css`, the source the generated
 * module is built from. The last test below is what keeps that honest: an
 * agreement asserted against a stale artifact is no agreement at all.
 */

const SOURCE = new URL("./animation.css", import.meta.url);
const stylesheet = await Deno.readTextFile(SOURCE);
const contract = primitiveContracts.animation;

/** The unique names in a list, in the order they appear. */
function unique(names: string[]): string[] {
  return [...new Set(names)];
}

/** The keyframe names the stylesheet defines. */
function keyframesIn(css: string): string[] {
  return unique(
    [...css.matchAll(/@keyframes\s+([\w-]+)/g)].map((match) => match[1]),
  );
}

/** The class names the stylesheet defines. */
function classesIn(css: string): string[] {
  return unique(
    [...css.matchAll(/\.([a-z][\w-]*)\s*\{/g)].map((match) => match[1]),
  );
}

/** The custom properties the stylesheet reads, without the leading `--`. */
function readsIn(css: string): string[] {
  return unique(
    [...css.matchAll(/var\(\s*--([\w-]+)/g)].map((match) => match[1]),
  );
}

Deno.test("every keyframe the manifest names is defined by the stylesheet", () => {
  const defined = keyframesIn(stylesheet);
  for (const name of contract.keyframes) {
    assert(
      defined.includes(name),
      `the manifest names the keyframe \`${name}\`, which the stylesheet does not define`,
    );
  }
});

Deno.test("every keyframe the stylesheet defines is named in the manifest", () => {
  // A keyframe the manifest does not name is a name nothing owns: the next
  // component to define one takes it silently, and the second definition wins.
  const named = contract.keyframes;
  for (const name of keyframesIn(stylesheet)) {
    assert(
      named.includes(name),
      `the stylesheet defines the keyframe \`${name}\`, which the manifest does not name`,
    );
  }
});

Deno.test("the classes the manifest claims are the classes the stylesheet defines", () => {
  // The manifest is the lint plugin's vocabulary: a class it claims is one
  // authored code may write, and one it does not claim is one the sheet has
  // no rule for.
  const defined = classesIn(stylesheet);
  for (const name of contract.variants) {
    assert(
      defined.includes(name),
      `the manifest claims the class \`${name}\`, which the stylesheet does not define`,
    );
  }
  for (const name of defined) {
    assert(
      contract.variants.includes(name),
      `the stylesheet defines the class \`${name}\`, which the manifest does not claim`,
    );
  }
});

Deno.test("the custom properties the manifest declares are the ones the stylesheet reads", () => {
  // A read the manifest does not declare is a variable no theme is told to
  // supply, so it resolves to nothing at computed-value time; a declared read
  // the stylesheet never spends is a variable a theme carries for nothing.
  const read = readsIn(stylesheet);
  for (const name of contract.reads) {
    assert(
      read.includes(name),
      `the manifest declares \`--${name}\`, which the stylesheet never reads`,
    );
  }
  for (const name of read) {
    assert(
      contract.reads.includes(name),
      `the stylesheet reads \`--${name}\`, which the manifest does not declare`,
    );
  }
});

Deno.test("the shipped stylesheet is the source of truth, not a stale copy", () => {
  // The generated module is what ships; the CSS beside it is what the author
  // edits. A stylesheet edited without a codegen run ships the old one, and
  // every agreement above would be asserted against a file nobody edits.
  assertEquals(
    animationCss,
    stylesheet,
    "the generated module is stale: run `deno task codegen`",
  );
});

import { assertEquals } from "@std/assert";
import { walk } from "jsr:@std/fs@^1.0.0/walk";

/**
 * No custom property is spelled by hand.
 *
 * A token's name is derived from its path, once, in `themeRef` and
 * `generateCss`. Every other module reaches a token by reading the theme
 * object — `theme.colors.primary` — which makes a hand-written `var(--asdf)`
 * not merely discouraged but impossible to write without abandoning the
 * mechanism. A typo or a rename cannot leave a rule pointing at nothing,
 * because there is no place to type the name.
 *
 * The lint plugin polices authored code; this polices ours, where a stray
 * variable would be a bug the linter cannot see.
 */

/** The modules that resolve tokens. A rule belongs to one of these. */
const RESOLVERS = ["packages/preset/src", "packages/primitives/src"];

/**
 * The one legitimate spelling: the builder that derives names, and the CSS the
 * primitives author in `--at-apply` form. Neither resolves a token — they
 * produce the names that are resolved.
 */
const ALLOWED = new Set([
  // The two functions that derive a name from a path.
  "packages/theme/src/uno-ref.ts",
  "packages/theme/src/pipeline/generate.ts",
  // Authored CSS. Its `var()` forms are expanded at build, and `primitives`
  // asserts each one has a utility that spends the same token.
  "packages/primitives/src/button.css",
  "packages/primitives/src/form.css",
  "packages/primitives/src/content.css",
  "packages/primitives/src/disclosure.css",
  "packages/primitives/src/layout.css",
  "packages/primitives/src/nav.css",
  "packages/primitives/src/group.css",
  "packages/primitives/src/feedback.css",
  "packages/primitives/src/card.css",
  // Generated from the sources above: the expanded form of the same CSS.
  "packages/primitives/src/styles.ts",
]);

/**
 * The two preset modules that legitimately spell a name, and why.
 *
 * `declarations.ts` is the gap-gutter binding: a component-local binding the
 * theme owns through `--spacing-4` but a primitive reads as `--grid-gutter`,
 * and it is not a token — no theme declares it. `spacing.ts` reads it back.
 * Both are one direction of a single documented exception, not a pattern.
 */
const DERIVES_OTHERWISE = new Set([
  "packages/preset/src/utils/declarations.ts",
  "packages/preset/src/rules/spacing.ts",
]);

Deno.test("no module resolves a token by naming its variable", async () => {
  const offenders: string[] = [];

  const decoder = new TextDecoder();
  for (const root of RESOLVERS) {
    const base = new URL(`../../../${root}/`, import.meta.url);
    // Recursive readDir reports bare names, so the relative path is rebuilt
    // from the entry name rather than guessed from a flat listing.
    for await (const entry of walk(base)) {
      if (!entry.isFile || !/\.(ts|css)$/.test(entry.name)) continue;
      // `walk` yields absolute paths; the lists above are workspace-relative,
      // so the workspace prefix is trimmed rather than duplicated.
      const path = entry.path.replace(/^\/.*\/spin\//, "");
      if (ALLOWED.has(path) || DERIVES_OTHERWISE.has(path)) continue;
      const source = decoder.decode(
        await Deno.readFile(new URL(entry.path, base)),
      );
      if (/var\(--[a-z]/.test(source)) offenders.push(path);
    }
  }

  assertEquals(
    offenders,
    [],
    `these name a custom property by hand; read the theme instead: ${
      offenders.join(", ")
    }`,
  );
});

Deno.test("the allow-list only covers the builders and authored CSS", () => {
  // A name that is not derived from a path, and not authored CSS, would let a
  // typo through the check above. So the exceptions are enumerated rather than
  // pattern-matched: anything new must be added here deliberately.
  for (const path of ALLOWED) {
    const isCss = path.endsWith(".css") || path.endsWith("styles.ts");
    const derives = path === "packages/theme/src/uno-ref.ts" ||
      path === "packages/theme/src/pipeline/generate.ts";
    assertEquals(
      isCss || derives,
      true,
      `${path} is allowed but is neither authored CSS nor a name builder`,
    );
  }
});

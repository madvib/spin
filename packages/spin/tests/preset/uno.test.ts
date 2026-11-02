import { test } from "bun:test";
import { deepStrictEqual } from "node:assert/strict";
import { parseTokens } from "../../src/theme/index.ts";
import type { TokenTree } from "../../src/theme/index.ts";
import { toUnoTheme } from "../../src/compiler/index.ts";

function treeOf(doc: unknown): TokenTree {
  const parsed = parseTokens(doc);
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed.tree;
}

test("toUnoTheme nests color groups and resolves aliases", () => {
  const theme = toUnoTheme(treeOf({
    color: {
      $type: "color",
      primary: { $value: "#111" },
      neutral: {
        50: { $value: "#eee" },
        900: { $value: "#111" },
      },
      surface: { $value: "{color.primary}" },
    },
  }));
  deepStrictEqual(theme.colors.primary, "#111");
  deepStrictEqual(
    (theme.colors.neutral as Record<string, string>)["50"],
    "#eee",
  );
  deepStrictEqual(theme.colors.surface, "#111");
});

test("toUnoTheme maps each token group onto its Uno key", () => {
  const theme = toUnoTheme(treeOf({
    spacing: { $type: "dimension", 4: { $value: "1rem" } },
    font: {
      size: { $type: "dimension", lg: { $value: "2rem" } },
      family: { $type: "fontFamily", sans: { $value: "faces" } },
      weight: { $type: "fontWeight", bold: { $value: 700 } },
    },
    radius: { $type: "dimension", lg: { $value: "3px" } },
    shadow: { $type: "shadow", md: { $value: "shadows" } },
    breakpoint: { $type: "dimension", md: { $value: "5rem" } },
    "z-index": { $type: "number", modal: { $value: 9 } },
    motion: {
      duration: { $type: "duration", base: { $value: "9ms" } },
      easing: { $type: "cubicBezier", standard: { $value: "linear" } },
    },
  }));
  deepStrictEqual(theme.spacing["4"], "1rem");
  deepStrictEqual(theme.fontSize["lg"], "2rem");
  deepStrictEqual(theme.fontFamily["sans"], "faces");
  deepStrictEqual(theme.fontWeight["bold"], "700");
  deepStrictEqual(theme.radius["lg"], "3px");
  deepStrictEqual(theme.shadow["md"], "shadows");
  deepStrictEqual(theme.breakpoint["md"], "5rem");
  deepStrictEqual(theme.zIndex["modal"], "9");
  deepStrictEqual(theme.transitionDuration["base"], "9ms");
  deepStrictEqual(theme.transitionTimingFunction["standard"], "linear");
});

test("toUnoTheme keeps base values when a dark group exists", () => {
  const theme = toUnoTheme(treeOf({
    color: {
      $type: "color",
      primary: { $value: "#111" },
    },
    dark: {
      color: {
        $type: "color",
        primary: { $value: "#222" },
      },
    },
  }));
  deepStrictEqual(theme.colors.primary, "#111");
  deepStrictEqual("dark" in theme.colors, false);
});

test("the loop is not a transition duration in the Uno theme", () => {
  // The Uno shape has no slot for the period of an endless animation, and a
  // loop where a transition's duration goes is how `duration-loop` became a
  // transition. The loop is spent off the custom property instead.
  const theme = toUnoTheme(treeOf({
    motion: {
      duration: {
        $type: "duration",
        base: { $value: "9ms" },
        loop: { $value: "1.2s" },
      },
    },
  }));
  deepStrictEqual(theme.transitionDuration["base"], "9ms");
  deepStrictEqual("loop" in theme.transitionDuration, false);
});

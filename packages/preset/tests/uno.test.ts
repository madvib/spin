import { assertEquals } from "@std/assert";
import { parseTokens } from "@spin/theme";
import type { TokenTree } from "@spin/theme";
import { toUnoTheme } from "@spin/preset";

function treeOf(doc: unknown): TokenTree {
  const parsed = parseTokens(doc);
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed.tree;
}

Deno.test("toUnoTheme nests color groups and resolves aliases", () => {
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
  assertEquals(theme.colors.primary, "#111");
  assertEquals(
    (theme.colors.neutral as Record<string, string>)["50"],
    "#eee",
  );
  assertEquals(theme.colors.surface, "#111");
});

Deno.test("toUnoTheme maps each token group onto its Uno key", () => {
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
  assertEquals(theme.spacing["4"], "1rem");
  assertEquals(theme.fontSize["lg"], "2rem");
  assertEquals(theme.fontFamily["sans"], "faces");
  assertEquals(theme.fontWeight["bold"], "700");
  assertEquals(theme.radius["lg"], "3px");
  assertEquals(theme.shadow["md"], "shadows");
  assertEquals(theme.breakpoint["md"], "5rem");
  assertEquals(theme.zIndex["modal"], "9");
  assertEquals(theme.transitionDuration["base"], "9ms");
  assertEquals(theme.transitionTimingFunction["standard"], "linear");
});

Deno.test("toUnoTheme keeps base values when a dark group exists", () => {
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
  assertEquals(theme.colors.primary, "#111");
  assertEquals("dark" in theme.colors, false);
});

Deno.test("the loop is not a transition duration in the Uno theme", () => {
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
  assertEquals(theme.transitionDuration["base"], "9ms");
  assertEquals("loop" in theme.transitionDuration, false);
});

import type { Rule } from "@unocss/core";
import { groupOf, themeOf } from "../../utils/lookup.ts";
import type { Mode } from "./shared.ts";

/**
 * Avatar — a face in a fixed square, sized by the theme's ladder.
 */
export function avatarRules(
  roots: readonly string[],
  mode: Mode,
): Rule[] {
  if (!roots.includes("avatar")) return [];
  const avatar = ".avatar";
  return [
    avatarBase(avatar),
    ...avatarSizes(avatar),
    avatarCircle(avatar),
  ];
}

/** The base: a fixed inline square that crops its image to fill. */
function avatarBase(avatar: string): Rule {
  return [
    /^avatar$/,
    function* (_m, ctx) {
      const t = themeOf(ctx);
      const size = groupOf(ctx, "avatar")["md"];
      const radius = t?.radius["md"];
      yield {
        [ctx.symbols.selector]: () => avatar,
        ...(size !== undefined ? { width: size, height: size } : {}),
        "object-fit": "cover",
        display: "inline-block",
        ...(radius !== undefined ? { "border-radius": radius } : {}),
      };
    },
    { layer: "primitives", autocomplete: "avatar" },
  ];
}

/** The size ladder: each step restates the square's edge. */
function avatarSizes(avatar: string): Rule[] {
  return (["sm", "md", "lg"] as const).map((step): Rule => [
    new RegExp(`^avatar-${step}$`),
    function* (_m, ctx) {
      const size = groupOf(ctx, "avatar")[step];
      yield {
        [ctx.symbols.selector]: () => `${avatar}.avatar-${step}`,
        ...(size !== undefined ? { width: size, height: size } : {}),
      };
    },
    { layer: "primitives", autocomplete: `avatar-${step}` },
  ]);
}

/** The circle: the face as a disc rather than a rounded square. */
function avatarCircle(avatar: string): Rule {
  return [
    /^avatar-circle$/,
    function* (_m, ctx) {
      const radius = themeOf(ctx)?.radius["full"];
      yield {
        [ctx.symbols.selector]: () => `${avatar}.avatar-circle`,
        ...(radius !== undefined ? { "border-radius": radius } : {}),
      };
    },
    { layer: "primitives", autocomplete: "avatar-circle" },
  ];
}

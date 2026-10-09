import type { Rule } from "@unocss/core";
import { groupOf, themeOf } from "../../utils/lookup.ts";
import type { Mode } from "./shared.ts";

/**
 * Avatar — a face in a fixed square, sized by the theme's ladder.
 *
 * Three opinions, all of them about how a face is framed rather than about
 * what a face looks like:
 *
 * **The face is the element, or the element holds the face.** An avatar is an
 * `<img>` carrying the class, and there the class does everything: the edge,
 * the crop, the radius. A wrapper carrying the same class is the other way to
 * write one, and it exists because a status dot needs somewhere to sit — the
 * rule then sizes the image inside the wrapper instead of being the image.
 *
 * **The variants are the ladder, not the tone.** Three sizes and a circle,
 * all of them restating or replacing one geometry fact: the edge, and whether
 * the corner is round. A face has no palette of its own — the image is the
 * content, and the rule frames it.
 *
 * **A ring is a shadow, and a dot is placed.** A ring drawn as a border takes
 * a hairline out of the face, because the square is fixed in a border-box and
 * a border inside it shrinks the image; a shadow paints outside and leaves
 * the edge exactly the size the theme named. The dot is absolute, which means
 * the avatar is the containing block — that is the rule's half of the
 * contract, and the child span is the caller's.
 */
export function avatarRules(
  roots: readonly string[],
  _mode: Mode,
): Rule[] {
  if (!roots.includes("avatar")) return [];
  const avatar = ".avatar";
  return [
    avatarBase(avatar),
    ...avatarSizes(avatar),
    avatarCircle(avatar),
    avatarRing(avatar),
    avatarStatus(),
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
        // The face is where a status dot is placed, so it is the containing
        // block for one. The class also lands on a wrapper around the face,
        // and a positioned wrapper is what makes that form work.
        position: "relative",
      };
      // The wrapper form: the avatar class on a container, holding the face
      // and whatever sits on it. The image fills the square the class named
      // and is cropped to it, which is what the element form stated for
      // itself — so a wrapper is an avatar too, not a different component.
      yield {
        [ctx.symbols.selector]: () => `${avatar} > img`,
        width: "100%",
        height: "100%",
        "object-fit": "cover",
        display: "block",
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

/**
 * The ring: the face framed from the border tokens.
 *
 * A shadow rather than a border, for the reason the group gives: the square is
 * fixed in a border-box, so a border would take its hairline out of the image
 * itself and every ring would make its face slightly smaller. The weight is
 * the theme's emphasis edge, which is the edge the theme reserves for a
 * control that must read as selected rather than merely bordered — and a ring
 * is exactly that, a face singled out.
 */
function avatarRing(avatar: string): Rule {
  return [
    /^avatar-ring$/,
    function* (_m, ctx) {
      const t = themeOf(ctx);
      const width = t?.borderWidth?.["width-2"];
      const color = t?.colors["border-strong"];
      yield {
        [ctx.symbols.selector]: () => `${avatar}.avatar-ring`,
        ...(width !== undefined && color !== undefined
          ? { "box-shadow": `0 0 0 ${width} ${color}` }
          : {}),
      };
    },
    { layer: "primitives", autocomplete: "avatar-ring" },
  ];
}

/**
 * The status dot: a child of the avatar, placed in its trailing corner.
 *
 * The dot is sized as a share of the face, so one class serves the whole
 * ladder — a face in a list gets a small dot and a page's subject gets a
 * large one, and neither needs a second class to say so. It reads the success
 * token, because presence is the one state a status dot names.
 */
function avatarStatus(): Rule {
  return [
    /^avatar-status$/,
    function* (_m, ctx) {
      const t = themeOf(ctx);
      const radius = t?.radius["full"];
      const success = t?.colors["semantic-success"];
      yield {
        [ctx.symbols.selector]: () => ".avatar-status",
        position: "absolute",
        "inset-block-end": "0",
        "inset-inline-end": "0",
        width: "25%",
        "aspect-ratio": "1",
        ...(radius !== undefined ? { "border-radius": radius } : {}),
        ...(success !== undefined ? { "background-color": success } : {}),
      };
    },
    { layer: "primitives", autocomplete: "avatar-status" },
  ];
}

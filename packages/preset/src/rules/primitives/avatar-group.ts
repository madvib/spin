import type { Rule } from "@unocss/core";
import { groupOf, themeOf } from "../../utils/lookup.ts";
import type { Mode } from "./shared.ts";

/**
 * Avatar group — a stack of faces, each later one overlapping the last.
 *
 * Geometry only: the group lays its children out and separates them, and
 * nothing else. A face is the avatar rule's business — its size, its radius,
 * its crop — so this rule spends none of that. That is also why the overlap
 * is a margin and the ring is a shadow: both are facts about the group's
 * arrangement rather than properties of the face.
 *
 * **Forward, not reversed.** DOM order is first to last and the row is a plain
 * row, so the LAST face is the one on top. That matches how an author writes
 * the markup: the stack is listed in order, and the front of it is the end of
 * the list. A `row-reverse` row would put the first face on top and make the
 * author write the list backwards to get the same reading.
 *
 * **The overlap is a third of the default face, taken from the avatar ladder.**
 * `--avatar-md` is the size a face in a group is authored at, and a third of
 * it is enough of a step that five faces still fit a row. It is arithmetic on
 * the token rather than a length of its own, so a theme that grows its faces
 * grows the overlap with them — which is the whole reason it is written as a
 * `calc` on a reference instead of a number.
 *
 * **Paint order does the stacking, so nothing sets it.** Siblings painting in
 * one stacking context paint in DOM order, so a later face paints after — and
 * therefore above — the one before it. No `z-index` and no `position`: a stack
 * of faces needs no layer of its own, and a group nested in one must not
 * invent one.
 *
 * **The ring is a box-shadow, not a border.** A border is a layout fact: it
 * takes a hairline out of the face itself, because a face is fixed to the
 * theme's edge in a `border-box` and a border inside it shrinks the image —
 * so a stack of bordered avatars is a stack of slightly smaller faces. A
 * box-shadow paints outside the border box, which leaves every face at
 * exactly the size the theme named it and the overlap at exactly a third. It
 * follows the child's own radius as well, so a group of circles gets a
 * circular ring without a rule that says so.
 */
export function avatarGroupRules(
  roots: readonly string[],
  mode: Mode,
): Rule[] {
  if (!roots.includes("avatar-group")) return [];
  return [avatarGroup()];
}

/** The theme values a group spends, resolved once per rule. */
function groupTokens(ctx: Parameters<typeof themeOf>[0]) {
  const t = themeOf(ctx);
  return {
    face: groupOf(ctx, "avatar")["md"],
    ringWidth: t?.borderWidth?.["width"],
    // The colour behind the group, because a ring is a cut through to whatever
    // the group is sitting on — and the theme's name for that is `surface`.
    ringColor: t?.colors?.["surface"],
  };
}

/**
 * The whole group, in one rule.
 *
 * Uno keeps only the first rule matching a token, so a document's single
 * `class="avatar-group"` must find the row, the overlap and the ring in the
 * same rule. Splitting them would ship a group with a row and no seam.
 */
function avatarGroup(): Rule {
  return [
    /^avatar-group$/,
    function* (_m, ctx) {
      const { face, ringWidth, ringColor } = groupTokens(ctx);

      // The row: sized to its content so it sits inline beside a heading, and
      // centred so faces of mixed sizes share one line rather than a top.
      yield {
        [ctx.symbols.selector]: () => ".avatar-group",
        display: "inline-flex",
        "flex-direction": "row",
        "align-items": "center",
      };

      // The seam. Every face after the first is pulled back over the one
      // before it, in the inline direction, by a third of the default face.
      yield {
        [ctx.symbols.selector]: () => ".avatar-group > * + *",
        ...(face !== undefined
          ? { "margin-inline-start": `calc(${face} / -3)` }
          : {}),
      };

      // The ring, on every child alike: a face and the `+3` counter that
      // closes a long stack are separated from what is behind them the same
      // way, and the counter has no class of its own to carry one.
      yield {
        [ctx.symbols.selector]: () => ".avatar-group > *",
        ...(ringWidth !== undefined && ringColor !== undefined
          ? { "box-shadow": `0 0 0 ${ringWidth} ${ringColor}` }
          : {}),
      };
    },
    { layer: "primitives", autocomplete: "avatar-group" },
  ];
}

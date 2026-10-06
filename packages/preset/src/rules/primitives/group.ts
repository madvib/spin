import type { Rule } from "@unocss/core";
import { themeOf } from "../../utils/lookup.ts";

/**
 * Group — joined controls, as a relationship rather than a component.
 *
 * The one thing in the library no utility can express, and the reason this
 * file exists. `role="group"` reads as one object: its children flatten each
 * other's corners, and their borders collapse into a single seam rather than
 * stacking. No class can do this — the selector would have to reach into a
 * sibling the author never named, which makes it a relationship rather than a
 * declaration. It is also why this is the only component keyed on a role: the
 * role is what a screen reader navigates by, so an author writing
 * `role="group"` has already claimed these controls are one thing and the
 * styling is that claim made visible.
 *
 * How: child and sibling combinators, because a joined control's shape is a
 * fact about its neighbours. The radius is set on the GROUP and unset on the
 * children, so a theme that changes it changes it once and the flattening
 * follows. Restating it per position would put the number in six places and
 * they would drift apart immediately.
 *
 * The seam is made by overlapping rather than by removing borders: each child
 * after the first is pulled back by one border width, so two borders become
 * one pixel. The borders stay; they just stop being visible. A focused child
 * is raised so a neighbour cannot paint over its ring, which costs no layout
 * because the element already occupies its space.
 */
export function groupRules(roots: readonly string[]): Rule[] {
  if (!roots.includes("group")) return [];
  return [groupRule()];
}

/** The controls a group joins. A group of things is a group of controls. */
const MEMBERS =
  ':is(button, input, select, textarea, badge, [role="button"])';

/** The same list as a standalone selector, for composing onto a position. */
const MEMBER = "button, input, select, textarea, badge, [role=\"button\"]";

function tokens(ctx: Parameters<typeof themeOf>[0]) {
  const t = themeOf(ctx);
  return {
    radius: t?.radius?.["md"],
    radiusFull: t?.radius?.["full"],
    borderWidth: t?.borderWidth?.["width"],
  };
}

function groupRule(): Rule {
  return [
    /^(?:group|joined)$/,
    function* (_m, ctx) {
      const t = tokens(ctx);
      const group = `[role="group"]`;

      // The radius lives on the group. The children inherit it, and the rules
      // below take it away from the corners that would meet a neighbour.
      yield {
        [ctx.symbols.selector]: () => group,
        ...(t.radius !== undefined ? { "border-radius": t.radius } : {}),
      };

      // Every member flattens entirely; the two ends below restore their own
      // corners. Flattening the lot first means the rules do not have to
      // enumerate the middle positions, and there is no fourth child case.
      yield {
        [ctx.symbols.selector]: () => `${group} > ${MEMBERS}`,
        ...(t.radius !== undefined ? { "border-radius": "0" } : {}),
      };
      yield {
        [ctx.symbols.selector]: () => `${group} > :first-child:is(${MEMBER})`,
        ...(t.radius !== undefined
          ? {
            "border-start-start-radius": t.radius,
            "border-end-start-radius": t.radius,
          }
          : {}),
      };
      yield {
        [ctx.symbols.selector]: () => `${group} > :last-child:is(${MEMBER})`,
        ...(t.radius !== undefined
          ? {
            "border-start-end-radius": t.radius,
            "border-end-end-radius": t.radius,
          }
          : {}),
      };

      // The seam: overlap the border rather than remove it. A negative margin
      // of exactly one border width turns two one-pixel rules into one, and it
      // stays correct when the theme changes the border weight — which is the
      // reason it is a margin and not a `border: none`.
      yield {
        [ctx.symbols.selector]: () => `${group} > ${MEMBERS} ~ ${MEMBERS}`,
        ...(t.borderWidth !== undefined
          ? { "margin-inline-start": `calc(-1 * ${t.borderWidth})` }
          : {}),
      };

      // A focused member must sit above its neighbours' borders or a sibling
      // paints over the ring.
      yield {
        [ctx.symbols.selector]: () => `${group} > ${MEMBERS}:focus-visible`,
        position: "relative",
        "z-index": "1",
      };

      // A group that wraps would leave a negative margin on the first member
      // of each line, dragging it into the row above. Opting out is one rule
      // rather than a variant, because nothing else distinguishes the two.
      yield {
        [ctx.symbols.selector]: () => `${group}[data-wrap] > ${MEMBERS} ~ ${MEMBERS}`,
        "margin-inline-start": "0",
      };
    },
    { layer: "primitives", autocomplete: "group" },
  ];
}
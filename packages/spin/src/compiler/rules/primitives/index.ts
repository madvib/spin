import type { Rule } from "@unocss/core";
import { a11yRules } from "./a11y.ts";
import { alertRules } from "./alert.ts";
import { badgeRules } from "./badge.ts";
import { breadcrumbsRules } from "./breadcrumbs.ts";
import { buttonRules } from "./button.ts";
import { cardRules } from "./card.ts";
import type { Mode } from "./shared.ts";
import { controlRules } from "./control.ts";
import { dialogRules } from "./dialog.ts";
import { disclosureRules } from "./disclosure.ts";
import { fieldBox } from "./field.ts";
import { fieldsetRules } from "./fieldset.ts";
import { joinRules } from "./join.ts";
import { hrRules } from "./hr.ts";
import { kbdRules } from "./kbd.ts";
import { labelRules } from "./label.ts";
import { meterRules } from "./meter.ts";
import { panelRules } from "./panel.ts";
import { progressRules } from "./progress.ts";
import { proseRules } from "./prose.ts";
import { radioRules } from "./radio.ts";
import { rangeRules } from "./range.ts";
import { statRules } from "./stat.ts";
import { skeletonRules } from "./skeleton.ts";
import { swatchRules } from "./swatch.ts";
import { tableRules } from "./table.ts";
import { tooltipRules } from "./tooltip.ts";
import { textareaRules } from "./textarea.ts";

/**
 * The primitive components, as rules.
 *
 * Every component here is a rule, not a shortcut. A shortcut emits a CLASS
 * selector — uno gives it no way to say `card:` — and the primitive surface is
 * a tag vocabulary, so a shortcut component would style nothing anyone writes.
 * Card proved that the hard way: seven shortcuts emitted `.card`,
 * `.card-header`, `.card-title`, and a bare `<card>` rendered unstyled.
 *
 * A rule sets `ctx.symbols.selector` and can claim the element itself, which
 * is what makes the surface classless. uno keeps only the first rule matching
 * a token, so one component's parts must each be their own token — which is
 * also why they shake: an unused part emits nothing.
 *
 * Shortcuts still have a place, for utility bundles a caller opts into by
 * name. They are not for components.
 */
export function primitiveRules(
  roots: readonly string[],
  mode: Mode,
): Rule[] {
  return [
    // The shared box is one component: `field` covers input and textarea,
    // because they are one box with two contents.
    ...(roots.includes("field") ? [fieldBox()] : []),
    ...a11yRules(roots),
    ...alertRules(roots, mode),
    ...badgeRules(roots, mode),
    ...breadcrumbsRules(roots, mode),
    ...buttonRules(roots),
    ...cardRules(roots, mode),
    ...controlRules(roots),
    ...dialogRules(roots, mode),
    ...disclosureRules(roots, mode),
    ...fieldsetRules(roots, mode),
    ...progressRules(roots, mode),
    ...proseRules(),
    ...joinRules(roots, mode),
    ...hrRules(roots, mode),
    ...kbdRules(roots, mode),
    ...labelRules(roots, mode),
    ...meterRules(roots, mode),
    ...panelRules(roots, mode),
    ...statRules(roots, mode),
    ...skeletonRules(roots, mode),
    ...swatchRules(roots, mode),
    ...tableRules(roots, mode),
    ...textareaRules(roots),
    ...radioRules(roots),
    ...rangeRules(roots),
    ...tooltipRules(roots, mode),
  ];
}

/**
 * The ARIA vocabulary: the attribute sets a part states.
 *
 * The attributes of a part belong to the pattern the part plays — a
 * disclosure trigger, a list surface, a slider thumb, an option row — and
 * not to the component that renders it. Stating a pattern once is what
 * makes a change to it reach every part that plays it.
 *
 * A primitive states the attributes it owns and nothing else, so a part
 * spreads it beside the attributes it owns itself.
 *
 * Two rules govern the shape of a primitive, and both are the framework's
 * own conventions:
 *
 * - A member left out of the options is not in the fragment at all. A
 *   member passed as `undefined` is in the fragment with no value, which
 *   the framework drops when it writes the attribute. The difference is the
 *   difference between a part that does not carry the attribute and a
 *   part that carries it with nothing to say.
 * - A value is the value the part already states. The corpus spells a
 *   state either as the boolean or as the string the attribute reads in
 *   the DOM, and both render the same attribute text, so the type admits
 *   both and a part keeps the one it used.
 *
 * The single-attribute helpers are named after the attribute they own —
 * `ariaDisabled` is `aria-disabled` — so a reader of a part's bag sees
 * where the attribute came from. The composites are named after the role
 * they play: a `disclosureTrigger` opens a region, a `listSurface` holds
 * rows, a `sliderThumb` rides a range, an `optionRow` sits in a set, a
 * `comboboxInput` completes what is typed into it.
 */

import type { PartView } from "./component/define.ts";

/** The values an ARIA attribute may carry. */
export type AriaValue = string | number | boolean | undefined;

/** The attribute fragment a pattern contributes to a part's bag. */
export type AriaFragment = Record<string, AriaValue>;

/**
 * A state an ARIA attribute states.
 *
 * The corpus spells a state either as the boolean or as the string the
 * attribute reads in the DOM. Both render the same attribute text, so the
 * type admits both.
 */
export type AriaState = boolean | "true" | "false";

/** The popups a trigger can announce. */
export type AriaHasPopup = "menu" | "dialog" | "listbox" | "tree" | "grid";

/** How a combobox completes what is typed into it. */
export type AriaAutocomplete = "none" | "inline" | "list" | "both";

/** The direction a region reads in. */
export type AriaOrientation = "horizontal" | "vertical";

/** How eagerly a region is announced. */
export type AriaLive = "off" | "polite" | "assertive";

/** Where a part stands within a set. */
export type AriaCurrent =
  | "page"
  | "step"
  | "location"
  | "date"
  | "time"
  | boolean;

/** A part of the scope, named for a relation that points at more than one. */
export interface AriaPartRef {
  /** The part the relation points at. */
  readonly part: string;
  /** The slot the relation points at, when the part is a slot. */
  readonly slot?: unknown;
}

/**
 * The element an ARIA relation points at.
 *
 * A relation names the part of the scope it points to and the scope mints
 * the id; a relation that points at an element the scope does not own
 * names the id itself; a relation that points at several elements names
 * them as parts, and the ids are joined by a space.
 */
export type AriaTarget =
  | { readonly part: string; readonly slot?: unknown }
  | { readonly id: string }
  | { readonly parts: readonly AriaPartRef[] };

/** The id an ARIA relation points at. */
function targetId<C extends object>(
  scope: PartView<unknown, C>,
  target: AriaTarget | undefined,
): string | undefined {
  if (target === undefined) return undefined;
  if ("id" in target) return target.id;
  if ("parts" in target) {
    const ids = target.parts.map((ref) => scope.id(ref.part, ref.slot));
    return ids.length > 0 ? ids.join(" ") : undefined;
  }
  return scope.id(target.part, target.slot);
}

/**
 * A part the user cannot act on.
 *
 * The state is stated rather than implied: the part is still in the page,
 * and a reader has to hear that it is unavailable.
 */
export function ariaDisabled(state: AriaState | undefined): AriaFragment {
  return { "aria-disabled": state };
}

/** A part that is not in the page for a reader. */
export function ariaHidden(state: AriaState | undefined): AriaFragment {
  return { "aria-hidden": state };
}

/** A part whose value is not valid. */
export function ariaInvalid(state: AriaState | undefined): AriaFragment {
  return { "aria-invalid": state };
}

/** A toggle that is held down. */
export function ariaPressed(state: AriaState | undefined): AriaFragment {
  return { "aria-pressed": state };
}

/** A part that is still working. */
export function ariaBusy(state: AriaState | undefined): AriaFragment {
  return { "aria-busy": state };
}

/** Where a part stands within a set. */
export function ariaCurrent(place: AriaCurrent | undefined): AriaFragment {
  return { "aria-current": place };
}

/** The direction a region reads in. */
export function ariaOrientation(
  dir: AriaOrientation | undefined,
): AriaFragment {
  return { "aria-orientation": dir };
}

/** The name a part gives itself beyond its role. */
export function ariaRoleDescription(text: string | undefined): AriaFragment {
  return { "aria-roledescription": text };
}

/** A description of a part that no element owns. */
export function ariaDescription(text: string | undefined): AriaFragment {
  return { "aria-description": text };
}

/** How a combobox completes what is typed into it. */
export function ariaAutocomplete(
  mode: AriaAutocomplete | undefined,
): AriaFragment {
  return { "aria-autocomplete": mode };
}

/**
 * A prop's truth, as an ARIA state.
 *
 * The corpus states a boolean prop as its own truth: a prop that is absent
 * or false says nothing, so the attribute is not written at all, and a
 * prop that is true states the state.
 */
export function ariaFlag(value: unknown): boolean | undefined {
  return value ? true : undefined;
}

/**
 * A prop's value, as an ARIA state.
 *
 * A boolean prop is the state it is: a prop that is false states "false",
 * and a prop that is absent states nothing at all.
 */
export function ariaState(value: unknown): AriaState | undefined {
  if (typeof value === "boolean") return value;
  if (value === "true") return "true";
  if (value === "false") return "false";
  return undefined;
}

/** Whether a part must be filled in. */
export function ariaRequired(state: AriaState | undefined): AriaFragment {
  return { "aria-required": state };
}

/** Whether a part refuses edits. */
export function ariaReadOnly(state: AriaState | undefined): AriaFragment {
  return { "aria-readonly": state };
}

/** The element that describes a part. */
export function ariaDescribedBy<C extends object>(
  scope: PartView<unknown, C>,
  target: AriaTarget | undefined,
): AriaFragment {
  return { "aria-describedby": targetId(scope, target) };
}

/** The element that names a part. */
export function ariaLabelledBy<C extends object>(
  scope: PartView<unknown, C>,
  target: AriaTarget | undefined,
): AriaFragment {
  return { "aria-labelledby": targetId(scope, target) };
}

/** The region a part controls. */
export function ariaControls<C extends object>(
  scope: PartView<unknown, C>,
  target: AriaTarget | undefined,
): AriaFragment {
  return { "aria-controls": targetId(scope, target) };
}

/** The elements a part owns. */
export function ariaOwns<C extends object>(
  scope: PartView<unknown, C>,
  target: AriaTarget | undefined,
): AriaFragment {
  return { "aria-owns": targetId(scope, target) };
}

/**
 * A region that announces itself.
 *
 * The region says how loudly it speaks, whether it speaks as a whole, and
 * which of its changes are worth speaking of.
 */
export function liveRegion(
  init: {
    /** How eagerly the region is announced. */
    readonly live?: AriaLive | undefined;
    /** Whether the region is announced as a whole. */
    readonly atomic?: AriaState | undefined;
    /** Which of the region's changes are announced. */
    readonly relevant?: string | undefined;
  },
): AriaFragment {
  return {
    ...("live" in init ? { "aria-live": init.live } : {}),
    ...("atomic" in init ? { "aria-atomic": init.atomic } : {}),
    ...("relevant" in init ? { "aria-relevant": init.relevant } : {}),
  };
}

/**
 * A control that opens a region.
 *
 * The trigger says whether the region is open, what kind of popup it
 * opens, and which region that is. A trigger that opens no region states
 * no `aria-controls`, and a part that is not a trigger at all states
 * neither.
 */
export function disclosureTrigger<C extends object>(
  scope: PartView<unknown, C>,
  init: {
    /** Whether the region the trigger opens is open. */
    readonly expanded?: AriaState | undefined;
    /** The kind of popup the trigger opens. */
    readonly hasPopup?: AriaHasPopup | undefined;
    /** The region the trigger opens. */
    readonly controls?: AriaTarget | undefined;
  },
): AriaFragment {
  return {
    ...("expanded" in init ? { "aria-expanded": init.expanded } : {}),
    ...("hasPopup" in init ? { "aria-haspopup": init.hasPopup } : {}),
    ...("controls" in init
      ? { "aria-controls": targetId(scope, init.controls) }
      : {}),
  };
}

/**
 * A surface that holds rows.
 *
 * The surface says what names it, which row is the active descendant, and
 * the selection states it carries.
 */
export function listSurface<C extends object>(
  scope: PartView<unknown, C>,
  init: {
    /** The element that names the surface. */
    readonly labelledBy?: AriaTarget | undefined;
    /** The row the surface is on. */
    readonly activeDescendant?: AriaTarget | undefined;
    /** Whether more than one row may be chosen. */
    readonly multiSelectable?: AriaState | undefined;
    /** Whether the surface must be filled in. */
    readonly required?: AriaState | undefined;
    /** Whether the surface refuses edits. */
    readonly readOnly?: AriaState | undefined;
  },
): AriaFragment {
  return {
    ...("labelledBy" in init
      ? { "aria-labelledby": targetId(scope, init.labelledBy) }
      : {}),
    ...("activeDescendant" in init
      ? { "aria-activedescendant": targetId(scope, init.activeDescendant) }
      : {}),
    ...("multiSelectable" in init
      ? { "aria-multiselectable": init.multiSelectable }
      : {}),
    ...("required" in init ? { "aria-required": init.required } : {}),
    ...("readOnly" in init ? { "aria-readonly": init.readOnly } : {}),
  };
}

/**
 * A field that completes what is typed into it.
 *
 * The field says how it completes, which region it controls, whether that
 * region is open, and which row it is on.
 */
export function comboboxInput<C extends object>(
  scope: PartView<unknown, C>,
  init: {
    /** How the field completes what is typed into it. */
    readonly autocomplete?: AriaAutocomplete | undefined;
    /** The region the field controls. */
    readonly controls?: AriaTarget | undefined;
    /** Whether the region the field controls is open. */
    readonly expanded?: AriaState | undefined;
    /** The row the field is on. */
    readonly activeDescendant?: AriaTarget | undefined;
  },
): AriaFragment {
  return {
    ...("autocomplete" in init ? ariaAutocomplete(init.autocomplete) : {}),
    ...("controls" in init
      ? { "aria-controls": targetId(scope, init.controls) }
      : {}),
    ...("expanded" in init ? { "aria-expanded": init.expanded } : {}),
    ...("activeDescendant" in init
      ? { "aria-activedescendant": targetId(scope, init.activeDescendant) }
      : {}),
  };
}

/**
 * A handle that rides a range.
 *
 * The thumb says the range it rides and where it sits in it; `text` is
 * what a reader hears, which the number alone does not say.
 */
export function sliderThumb(
  init: {
    /** The lowest value of the range. */
    readonly min?: string | number | undefined;
    /** The highest value of the range. */
    readonly max?: string | number | undefined;
    /** The value the thumb sits at. */
    readonly now?: string | number | undefined;
    /** The value a reader hears. */
    readonly text?: string | undefined;
  },
): AriaFragment {
  return {
    ...("min" in init ? { "aria-valuemin": init.min } : {}),
    ...("max" in init ? { "aria-valuemax": init.max } : {}),
    ...("now" in init ? { "aria-valuenow": init.now } : {}),
    ...("text" in init ? { "aria-valuetext": init.text } : {}),
  };
}

/**
 * A row inside a set.
 *
 * A row is either selected or checked, never both: `selected` says the
 * row is the chosen one, `checked` says the row carries a state of its
 * own. `posInSet` and `setSize` place the row in the set it belongs to,
 * and `level` places it in the hierarchy it belongs to.
 */
export function optionRow(
  init: {
    /** Whether the row is the chosen one. */
    readonly selected?: AriaState | undefined;
    /** The state the row carries. */
    readonly checked?: AriaState | undefined;
    /** The row's place in the set. */
    readonly posInSet?: string | number | undefined;
    /** The size of the set the row belongs to. */
    readonly setSize?: string | number | undefined;
    /** The row's depth in the hierarchy. */
    readonly level?: number | undefined;
    /** Whether the row is unavailable to the user. */
    readonly disabled?: AriaState | undefined;
  },
): AriaFragment {
  return {
    ...("selected" in init ? { "aria-selected": init.selected } : {}),
    ...("checked" in init ? { "aria-checked": init.checked } : {}),
    ...("posInSet" in init ? { "aria-posinset": init.posInSet } : {}),
    ...("setSize" in init ? { "aria-setsize": init.setSize } : {}),
    ...("level" in init ? { "aria-level": init.level } : {}),
    ...("disabled" in init ? ariaDisabled(init.disabled) : {}),
  };
}

import { test } from "bun:test";
/**
 * The ARIA vocabulary's tests.
 *
 * Each primitive is tested twice over: the attributes it owns when every
 * member is given, and the attributes it owns when a member is left out or
 * passed as `undefined`. The difference matters — a member left out is not
 * in the fragment at all, a member passed as `undefined` is in the
 * fragment with no value, and the framework drops that value when it
 * writes the attribute.
 */

import { deepStrictEqual } from "node:assert/strict";
import { parseHTML } from "@spinjs/runtime/testing";
import type { PartScope } from "./component/define.ts";
import { bindSpread } from "./directives/spread.ts";
import {
  ariaAutocomplete,
  ariaBusy,
  ariaControls,
  ariaCurrent,
  ariaDescribedBy,
  ariaDescription,
  ariaDisabled,
  ariaHidden,
  ariaInvalid,
  ariaLabelledBy,
  ariaOrientation,
  ariaOwns,
  ariaPressed,
  ariaReadOnly,
  ariaRequired,
  ariaRoleDescription,
  comboboxInput,
  disclosureTrigger,
  listSurface,
  liveRegion,
  optionRow,
  sliderThumb,
} from "./aria.ts";

const { document } = parseHTML("<html><body></body></html>");

/** A scope that mints ids the way the runtime does. */
function scopeOf(): PartScope {
  return {
    props: {},
    context: {},
    state: "idle",
    root: () => document.createElement("div"),
    id: (part: string, slot?: unknown): string =>
      slot === undefined || slot === null
        ? `demo:${part}`
        : `demo:${part}:${String(slot)}`,
    measure: () => null,
    send: () => {},
    attr: (value: boolean): string | undefined => (value ? "" : undefined),
    slot: undefined,
  };
}

test("Given a state / When it is stated / Then the attribute carries it", () => {
  deepStrictEqual(
    ariaDisabled(true),
    { "aria-disabled": true },
    "the disabled state",
  );
  deepStrictEqual(ariaHidden(false), { "aria-hidden": false }, "the hidden state");
  deepStrictEqual(
    ariaInvalid(true),
    { "aria-invalid": true },
    "the invalid state",
  );
  deepStrictEqual(
    ariaPressed("true"),
    { "aria-pressed": "true" },
    "the pressed state",
  );
  deepStrictEqual(ariaBusy("false"), { "aria-busy": "false" }, "the busy state");
  deepStrictEqual(
    ariaRequired(true),
    { "aria-required": true },
    "the required state",
  );
  deepStrictEqual(
    ariaReadOnly(false),
    { "aria-readonly": false },
    "the read-only state",
  );
  deepStrictEqual(
    ariaCurrent("page"),
    { "aria-current": "page" },
    "the current place",
  );
  deepStrictEqual(
    ariaOrientation("vertical"),
    { "aria-orientation": "vertical" },
    "the orientation",
  );
  deepStrictEqual(
    ariaAutocomplete("both"),
    { "aria-autocomplete": "both" },
    "the completion",
  );
  deepStrictEqual(ariaRoleDescription("slide"), {
    "aria-roledescription": "slide",
  }, "the role description");
  deepStrictEqual(
    ariaDescription("a hint"),
    { "aria-description": "a hint" },
    "the description",
  );
});

test("Given a state / When it is not known / Then the attribute is there with no value", () => {
  deepStrictEqual(
    ariaDisabled(undefined),
    { "aria-disabled": undefined },
    "the disabled state",
  );
  deepStrictEqual(
    "aria-disabled" in ariaDisabled(undefined),
    true,
    "the attribute is still in the record",
  );
  deepStrictEqual(
    ariaHidden(undefined),
    { "aria-hidden": undefined },
    "the hidden state",
  );
  deepStrictEqual(
    "aria-hidden" in ariaHidden(undefined),
    true,
    "the attribute is still in the record",
  );
  deepStrictEqual(
    ariaInvalid(undefined),
    { "aria-invalid": undefined },
    "the invalid state",
  );
  deepStrictEqual(
    ariaPressed(undefined),
    { "aria-pressed": undefined },
    "the pressed state",
  );
  deepStrictEqual(
    ariaBusy(undefined),
    { "aria-busy": undefined },
    "the busy state",
  );
  deepStrictEqual(
    ariaRequired(undefined),
    { "aria-required": undefined },
    "the required state",
  );
  deepStrictEqual(
    ariaReadOnly(undefined),
    { "aria-readonly": undefined },
    "the read-only state",
  );
  deepStrictEqual(
    ariaCurrent(undefined),
    { "aria-current": undefined },
    "the current place",
  );
  deepStrictEqual(
    ariaOrientation(undefined),
    { "aria-orientation": undefined },
    "the orientation",
  );
  deepStrictEqual(
    ariaAutocomplete(undefined),
    { "aria-autocomplete": undefined },
    "the completion",
  );
  deepStrictEqual(ariaRoleDescription(undefined), {
    "aria-roledescription": undefined,
  }, "the role description");
  deepStrictEqual(
    ariaDescription(undefined),
    { "aria-description": undefined },
    "the description",
  );
});

test("Given a relation / When it names a part / Then the scope mints the id", () => {
  const scope = scopeOf();
  deepStrictEqual(
    ariaDescribedBy(scope, { part: "hint" }),
    { "aria-describedby": "demo:hint" },
    "the described-by relation",
  );
  deepStrictEqual(
    ariaLabelledBy(scope, { part: "label" }),
    { "aria-labelledby": "demo:label" },
    "the labelled-by relation",
  );
  deepStrictEqual(
    ariaControls(scope, { part: "content" }),
    { "aria-controls": "demo:content" },
    "the controls relation",
  );
  deepStrictEqual(
    ariaOwns(scope, { part: "list" }),
    { "aria-owns": "demo:list" },
    "the owns relation",
  );
});

test("Given a relation / When it names a slot / Then the scope mints the slotted id", () => {
  const scope = scopeOf();
  deepStrictEqual(
    ariaControls(scope, { part: "item", slot: "a" }),
    { "aria-controls": "demo:item:a" },
    "the controls relation",
  );
  deepStrictEqual(
    ariaLabelledBy(scope, { part: "itemGroupLabel", slot: 3 }),
    { "aria-labelledby": "demo:itemGroupLabel:3" },
    "the labelled-by relation",
  );
});

test("Given a relation / When it names ids of its own / Then they are carried as they are", () => {
  const scope = scopeOf();
  deepStrictEqual(
    ariaDescribedBy(scope, { id: "outside" }),
    { "aria-describedby": "outside" },
    "the described-by relation",
  );
  deepStrictEqual(
    ariaControls(scope, { id: "outside" }),
    { "aria-controls": "outside" },
    "the controls relation",
  );
});

test("Given a relation / When it names several parts / Then the ids are joined by a space", () => {
  const scope = scopeOf();
  deepStrictEqual(
    ariaLabelledBy(scope, {
      parts: [{ part: "label" }, { part: "valueText" }],
    }),
    { "aria-labelledby": "demo:label demo:valueText" },
    "the labelled-by relation",
  );
  deepStrictEqual(
    ariaControls(scope, {
      parts: [{ part: "panel", slot: "a" }, { part: "panel", slot: "b" }],
    }),
    { "aria-controls": "demo:panel:a demo:panel:b" },
    "the controls relation",
  );
});

test("Given a relation / When it names nothing / Then the attribute is there with no value", () => {
  const scope = scopeOf();
  deepStrictEqual(ariaDescribedBy(scope, undefined), {
    "aria-describedby": undefined,
  }, "the described-by relation");
  deepStrictEqual(
    "aria-describedby" in ariaDescribedBy(scope, undefined),
    true,
    "the attribute is still in the record",
  );
  deepStrictEqual(ariaLabelledBy(scope, undefined), {
    "aria-labelledby": undefined,
  }, "the labelled-by relation");
  deepStrictEqual(
    ariaControls(scope, undefined),
    { "aria-controls": undefined },
    "the controls relation",
  );
  deepStrictEqual(
    ariaOwns(scope, undefined),
    { "aria-owns": undefined },
    "the owns relation",
  );
});

test("Given a live region / When it says everything / Then the region is stated", () => {
  deepStrictEqual(
    liveRegion({ live: "polite", atomic: "false", relevant: "additions text" }),
    {
      "aria-live": "polite",
      "aria-atomic": "false",
      "aria-relevant": "additions text",
    },
    "the region",
  );
});

test("Given a live region / When it says one thing / Then the rest is not in the record", () => {
  const region = liveRegion({ atomic: true });
  deepStrictEqual(
    region,
    { "aria-atomic": true },
    "only the atomic state is stated",
  );
  deepStrictEqual(
    "aria-live" in region,
    false,
    "the live state is not in the record",
  );
  deepStrictEqual(
    "aria-relevant" in region,
    false,
    "the relevant state is not in the record",
  );
});

test("Given a trigger / When it opens a region / Then the trigger is stated", () => {
  const scope = scopeOf();
  deepStrictEqual(
    disclosureTrigger(scope, {
      expanded: true,
      hasPopup: "listbox",
      controls: { part: "content" },
    }),
    {
      "aria-expanded": true,
      "aria-haspopup": "listbox",
      "aria-controls": "demo:content",
    },
    "the trigger",
  );
});

test("Given a trigger / When it states one thing / Then the rest is not in the record", () => {
  const scope = scopeOf();
  const trigger = disclosureTrigger(scope, { expanded: false });
  deepStrictEqual(
    trigger,
    { "aria-expanded": false },
    "only the expanded state is stated",
  );
  deepStrictEqual(
    "aria-haspopup" in trigger,
    false,
    "the popup kind is not in the record",
  );
  deepStrictEqual(
    "aria-controls" in trigger,
    false,
    "the controlled region is not in the record",
  );
});

test("Given a trigger / When it opens no region / Then the attribute is there with no value", () => {
  const scope = scopeOf();
  const trigger = disclosureTrigger(scope, {
    expanded: false,
    controls: undefined,
  });
  deepStrictEqual(
    trigger["aria-controls"],
    undefined,
    "the controlled region has no value",
  );
  deepStrictEqual(
    "aria-controls" in trigger,
    true,
    "the attribute is still in the record",
  );
});

test("Given a list surface / When it holds rows / Then the surface is stated", () => {
  const scope = scopeOf();
  deepStrictEqual(
    listSurface(scope, {
      labelledBy: { part: "label" },
      activeDescendant: { part: "item", slot: "a" },
      multiSelectable: true,
      required: false,
      readOnly: false,
    }),
    {
      "aria-labelledby": "demo:label",
      "aria-activedescendant": "demo:item:a",
      "aria-multiselectable": true,
      "aria-required": false,
      "aria-readonly": false,
    },
    "the surface",
  );
});

test("Given a list surface / When it states one thing / Then the rest is not in the record", () => {
  const scope = scopeOf();
  const surface = listSurface(scope, { labelledBy: { part: "label" } });
  deepStrictEqual(
    surface,
    { "aria-labelledby": "demo:label" },
    "only the name is stated",
  );
  deepStrictEqual(
    "aria-activedescendant" in surface,
    false,
    "the active row is not in the record",
  );
  deepStrictEqual(
    "aria-multiselectable" in surface,
    false,
    "the selection state is not in the record",
  );
  deepStrictEqual(
    "aria-required" in surface,
    false,
    "the required state is not in the record",
  );
  deepStrictEqual(
    "aria-readonly" in surface,
    false,
    "the read-only state is not in the record",
  );
});

test("Given a list surface / When no row is active / Then the attribute is there with no value", () => {
  const scope = scopeOf();
  const surface = listSurface(scope, { activeDescendant: undefined });
  deepStrictEqual(
    surface["aria-activedescendant"],
    undefined,
    "the active row has no value",
  );
  deepStrictEqual(
    "aria-activedescendant" in surface,
    true,
    "the attribute is still in the record",
  );
});

test("Given a combobox field / When it completes what is typed / Then the field is stated", () => {
  const scope = scopeOf();
  deepStrictEqual(
    comboboxInput(scope, {
      autocomplete: "list",
      controls: { part: "content" },
      expanded: false,
      activeDescendant: { part: "item", slot: "a" },
    }),
    {
      "aria-autocomplete": "list",
      "aria-controls": "demo:content",
      "aria-expanded": false,
      "aria-activedescendant": "demo:item:a",
    },
    "the field",
  );
});

test("Given a combobox field / When it states one thing / Then the rest is not in the record", () => {
  const scope = scopeOf();
  const field = comboboxInput(scope, { autocomplete: "none" });
  deepStrictEqual(
    field,
    { "aria-autocomplete": "none" },
    "only the completion is stated",
  );
  deepStrictEqual(
    "aria-controls" in field,
    false,
    "the controlled region is not in the record",
  );
  deepStrictEqual(
    "aria-expanded" in field,
    false,
    "the expanded state is not in the record",
  );
  deepStrictEqual(
    "aria-activedescendant" in field,
    false,
    "the active row is not in the record",
  );
});

test("Given a thumb / When it rides a range / Then the thumb is stated", () => {
  deepStrictEqual(
    sliderThumb({ min: "0", max: "100", now: "42", text: "42 percent" }),
    {
      "aria-valuemin": "0",
      "aria-valuemax": "100",
      "aria-valuenow": "42",
      "aria-valuetext": "42 percent",
    },
    "the thumb",
  );
});

test("Given a thumb / When the range has no ends / Then the attribute is there with no value", () => {
  const thumb = sliderThumb({ min: undefined, now: 42 });
  deepStrictEqual(
    thumb["aria-valuemin"],
    undefined,
    "the lowest value has no value",
  );
  deepStrictEqual(
    "aria-valuemin" in thumb,
    true,
    "the attribute is still in the record",
  );
  deepStrictEqual(
    thumb["aria-valuenow"],
    42,
    "the value the thumb sits at is a number",
  );
  deepStrictEqual(
    "aria-valuemax" in thumb,
    false,
    "the highest value is not in the record",
  );
  deepStrictEqual(
    "aria-valuetext" in thumb,
    false,
    "the heard value is not in the record",
  );
});

test("Given a row / When it sits in a set / Then the row is stated", () => {
  deepStrictEqual(
    optionRow({
      selected: true,
      checked: "false",
      posInSet: 2,
      setSize: 5,
      level: 1,
      disabled: false,
    }),
    {
      "aria-selected": true,
      "aria-checked": "false",
      "aria-posinset": 2,
      "aria-setsize": 5,
      "aria-level": 1,
      "aria-disabled": false,
    },
    "the row",
  );
});

test("Given a row / When it states one thing / Then the rest is not in the record", () => {
  const row = optionRow({ selected: false });
  deepStrictEqual(row, { "aria-selected": false }, "only the selection is stated");
  deepStrictEqual(
    "aria-checked" in row,
    false,
    "the checked state is not in the record",
  );
  deepStrictEqual(
    "aria-posinset" in row,
    false,
    "the place in the set is not in the record",
  );
  deepStrictEqual(
    "aria-setsize" in row,
    false,
    "the size of the set is not in the record",
  );
  deepStrictEqual("aria-level" in row, false, "the depth is not in the record");
  deepStrictEqual(
    "aria-disabled" in row,
    false,
    "the unavailable state is not in the record",
  );
});

test("Given a fragment / When the framework writes it / Then an attribute with no value is dropped", () => {
  const el = document.createElement("div");
  document.body.appendChild(el);
  bindSpread(el, () => ({
    ...disclosureTrigger(scopeOf(), {
      expanded: false,
      hasPopup: "dialog",
      controls: undefined,
    }),
  }));
  deepStrictEqual(
    el.getAttribute("aria-expanded"),
    "false",
    "a state is written as it reads",
  );
  deepStrictEqual(
    el.getAttribute("aria-haspopup"),
    "dialog",
    "the popup kind is written",
  );
  deepStrictEqual(
    el.getAttribute("aria-controls"),
    null,
    "an attribute with no value is dropped",
  );
});

test("Given a primitive / When a part spreads it / Then it sits beside the part's own attributes", () => {
  const scope = scopeOf();
  const bag: Record<string, unknown> = {
    ...disclosureTrigger(scope, {
      expanded: scope.state === "open",
      hasPopup: "dialog",
      controls: { part: "content" },
    }),
    id: scope.id("trigger"),
  };
  deepStrictEqual(
    bag["aria-expanded"],
    false,
    "the trigger states the region is shut",
  );
  deepStrictEqual(
    bag["aria-haspopup"],
    "dialog",
    "and the kind of popup it opens",
  );
  deepStrictEqual(bag["aria-controls"], "demo:content", "and the region it opens");
  deepStrictEqual(
    bag["id"],
    "demo:trigger",
    "and the part keeps its own attributes",
  );
});

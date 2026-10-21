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

import { assertEquals } from "@std/assert";
import { parseHTML } from "@spin/runtime/testing";
import type { PartScope } from "./component/define.ts";
import { bindSpread } from "./directives/spread.ts";
import {
  ariaAutocomplete,
  ariaBusy,
  ariaControls,
  ariaCurrent,
  ariaDescription,
  ariaDescribedBy,
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

Deno.test("Given a state / When it is stated / Then the attribute carries it", () => {
  assertEquals(ariaDisabled(true), { "aria-disabled": true }, "the disabled state");
  assertEquals(ariaHidden(false), { "aria-hidden": false }, "the hidden state");
  assertEquals(ariaInvalid(true), { "aria-invalid": true }, "the invalid state");
  assertEquals(ariaPressed("true"), { "aria-pressed": "true" }, "the pressed state");
  assertEquals(ariaBusy("false"), { "aria-busy": "false" }, "the busy state");
  assertEquals(ariaRequired(true), { "aria-required": true }, "the required state");
  assertEquals(ariaReadOnly(false), { "aria-readonly": false }, "the read-only state");
  assertEquals(ariaCurrent("page"), { "aria-current": "page" }, "the current place");
  assertEquals(ariaOrientation("vertical"), { "aria-orientation": "vertical" }, "the orientation");
  assertEquals(ariaAutocomplete("both"), { "aria-autocomplete": "both" }, "the completion");
  assertEquals(ariaRoleDescription("slide"), { "aria-roledescription": "slide" }, "the role description");
  assertEquals(ariaDescription("a hint"), { "aria-description": "a hint" }, "the description");
});

Deno.test("Given a state / When it is not known / Then the attribute is there with no value", () => {
  assertEquals(ariaDisabled(undefined), { "aria-disabled": undefined }, "the disabled state");
  assertEquals("aria-disabled" in ariaDisabled(undefined), true, "the attribute is still in the record");
  assertEquals(ariaHidden(undefined), { "aria-hidden": undefined }, "the hidden state");
  assertEquals("aria-hidden" in ariaHidden(undefined), true, "the attribute is still in the record");
  assertEquals(ariaInvalid(undefined), { "aria-invalid": undefined }, "the invalid state");
  assertEquals(ariaPressed(undefined), { "aria-pressed": undefined }, "the pressed state");
  assertEquals(ariaBusy(undefined), { "aria-busy": undefined }, "the busy state");
  assertEquals(ariaRequired(undefined), { "aria-required": undefined }, "the required state");
  assertEquals(ariaReadOnly(undefined), { "aria-readonly": undefined }, "the read-only state");
  assertEquals(ariaCurrent(undefined), { "aria-current": undefined }, "the current place");
  assertEquals(ariaOrientation(undefined), { "aria-orientation": undefined }, "the orientation");
  assertEquals(ariaAutocomplete(undefined), { "aria-autocomplete": undefined }, "the completion");
  assertEquals(ariaRoleDescription(undefined), { "aria-roledescription": undefined }, "the role description");
  assertEquals(ariaDescription(undefined), { "aria-description": undefined }, "the description");
});

Deno.test("Given a relation / When it names a part / Then the scope mints the id", () => {
  const scope = scopeOf();
  assertEquals(
    ariaDescribedBy(scope, { part: "hint" }),
    { "aria-describedby": "demo:hint" },
    "the described-by relation",
  );
  assertEquals(
    ariaLabelledBy(scope, { part: "label" }),
    { "aria-labelledby": "demo:label" },
    "the labelled-by relation",
  );
  assertEquals(
    ariaControls(scope, { part: "content" }),
    { "aria-controls": "demo:content" },
    "the controls relation",
  );
  assertEquals(
    ariaOwns(scope, { part: "list" }),
    { "aria-owns": "demo:list" },
    "the owns relation",
  );
});

Deno.test("Given a relation / When it names a slot / Then the scope mints the slotted id", () => {
  const scope = scopeOf();
  assertEquals(
    ariaControls(scope, { part: "item", slot: "a" }),
    { "aria-controls": "demo:item:a" },
    "the controls relation",
  );
  assertEquals(
    ariaLabelledBy(scope, { part: "itemGroupLabel", slot: 3 }),
    { "aria-labelledby": "demo:itemGroupLabel:3" },
    "the labelled-by relation",
  );
});

Deno.test("Given a relation / When it names ids of its own / Then they are carried as they are", () => {
  const scope = scopeOf();
  assertEquals(
    ariaDescribedBy(scope, { id: "outside" }),
    { "aria-describedby": "outside" },
    "the described-by relation",
  );
  assertEquals(
    ariaControls(scope, { id: "outside" }),
    { "aria-controls": "outside" },
    "the controls relation",
  );
});

Deno.test("Given a relation / When it names several parts / Then the ids are joined by a space", () => {
  const scope = scopeOf();
  assertEquals(
    ariaLabelledBy(scope, { parts: [{ part: "label" }, { part: "valueText" }] }),
    { "aria-labelledby": "demo:label demo:valueText" },
    "the labelled-by relation",
  );
  assertEquals(
    ariaControls(scope, { parts: [{ part: "panel", slot: "a" }, { part: "panel", slot: "b" }] }),
    { "aria-controls": "demo:panel:a demo:panel:b" },
    "the controls relation",
  );
});

Deno.test("Given a relation / When it names nothing / Then the attribute is there with no value", () => {
  const scope = scopeOf();
  assertEquals(ariaDescribedBy(scope, undefined), { "aria-describedby": undefined }, "the described-by relation");
  assertEquals("aria-describedby" in ariaDescribedBy(scope, undefined), true, "the attribute is still in the record");
  assertEquals(ariaLabelledBy(scope, undefined), { "aria-labelledby": undefined }, "the labelled-by relation");
  assertEquals(ariaControls(scope, undefined), { "aria-controls": undefined }, "the controls relation");
  assertEquals(ariaOwns(scope, undefined), { "aria-owns": undefined }, "the owns relation");
});

Deno.test("Given a live region / When it says everything / Then the region is stated", () => {
  assertEquals(
    liveRegion({ live: "polite", atomic: "false", relevant: "additions text" }),
    {
      "aria-live": "polite",
      "aria-atomic": "false",
      "aria-relevant": "additions text",
    },
    "the region",
  );
});

Deno.test("Given a live region / When it says one thing / Then the rest is not in the record", () => {
  const region = liveRegion({ atomic: true });
  assertEquals(region, { "aria-atomic": true }, "only the atomic state is stated");
  assertEquals("aria-live" in region, false, "the live state is not in the record");
  assertEquals("aria-relevant" in region, false, "the relevant state is not in the record");
});

Deno.test("Given a trigger / When it opens a region / Then the trigger is stated", () => {
  const scope = scopeOf();
  assertEquals(
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

Deno.test("Given a trigger / When it states one thing / Then the rest is not in the record", () => {
  const scope = scopeOf();
  const trigger = disclosureTrigger(scope, { expanded: false });
  assertEquals(trigger, { "aria-expanded": false }, "only the expanded state is stated");
  assertEquals("aria-haspopup" in trigger, false, "the popup kind is not in the record");
  assertEquals("aria-controls" in trigger, false, "the controlled region is not in the record");
});

Deno.test("Given a trigger / When it opens no region / Then the attribute is there with no value", () => {
  const scope = scopeOf();
  const trigger = disclosureTrigger(scope, { expanded: false, controls: undefined });
  assertEquals(trigger["aria-controls"], undefined, "the controlled region has no value");
  assertEquals("aria-controls" in trigger, true, "the attribute is still in the record");
});

Deno.test("Given a list surface / When it holds rows / Then the surface is stated", () => {
  const scope = scopeOf();
  assertEquals(
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

Deno.test("Given a list surface / When it states one thing / Then the rest is not in the record", () => {
  const scope = scopeOf();
  const surface = listSurface(scope, { labelledBy: { part: "label" } });
  assertEquals(surface, { "aria-labelledby": "demo:label" }, "only the name is stated");
  assertEquals("aria-activedescendant" in surface, false, "the active row is not in the record");
  assertEquals("aria-multiselectable" in surface, false, "the selection state is not in the record");
  assertEquals("aria-required" in surface, false, "the required state is not in the record");
  assertEquals("aria-readonly" in surface, false, "the read-only state is not in the record");
});

Deno.test("Given a list surface / When no row is active / Then the attribute is there with no value", () => {
  const scope = scopeOf();
  const surface = listSurface(scope, { activeDescendant: undefined });
  assertEquals(surface["aria-activedescendant"], undefined, "the active row has no value");
  assertEquals("aria-activedescendant" in surface, true, "the attribute is still in the record");
});

Deno.test("Given a combobox field / When it completes what is typed / Then the field is stated", () => {
  const scope = scopeOf();
  assertEquals(
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

Deno.test("Given a combobox field / When it states one thing / Then the rest is not in the record", () => {
  const scope = scopeOf();
  const field = comboboxInput(scope, { autocomplete: "none" });
  assertEquals(field, { "aria-autocomplete": "none" }, "only the completion is stated");
  assertEquals("aria-controls" in field, false, "the controlled region is not in the record");
  assertEquals("aria-expanded" in field, false, "the expanded state is not in the record");
  assertEquals("aria-activedescendant" in field, false, "the active row is not in the record");
});

Deno.test("Given a thumb / When it rides a range / Then the thumb is stated", () => {
  assertEquals(
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

Deno.test("Given a thumb / When the range has no ends / Then the attribute is there with no value", () => {
  const thumb = sliderThumb({ min: undefined, now: 42 });
  assertEquals(thumb["aria-valuemin"], undefined, "the lowest value has no value");
  assertEquals("aria-valuemin" in thumb, true, "the attribute is still in the record");
  assertEquals(thumb["aria-valuenow"], 42, "the value the thumb sits at is a number");
  assertEquals("aria-valuemax" in thumb, false, "the highest value is not in the record");
  assertEquals("aria-valuetext" in thumb, false, "the heard value is not in the record");
});

Deno.test("Given a row / When it sits in a set / Then the row is stated", () => {
  assertEquals(
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

Deno.test("Given a row / When it states one thing / Then the rest is not in the record", () => {
  const row = optionRow({ selected: false });
  assertEquals(row, { "aria-selected": false }, "only the selection is stated");
  assertEquals("aria-checked" in row, false, "the checked state is not in the record");
  assertEquals("aria-posinset" in row, false, "the place in the set is not in the record");
  assertEquals("aria-setsize" in row, false, "the size of the set is not in the record");
  assertEquals("aria-level" in row, false, "the depth is not in the record");
  assertEquals("aria-disabled" in row, false, "the unavailable state is not in the record");
});

Deno.test("Given a fragment / When the framework writes it / Then an attribute with no value is dropped", () => {
  const el = document.createElement("div");
  document.body.appendChild(el);
  bindSpread(el, () => ({
    ...disclosureTrigger(scopeOf(), {
      expanded: false,
      hasPopup: "dialog",
      controls: undefined,
    }),
  }));
  assertEquals(el.getAttribute("aria-expanded"), "false", "a state is written as it reads");
  assertEquals(el.getAttribute("aria-haspopup"), "dialog", "the popup kind is written");
  assertEquals(el.getAttribute("aria-controls"), null, "an attribute with no value is dropped");
});

Deno.test("Given a primitive / When a part spreads it / Then it sits beside the part's own attributes", () => {
  const scope = scopeOf();
  const bag: Record<string, unknown> = {
    ...disclosureTrigger(scope, {
      expanded: scope.state === "open",
      hasPopup: "dialog",
      controls: { part: "content" },
    }),
    id: scope.id("trigger"),
  };
  assertEquals(bag["aria-expanded"], false, "the trigger states the region is shut");
  assertEquals(bag["aria-haspopup"], "dialog", "and the kind of popup it opens");
  assertEquals(bag["aria-controls"], "demo:content", "and the region it opens");
  assertEquals(bag["id"], "demo:trigger", "and the part keeps its own attributes");
});

/**
 * Fieldset examples — the markup a consumer writes, beside the rule that
 * styles it.
 *
 * A bare `<fieldset>` groups related fields; `disabled` on the fieldset
 * disables all of them at once — the platform does the disabling. The
 * legend reads as the group's name. Grouping semantics come from
 * `role="group"`, not a class: there is no `group` class.
 */

export interface FieldsetExample {
  /** What this example is showing. Rendered as the row's label. */
  readonly name: string;
  /** The markup, exactly as a consumer would write it. */
  readonly html: string;
}

export const fieldsetFixtureNote =
  "A fieldset groups related fields and disables all of them at once — " +
  "the platform does the disabling, so the only thing to state is that " +
  "a legend reads as the group's name.";

export const FIELDSET_EXAMPLES: readonly FieldsetExample[] = [
  {
    name: "A group",
    html:
      `        <fieldset>
          <legend>Shipping</legend>
          <label><input type="text" placeholder="Full name"><span>Name</span></label>
          <label><input type="text" placeholder="Street"><span>Address</span></label>
        </fieldset>`,
  },
  {
    name: "Disabled as one",
    html:
      `        <fieldset disabled>
          <legend>Unavailable</legend>
          <label><input type="text" value="Cannot touch"><span>Name</span></label>
        </fieldset>`,
  },
];

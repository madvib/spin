/**
 * Fieldset examples — the markup a consumer writes, beside the rule that
 * styles it.
 *
 * A bare `<fieldset>` groups related fields; `disabled` on the fieldset
 * disables all of them at once — the platform does the disabling. The
 * legend reads as the group's name. Grouping semantics come from
 * `role="group"`, not a class: there is no `group` class.
 *
 * The group's own box is drawn by utilities on the element, because spin
 * claims no `fieldset` variant: a class named `group` would displace the
 * `role=group` primitive's rules, and the element selector is the one hook
 * that collides with nothing.
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
      `        <fieldset class="flex flex-col gap-2 rounded-md border border-solid border-border p-4">
          <legend class="px-2 text-sm font-semibold">Shipping</legend>
          <label><input type="text" placeholder="Full name"><span>Name</span></label>
          <label><input type="text" placeholder="Street"><span>Address</span></label>
        </fieldset>`,
  },
  {
    name: "Disabled as one",
    html:
      `        <fieldset class="flex flex-col gap-2 rounded-md border border-solid border-border p-4" disabled>
          <legend class="px-2 text-sm font-semibold">Unavailable</legend>
          <label><input type="text" value="Cannot touch"><span>Name</span></label>
        </fieldset>`,
  },
];

import type { ClassDoc } from "./example.ts";

export interface FieldsetExample {
  /** What this example is showing. Rendered as the row's label. */
  readonly name: string;
  /** The markup, exactly as a consumer would write it. */
  readonly html: string;
}

export const fieldsetFixtureNote =
  "A fieldset groups related fields and disables them at once; the legend reads as the group's name.";

export const FIELDSET_CLASSES: readonly ClassDoc[] = [
  {
    name: "<fieldset>",
    kind: "Component",
    description: "Grouping box; flex column with the field box's border, radius, and spacing",
  },
  {
    name: "<legend>",
    kind: "Part",
    description: "Group name on the border; semibold small type with side padding",
  },
  {
    name: "disabled",
    kind: "Behavior",
    description: "Disables every control inside at once; the platform does the disabling",
  },
];

export const FIELDSET_EXAMPLES: readonly FieldsetExample[] = [
  {
    name: "Notification preferences",
    html:
      `        <fieldset>
          <legend><i class="i-lucide-bell" aria-hidden="true"></i>Notify me about</legend>
          <label><input type="checkbox" checked><span>Deploys to eu-west-1</span></label>
          <label><input type="checkbox"><span>Failed health checks</span></label>
          <label><input type="checkbox"><span>Weekly changelog</span></label>
        </fieldset>`,
  },
  {
    name: "Release channel",
    html:
      `        <fieldset>
          <legend><i class="i-lucide-rocket" aria-hidden="true"></i>Release channel<badge variant="primary">stable</badge></legend>
          <label><input type="radio" name="channel" checked><span>Stable · v4.12.0</span></label>
          <label><input type="radio" name="channel"><span>Beta · v4.12.1-rc2</span></label>
          <label><input type="radio" name="channel"><span>Nightly</span></label>
        </fieldset>`,
  },
  {
    name: "Locked while deploying",
    html:
      `        <fieldset disabled>
          <legend><i class="i-lucide-lock" aria-hidden="true"></i>Locked while a deploy runs</legend>
          <label><input type="text" value="checkout-api"><span>Service</span></label>
          <label><input type="range" value="10"><span>Canary traffic</span></label>
        </fieldset>`,
  },
];

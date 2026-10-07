/**
 * The showcase fixtures — one entry per tag, not per component.
 *
 * Organizing by tag is the same discipline the rules use: a tag is the unit a
 * consumer writes, so it is the unit worth demonstrating. A page per
 * component would put a switch and a checkbox together because they are both
 * "form controls", which is a grouping a consumer never asks for.
 *
 * Every entry carries the examples it should show, because a primitive with no
 * examples is a primitive nobody can use: the variants, the states and the
 * sizes are the contract, and seeing them side by side is how the contract is
 * checked.
 */

export interface Example {
  /** What this example is showing. Rendered as the row's label. */
  readonly name: string;
  /** The markup, exactly as a consumer would write it. */
  readonly html: string;
}

export interface Fixture {
  /** The route. Also the tag the rules claim. */
  readonly id: string;
  readonly title: string;
  /** Rule or shortcut — why it is authored that way. */
  readonly kind: string;
  readonly note: string;
  /** The examples, each with its own heading. */
  readonly examples: readonly Example[];
  /** State that is a DOM property rather than an attribute. */
  readonly onLoad?: string;
}

// A badge's shape is `<badge>`; its tone is a utility the badge spends. That
// split is the whole API — the component says what shape it is, the tone says
// what it is wearing, and neither restates the other.
const badge = (label: string, tone = "") =>
  `<badge${tone ? ` class="${tone}"` : ""}>${label}</badge>`;

/** A label wrapping a control, which is how a consumer writes one. */
const field = (label: string, control: string) =>
  `<label class="field">${control}<span>${label}</span></label>`;

const labelled = (control: string, text: string) =>
  `<label class="control">${control}<span>${text}</span></label>`;

export const FIXTURES: readonly Fixture[] = [
  {
    id: "label",
    title: "Label",
    kind: "alias",
    note:
      "Names a field and is clickable, so it takes a cursor and inherits the " +
      "type it sits beside rather than stating a size of its own.",
    examples: [
      {
        name: "Naming a control",
        html: `<div>
          <label class="field">
            <input type="text" placeholder="you@example.com">
            <span>Email address</span>
          </label>
        </div>`,
      },
    ],
  },
  {
    id: "fieldset",
    title: "Fieldset & legend",
    kind: "alias",
    note:
      "Groups related fields and disables all of them at once — the platform " +
      "does the disabling, so the only thing to state is that a legend reads " +
      "as the group's name.",
    examples: [
      {
        name: "A group",
        html: `<fieldset class="group">
          <legend>Shipping</legend>
          ${field("Name", '<input type="text" placeholder="Full name">')}
          ${field("Address", '<input type="text" placeholder="Street">')}
        </fieldset>`,
      },
      {
        name: "Disabled as one",
        html: `<fieldset class="group" disabled>
          <legend>Unavailable</legend>
          ${field("Name", '<input type="text" value="Cannot touch">')}
        </fieldset>`,
      },
    ],
  },
  {
    id: "details",
    title: "Details",
    kind: "rule",
    note:
      "A native element with a real open state, so it needs no JavaScript " +
      "and still works with scripting disabled. The platform's triangle is " +
      "replaced with a chevron that rotates rather than one that swaps, " +
      "because a turning indicator reads as open or closed without the " +
      "reader parsing the angle — and it scales with the type.",
    examples: [
      {
        name: "Closed and open",
        html: `<div>
          <details>
            <summary>What is this component?</summary>
            <p>A disclosure. The body is inset from the label so the content reads as belonging to it.</p>
          </details>
          <details open>
            <summary>Does it need JavaScript?</summary>
            <p>No. The platform owns the behaviour; this component owns only the surface.</p>
          </details>
        </div>`,
      },
      {
        name: "Several together",
        html: `<div>
          <details>
            <summary>Keyboard</summary>
            <p>Summable, so it is reachable and operable without a pointer.</p>
          </details>
          <details>
            <summary>Screen readers</summary>
            <p>Announced through the native role and state.</p>
          </details>
          <details>
            <summary>Disabled scripting</summary>
            <p>Still opens. Nothing here depends on it.</p>
          </details>
        </div>`,
      },
    ],
  },
];

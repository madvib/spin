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
    id: "badge",
    title: "Badge",
    kind: "rule",
    note:
      "The smallest component there is. A rule rather than a shortcut, because " +
      "a shortcut emits a class selector and the surface is tags. The base and " +
      "each colour are separate tokens, so a page using none of them pays only " +
      "for the base. A variant is sugar over a character token: the same " +
      "mechanism, so setting the token yourself is equivalent.",
    examples: [
      {
        name: "Variants",
        html: `<div class="flex flex-wrap items-center gap-2">
          ${badge("default")}${badge("primary", "badge-primary")}
          ${badge("neutral", "badge-neutral")}${badge("secondary", "badge-secondary")}
          ${badge("accent", "badge-accent")}${badge("success", "badge-success")}
          ${badge("warning", "badge-warning")}${badge("danger", "badge-danger")}
        </div>`,
      },
      {
        name: "Muted",
        html: `<div class="flex flex-wrap items-center gap-2">
          ${badge("neutral", "badge-neutral-muted")}
          ${badge("secondary", "badge-secondary-muted")}
          ${badge("accent", "badge-accent-muted")}
          ${badge("success", "badge-success-muted")}
          ${badge("warning", "badge-warning-muted")}
          ${badge("danger", "badge-danger-muted")}
        </div>`,
      },
      {
        name: "Sizes",
        html: `<div class="flex flex-wrap items-center gap-2">
          <badge class="badge-sm">small</badge>
          <badge>medium</badge>
          <badge class="badge-lg">large</badge>
        </div>`,
      },
      {
        name: "By variant attribute",
        html: `<div class="flex flex-wrap items-center gap-2">
          <badge variant="primary">primary</badge>
          <badge variant="danger-muted">danger muted</badge>
          <badge variant="sm">small</badge>
        </div>`,
      },
      {
        name: "With content",
        html: `<div>
          ${badge("New")}${badge("3 items", "badge-accent")}
        </div>`,
      },
      {
        name: "With a remove action",
        html: `<div class="flex flex-wrap items-center gap-2">
          <badge>Item <button class="badge-close" aria-label="remove">×</button></badge>
          <badge class="badge-accent">Tag <button class="badge-close" aria-label="remove">×</button></badge>
        </div>`,
      },
      {
        name: "With an icon",
        html: `<div class="flex flex-wrap items-center gap-2">
          <badge><i class="i-lucide-bell"></i>Notifications</badge>
          <badge class="badge-accent"><i class="i-lucide-check"></i>Done</badge>
        </div>`,
      },
      {
        name: "In text",
        html:
          `<p>Press the <badge class="badge-primary">New</badge> button to continue.</p>`,
      },
      {
        name: "In a button",
        html:
          `<button class="btn">Inbox <badge class="badge-accent">3</badge></button>`,
      },
    ],
  },
  {
    id: "card",
    title: "Card",
    kind: "rule",
    note:
      "Seven parts, each its own tag and its own token, so an unused part " +
      "costs nothing. Composition happens in the markup — a shortcut cannot " +
      "include a rule, and the footer holds classless buttons.",
    examples: [
      {
        name: "Every part",
        html: `<card class="card-narrow">
          <card-header>
            <card-title>Card Title</card-title>
            <card-description>Card Description</card-description>
            <card-action>${badge("New")}</card-action>
          </card-header>
          <card-content>
            <p>Card content. Seven parts, each its own tag.</p>
          </card-content>
          <card-footer>
            <button>Save</button><button class="ghost">Cancel</button>
          </card-footer>
        </card>`,
      },
      {
        name: "Content only",
        html: `<card class="card-narrow">
          <card-content>
            <p>A card needs no header or footer to be a card.</p>
          </card-content>
        </card>`,
      },
    ],
  },
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
  {
    id: "group",
    title: "Group",
    kind: "rule",
    note:
      "The one relationship no utility can express. A group's children flatten " +
      "each other's corners and their borders collapse into one seam, which " +
      "needs a selector that reaches into a sibling the author never named. " +
      "The radius is set on the group and unset on the children, so changing it " +
      "once changes every position.",
    examples: [
      {
        name: "Joined",
        html: `<div role="group">
          <button>First</button>
          <button class="secondary">Second</button>
          <button class="secondary">Third</button>
        </div>`,
      },
      {
        name: "A wrapping group opts out of the seam",
        html: `<div role="group" data-wrap>
          <button>One</button>
          <button class="secondary">Two</button>
          <button class="secondary">Three</button>
          <button class="secondary">Four</button>
          <button class="secondary">Five</button>
        </div>`,
      },
    ],
  },
  {
    id: "prose",
    title: "Prose",
    kind: "rule",
    note:
      "Headings, rhythm, lists, quotes and code, styled globally because the " +
      "tag IS the contract — and where we disagree with the platform on " +
      "purpose, we say so in a token rather than a utility. The prose " +
      "container only constrains measure.",
    examples: [
      {
        name: "Content tags",
        html: `<article>
          <h1>A heading</h1>
          <p>Body text with a <a href="#">link</a> and some <code>inline code</code>.</p>
          <ul><li>Unordered</li><li>Items</li></ul>
          <blockquote>A quotation.<footer>Attribution</footer></blockquote>
          <pre><code>preformatted</code></pre>
        </article>`,
      },
      {
        name: "A constrained measure",
        html: `<prose>
          <h2>Prose</h2>
          <p>The same content, at a comfortable measure. The container states
          nothing but width — every tag keeps whatever it does elsewhere.</p>
        </prose>`,
      },
    ],
  },
];

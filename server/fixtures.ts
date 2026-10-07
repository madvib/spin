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
    id: "table",
    title: "Table",
    kind: "rule",
    note:
      "The first primitive with a strong opinion, and the three are the ones " +
      "a consumer is better served by not having to make: figures line up on " +
      "the digit, the header stays put when the table scrolls, and cells are " +
      "separated by a rule rather than boxed. A table that disagrees with " +
      "these takes one class and gets the element as the browser draws it.",
    examples: [
      {
        name: "Figures align",
        html: `<table>
          <caption>Q3 by region</caption>
          <thead>
            <tr>
              <th scope="col">Region</th>
              <th scope="col">Units</th>
              <th scope="col">Revenue</th>
              <th scope="col">Change</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>North</td><td>1,204</td><td>18,400</td><td>+12%</td></tr>
            <tr><td>South</td><td>987</td><td>14,910</td><td>+4%</td></tr>
            <tr><td>East</td><td>2,310</td><td>35,120</td><td>-3%</td></tr>
            <tr><td>West</td><td>744</td><td>10,880</td><td>+21%</td></tr>
          </tbody>
        </table>`,
      },
      {
        name: "A sticky header in a scroller",
        html: `<div data-scroller>
          <table>
            <thead>
              <tr><th scope="col">Unit</th><th scope="col">ms</th></tr>
            </thead>
            <tbody>
              <tr><td>parse</td><td>2.1</td></tr>
              <tr><td>resolve</td><td>0.8</td></tr>
              <tr><td>generate</td><td>4.6</td></tr>
              <tr><td>emit</td><td>1.2</td></tr>
              <tr><td>link</td><td>9.3</td></tr>
              <tr><td>minify</td><td>3.7</td></tr>
              <tr><td>ship</td><td>0.4</td></tr>
            </tbody>
          </table>
        </div>`,
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
    id: "progress",
    title: "Progress",
    kind: "rule",
    note:
      "The one control with no cross-browser standard rendering, so each " +
      "engine's pseudo-elements are stated separately and the duplication is " +
      "the platform's cost rather than ours to tidy away. A theme with " +
      "indeterminate state gets motion — a static bar with no fill reads as a " +
      "bar that failed to load.",
    examples: [
      {
        name: "Values",
        html: `<div>
          <label class="field"><span>Complete</span>
            <progress value="100" max="100"></progress>
          </label>
          <label class="field"><span>Half</span>
            <progress value="50" max="100"></progress>
          </label>
          <label class="field"><span>Working</span>
            <progress></progress>
          </label>
        </div>`,
      },
      {
        name: "A meter · a value in a known range",
        html: `<div>
          <label class="field"><span>Disk</span>
            <meter value="0.4" min="0" max="1" low="0.3" high="0.8"></meter>
          </label>
        </div>`,
      },
    ],
  },
  {
    id: "dialog",
    title: "Dialog",
    kind: "rule",
    note:
      "The native element brings the four things a modal has to have — focus " +
      "trapped, Escape to close, the page inert, and a top-layer position — " +
      "and none of them are ours. What is ours is a card that looks like every " +
      "other card, centred and capped so it cannot outgrow the viewport.",
    onLoad:
      "document.querySelectorAll('[data-open]').forEach((b) => b.addEventListener('click', () => document.getElementById(b.dataset.open)?.showModal()));",
    examples: [
      {
        name: "Modal",
        html: `<div>
          <button data-open="confirm">Open a dialog</button>
        </div>
        <dialog id="confirm">
          <header>
            <h2>Delete this file?</h2>
            <button class="ghost" onclick="this.closest('dialog').close()">Close</button>
          </header>
          <p>The file and its history will be removed. This cannot be undone.</p>
          <footer>
            <button class="ghost" onclick="this.closest('dialog').close()">Cancel</button>
            <button class="danger">Delete</button>
          </footer>
        </dialog>`,
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
    id: "tabs",
    title: "Tabs",
    kind: "rule",
    note:
      "No JavaScript at all: radio inputs and :checked drive both the tab's " +
      "appearance and its panel's visibility. The radios stay in the " +
      "accessibility tree — collapsed to a pixel, not hidden — so the tabs " +
      "are keyboard reachable and a screen reader announces them.",
    examples: [
      {
        name: "Horizontal",
        html: `<tabs>
          <div><label><input type="radio" name="t1" checked> Overview</label><section>Panel one. Nothing here is script — the radio is checked and the panel is its sibling.</section></div>
          <div><label><input type="radio" name="t1"> Details</label><section>Panel two.</section></div>
          <div><label><input type="radio" name="t1"> Settings</label><section>Panel three.</section></div>
        </tabs>`,
      },
      {
        name: "Vertical · a structural variant",
        html: `<tabs class="tabs-vertical">
          <div><label><input type="radio" name="t2" checked> One</label><section>The rail runs down and the panel beside it.</section></div>
          <div><label><input type="radio" name="t2"> Two</label><section>Second.</section></div>
        </tabs>`,
      },
    ],
  },
  {
    id: "popover",
    title: "Popover & tooltip",
    kind: "rule",
    note:
      "The native top layer: popovertarget puts the panel above everything " +
      "without script, and light-dismiss is the platform's. A tooltip is the " +
      "same surface revealed on hover or focus, so both spend one card's " +
      "worth of CSS.",
    examples: [
      {
        name: "Popover",
        html: `<div>
          <button popovertarget="menu">Open</button>
        </div>
        <popover id="menu">Menu content</popover>`,
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

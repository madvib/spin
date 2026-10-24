/**
 * Join examples — the markup a consumer writes, beside the rule that styles
 * it.
 *
 * Join is the class-entry spelling of the joined control: a `join`
 * container whose children each carry `join-item`. It owns geometry only —
 * the buttons, the field and the select keep the paints their own rules
 * give them. Every class used here resolves against the preset's own
 * catalog; the self-resolution test fails the suite if an example
 * demonstrates what the package cannot do.
 */

export interface JoinExample {
  /** What this example is showing. Rendered as the row's label. */
  readonly name: string;
  /** The markup, exactly as a consumer would write it. */
  readonly html: string;
}

const row = (inner: string): string =>
  `<div class="flex flex-wrap items-center gap-2">
${inner}
        </div>`;

export const joinFixtureNote =
  "A join merges adjacent controls into one object: shared edges square off, the seam collapses to one border. Geometry only — each child keeps its own paint.";

export const JOIN_EXAMPLES: readonly JoinExample[] = [
  {
    name: "Join · three buttons",
    html: row(
      `          <div class="join">
            <button class="join-item">Deploy</button>
            <button class="join-item secondary">Schedule</button>
            <button class="join-item ghost">Discard</button>
          </div>`,
    ),
  },
  {
    name: "Join · search and submit",
    html: row(
      `          <div class="join">
            <input class="join-item" type="search" placeholder="Search services" aria-label="Search services">
            <button class="join-item" type="submit">Search</button>
          </div>`,
    ),
  },
  {
    name: "Join · select and apply",
    html: row(
      `          <div class="join">
            <select class="join-item" aria-label="Sort by">
              <option>Newest</option>
              <option>Oldest</option>
              <option>Duration</option>
            </select>
            <button class="join-item secondary">Apply</button>
          </div>`,
    ),
  },
  {
    name: "Join · beside a paragraph",
    html: `        <div class="flex items-center gap-2">
          <div class="join">
            <button class="join-item">Deploy</button>
            <button class="join-item secondary">Deploy and watch</button>
          </div>
          <p>The build log streams while the deploy runs.</p>
        </div>`,
  },
];

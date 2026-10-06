/**
 * The reference renderers.
 *
 * Everything here is a pure function from a manifest entry to markup. There is
 * no framework, no router, no chrome and no state, because the whole point is
 * that a component's SURFACE is generated from its contract rather than typed
 * out by hand — and a hand-written fixture is a fixture that drifts.
 *
 * Why it exists: every visual defect in this project was a state or a variant
 * that nothing rendered. A checkbox whose tick was a speck, a radio that
 * collapsed to 2px, button sizes that silently stopped being emitted — none of
 * them was caught by a test, and all of them were caught by a person looking at
 * a page. A renderer that walks the contract and produces every state removes
 * the gap between "the rule does this" and "someone can see it does this".
 */

/** One state a component declares, and the selector that produces it. */
export interface State {
  /** What the state is, in the words a person would use. */
  readonly name: string;
  /** The pseudo-class or attribute that puts the element in it. */
  readonly when: string;
  /** Extra markup the state needs — an attribute value, a child element. */
  readonly attrs?: Readonly<Record<string, string>>;
  /** Marks a state that cannot be shown in a static row. */
  readonly note?: string;
}

/** A component's surface: what it claims, what it offers, what it spends. */
export interface Surface {
  /** The component's name, as the manifest knows it. */
  readonly name: string;
  /** The tags it styles — what a consumer writes. */
  readonly tags: readonly string[];
  /** The classes it defines, split from the tags. */
  readonly variants: readonly string[];
  /** The custom properties it spends. */
  readonly reads: readonly string[];
  /** Groups this component OWNS tokens under, e.g. `button`. */
  readonly claims: readonly string[];
}

/**
 * A row of every state of one component, side by side.
 *
 * The point is not that it looks tidy. The point is that a state nobody added
 * here is a state nobody sees — and once the list is derived from the contract,
 * adding a state to a component makes it appear without anyone remembering to
 * draw it.
 */
export function stateRow(
  surface: Surface,
  states: readonly State[],
  options: { readonly markup?: (s: State) => string } = {},
): string {
  if (states.length === 0) return "";
  const cells = states.map((state) => {
    const markup = options.markup?.(state) ?? defaultMarkup(surface, state);
    return `
      <figure class="state">
        <div class="state-frame">${markup}</div>
        <figcaption>
          <span class="state-name">${escapeHtml(state.name)}</span>
          ${state.when ? `<code class="state-when">${escapeHtml(state.when)}</code>` : ""}
          ${state.note ? `<span class="state-note">${escapeHtml(state.note)}</span>` : ""}
        </figcaption>
      </figure>`;
  }).join("");
  return `<section class="states" data-component="${escapeHtml(surface.name)}">
    <h2>${escapeHtml(surface.name)}</h2>
    <div class="state-grid">${cells}
    </div>
  </section>`;
}

/**
 * The markup for one state.
 *
 * Deliberately the SIMPLEST thing that expresses the state: the component's
 * own tag, plus whatever the state needs. Anything cleverer would be the
 * fixture lying about what the component requires.
 */
function defaultMarkup(surface: Surface, state: State): string {
  const tag = surface.tags[0] ?? "div";
  const attrs = Object.entries(state.attrs ?? {})
    .map(([k, v]) => ` ${k}="${escapeHtml(v)}"`)
    .join("");
  const variant = state.when.startsWith(".")
    ? ` class="${escapeHtml(state.when.slice(1))}"`
    : "";
  return `<${tag}${variant}${attrs}>${escapeHtml(state.name)}</${tag}>`;
}

/**
 * What a component spends, split into the global scales it borrows and the
 * tokens it owns.
 *
 * The split is the useful part. A token under `--button.` is a decision this
 * component makes and a theme answers; anything else is the shared vocabulary,
 * and a component spending something odd is a thing worth seeing.
 */
export function tokenReport(surface: Surface): string {
  const own: string[] = [];
  const shared: string[] = [];
  for (const token of surface.reads) {
    const bare = token.replace(/^--/, "");
    // The theme's custom property for a component's own token is
    // `--<component>-<step>` — the DTCG path `checkbox.depth` is emitted as
    // `--checkbox-depth`, with the dot becoming a dash. Matching the DTCG form
    // here is why the split silently reported zero.
    if (surface.claims.some((c) => bare.startsWith(`${c}-`))) {
      own.push(bare);
    } else {
      shared.push(bare);
    }
  }
  return `
    <section class="tokens" data-component="${escapeHtml(surface.name)}">
      <h2>${escapeHtml(surface.name)} spends</h2>
      <h3>shared <span class="count">${shared.length}</span></h3>
      <ul class="token-list">${shared.map((t) => `<li><code>--${escapeHtml(t)}</code></li>`).join("")}</ul>
      <h3>its own <span class="count">${own.length}</span></h3>
      <ul class="token-list">${own.length === 0
        ? "<li class=\"none\">none — it spends only the shared vocabulary</li>"
        : own.map((t) => `<li><code>--${escapeHtml(t)}</code></li>`).join("")}</ul>
    </section>`;
}

/** Escape, because a token name and a label are both authored text. */
export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
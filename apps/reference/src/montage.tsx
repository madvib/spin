/**
 * THE MONTAGE — every starter theme, side by side.
 *
 * A theme is judged by what it does to the same content, so the content is
 * held still: one screen, one set of words, one set of sizes, rendered once
 * per theme. What changes between the columns is the theme and nothing else,
 * which is the only way a reader can say "this one is dull" or "this one is
 * illegible" and mean it.
 *
 * Each column carries its theme the way the app carries the theme it is
 * looking at: the `data-theme` and `data-mode` attributes the theme's own
 * stylesheet is scoped to. The app writes them on the document element; a
 * column writes them on itself, and the same rules read them there. There is
 * no second mechanism — a theme is a selector, and a subtree is a scope.
 *
 * The renderings a theme serves are shown, all of them: a theme that serves a
 * dark mode shows its light rendering and its dark one, stacked, so the two
 * faces of a theme are compared in the same column rather than across two
 * visits. A theme that serves one rendering shows that one and says which it
 * is — neobrut has no dark tokens to restate, and console's own rendering IS
 * dark.
 */

import { For, Show } from "solid-js";
import { renderingsFor, themeIsServed, THEMES } from "./themes.ts";

/* ──────────────────────────────────────────────────────────────────────────
 * THE SCREEN.
 *
 * One markup, rendered in every column. It is the screen a theme has to
 * survive: a card with its parts, a form with a field and a button, a row of
 * stats, a table of figures, an alert, a set of badges, and a paragraph of
 * real prose.
 *
 * It is written as the markup a consumer writes — the same vocabulary the
 * reference's own specimens use, and the same subject they are about — so
 * what the columns show is what a page of a spin app looks like, and not a
 * set of parts arranged for the occasion.
 *
 * Three of those parts are there because of what the primitives now do on
 * their own, and the montage is where that shows: the card's footer needs no
 * utility to wrap, the row of stats is the stat's own `stat-row`, and the
 * table sits in a scroller because a table carries a minimum — it is never
 * narrower than the content it holds, so a table too wide for the column is
 * scrolled by the box around it rather than crushing its columns.
 * ────────────────────────────────────────────────────────────────────────── */

const SCREEN_MARKUP = `<div class="flex flex-col gap-4">
<card>
  <card-header>
    <card-title>checkout-api</card-title>
    <card-description>12 instances across 3 regions</card-description>
    <card-action><badge variant="success">healthy</badge></card-action>
  </card-header>
  <card-content>
    <p>Running v4.12.0 since 09:14 UTC.</p>
  </card-content>
  <card-footer>
    <button>Deploy</button>
    <button class="ghost">Roll back</button>
  </card-footer>
</card>
<form class="flex flex-col items-start gap-2">
  <label><input type="text" value="checkout-api"><span>Service name</span></label>
  <label><input type="checkbox" checked><span>Auto-drain traffic</span></label>
  <label><input type="checkbox" role="switch" checked><span>Canary gate</span></label>
  <button>Deploy</button>
</form>
<progress value="68" max="100">68%</progress>
<div class="stat-row">
  <div class="stat">
    <div class="stat-title">Errors</div>
    <div class="stat-value">0.42%</div>
    <div class="stat-desc">24 hours</div>
  </div>
  <div class="stat">
    <div class="stat-title">p95</div>
    <div class="stat-value">214</div>
    <div class="stat-desc">24 hours</div>
  </div>
  <div class="stat">
    <div class="stat-title">Deploys</div>
    <div class="stat-value">38</div>
    <div class="stat-desc">7 days</div>
  </div>
</div>
<div class="overflow-x-auto">
  <table class="striped">
    <caption>Deploys by service, last 7 days</caption>
    <thead>
      <tr>
        <th scope="col">Service</th>
        <th scope="col">Deploys</th>
        <th scope="col" data-align="end">p95</th>
      </tr>
    </thead>
    <tbody>
      <tr><td>checkout-api</td><td>128</td><td>214</td></tr>
      <tr><td>payments</td><td>96</td><td>198</td></tr>
      <tr><td>search</td><td>61</td><td>176</td></tr>
    </tbody>
  </table>
</div>
<alert role="status" variant="accent">
  <strong>Deploy #4821 is running</strong>
  <p>Ten per cent of traffic is on v4.12.0 in eu-west-1.</p>
</alert>
<div class="flex flex-wrap items-center gap-2">
  <badge variant="primary">production</badge>
  <badge variant="accent">beta</badge>
  <badge variant="success">passing</badge>
  <badge variant="warning">degraded</badge>
</div>
<p>A rollback sends every instance back to the previous release. It takes under two minutes, and it keeps the failed release in the history.</p>
</div>`;

/* ──────────────────────────────────────────────────────────────────────────
 * THE PAGE'S OWN CLASSES.
 *
 * The chrome of the montage wears the app's own theme, so the chrome reads
 * the same across the four columns and only the screens differ. A label that
 * changed with the theme under it would make the comparison a comparison of
 * the labels.
 * ────────────────────────────────────────────────────────────────────────── */

const PAGE_HEAD = "mb-8 flex items-start justify-between gap-4";
const KIND = "type-code text-text-muted";
const BADGE =
  "shrink-0 rounded-lg border border-solid border-border bg-surface-raised px-2 py-1 type-code text-text-muted";
const LEAD = "mb-8 max-w-screen-md text-text-muted";

/**
 * The four columns, side by side, each as wide as the page allows it.
 *
 * The grid takes the page's whole width, gutters and all: four columns of a
 * screen at the page's measure do not fit inside the measure, and a montage
 * whose columns are narrower than their content is a montage measuring the
 * wrong thing. The gutter is the small step, because the columns are narrow
 * and a wide gutter would be a fifth of the screen.
 *
 * The count steps with the width, and it steps on the VIEWPORT rather than on
 * the page: the rail takes a fixed bite out of every width, so a viewport
 * that is wide enough for four columns on its own is not wide enough for
 * four columns beside the rail. One column is a page of themes read down;
 * two are compared in two rows; four are compared in one glance.
 */
const GRID =
  "-mx-8 grid grid-cols-1 items-start gap-2 md:grid-cols-2 xl:grid-cols-4";

/** One theme's column: the name, and the renderings under it. */
const COLUMN = "flex min-w-0 flex-col gap-2";
const THEME_NAME = "m-0 truncate type-body-strong";
const MODE_LABEL = "type-code text-text-muted";

/**
 * The screen's own frame.
 *
 * The padding is the page's step and not a measure of it: a screen is a
 * stage, and a stage the size of a page turns every part into a slab of
 * nothing. The surface and the ink are the THEME's own — the default ink needs
 * no naming: the column declares its own custom property, so the text that
 * nothing else painted is the theme's ink and not the app's.
 */
const SCREEN =
  "rounded-md border border-solid border-border bg-surface p-2";

/** What a column says when its theme never reached the page. */
const NOT_RENDERED =
  "rounded-md border border-dashed border-solid border-border bg-surface p-2 text-text-muted";

/* ──────────────────────────────────────────────────────────────────────────
 * THE PAGE.
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * One theme's column.
 *
 * Every theme gets one, and a theme that cannot render says so in its own
 * place rather than being left out: a column that quietly shows the app's
 * theme would be a lie about a theme nobody could see.
 */
function ThemeColumn(props: { name: string }) {
  const renderings = () => renderingsFor(props.name);
  const served = () => themeIsServed(props.name);
  return (
    <section class={COLUMN}>
      <h3 class={THEME_NAME}>{props.name}</h3>
      <Show
        when={served()}
        fallback={
          <p class={NOT_RENDERED}>
            This theme did not render: the page carries no tokens for it.
          </p>
        }
      >
        <For each={renderings()}>
          {(rendering) => (
            <div class="flex flex-col gap-1">
              <span class={MODE_LABEL}>{rendering.label}</span>
              <div
                class={SCREEN}
                data-theme={props.name}
                data-mode={rendering.mode}
                innerHTML={SCREEN_MARKUP}
              />
            </div>
          )}
        </For>
      </Show>
    </section>
  );
}

/**
 * The montage.
 *
 * The same screen in every theme, side by side, with each theme's own
 * renderings shown under its name.
 */
export function MontagePage() {
  const renderings = THEMES.reduce(
    (sum, name) => sum + renderingsFor(name).length,
    0,
  );
  return (
    <>
      <header class={PAGE_HEAD}>
        <div>
          <h2>Themes</h2>
          <div class={KIND}>
            spin reference · {THEMES.length} themes · {renderings} renderings
          </div>
        </div>
        <span class={BADGE}>{THEMES.length} themes</span>
      </header>
      <p class={LEAD}>
        Every starter theme, side by side: one screen in each, the same words at
        the same sizes, so the themes can be compared rather than admired one at
        a time. A theme that serves a dark mode shows both of its renderings.
      </p>
      <div class={GRID}>
        <For each={THEMES}>
          {(name) => <ThemeColumn name={name} />}
        </For>
      </div>
    </>
  );
}

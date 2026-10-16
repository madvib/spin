import { createMemo, For, Show } from "solid-js";
import type { JSX } from "solid-js";
import ValueInput from "../components/demos/ValueInput";
import ScaleControl from "../components/demos/ScaleControl";
import Page from "../components/Page";
import { analyzeTheme } from "../lib/theme";
import { groupTokens } from "../lib/tokens";
import type { TokenRow } from "../lib/tokens";
import { activeMode, themeText } from "../lib/store";
import { editToken, editTokens } from "../lib/editing";
import type { TokenEdit } from "../lib/editing";

/**
 * Style — the values that shape a surface: its corners, its lift, its stack.
 *
 * Each family's specimen is the thing the family controls, spent through the
 * token's own utility inside the preview scope. Radius rounds a real box, so
 * the shape is the value. A shadow lifts a real card off a sunken ground,
 * because a shadow read as a string of offsets says nothing about how far it
 * stands off the page. Z-index stacks real layers, because a number cannot
 * say which of two overlapping things wins — the overlap can.
 *
 * A family of corners is a scale before it is a set of values — none, small,
 * medium, large exist as RATIOS — so radius takes one control that moves the
 * whole family by a factor, and a slider per corner for the step that is
 * wrong on its own. Z-index gets sliders and no factor: layer ORDER is the
 * decision there, and a factor would happily keep the order while quietly
 * changing every number the author already chose.
 *
 * Every row is editable, including radius, which used to be a column of
 * squares you could look at but not set.
 */

/** `radius.md` → `md`, the suffix the matching utility spends. */
function suffixOf(path: string): string {
  return path.split(".").slice(1).join("-");
}

export default function StylePage() {
  const tree = createMemo(() => analyzeTheme(themeText()).tree);
  const group = (prefixes: string[][]): TokenRow[] => {
    const current = tree();
    return current ? groupTokens(current, prefixes, activeMode()) : [];
  };
  const radii = createMemo(() => group([["radius"]]));
  const shadows = createMemo(() => group([["shadow"]]));
  const layers = createMemo(() => group([["z-index"]]));

  const edit = (row: TokenRow, value: string) =>
    editToken(row.path.split("."), value);
  const scale = (edits: readonly TokenEdit[]) => editTokens(edits);

  return (
    <Page
      title="Style"
      note="The values that shape a surface. Each row spends its own utility on a real specimen and edits in place, so the thing you are changing is the thing you are looking at."
    >
      <Family
        title="Radius"
        note="A corner, on a box the theme's own surface and edge draw."
        rows={radii()}
        prefix="rounded"
        onEdit={edit}
        scale={{ label: "Scale every radius together", apply: scale }}
      >
        {(row) => <RadiusSpecimen row={row} />}
      </Family>

      <Family
        title="Elevation"
        note="A card stood off a sunken ground, so the shadow is the distance. A shadow is a list of offsets, blurs and colours rather than one number, so it edits as the string the author wrote."
        rows={shadows()}
        prefix="shadow"
        onEdit={edit}
      >
        {(row) => <LiftSpecimen row={row} />}
      </Family>

      <section class="stack-sm" aria-label="Z-index">
        <h2 class="text-xl">Z-index</h2>
        <p class="text-sm text-text-muted">
          Layers stacked, so the winner is visible. Each carries its own
          utility; the one that sits highest is the one whose step is largest.
        </p>
        <Show
          when={layers().length > 0}
          fallback={<Empty />}
        >
          <StackSpecimen rows={layers()} />
          <ul class="flow-list stack-sm">
            <For each={layers()}>
              {(row) => (
                <li class="panel flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div class="row-sm flex-wrap justify-between gap-3">
                    <code class="text-xs text-text-muted">{row.path}</code>
                    <code class="text-xs whitespace-nowrap">
                      {`z-${suffixOf(row.path)}`}
                    </code>
                  </div>
                  <ValueInput
                    value={row.value}
                    type={row.type}
                    onCommit={(value) => edit(row, value)}
                    group={layers().map((r) => r.value)}
                    variable={row.variable}
                    label={row.path}
                  />
                </li>
              )}
            </For>
          </ul>
        </Show>
      </section>
    </Page>
  );
}

function Empty() {
  return <p class="text-sm text-text-muted">This theme declares none yet.</p>;
}

/** One family: a specimen per row, the editor beside it. */
function Family(props: {
  title: string;
  note: string;
  rows: TokenRow[];
  /** The utility prefix this family spends, so the label matches the specimen. */
  prefix: string;
  onEdit: (row: TokenRow, value: string) => boolean;
  /**
   * Present only for a family whose values scale together: one factor for
   * the whole family, applied as a single edit.
   */
  scale?: {
    label: string;
    apply: (edits: readonly TokenEdit[]) => boolean;
  };
  children: (row: TokenRow) => JSX.Element;
}) {
  return (
    <section class="stack-sm" aria-label={props.title}>
      <h2 class="text-xl">{props.title}</h2>
      <p class="text-sm text-text-muted">{props.note}</p>
      <Show when={props.rows.length > 0} fallback={<Empty />}>
        <Show when={props.scale}>
          {(scale) => (
            <ScaleControl
              rows={props.rows}
              label={scale().label}
              onScale={scale().apply}
            />
          )}
        </Show>
        <ul class="flow-list stack-sm">
          <For each={props.rows}>
            {(row) => (
              <li class="panel flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div class="row-sm flex-wrap">
                  {props.children(row)}
                  <code class="text-xs text-text-muted">{row.path}</code>
                </div>
                <div class="row-sm flex-wrap shrink-0">
                  <code class="text-xs whitespace-nowrap">
                    {`${props.prefix}-${suffixOf(row.path)}`}
                  </code>
                  <ValueInput
                    value={row.value}
                    type={row.type}
                    onCommit={(value) => props.onEdit(row, value)}
                    group={props.rows.map((r) => r.value)}
                    variable={row.variable}
                    label={row.path}
                  />
                </div>
              </li>
            )}
          </For>
        </ul>
      </Show>
    </section>
  );
}

/** A box whose corners are the radius under edit. */
function RadiusSpecimen(props: { row: TokenRow }) {
  return (
    <div class="spin-preview shrink-0">
      <div
        class={`bg-surface-raised border border-border h-10 w-10 ${`rounded-${
          suffixOf(props.row.path)
        }`}`}
      />
    </div>
  );
}

/** A card stood off a sunken ground by the elevation under edit. */
function LiftSpecimen(props: { row: TokenRow }) {
  return (
    <div class="spin-preview bg-surface-sunken shrink-0 rounded-md p-3">
      <div
        class={`bg-surface-raised border border-border h-8 w-16 ${`shadow-${
          suffixOf(props.row.path)
        }`}`}
      />
    </div>
  );
}

/**
 * Every layer stacked and fanned, so the order is the z-index.
 *
 * The fan offset is demo geometry — how far each card peeks from behind the
 * one above — not a value the theme owns, so it is set inline rather than
 * through a token. The z-index itself is the token's own utility.
 */
function StackSpecimen(props: { rows: TokenRow[] }) {
  return (
    <div class="spin-preview relative h-24">
      <For each={props.rows}>
        {(row, index) => (
          <div
            class={`absolute inset-0 bg-surface-raised border border-border rounded-md p-3 stack-sm ${`z-${
              suffixOf(row.path)
            }`}`}
            style={{
              top: `${index() * 10}px`,
              left: `${index() * 10}px`,
            }}
          >
            <code class="text-xs text-text-muted">{row.path}</code>
            <code class="text-xs">{`z-${suffixOf(row.path)}`}</code>
          </div>
        )}
      </For>
    </div>
  );
}

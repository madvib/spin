import { createMemo, For, Show } from "solid-js";
import type { JSX } from "solid-js";
import ValueInput from "../components/demos/ValueInput";
import LinkToggle from "../components/demos/LinkToggle";
import Page from "../components/Page";
import { analyzeTheme } from "../lib/theme";
import { groupTokens } from "../lib/tokens";
import type { TokenRow } from "../lib/tokens";
import { activeMode, themeText } from "../lib/store";
import { editToken } from "../lib/editing";
import { createLockstep, type Lockstep } from "../lib/lockstep";
import { borderUtilityOf } from "../lib/tokens";

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
 * medium, large exist as RATIOS — so radius is linked: one row's track sets
 * that corner and every sibling by the same ratio. Z-index stays unlinked
 * in spirit: layer ORDER is the decision there, and a ratio would happily
 * keep the order while quietly changing every number the author chose.
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
  const radii = createLockstep(() => group([["radius"]]), "radius");
  const shadows = createMemo(() => group([["shadow"]]));
  const layers = createMemo(() => group([["z-index"]]));
  const opacities = createMemo(() => group([["opacity"]]));
  const borders = createMemo(() => group([["border"]]));
  const focuses = createMemo(() => group([["focus"]]));
  const edit = (row: TokenRow, value: string) =>
    editToken(row.path.split("."), value);

  return (
    <Page
      title="Style"
      note="The values that shape a surface. Each row spends its own utility on a real specimen and edits in place, so the thing you are changing is the thing you are looking at."
    >
      <Family
        title="Radius"
        note="A corner, on a box the theme's own surface and edge draw."
        rows={radii.rows()}
        prefix="rounded"
        onEdit={(row, value) => radii.commit(row.path, value)}
        family={radii}
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

      <Family
        title="Opacity"
        note="How much of a thing is shown, from invisible to fully there. The specimen spends the token's own value; the step a theme edits is the step everything else reads."
        rows={opacities()}
        prefix="opacity"
        utilityOf={(row) => `opacity-${suffixOf(row.path)}`}
        onEdit={edit}
      >
        {(row) => <OpacitySpecimen row={row} />}
      </Family>

      <Family
        title="Border"
        note="The edge a control and surface draw with, as a width. The specimen is the edge, and the page spends the token's own thickness on it."
        rows={borders()}
        prefix="border"
        utilityOf={(row) => borderUtilityOf(row.path)}
        onEdit={edit}
      >
        {(row) => <BorderSpecimen row={row} />}
      </Family>

      <section class="stack-sm" aria-label="Focus">
        <h2 class="text-xl">Focus</h2>
        <p class="text-sm text-text-muted">
          The ring that marks the interactive element, shared by every control:
          its thickness and the gap between it and its control. Each carries its
          own custom property, so the ring is the value.
        </p>
        <Show when={focuses().length > 0} fallback={<Empty />}>
          <ul class="flow-list stack-sm">
            <For each={focuses()}>
              {(row) => (
                <li class="panel flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div class="row-sm flex-wrap">
                    <FocusSpecimen row={row} />
                    <code class="text-xs text-text-muted">{row.path}</code>
                  </div>
                  <div class="row-sm flex-wrap shrink-0">
                    <code class="text-xs whitespace-nowrap">
                      {row.path.split(".").pop()}
                    </code>
                    <ValueInput
                      value={row.value}
                      type={row.type}
                      onCommit={(value) => edit(row, value)}
                      group={focuses().map((r) => r.value)}
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
  rows: readonly TokenRow[];
  /** The utility prefix this family spends, so the label matches the specimen. */
  prefix: string;
  onEdit: (row: TokenRow, value: string) => boolean;
  /** Maps a row to the utility name an author writes, when it is not the prefix. */
  utilityOf?: (row: TokenRow) => string;
  /**
   * Present only for a family whose values are a scale: rows move in
   * lockstep while linked, and the family takes the drag's preview itself.
   */
  family?: Lockstep;
  children: (row: TokenRow) => JSX.Element;
}) {
  const family = props.family;
  return (
    <section class="stack-sm" aria-label={props.title}>
      <div class="row-sm justify-between gap-3">
        <h2 class="text-xl">{props.title}</h2>
        <Show when={family}>
          {(active) => <LinkToggle group={active().name} />}
        </Show>
      </div>
      <p class="text-sm text-text-muted">{props.note}</p>
      <Show when={props.rows.length > 0} fallback={<Empty />}>
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
                    {props.utilityOf === undefined
                      ? `${props.prefix}-${suffixOf(row.path)}`
                      : props.utilityOf(row)}
                  </code>
                  <ValueInput
                    value={row.value}
                    type={row.type}
                    onCommit={(value) => props.onEdit(row, value)}
                    group={props.rows.map((r) => r.value)}
                    variable={row.variable}
                    label={row.path}
                    onPreview={family === undefined
                      ? undefined
                      : (value) => family.preview(row.path, value)}
                    onCancel={family?.abandon}
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

/** A surface read at the opacity the token carries. */
function OpacitySpecimen(props: { row: TokenRow }) {
  return (
    <div class="spin-preview shrink-0">
      <div
        class="h-10 w-10 rounded-md border border-border bg-primary"
        style={{ opacity: `var(${props.row.variable})` }}
      />
    </div>
  );
}

/** A box drawn at the border width the token carries. */
function BorderSpecimen(props: { row: TokenRow }) {
  return (
    <div class="spin-preview shrink-0">
      <div
        class="h-10 w-16 rounded-md bg-surface-raised text-text"
        style={{
          "border-width": `var(${props.row.variable})`,
          "border-style": "solid",
          "border-color": "var(--color-border)",
        }}
      />
    </div>
  );
}

/** A focus ring at the width and offset the token carries. */
function FocusSpecimen(props: { row: TokenRow }) {
  // The element has its own width and offset; pair them on the same ring so
  // the two steps read as one ring being adjusted.
  return (
    <div class="spin-preview shrink-0">
      <button
        type="button"
        class="rounded-md border border-border bg-surface-raised px-2 py-1 text-xs text-text"
        style={{
          outline: `var(${props.row.variable}) solid var(--color-focus-ring)`,
          "outline-offset": "var(--focus-offset)",
        }}
      >
        focus
      </button>
    </div>
  );
}
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

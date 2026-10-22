import { createMemo, For, Show } from "solid-js";
import type { JSX } from "solid-js";
import ValueInput from "../components/demos/ValueInput.tsx";
import LinkToggle from "../components/demos/LinkToggle.tsx";
import {
  ConcernPage,
  Frame,
  Section,
  TokenLine,
} from "../components/Concern.tsx";
import { analyzeTheme } from "../lib/theme.ts";
import { actingColour, tokenValue } from "../lib/overview.ts";
import { borderUtilityOf, groupTokens } from "../lib/tokens.ts";
import type { TokenRow } from "../lib/tokens.ts";
import { activeMode, themeText } from "../lib/store.ts";
import { editToken } from "../lib/editing.ts";
import { createLockstep, type Lockstep } from "../lib/lockstep.ts";

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
 * The page is a set of FAMILIES, and a family is a ladder: the steps of a
 * scale are only legible against one another, so every family is drawn as a
 * figure that holds all of its steps at once — corners in a row, cards stood
 * off a sunken ground, layers fanned — and the table under the figure says
 * what each step is called and what it is worth. A column of panels is a
 * column of numbers, and the page used to be one.
 *
 * The specimens wear the theme's own acting colour, and they wear it for a
 * reason: a corner is a corner on a thing that is painted, a lift is a lift
 * under a painted card, and a layer that wins is a painted layer. A white
 * box on a white page shows nothing at all, which is what the page used to
 * show.
 *
 * A family of corners is a scale before it is a set of values — none, small,
 * medium, large exist as RATIOS — so radius is linked: one row's track sets
 * that corner and every sibling by the same ratio. Z-index stays unlinked
 * in spirit: layer ORDER is the decision there, and a ratio would happily
 * keep the order while quietly changing every number the author chose.
 */

/** `radius.md` → `md`, the suffix the matching utility spends. */
function suffixOf(path: string): string {
  return path.split(".").slice(1).join("-");
}

/** The step's own name: the last segment of its path. */
function stepOf(path: string): string {
  return path.split(".").pop() ?? path;
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
  /**
   * The theme's own value for a colour, in the mode being shown.
   *
   * The specimens are painted with the value rather than with a utility: a
   * specimen shows the theme's colour, and a utility paints whatever the
   * studio's own sheet happens to say.
   */
  const colour = (path: string): string | undefined => {
    const current = tree();
    return current === undefined
      ? undefined
      : tokenValue(current, activeMode(), path);
  };
  const acting = createMemo(() => {
    const current = tree();
    return current === undefined
      ? undefined
      : actingColour(current, activeMode());
  });
  const edit = (row: TokenRow, value: string) =>
    editToken(row.path.split("."), value);

  return (
    <ConcernPage
      title="Style"
      note="The values that shape a surface: how round its corners are, how high it stands off the page, and which of two things wins when they overlap."
    >
      <Family
        title="Radius"
        fact={`${radii.rows().length} corners`}
        note="A corner, on a box the theme's own surface and edge draw."
        rows={radii.rows()}
        prefix="rounded"
        onEdit={(row, value) => radii.commit(row.path, value)}
        family={radii}
        figure={<RadiusFigure rows={radii.rows()} fill={acting()} />}
      />

      <Family
        title="Elevation"
        fact={`${shadows().length} steps`}
        note="A card stood off a sunken ground, so the shadow is the distance. A shadow is a list of offsets, blurs and colours rather than one number, so it edits as the string the author wrote."
        rows={shadows()}
        prefix="shadow"
        onEdit={edit}
        figure={<LiftFigure rows={shadows()} fill={acting()} />}
      />

      <Family
        title="Stack order"
        fact={`${layers().length} layers`}
        note="Layers stacked, so the winner is visible. Each carries its own utility; the one that sits highest is the one whose step is largest."
        rows={layers()}
        prefix="z"
        onEdit={edit}
        utilityOf={(row) => `z-${suffixOf(row.path)}`}
        figure={<StackFigure rows={layers()} />}
      />

      <Family
        title="Opacity"
        fact={`${opacities().length} steps`}
        note="How much of a thing is shown, from invisible to fully there. The specimen spends the token's own value; the step a theme edits is the step everything else reads."
        rows={opacities()}
        prefix="opacity"
        utilityOf={(row) => `opacity-${suffixOf(row.path)}`}
        onEdit={edit}
        figure={<OpacityFigure rows={opacities()} fill={acting()} />}
      />

      <Family
        title="Border"
        fact={`${borders().length} widths`}
        note="The edge a control and surface draw with, as a width. The specimen is the edge, and the page spends the token's own thickness on it."
        rows={borders()}
        prefix="border"
        utilityOf={(row) => borderUtilityOf(row.path)}
        onEdit={edit}
        figure={
          <BorderFigure
            rows={borders()}
            fill={acting()}
            edge={colour("color.text")}
          />
        }
      />

      <Family
        title="Focus"
        fact={`${focuses().length} steps`}
        note="The ring that marks the interactive element, shared by every control: its thickness and the gap between it and its control. Each carries its own custom property, so the ring is the value."
        rows={focuses()}
        prefix="focus"
        onEdit={edit}
        figure={
          <FocusFigure rows={focuses()} ring={colour("color.focus-ring")} />
        }
      />
    </ConcernPage>
  );
}

/**
 * One family: the ladder it is, and the table that names its steps.
 *
 * The figure comes first and the table under it, because the figure is the
 * answer to the family's question and the table is the way to change it.
 */
function Family(props: {
  title: string;
  fact: string;
  note: string;
  /** The figure: every step of the family, at once. */
  figure: JSX.Element;
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
}) {
  const family = props.family;
  return (
    <Section
      title={props.title}
      fact={props.fact}
      note={props.note}
      aside={
        <Show when={family}>
          {(active) => <LinkToggle group={active().name} />}
        </Show>
      }
    >
      <Show
        when={props.rows.length > 0}
        fallback={
          <p class="text-sm text-text-muted">
            This theme declares none of these yet.
          </p>
        }
      >
        {
          /* The figure and the table, side by side where there is room.
            The figure is the family's answer and the table is the way to
            change it, and a table under a figure leaves the two a screen
            apart — so they share the row: the figure takes a third of the
            measure and the table the rest, and the table's columns stay
            together instead of being spread across the page. */
        }
        <div class="grid gap-4 lg:grid-cols-3 lg:items-start">
          <Frame>{props.figure}</Frame>
          <ul class="flow-list lg:col-span-2">
            <For each={props.rows}>
              {(row) => (
                <TokenLine
                  path={row.path}
                  utility={props.utilityOf === undefined
                    ? `${props.prefix}-${suffixOf(row.path)}`
                    : props.utilityOf(row)}
                  editor={
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
                  }
                />
              )}
            </For>
          </ul>
        </div>
      </Show>
    </Section>
  );
}

/**
 * The radius ladder: one box per corner, each at its own roundness.
 *
 * The boxes are the same size, so the eye reads the progression rather than
 * five separate shapes — a bigger box and a rounder one at once would be
 * two facts where the question is one. The fill is the theme's acting
 * colour, because a corner is a corner on a thing that is painted, and a
 * painted corner against a card is the only way the curve shows.
 *
 * The radius is the token's OWN property rather than the utility an author
 * writes: the utility is a name the scanner has to see written down, and a
 * theme may name its corners anything at all — the property is the value,
 * and it moves while the author drags.
 */
function RadiusFigure(
  props: { rows: readonly TokenRow[]; fill: string | undefined },
) {
  return (
    <div class="flex flex-wrap items-end gap-2">
      <For each={props.rows}>
        {(row) => (
          <figure class="stack-sm w-12">
            <div
              class="h-12 w-12"
              style={{
                background: props.fill,
                "border-radius": `var(${row.variable})`,
              }}
            />
            <figcaption class="truncate text-center">
              {stepOf(row.path)}
            </figcaption>
          </figure>
        )}
      </For>
    </div>
  );
}

/**
 * The elevation ladder: every shadow, as a card on one sunken ground.
 *
 * The ground is the same for all of them, so the distance each card stands
 * off is the only thing that differs — which is the whole question the
 * family asks. The card is painted, because a shadow is invisible on a
 * white card in a white room.
 */
function LiftFigure(
  props: { rows: readonly TokenRow[]; fill: string | undefined },
) {
  return (
    <div class="flex flex-wrap items-end gap-4 rounded-md bg-surface-sunken p-4">
      <For each={props.rows}>
        {(row) => (
          <figure class="stack-sm w-16">
            <div
              class="h-12 w-full rounded-md"
              style={{
                background: props.fill,
                "box-shadow": `var(${row.variable})`,
              }}
            />
            <figcaption class="truncate text-center">
              {stepOf(row.path)}
            </figcaption>
          </figure>
        )}
      </For>
    </div>
  );
}

/**
 * The stacking ladder: every layer, fanned, so the order is the z-index.
 *
 * The fan offset is demo geometry — how far each card peeks from behind the
 * one above — not a value the theme owns, so it is set inline rather than
 * through a token. The z-index itself is the token's own utility, so the
 * card that paints on top is the card the theme says wins — and the winner
 * is painted, because "this one is on top" is the fact the figure exists
 * to say.
 */
function StackFigure(props: { rows: readonly TokenRow[] }) {
  /** The layer the theme puts highest: the one that wins. */
  const winner = () => {
    let best: TokenRow | undefined;
    for (const row of props.rows) {
      const value = Number(row.value);
      if (best === undefined) {
        best = row;
        continue;
      }
      if (Number.isFinite(value) && value > Number(best.value)) best = row;
    }
    return best?.path;
  };

  return (
    <div class="spin-preview relative h-[7rem]">
      <For each={props.rows}>
        {(row, index) => (
          <div
            class={`absolute inset-0 stack-sm rounded-md border border-border p-3 ${
              row.path === winner() ? "bg-primary" : "bg-surface-raised"
            }`}
            style={{
              top: `${index() * 10}px`,
              left: `${index() * 10}px`,
              "z-index": `var(${row.variable})`,
            }}
          >
            {
              /* A span and not a `code`: the theme draws inline code on its
                own little surface, and a chip of that surface on a painted
                card would carry the page's ink under the card's ink. */
            }
            <span
              class={`font-mono text-xs ${
                row.path === winner() ? "text-on-primary" : "text-text-muted"
              }`}
            >
              {row.path}
            </span>
          </div>
        )}
      </For>
    </div>
  );
}

/**
 * The opacity ladder: the acting colour, at every step of its presence.
 *
 * The swatches stand on a sunken ground, because a colour at forty per cent
 * over a white page and a colour at forty per cent over a sunken well are
 * two different colours, and the well is the one the theme draws it on.
 * They share the row equally, so the ladder reads as one ramp from the
 * invisible step to the whole one, and the table beside it names them in
 * the same order.
 */
function OpacityFigure(
  props: { rows: readonly TokenRow[]; fill: string | undefined },
) {
  return (
    <div class="flex items-end gap-1 rounded-md bg-surface-sunken p-3">
      <For each={props.rows}>
        {(row) => (
          <div
            class="h-12 min-w-0 flex-1 rounded-sm"
            style={{
              background: props.fill,
              opacity: `var(${row.variable})`,
            }}
            title={`${stepOf(row.path)} · ${row.value}`}
          />
        )}
      </For>
    </div>
  );
}

/**
 * The border ladder: the acting colour, edged at every thickness.
 *
 * The fill is the colour so that the edge is the only thing the eye has to
 * read — a hairline drawn around a white box on a white card is a hairline
 * nobody can see.
 */
function BorderFigure(
  props: {
    rows: readonly TokenRow[];
    fill: string | undefined;
    edge: string | undefined;
  },
) {
  return (
    <div class="flex flex-wrap items-end gap-4 rounded-md bg-surface-sunken p-4">
      <For each={props.rows}>
        {(row) => (
          <figure class="stack-sm w-16">
            <div
              class="h-12 w-full rounded-md"
              style={{
                background: props.fill,
                "border-width": `var(${row.variable})`,
                "border-style": "solid",
                "border-color": props.edge,
              }}
            />
            <figcaption class="truncate text-center">
              {stepOf(row.path)}
            </figcaption>
          </figure>
        )}
      </For>
    </div>
  );
}

/**
 * The focus ladder: the ring, at every step of its thickness and its gap.
 *
 * The ring is the theme's own focus colour, and it is drawn around a
 * painted control, because a ring around nothing is a ring nobody reads.
 * The step under edit is the one the specimen isolates: the width's ring
 * sits on the control itself, and the offset's ring stands off it.
 */
function FocusFigure(
  props: { rows: readonly TokenRow[]; ring: string | undefined },
) {
  return (
    <div class="flex flex-wrap items-end gap-4 rounded-md bg-surface-sunken p-4">
      <For each={props.rows}>
        {(row) => (
          <figure class="stack-sm w-24">
            <div class="flex h-12 items-center justify-center">
              <button
                type="button"
                class="secondary s-sm"
                style={{
                  outline: `var(--focus-width, 1px) solid ${
                    props.ring ?? "transparent"
                  }`,
                  "outline-offset": row.path.endsWith("offset")
                    ? `var(${row.variable}, 2px)`
                    : "0px",
                }}
              >
                focus
              </button>
            </div>
            <figcaption class="truncate text-center">
              {stepOf(row.path)}
            </figcaption>
          </figure>
        )}
      </For>
    </div>
  );
}

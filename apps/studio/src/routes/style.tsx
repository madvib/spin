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
import { actingColour, tokenValue } from "../lib/overview.ts";
import { borderUtilityOf, groupTokens } from "../lib/tokens.ts";
import type { TokenRow } from "../lib/tokens.ts";
import { activeMode, activeTree } from "../lib/store.ts";
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
  const group = (prefixes: string[][]): TokenRow[] =>
    groupTokens(activeTree(), prefixes, activeMode());
  const radii = createLockstep(() => group([["radius"]]), "radius");
  const shadows = createMemo(() => group([["shadow"]]));
  const layers = createMemo(() => group([["z-index"]]));
  const opacities = createMemo(() => group([["opacity"]]));
  const borders = createMemo(() => group([["border"]]));
  /**
   * The edges the theme spells in one token.
   *
   * A border token carries a width, a style and a colour at once, so it is
   * not a width on its own: the widths below are the ladder, and these are
   * the edges a theme draws with them.
   */
  const borderComposites = createMemo(() =>
    borders().filter((row) => row.type === "border")
  );
  const borderWidths = createMemo(() =>
    borders().filter((row) => row.type !== "border")
  );
  /** The fills the theme spells in one token. */
  const gradients = createMemo(() => group([["gradient"]]));
  const focuses = createMemo(() => group([["focus"]]));
  /**
   * The theme's own value for a colour, in the mode being shown.
   *
   * The specimens are painted with the value rather than with a utility: a
   * specimen shows the theme's colour, and a utility paints whatever the
   * studio's own sheet happens to say.
   */
  const colour = (path: string): string | undefined =>
    tokenValue(activeTree(), activeMode(), path);
  const acting = createMemo(() => actingColour(activeTree(), activeMode()));
  const edit = (row: TokenRow, value: string) =>
    editToken(row.path.split("."), value);

  return (
    <ConcernPage title="Style">
      <Family
        title="Radius"
        fact={`${radii.rows().length} corners`}
        info="Corner radii scale proportionally while linked; radius.full stays pinned as a pill."
        rows={radii.rows()}
        prefix="rounded"
        onEdit={(row, value) => radii.commit(row.path, value)}
        family={radii}
        specimenOf={(row) => (
          <div
            class="bg-surface-sunken"
            style={{
              width: stepOf(row.path) === "full" ? "3rem" : "1.75rem",
              height: "1.25rem",
              border: `2px solid ${acting() ?? "currentColor"}`,
              "border-radius": `var(${row.variable})`,
            }}
          />
        )}
        figure={
          <RadiusFigure
            rows={radii.rows()}
            fill={acting()}
            shownOf={(row) => radii.shown(row.path, row.value)}
          />
        }
      />

      <Family
        title="Elevation"
        fact={`${shadows().length} steps`}
        info="Box shadows rendered on raised surface cards over a sunken stage. Use ArrowUp/ArrowDown in x, y, blur, or spread to step by 1px."
        rows={shadows()}
        prefix="shadow"
        onEdit={edit}
        figure={<LiftFigure rows={shadows()} />}
      />

      <Family
        title="Stack order"
        fact={`${layers().length} layers`}
        info="Cascading z-index layers; higher values stack in front of lower ones."
        rows={layers()}
        prefix="z"
        onEdit={edit}
        utilityOf={(row) => `z-${suffixOf(row.path)}`}
        figure={<StackFigure rows={layers()} />}
      />

      <Family
        title="Opacity"
        fact={`${opacities().length} steps`}
        rows={opacities()}
        prefix="opacity"
        utilityOf={(row) => `opacity-${suffixOf(row.path)}`}
        onEdit={edit}
        figure={<OpacityFigure rows={opacities()} fill={acting()} />}
      />

      <Family
        title="Border"
        fact={`${borderWidths().length} widths`}
        rows={borderWidths()}
        prefix="border"
        utilityOf={(row) => borderUtilityOf(row.path)}
        onEdit={edit}
        figure={<BorderFigure rows={borderWidths()} fill={acting()} />}
      />

      <Show when={borderComposites().length > 0}>
        <Section
          title="Composite borders"
          fact={`${borderComposites().length} edges`}
        >
          <Frame class="p-3">
            <ul>
              <For each={borderComposites()}>
                {(row) => (
                  <TokenLine
                    path={row.path}
                    specimen={
                      <div
                        class="h-6 w-24 rounded-sm bg-surface-sunken"
                        style={{ border: `var(${row.variable})` }}
                      />
                    }
                    editor={
                      <ValueInput
                        value={row.value}
                        type={row.type}
                        onCommit={(value) => edit(row, value)}
                        variable={row.variable}
                        label={row.path}
                      />
                    }
                  />
                )}
              </For>
            </ul>
          </Frame>
        </Section>
      </Show>

      <Show when={gradients().length > 0}>
        <Section title="Gradient" fact={`${gradients().length} fills`}>
          <Frame class="p-3">
            <ul>
              <For each={gradients()}>
                {(row) => (
                  <TokenLine
                    path={row.path}
                    specimen={
                      <div
                        class="h-6 w-24 rounded-sm border border-border"
                        style={{ background: `var(${row.variable})` }}
                      />
                    }
                    editor={
                      <ValueInput
                        value={row.value}
                        type={row.type}
                        onCommit={(value) => edit(row, value)}
                        variable={row.variable}
                        label={row.path}
                      />
                    }
                  />
                )}
              </For>
            </ul>
          </Frame>
        </Section>
      </Show>

      <Family
        title="Focus"
        fact={`${focuses().length} steps`}
        info="Focus ring thickness and offset shared across interactive controls."
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

function Family(props: {
  title: string;
  fact: string;
  info?: string;
  /** The figure: every step of the family, at once. */
  figure: JSX.Element;
  rows: readonly TokenRow[];
  /** The utility prefix this family spends, so the label matches the specimen. */
  prefix: string;
  onEdit: (row: TokenRow, value: string) => boolean;
  /** Maps a row to the utility name an author writes, when it is not the prefix. */
  utilityOf?: (row: TokenRow) => string;
  /** Optional inline specimen rendered inside each token row. */
  specimenOf?: (row: TokenRow) => JSX.Element;
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
      info={props.info}
      aside={
        <Show when={family}>
          {(active) => (
            <LinkToggle
              group={active().name}
              ratio={active().activeRatio()}
            />
          )}
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
        <Frame class="stack">
          <div
            data-studio-specimen=""
            class="rounded-md border border-border bg-surface-sunken p-4"
          >
            {props.figure}
          </div>
          <ul>
            <For each={props.rows}>
              {(row) => (
                <TokenLine
                  path={row.path}
                  utility={
                    props.utilityOf === undefined
                      ? `${props.prefix}-${suffixOf(row.path)}`
                      : props.utilityOf(row)
                  }
                  specimen={props.specimenOf?.(row)}
                  editor={
                    <ValueInput
                      value={row.value}
                      type={row.type}
                      onCommit={(value) => props.onEdit(row, value)}
                      group={props.rows.map((r) => r.value)}
                      variable={row.variable}
                      label={row.path}
                      onPreview={
                        family === undefined
                          ? undefined
                          : (value) => family.preview(row.path, value)
                      }
                      onCancel={family?.abandon}
                      proposed={family?.shown(row.path, row.value)}
                    />
                  }
                />
              )}
            </For>
          </ul>
        </Frame>
      </Show>
    </Section>
  );
}

function RadiusFigure(props: {
  rows: readonly TokenRow[];
  fill: string | undefined;
  shownOf: (row: TokenRow) => string;
}) {
  return (
    <div class="flex flex-wrap items-end gap-4">
      <For each={props.rows}>
        {(row) => {
          const isFull = () => stepOf(row.path) === "full";
          return (
            <figure
              class="stack-xs flex-1 items-center"
              style={{ "min-width": "5rem" }}
            >
              <div
                class="flex w-full items-center justify-center"
                style={{ height: "3.5rem" }}
              >
                <div
                  class="bg-surface"
                  style={{
                    width: isFull() ? "5.5rem" : "3.25rem",
                    height: isFull() ? "2.25rem" : "3.25rem",
                    border: `2px solid ${props.fill ?? "currentColor"}`,
                    background: props.fill
                      ? `color-mix(in oklab, ${props.fill} 16%, transparent)`
                      : undefined,
                    "border-radius": `var(${row.variable})`,
                  }}
                />
              </div>
              <figcaption class="stack-xs items-center text-center">
                <span class="font-mono text-xs font-semibold text-text">
                  {stepOf(row.path)}
                </span>
                <code class="text-xs text-text-muted tabular-nums">
                  {props.shownOf(row)}
                </code>
              </figcaption>
            </figure>
          );
        }}
      </For>
    </div>
  );
}

function LiftFigure(props: { rows: readonly TokenRow[] }) {
  return (
    <div class="grid grid-cols-2 gap-5 sm:grid-cols-4">
      <For each={props.rows}>
        {(row) => (
          <figure class="stack-xs items-center">
            <div
              class="flex w-full flex-col items-center justify-center gap-1 rounded-lg border border-border bg-surface p-3"
              style={{
                "min-height": "4.75rem",
                "box-shadow": `var(${row.variable})`,
              }}
            >
              <span class="font-mono text-xs font-semibold text-text">
                {stepOf(row.path)}
              </span>
              <code class="text-xs text-text-muted">
                shadow-{suffixOf(row.path)}
              </code>
            </div>
          </figure>
        )}
      </For>
    </div>
  );
}

function StackFigure(props: { rows: readonly TokenRow[] }) {
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
    <div
      class="spin-preview relative w-full"
      style={{
        height: `${Math.max(7, props.rows.length * 1.75 + 2.25)}rem`,
      }}
    >
      <For each={props.rows}>
        {(row, index) => {
          const isWinner = () => row.path === winner();
          const leftPct = () =>
            props.rows.length > 1
              ? (index() / (props.rows.length - 1)) * 40
              : 0;
          return (
            <div
              class={`
                absolute rounded-md border border-border px-3 py-2 shadow-sm
                ${isWinner() ? "bg-primary" : "bg-surface-raised"}
              `}
              style={{
                top: `${index() * 28}px`,
                left: `${leftPct()}%`,
                width: "60%",
                height: "3.75rem",
                "z-index": `var(${row.variable})`,
              }}
            >
              <div class="split items-center gap-2">
                <span
                  class={`
                    font-mono text-xs font-semibold truncate
                    ${isWinner() ? "text-on-primary" : "text-text"}
                  `}
                >
                  {stepOf(row.path)}
                </span>
                <span
                  class={`
                    font-mono text-xs tabular-nums
                    ${isWinner() ? "text-on-primary" : "text-text-muted"}
                  `}
                >
                  {row.value}
                </span>
              </div>
            </div>
          );
        }}
      </For>
    </div>
  );
}

function OpacityFigure(props: {
  rows: readonly TokenRow[];
  fill: string | undefined;
}) {
  return (
    <div class="flex flex-wrap items-end gap-3">
      <For each={props.rows}>
        {(row) => {
          const pct = () => {
            const n = Number(row.value);
            return Number.isFinite(n) ? `${Math.round(n * 100)}%` : row.value;
          };
          return (
            <figure
              class="stack-xs flex-1 items-center"
              style={{ "min-width": "4rem" }}
            >
              <div
                class="h-12 w-full rounded-md border border-border bg-surface p-1"
                style={{ height: "3rem" }}
              >
                <div
                  class="h-full w-full rounded-sm"
                  style={{
                    background: props.fill,
                    opacity: `var(${row.variable})`,
                  }}
                />
              </div>
              <figcaption class="stack-xs items-center text-center">
                <span class="font-mono text-xs font-semibold text-text">
                  {stepOf(row.path)}
                </span>
                <code class="text-xs text-text-muted tabular-nums">
                  {pct()}
                </code>
              </figcaption>
            </figure>
          );
        }}
      </For>
    </div>
  );
}

function BorderFigure(props: {
  rows: readonly TokenRow[];
  fill: string | undefined;
}) {
  return (
    <div class="flex flex-wrap items-end gap-4">
      <For each={props.rows}>
        {(row) => (
          <figure
            class="stack-xs flex-1 items-center"
            style={{ "min-width": "5.5rem" }}
          >
            <div
              class="h-12 w-full rounded-md bg-surface"
              style={{
                height: "3.25rem",
                "border-width": `var(${row.variable})`,
                "border-style": "solid",
                "border-color": props.fill,
              }}
            />
            <figcaption class="stack-xs items-center text-center">
              <span class="font-mono text-xs font-semibold text-text">
                {stepOf(row.path)}
              </span>
              <code class="text-xs text-text-muted tabular-nums">
                {row.value}
              </code>
            </figcaption>
          </figure>
        )}
      </For>
    </div>
  );
}

function FocusFigure(props: {
  rows: readonly TokenRow[];
  ring: string | undefined;
}) {
  return (
    <div class="flex flex-wrap items-end gap-4">
      <For each={props.rows}>
        {(row) => (
          <figure
            class="stack-xs flex-1 items-center"
            style={{ "min-width": "7rem" }}
          >
            <div
              class="flex h-12 w-full items-center justify-center rounded-md border border-border bg-surface"
              style={{ height: "3.25rem" }}
            >
              <button
                type="button"
                class="secondary s-sm"
                style={{
                  outline: `var(--focus-width, 2px) solid ${
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
            <figcaption class="stack-xs items-center text-center">
              <span class="font-mono text-xs font-semibold text-text">
                {stepOf(row.path)}
              </span>
              <code class="text-xs text-text-muted tabular-nums">
                {row.value}
              </code>
            </figcaption>
          </figure>
        )}
      </For>
    </div>
  );
}

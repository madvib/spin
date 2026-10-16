import { createMemo, For, Show } from "solid-js";
import ValueInput from "../components/demos/ValueInput";
import ScaleBar from "../components/demos/ScaleBar";
import { inDrawer } from "../app";
import { analyzeTheme } from "../lib/theme";
import { groupTokens, toPx } from "../lib/tokens";
import type { TokenRow } from "../lib/tokens";
import { activeMode, themeText } from "../lib/store";
import { editToken } from "../lib/editing";

/**
 * Spacing — the scale, and what each step is for.
 *
 * A column of steps is a column of numbers: `0.25rem` beside `4rem` says
 * nothing about the gap between them, and nothing about which one fits a
 * card's padding. So a row carries the step three ways, all spending its own
 * utility inside the preview scope: the bar, whose width IS the step; the
 * step as padding around a box; and the step as a gap between two boxes.
 * Drag the bar or set the field — both write the same token, and all three
 * specimens move together.
 *
 * A breakpoint is a viewport width, not a length inside a layout, so it is
 * shown as a share of the widest the theme declares — the one relative fact
 * about a breakpoint — with its own px beside it.
 */

/** `spacing.4` → `4`, the suffix every spacing utility spends. */
function stepOf(path: string): string {
  return path.split(".").slice(1).join("-");
}

export default function SpacingPage() {
  const tree = createMemo(() => analyzeTheme(themeText()).tree);
  const steps = createMemo(() => {
    const current = tree();
    return current ? groupTokens(current, [["spacing"]], activeMode()) : [];
  });
  const breakpoints = createMemo(() => {
    const current = tree();
    return current ? groupTokens(current, [["breakpoint"]], activeMode()) : [];
  });
  const widest = () =>
    Math.max(1, ...breakpoints().map((row) => toPx(row.value) ?? 0));

  const edit = (row: TokenRow, value: string) =>
    editToken(row.path.split("."), value);

  return (
    <section
      class="stack mb-6"
      classList={{ "max-w-screen-md": !inDrawer() }}
    >
      <header class="stack-sm">
        <h1 class="text-xl font-semibold">Spacing</h1>
        <p class="text-sm text-text-muted">
          Every gap, pad and inset is one of these steps. Each row spends the
          step's own utility three ways — as a bar, as padding around a box,
          and as a gap between boxes — so a step reads as the thing it is
          used for rather than as a number.
        </p>
      </header>

      <section class="stack-sm" aria-label="Scale">
        <h2 class="font-medium">Scale</h2>
        <Show
          when={steps().length > 0}
          fallback={
            <p class="text-sm text-text-muted">
              This theme declares no spacing steps yet.
            </p>
          }
        >
          <ul class="stack-sm flow-list">
            <For each={steps()}>
              {(row) => <StepRow row={row} onEdit={edit} />}
            </For>
          </ul>
        </Show>
      </section>

      <section class="stack-sm" aria-label="Breakpoints">
        <h2 class="font-medium">Breakpoints</h2>
        <p class="text-sm text-text-muted">
          The viewport widths a layout changes at. Each is shown as a share of
          the widest this theme declares, which is the only relative fact
          about one.
        </p>
        <Show
          when={breakpoints().length > 0}
          fallback={
            <p class="text-sm text-text-muted">
              This theme declares no breakpoints yet.
            </p>
          }
        >
          <ul class="stack-sm flow-list">
            <For each={breakpoints()}>
              {(row) => (
                <li class="panel stack-xs">
                  <div class="row-sm justify-between gap-3">
                    <code class="text-xs text-text-muted">{row.path}</code>
                    <ValueInput
                      value={row.value}
                      type={row.type}
                      onCommit={(value) => edit(row, value)}
                    />
                  </div>
                  <div
                    class="h-4 overflow-hidden rounded-sm bg-surface-sunken"
                    aria-hidden="true"
                  >
                    <div
                      class="h-full rounded-sm bg-secondary"
                      style={{
                        width: `${((toPx(row.value) ?? 0) / widest()) * 100}%`,
                      }}
                    />
                  </div>
                  <code class="text-xs text-text-muted">
                    {toPx(row.value) === undefined
                      ? row.value
                      : `${toPx(row.value)}px`}
                  </code>
                </li>
              )}
            </For>
          </ul>
        </Show>
      </section>
    </section>
  );
}

/**
 * One step: the editor, and the step spent three ways.
 *
 * The two applied specimens sit inside the preview scope so they spend the
 * step's own utility — `p-4` and `gap-4` — rather than a width read through
 * a custom property, which is the difference between showing the token and
 * showing a bar that happens to be as wide.
 */
function StepRow(props: {
  row: TokenRow;
  onEdit: (row: TokenRow, value: string) => boolean;
}) {
  const step = () => stepOf(props.row.path);
  return (
    <li class="panel stack-sm">
      <div class="row-sm justify-between gap-3">
        <code class="text-xs text-text-muted">{props.row.path}</code>
        <ValueInput
          value={props.row.value}
          type={props.row.type}
          onCommit={(value) => props.onEdit(props.row, value)}
        />
      </div>
      <ScaleBar
        variable={props.row.variable}
        px={toPx(props.row.value)}
        onCommit={(rem) => props.onEdit(props.row, rem)}
      />
      <div class="row-sm flex-wrap items-start gap-4">
        <figure class="stack-xs">
          <div class="spin-preview">
            <div class={`border border-dashed border-border-strong ${`p-${step()}`}`}>
              <div class="bg-primary h-3 w-10 rounded-sm" />
            </div>
          </div>
          <figcaption class="text-xs text-text-muted">
            {`p-${step()}`}
          </figcaption>
        </figure>
        <figure class="stack-xs">
          <div class={`spin-preview flex ${`gap-${step()}`}`}>
            <div class="bg-primary h-3 w-3 rounded-sm" />
            <div class="bg-primary h-3 w-3 rounded-sm" />
          </div>
          <figcaption class="text-xs text-text-muted">
            {`gap-${step()}`}
          </figcaption>
        </figure>
      </div>
    </li>
  );
}

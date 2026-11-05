import { createMemo, createSignal, For, Show } from "solid-js";
import ValueInput from "../components/demos/ValueInput.tsx";
import ScaleBar from "../components/demos/ScaleBar.tsx";
import LinkToggle from "../components/demos/LinkToggle.tsx";
import {
  ConcernPage,
  Frame,
  Section,
  TokenLine,
} from "../components/Concern.tsx";
import { actingColour, tokenValue } from "../lib/overview.ts";
import { groupTokens, toPx } from "../lib/tokens.ts";
import type { TokenRow } from "../lib/tokens.ts";
import { activeMode, activeTree } from "../lib/store.ts";
import { createLockstep } from "../lib/lockstep.ts";
import { inDrawer } from "../lib/host.ts";
/**
 * Spacing — the scale, and what each step is for.
 *
 * A column of panels is a column of numbers: it never shows the thing a
 * scale IS — a ramp of lengths sharing one origin, each step visibly
 * relative to the last, with the ratio that produced it beside it. So the
 * steps draw as one ramp, top to bottom, bars on a common track: read the
 * staircase and you have read the scale.
 *
 * The ramp is also the picker: a row selects, and the step's editor and its
 * two applied specimens — the step as padding, the step as a gap — spend
 * that step's own utility in the preview scope below. And the ramp is one
 * gesture: while the group is linked, dragging any bar or track sets that
 * step and moves every other step by the same ratio, so the shape survives
 * the edit.
 *
 * The page holds two families of tokens and they do not look alike. The
 * scale is the page's subject, so it wears the acting colour; the
 * breakpoints are a different kind of measurement — a viewport width rather
 * than a length inside a layout — so they wear the accent, and the section
 * that holds them is marked with it. The step in play is marked the way the
 * overview marks the theme being edited: an edge in the acting colour.
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
  const stepRows = createMemo(() => groupTokens(activeTree(), [["spacing"]], activeMode()));
  const steps = createLockstep(() => stepRows(), "spacing");
  const breakpointRows = createMemo(() => groupTokens(activeTree(), [["breakpoint"]], activeMode()));
  const breakpoints = createLockstep(() => breakpointRows(), "breakpoint");
  const widest = () =>
    Math.max(
      1,
      ...breakpoints.rows().map((row) => toPx(row.value) ?? 0),
    );
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

  // The ramp, shortest bar first: the order is the comparison, and a step
  // the length parser cannot read still has to appear — at the end, where
  // its row simply claims no ratio.
  const ramp = createMemo(() =>
    steps.rows()
      .map((row) => ({ row, px: toPx(row.value) }))
      .sort((a, b) => (a.px ?? Infinity) - (b.px ?? Infinity))
  );
  // Where the track ends: twice the longest bar, so the widest step sits at
  // half of it and a drag has somewhere to go.
  const rampMax = () => 2 * Math.max(16, ...ramp().map((s) => s.px ?? 0));

  const [selectedPath, setSelectedPath] = createSignal<string | undefined>(
    undefined,
  );
  const selected = createMemo(() => {
    const rows = ramp();
    return rows.find((r) => r.row.path === selectedPath()) ??
      rows.find((r) => (r.px ?? 0) > 0) ?? rows[0];
  });

  /** This step over the one before it: the ratio the scale is made of. */
  const ratioAt = (index: number): string => {
    const rows = ramp();
    const prev = rows[index - 1]?.px;
    const px = rows[index]?.px;
    if (prev === undefined || px === undefined || prev <= 0) return "";
    return `${Number((px / prev).toFixed(2))}×`;
  };

  return (
    <ConcernPage title="Spacing">
      <Section
        title="Scale"
        fact={`${steps.rows().length} steps`}
        info="Click any step to inspect its applied padding and gap specimens; drag a bar or use −/+ to adjust."
        aside={<LinkToggle group="spacing" ratio={steps.activeRatio()} />}
      >
        <Show
          when={steps.rows().length > 0}
          fallback={
            <p class="text-text-muted">
              This theme declares no spacing steps yet.
            </p>
          }
        >
          <div
            class={
              inDrawer()
                ? "stack-lg"
                : "grid items-start gap-6 lg:grid-cols-2"
            }
          >
            <Frame class="min-w-0 p-2">
              <ul class="divide-y divide-border">
                <For each={ramp()}>
                  {(entry, index) => {
                    const shownVal = () =>
                      steps.shown(entry.row.path, entry.row.value);
                    const shownPx = () => toPx(shownVal()) ?? entry.px;
                    return (
                      <li>
                        <button
                          type="button"
                          class="bare w-full select-none"
                          aria-pressed={
                            selected()?.row.path === entry.row.path
                          }
                          onClick={() => setSelectedPath(entry.row.path)}
                        >
                          <span
                            class="row-sm w-full gap-3 rounded-md border border-transparent px-3 py-2 data-[current]:border-primary"
                            data-current={
                              selected()?.row.path === entry.row.path
                                ? ""
                                : undefined
                            }
                            classList={{
                              "bg-surface-sunken":
                                selected()?.row.path === entry.row.path,
                            }}
                          >
                            <span
                              data-studio-chrome=""
                              class="w-8 shrink-0 type-caption-strong"
                            >
                              {stepOf(entry.row.path)}
                            </span>
                            <code
                              data-studio-chrome=""
                              class="w-24 shrink-0 truncate text-text-muted"
                            >
                              {entry.row.path}
                            </code>
                            <span
                              data-studio-specimen=""
                              class="min-w-0 flex-1"
                            >
                              <ScaleBar
                                fill={acting()}
                                variable={entry.row.variable}
                                px={entry.px}
                                maxPx={rampMax()}
                                onCommit={(rem) =>
                                  steps.commit(entry.row.path, rem)
                                }
                                onPreview={(rem) =>
                                  steps.preview(entry.row.path, rem)
                                }
                                onCancel={steps.abandon}
                              />
                            </span>
                            <code
                              data-studio-chrome=""
                              class="w-16 shrink-0 text-right tabular-nums"
                            >
                              {shownVal()}
                            </code>
                            <span
                              data-studio-chrome=""
                              class="w-12 shrink-0 text-right type-code text-text-muted tabular-nums"
                            >
                              {shownPx() !== undefined
                                ? `${Math.round(shownPx()!)}px`
                                : ""}
                            </span>
                            <code
                              data-studio-chrome=""
                              class="w-12 shrink-0 text-right text-text-muted tabular-nums"
                            >
                              {ratioAt(index())}
                            </code>
                          </span>
                        </button>
                      </li>
                    );
                  }}
                </For>
              </ul>
            </Frame>

            <div
              class="min-w-0"
              classList={{ "lg:sticky lg:top-4": !inDrawer() }}
            >
              <Show when={selected()}>
                {(entry) => {
                  const shownVal = () =>
                    steps.shown(entry().row.path, entry().row.value);
                  const shownPx = () => toPx(shownVal()) ?? entry().px ?? 0;
                  return (
                    <Frame class="stack">
                      <div
                        data-studio-chrome=""
                        class="split items-baseline gap-2"
                      >
                        <div class="row-sm items-baseline">
                          <span class="type-body-strong">
                            Step {stepOf(entry().row.path)}
                          </span>
                          <code class="text-text-muted">
                            {entry().row.path}
                          </code>
                        </div>
                        <span class="rounded-md bg-surface-sunken px-2 py-0 type-code text-text-muted tabular-nums">
                          {Math.round(shownPx())}px
                        </span>
                      </div>
                      <div data-studio-chrome="">
                        <ValueInput
                          value={entry().row.value}
                          type={entry().row.type}
                          onCommit={(value) =>
                            steps.commit(entry().row.path, value)
                          }
                          group={steps.rows().map((row) => row.value)}
                          variable={entry().row.variable}
                          label={entry().row.path}
                          onPreview={(value) =>
                            steps.preview(entry().row.path, value)
                          }
                          onCancel={steps.abandon}
                          proposed={shownVal()}
                        />
                      </div>
                      <div data-studio-specimen="">
                        <StepFigures
                          row={entry().row}
                          fill={acting()}
                          edge={colour("color.border-strong")}
                        />
                      </div>
                    </Frame>
                  );
                }}
              </Show>
            </div>
          </div>
        </Show>
      </Section>

      <Section
        title="Breakpoints"
        fact={`${breakpoints.rows().length} widths`}
        tone="accent"
        info="Viewport min-width thresholds for responsive prefixes (sm:, md:, lg:, xl:)."
        aside={
          <LinkToggle
            group="breakpoint"
            ratio={breakpoints.activeRatio()}
          />
        }
      >
        <Show
          when={breakpoints.rows().length > 0}
          fallback={
            <p class="text-text-muted">
              This theme declares no breakpoints yet.
            </p>
          }
        >
          <Frame class="stack">
            <div
              data-studio-specimen=""
              class="stack-sm rounded-md border border-border bg-surface-sunken p-4"
            >
              <For each={breakpoints.rows()}>
                {(row) => {
                  const shown = () => breakpoints.shown(row.path, row.value);
                  const pct = () =>
                    Math.max(8, ((toPx(shown()) ?? 0) / widest()) * 100);
                  return (
                    <div class="row-sm items-center gap-3">
                      <span class="w-10 shrink-0 type-caption-strong">
                        {row.path.split(".").pop()}
                      </span>
                      <div class="h-4 min-w-0 flex-1 overflow-hidden rounded-sm bg-surface">
                        <div
                          class="h-full rounded-sm"
                          style={{
                            background: colour("color.accent"),
                            width: `${pct()}%`,
                          }}
                        />
                      </div>
                      <code class="w-16 shrink-0 text-right text-text-muted tabular-nums">
                        {shown()}
                      </code>
                    </div>
                  );
                }}
              </For>
            </div>
            <ul>
              <For each={breakpoints.rows()}>
                {(row) => (
                  <TokenLine
                    path={row.path}
                    utility={`${row.path.split(".").pop()}:*`}
                    editor={
                      <ValueInput
                        value={row.value}
                        type={row.type}
                        onCommit={(value) =>
                          breakpoints.commit(row.path, value)
                        }
                        group={breakpoints.rows().map((r) => r.value)}
                        variable={row.variable}
                        label={row.path}
                        onPreview={(value) =>
                          breakpoints.preview(row.path, value)
                        }
                        onCancel={breakpoints.abandon}
                        proposed={breakpoints.shown(row.path, row.value)}
                      />
                    }
                  />
                )}
              </For>
            </ul>
          </Frame>
        </Show>
      </Section>
    </ConcernPage>
  );
}

function StepFigures(props: {
  row: TokenRow;
  fill: string | undefined;
  edge: string | undefined;
}) {
  const step = () => stepOf(props.row.path);
  return (
    <div class="stack-sm">
      <div class="stack-xs rounded-md border border-border bg-surface-sunken p-3">
        <div class="split items-center">
          <span class="type-caption-strong">Container padding</span>
          <code class="text-text-muted">{`p-${step()}`}</code>
        </div>
        <div
          class="spin-preview overflow-hidden rounded-sm border border-dashed bg-surface"
          style={{
            "border-color": props.edge,
            padding: `var(${props.row.variable})`,
          }}
        >
          <div
            class="h-6 w-full rounded-sm"
            style={{ background: props.fill }}
          />
        </div>
      </div>
      <div class="stack-xs rounded-md border border-border bg-surface-sunken p-3">
        <div class="split items-center">
          <span class="type-caption-strong">Stack / row gap</span>
          <code class="text-text-muted">{`gap-${step()}`}</code>
        </div>
        <div
          class="spin-preview flex items-center overflow-hidden rounded-sm border border-border bg-surface p-2"
          style={{ gap: `var(${props.row.variable})` }}
        >
          <div
            class="h-6 w-10 shrink-0 rounded-sm"
            style={{ background: props.fill }}
          />
          <div
            class="h-6 w-10 shrink-0 rounded-sm"
            style={{ background: props.fill }}
          />
          <div
            class="h-6 w-10 shrink-0 rounded-sm"
            style={{ background: props.fill }}
          />
        </div>
      </div>
    </div>
  );
}

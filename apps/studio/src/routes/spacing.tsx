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
import { analyzeTheme } from "../lib/theme.ts";
import { actingColour, tokenValue } from "../lib/overview.ts";
import { groupTokens, toPx } from "../lib/tokens.ts";
import type { TokenRow } from "../lib/tokens.ts";
import { activeMode, themeText } from "../lib/store.ts";
import { createLockstep } from "../lib/lockstep.ts";

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
  const tree = createMemo(() => analyzeTheme(themeText()).tree);
  const stepRows = createMemo(() => {
    const current = tree();
    return current ? groupTokens(current, [["spacing"]], activeMode()) : [];
  });
  const steps = createLockstep(() => stepRows(), "spacing");
  const breakpointRows = createMemo(() => {
    const current = tree();
    return current ? groupTokens(current, [["breakpoint"]], activeMode()) : [];
  });
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
    <ConcernPage
      title="Spacing"
      note="Every gap, pad and inset is one of these steps, and a step only means something beside the others, so the scale is drawn as a ramp."
    >
      <Section
        title="Scale"
        fact={`${steps.rows().length} steps`}
        note="The ramp: each step on one track, each step against the ratio that made it. A row opens the step's editor and its two applied figures."
        aside={<LinkToggle group="spacing" ratio={steps.activeRatio()} />}
      >
        <Show
          when={steps.rows().length > 0}
          fallback={
            <p class="text-sm text-text-muted">
              This theme declares no spacing steps yet.
            </p>
          }
        >
          <ul class="flow-list">
            <For each={ramp()}>
              {(entry, index) => (
                <li>
                  {
                    /* `bare` keeps the primitive's flex centering, so the row
                      span fills the button rather than being aligned by
                      text-align — the columns line up across rows only then.
                      The row that is in play wears the acting colour on its
                      edge, the way the overview marks the theme being edited.
                      The edge is drawn by a VARIANT, because a variant is
                      worth more than the colour it competes with: a row
                      that is transparent by default cannot also be told to
                      be primary without the two arguing over one edge. */
                  }
                  <button
                    type="button"
                    class="bare w-full select-none text-text"
                    aria-pressed={selected()?.row.path === entry.row.path}
                    onClick={() => setSelectedPath(entry.row.path)}
                  >
                    <span
                      class="row-sm w-full gap-3 rounded-md border border-transparent px-2 py-2 data-[current]:border-primary"
                      data-current={selected()?.row.path === entry.row.path
                        ? ""
                        : undefined}
                      classList={{
                        "bg-surface-raised": selected()?.row.path ===
                          entry.row.path,
                      }}
                    >
                      <code class="w-24 shrink-0 truncate">
                        {entry.row.path}
                      </code>
                      <span class="min-w-0 flex-1">
                        <ScaleBar
                          fill={acting()}
                          variable={entry.row.variable}
                          px={entry.px}
                          maxPx={rampMax()}
                          onCommit={(rem) => steps.commit(entry.row.path, rem)}
                          onPreview={(rem) =>
                            steps.preview(entry.row.path, rem)}
                          onCancel={steps.abandon}
                        />
                      </span>
                      <code class="w-16 shrink-0 text-right tabular-nums">
                        {steps.shown(entry.row.path, entry.row.value)}
                      </code>
                      <code class="w-10 shrink-0 text-right tabular-nums">
                        {ratioAt(index())}
                      </code>
                    </span>
                  </button>
                </li>
              )}
            </For>
          </ul>

          <Show when={selected()}>
            {(entry) => (
              <Frame>
                <div class="row-sm flex-wrap justify-between gap-3">
                  <code>
                    {entry().row.path}
                  </code>
                  <ValueInput
                    value={entry().row.value}
                    type={entry().row.type}
                    onCommit={(value) => steps.commit(entry().row.path, value)}
                    group={steps.rows().map((row) => row.value)}
                    variable={entry().row.variable}
                    label={entry().row.path}
                    onPreview={(value) =>
                      steps.preview(entry().row.path, value)}
                    onCancel={steps.abandon}
                    proposed={steps.shown(entry().row.path, entry().row.value)}
                  />
                </div>
                <StepFigures
                  row={entry().row}
                  fill={acting()}
                  edge={colour("color.border-strong")}
                />
              </Frame>
            )}
          </Show>
        </Show>
      </Section>

      <Section
        title="Breakpoints"
        fact={`${breakpoints.rows().length} widths`}
        tone="accent"
        note="The viewport widths a layout changes at. Each is shown as a share of the widest this theme declares, which is the only relative fact about one."
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
            <p class="text-sm text-text-muted">
              This theme declares no breakpoints yet.
            </p>
          }
        >
          <Frame>
            <div class="flex flex-wrap items-end gap-4">
              <For each={breakpoints.rows()}>
                {(row) => (
                  <figure class="stack-sm w-24">
                    <div class="h-4 overflow-hidden rounded-sm bg-surface-sunken">
                      <div
                        class="h-full rounded-sm"
                        style={{
                          background: colour("color.accent"),
                          width: `${
                            ((toPx(row.value) ?? 0) / widest()) * 100
                          }%`,
                        }}
                      />
                    </div>
                    <figcaption class="truncate text-center">
                      {row.path.split(".").pop()}
                    </figcaption>
                  </figure>
                )}
              </For>
            </div>
          </Frame>
          <ul class="flow-list">
            <For each={breakpoints.rows()}>
              {(row) => (
                <TokenLine
                  path={row.path}
                  editor={
                    <ValueInput
                      value={row.value}
                      type={row.type}
                      onCommit={(value) => breakpoints.commit(row.path, value)}
                      group={breakpoints.rows().map((r) => r.value)}
                      variable={row.variable}
                      label={row.path}
                      onPreview={(value) =>
                        breakpoints.preview(row.path, value)}
                      onCancel={breakpoints.abandon}
                      proposed={breakpoints.shown(row.path, row.value)}
                    />
                  }
                />
              )}
            </For>
          </ul>
        </Show>
      </Section>
    </ConcernPage>
  );
}

/**
 * One step spent two ways: as padding around a box, and as a gap between
 * boxes — the step's own utility, `p-4` and `gap-4`, spent on real boxes.
 *
 * The step is read through its own custom property rather than through the
 * utility: a utility is a name the sheet has to have been told about, and
 * the scale's steps are named by the theme, so the property is the only
 * spelling that is right for every one of them. The caption still says what
 * an author writes.
 */
function StepFigures(props: {
  row: TokenRow;
  fill: string | undefined;
  edge: string | undefined;
}) {
  const step = () => stepOf(props.row.path);
  return (
    <div class="row-sm flex-wrap items-start gap-4">
      <figure class="stack-sm">
        <div class="spin-preview">
          <div
            class="border border-dashed"
            style={{
              "border-color": props.edge,
              padding: `var(${props.row.variable})`,
            }}
          >
            <div
              class="h-3 w-10 rounded-sm"
              style={{ background: props.fill }}
            />
          </div>
        </div>
        <figcaption>{`p-${step()}`}</figcaption>
      </figure>
      <figure class="stack-sm">
        <div
          class="spin-preview flex"
          style={{ gap: `var(${props.row.variable})` }}
        >
          <div class="h-3 w-3 rounded-sm" style={{ background: props.fill }} />
          <div class="h-3 w-3 rounded-sm" style={{ background: props.fill }} />
        </div>
        <figcaption>
          {`gap-${step()}`}
        </figcaption>
      </figure>
    </div>
  );
}

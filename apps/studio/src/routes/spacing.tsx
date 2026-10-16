import { createMemo, createSignal, For, Show } from "solid-js";
import ValueInput from "../components/demos/ValueInput";
import ScaleBar from "../components/demos/ScaleBar";
import ScaleControl from "../components/demos/ScaleControl";
import Page from "../components/Page";
import { analyzeTheme } from "../lib/theme";
import { groupTokens, toPx } from "../lib/tokens";
import type { TokenRow } from "../lib/tokens";
import { activeMode, themeText } from "../lib/store";
import { editToken, editTokens } from "../lib/editing";
import type { TokenEdit } from "../lib/editing";

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
 * that step's own utility in the preview scope below. The scale control at
 * the head moves every step by one factor, because a scale is one decision
 * rather than eight.
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
  const scale = (edits: readonly TokenEdit[]) => editTokens(edits);

  // The ramp, shortest bar first: the order is the comparison, and a step
  // the length parser cannot read still has to appear — at the end, where
  // its row simply claims no ratio.
  const ramp = createMemo(() =>
    steps()
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
    <Page
      title="Spacing"
      note="Every gap, pad and inset is one of these steps. The ramp shows the scale itself — each bar on one track, each step against the ratio that made it — and a row opens the step's editor and its two applied figures."
    >
      <section class="stack-sm" aria-label="Scale">
        <h2 class="text-xl">Scale</h2>
        <Show
          when={steps().length > 0}
          fallback={
            <p class="text-sm text-text-muted">
              This theme declares no spacing steps yet.
            </p>
          }
        >
          <ScaleControl
            rows={steps()}
            label="Scale every step together"
            onScale={scale}
          />
          <ul class="flow-list stack-sm">
            <For each={ramp()}>
              {(entry, index) => (
                <li>
                  {
                    /* `bare` keeps the primitive's flex centering, so the row
                    span fills the button rather than being aligned by
                    text-align — the columns line up across rows only then. */
                  }
                  <button
                    type="button"
                    class="bare w-full select-none text-text"
                    aria-pressed={selected()?.row.path === entry.row.path}
                    onClick={() => setSelectedPath(entry.row.path)}
                  >
                    <span
                      class="row-sm w-full gap-3 rounded-md px-2 py-2"
                      classList={{
                        "bg-surface-raised":
                          selected()?.row.path === entry.row.path,
                      }}
                    >
                      <code class="w-24 shrink-0 truncate text-xs text-text-muted">
                        {entry.row.path}
                      </code>
                      <span class="min-w-0 flex-1">
                        <ScaleBar
                          variable={entry.row.variable}
                          px={entry.px}
                          maxPx={rampMax()}
                          onCommit={(rem) => edit(entry.row, rem)}
                        />
                      </span>
                      <code class="w-16 shrink-0 text-right text-xs">
                        {entry.row.value}
                      </code>
                      <code class="w-10 shrink-0 text-right text-xs text-text-muted">
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
              <div class="panel stack-sm">
                <div class="row-sm flex-wrap justify-between gap-3">
                  <code class="text-xs text-text-muted">
                    {entry().row.path}
                  </code>
                  <ValueInput
                    value={entry().row.value}
                    type={entry().row.type}
                    onCommit={(value) => edit(entry().row, value)}
                    group={steps().map((row) => row.value)}
                    variable={entry().row.variable}
                    label={entry().row.path}
                  />
                </div>
                <StepFigures row={entry().row} />
              </div>
            )}
          </Show>
        </Show>
      </section>

      <section class="stack-sm" aria-label="Breakpoints">
        <h2 class="text-xl">Breakpoints</h2>
        <p class="text-sm text-text-muted">
          The viewport widths a layout changes at. Each is shown as a share of
          the widest this theme declares, which is the only relative fact about
          one.
        </p>
        <Show
          when={breakpoints().length > 0}
          fallback={
            <p class="text-sm text-text-muted">
              This theme declares no breakpoints yet.
            </p>
          }
        >
          <ScaleControl
            rows={breakpoints()}
            label="Scale every breakpoint together"
            onScale={scale}
          />
          <ul class="flow-list stack-sm">
            <For each={breakpoints()}>
              {(row) => (
                <li class="panel stack-sm">
                  <div class="row-sm flex-wrap justify-between gap-3">
                    <code class="text-xs text-text-muted">{row.path}</code>
                    <ValueInput
                      value={row.value}
                      type={row.type}
                      onCommit={(value) => edit(row, value)}
                      group={breakpoints().map((r) => r.value)}
                      variable={row.variable}
                      label={row.path}
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
    </Page>
  );
}

/**
 * One step spent two ways: as padding around a box, and as a gap between
 * boxes, both inside the preview scope so they spend the step's own
 * utility — `p-4` and `gap-4` — rather than a width read through a custom
 * property, which is the difference between showing the token and showing
 * a box that happens to be that size.
 */
function StepFigures(props: { row: TokenRow }) {
  const step = () => stepOf(props.row.path);
  return (
    <div class="row-sm flex-wrap items-start gap-4">
      <figure class="stack-sm">
        <div class="spin-preview">
          <div
            class={`border border-dashed border-border-strong ${`p-${step()}`}`}
          >
            <div class="bg-primary h-3 w-10 rounded-sm" />
          </div>
        </div>
        <figcaption class="text-xs text-text-muted">{`p-${step()}`}</figcaption>
      </figure>
      <figure class="stack-sm">
        <div class={`spin-preview flex ${`gap-${step()}`}`}>
          <div class="bg-primary h-3 w-3 rounded-sm" />
          <div class="bg-primary h-3 w-3 rounded-sm" />
        </div>
        <figcaption class="text-xs text-text-muted">
          {`gap-${step()}`}
        </figcaption>
      </figure>
    </div>
  );
}

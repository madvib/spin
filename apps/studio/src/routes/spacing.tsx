import { createMemo, For } from "solid-js";
import { analyzeTheme } from "../lib/theme";
import { groupTokens, toPx } from "../lib/tokens";
import { activeMode, themeText } from "../lib/store";
import { editToken } from "../lib/editing";
import ScaleBar from "../components/demos/ScaleBar";


/**
 * Spacing — the scale, as lengths.
 *
 * A column of steps is a column of numbers: `0.25rem` beside `4rem` says
 * nothing about the gap between them, and the reader has to multiply to know
 * which step fits a card's padding. So a row's bar IS its value — the width
 * reads the theme's own custom property, the way the app spends it — and the
 * scale reads as relative lengths instead. Drag the bar to resize the step,
 * or set the step beside it; both write the same token.
 *
 * Breakpoints stay a readout: they are viewport widths a layout changes at,
 * not lengths inside it, and the editor above is the only path to a value.
 */
export default function SpacingPage() {
  const tree = createMemo(() => analyzeTheme(themeText()).tree);
  const tokens = createMemo(() => {
    const current = tree();
    return current ? groupTokens(current, [["spacing"]], activeMode()) : [];
  });
  const breakpoints = createMemo(() => {
    const current = tree();
    return current ? groupTokens(current, [["breakpoint"]], activeMode()) : [];
  });

  return (
    <div class="drawer-scroll flex-1 overflow-y-auto p-4 min-h-0 min-w-0 stack">
      <div>
        <h1 class="text-2xl">Spacing</h1>
        <p>
          Every gap, pad and inset is one of these steps. A row's bar is its
          value — the width IS the step — so the scale reads as lengths rather
          than numbers. Drag a bar to resize the step, or set the step beside
          it. Values stay on the type scale.
        </p>
      </div>

      <section class="stack-sm">
        <h2 class="text-xl">Scale</h2>
        <div class="stack-sm">
          <For each={tokens()}>
            {(row) => (
              <ScaleBar
                label={row.path}
                variable={row.variable}
                px={toPx(row.value)}
                onCommit={(rem) => editToken(row.path.split("."), rem)}
              />
            )}
          </For>
        </div>
      </section>

      <section class="stack-sm">
        <h2 class="text-xl">Breakpoints</h2>
        <p class="text-text-muted">
          The viewport widths a layout changes at. Read them, do not restyle
          them — the editor above is the only path to a value.
        </p>
        <div class="stack-sm">
          <For each={breakpoints()}>
            {(row) => (
              <div class="split panel">
                <code class="w-[10rem]">{row.path}</code>
                {
                  /*
                  A class built at runtime never reaches the scanner, so
                  `max-w-screen-${name}` styles nothing. The value is the demo:
                  what a breakpoint is worth is the whole fact about it.
                */
                }
                <code class="flex-1">{row.value}</code>
                <code class="font-mono text-xs opacity-70">
                  {toPx(row.value) === undefined ? "" : `${toPx(row.value)}px`}
                </code>
              </div>
            )}
          </For>
        </div>
      </section>
    </div>
  );
}

import { createMemo, For } from "solid-js";
import { analyzeTheme } from "../lib/theme";
import { groupTokens } from "../lib/tokens";
import { activeMode, themeText } from "../lib/store";
import { editToken } from "../lib/editing";
import ScaleBar from "../components/demos/ScaleBar";
import { Card } from "../components/spin.tsx";

function toPx(value: string): number | undefined {
  if (value.trim() === "0") return 0;
  const match = value.trim().match(/^(-?[\d.]+)rem$/);
  if (match) return Number(match[1]) * 16;
  return undefined;
}

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
    <div class="flex-1 overflow-y-auto p-4 min-h-0 min-w-0">
      <h1 class="text-2xl">Spacing</h1>
      <p>Drag a bar to resize the step. Values stay on the type scale.</p>
      <div class="flex flex-col gap-4">
        <For each={tokens()}>
          {(row) => (
            <ScaleBar
              label={row.path}
              px={toPx(row.value)}
              onCommit={(rem) => editToken(row.path.split("."), rem)}
            />
          )}
        </For>
      </div>
      <h2 class="text-xl">Breakpoints</h2>
      <p>
        The viewport widths a layout changes at. Read them, do not restyle them
        — the editor above is the only path to a value.
      </p>
      <div class="flex flex-col gap-2">
        <For each={breakpoints()}>
          {(row) => (
            <Card class="split p-4">
              <code class="w-40">{row.path}</code>
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
            </Card>
          )}
        </For>
      </div>
    </div>
  );
}

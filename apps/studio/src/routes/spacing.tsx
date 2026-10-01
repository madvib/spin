import { createMemo, For } from "solid-js";
import { analyzeTheme } from "../lib/theme";
import { groupTokens } from "../lib/tokens";
import { activeMode, themeText } from "../lib/store";
import { editToken } from "../lib/editing";
import ScaleBar from "../components/demos/ScaleBar";
import TokenGroupEditor from "../components/demos/TokenGroupEditor";

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
      <div class="flex flex-col gap-4">
        <For each={breakpoints()}>
          {(row) => (
            <div class="flex items-center gap-4 bg-surface-raised rounded-lg shadow-sm p-4 border border-border">
              <code>{row.path}</code>
              <div
                class={`h-4 bg-primary max-w-screen-${
                  row.path.split(".").pop()
                }`}
              >
                <div class="h-4 w-full bg-neutral-100 opacity-50" />
              </div>
              <code>{row.value}</code>
            </div>
          )}
        </For>
      </div>
      <h2 class="text-xl">Tokens</h2>
      <TokenGroupEditor tokens={tokens()} onEdit={editToken} />
    </div>
  );
}

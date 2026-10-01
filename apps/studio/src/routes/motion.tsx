import { createMemo, For } from "solid-js";
import PlayRig from "../components/demos/PlayRig";
import TokenGroupEditor from "../components/demos/TokenGroupEditor";
import { analyzeTheme } from "../lib/theme";
import { groupTokens } from "../lib/tokens";
import { activeMode, themeText } from "../lib/store";
import { editToken } from "../lib/editing";

export default function MotionPage() {
  const tree = createMemo(() => analyzeTheme(themeText()).tree);
  const tokens = createMemo(() => {
    const current = tree();
    return current ? groupTokens(current, [["motion"]], activeMode()) : [];
  });
  const durations = createMemo(() =>
    tokens()
      .filter((row) => row.path.startsWith("motion.duration."))
      .map((row) => row.path.split(".").slice(2).join("-"))
  );
  const easings = createMemo(() =>
    tokens()
      .filter((row) => row.path.startsWith("motion.easing."))
      .map((row) => row.path.split(".").slice(2).join("-"))
  );

  return (
    <div class="flex-1 overflow-y-auto p-4 min-h-0 min-w-0">
      <h1 class="text-2xl">Motion</h1>
      <p>Durations and easings with a play rig per value.</p>
      <div class="flex flex-wrap gap-4">
        <For each={durations()}>
          {(name) => (
            <div class="bg-surface-raised rounded-lg shadow-sm p-4 border border-border">
              <PlayRig utility={`duration-${name}`} />
              <code>duration-{name}</code>
            </div>
          )}
        </For>
        <For each={easings()}>
          {(name) => (
            <div class="bg-surface-raised rounded-lg shadow-sm p-4 border border-border">
              <PlayRig utility={`ease-${name}`} />
              <code>ease-{name}</code>
            </div>
          )}
        </For>
      </div>
      <h2 class="text-xl">Tokens</h2>
      <TokenGroupEditor tokens={tokens()} onEdit={editToken} />
    </div>
  );
}

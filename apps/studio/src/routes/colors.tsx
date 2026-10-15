import { createMemo } from "solid-js";
import TokenGroupEditor from "../components/demos/TokenGroupEditor";
import { analyzeTheme } from "../lib/theme";
import { sectionTokens } from "../lib/tokens";
import { activeMode, themeText } from "../lib/store";
import { editToken } from "../lib/editing";

export default function ColorsPage() {
  const tree = createMemo(() => analyzeTheme(themeText()).tree);
  const tokens = createMemo(() => {
    const current = tree();
    return current ? sectionTokens(current, "background", activeMode()) : [];
  });

  return (
    <div class="flex-1 overflow-y-auto p-4 min-h-0 min-w-0">
      <h1 class="text-2xl">Colors</h1>
      <p>Every color token. Editing writes to the active mode.</p>
      <TokenGroupEditor tokens={tokens()} onEdit={editToken} swatch />
    </div>
  );
}

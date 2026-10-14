import { createMemo, For, Show } from "solid-js";
import { A } from "@solidjs/router";
import { analyzeTheme, rootDescription } from "../lib/theme";
import { groupTokens } from "../lib/tokens";
import {
  activeMode,
  activeName,
  themeSummaries,
  themeText,
} from "../lib/store";

export default function OverviewPage() {
  const tree = createMemo(() => analyzeTheme(themeText()).tree);
  const report = createMemo(() => {
    const state = analyzeTheme(themeText());
    return {
      issues: [
        ...(state.error ? [state.error] : []),
        ...state.issues.map((issue) =>
          `${issue.path || "(document)"}: ${issue.message}`
        ),
      ],
    };
  });
  const colors = createMemo(() => {
    const current = tree();
    return current ? groupTokens(current, [["color"]], activeMode()) : [];
  });
  const families = createMemo(() => {
    const current = tree();
    const rows = current
      ? groupTokens(current, [["font", "family"]], activeMode())
      : [];
    return rows.slice(0, 3);
  });
  const steps = createMemo(() => {
    const current = tree();
    const rows = current
      ? groupTokens(current, [["spacing"]], activeMode())
      : [];
    return rows.slice(0, 4);
  });
  const iconGroups = createMemo(() => {
    const current = tree();
    if (!current) return [];
    const names = new Set<string>();
    for (const node of current) {
      if (node.kind === "group" && node.name.toLowerCase().includes("icon")) {
        names.add(node.name);
      }
    }
    return [...names];
  });

  return (
    <div class="flex-1 overflow-y-auto p-4 min-h-0 min-w-0">
      <h1 class="text-2xl">{activeName()}</h1>
      <p class="text-text-muted">
        {themeSummaries().find((summary) => summary.name === activeName())
          ?.file ?? "packages/theme/src/themes"} ·{" "}
        {rootDescription(themeText())}
      </p>
      {
        /* The verdict is the answer to the only question this page is asked:
           does the theme hold together? It comes first and says so either
           way, because a silent readiness signal is a signal nobody reads. */
      }
      <Show
        when={report().issues.length === 0}
        fallback={
          <alert variant="danger">
            {report().issues.length} issue
            {report().issues.length === 1 ? "" : "s"}{" "}
            · the first is what to fix before anything looks wrong
          </alert>
        }
      >
        <alert variant="success">
          Ties together — every legibility check passes in the {activeMode()}
          {" "}
          mode
        </alert>
      </Show>
      <h2 class="text-xl">Palette</h2>
      <div class="flex flex-wrap gap-4">
        <For each={colors()}>
          {(row) => {
            const suffix = row.path.split(".").slice(1).join("-")
              .toLowerCase();
            return (
              <div class="stack-sm-sm items-start">
                <div
                  class={`h-16 w-24 rounded-md shadow-sm bg-${suffix}`}
                />
                <code class="text-xs">{suffix}</code>
              </div>
            );
          }}
        </For>
      </div>
      <h2 class="text-xl">Type</h2>
      {
        /* One specimen per family, each named. Three identical sentences
           with no header is three sentences nobody reads — the name is what
           makes the comparison a decision. */
      }
      <div class="stack">
        <For each={families()}>
          {(row) => {
            const name = row.path.split(".").slice(2).join("-");
            return (
              <div class="stack-sm-sm">
                <code class="text-xs">{name}</code>
                <p class={`font-${name} text-lg`}>Agile foxes jump quickly.</p>
              </div>
            );
          }}
        </For>
      </div>
      <h2 class="text-xl">Spacing</h2>
      <div class="flex items-end gap-4">
        <For each={steps()}>
          {(row) => {
            const name = row.path.split(".").slice(1).join("-");
            return (
              <div class="flex flex-col gap-4">
                <div class={`bg-text p-${name}`}>
                  <div class="h-4 w-4 bg-surface-raised" />
                </div>
                <code>{name}</code>
              </div>
            );
          }}
        </For>
      </div>
      <h2 class="text-xl">Assets</h2>
      <Show
        when={iconGroups().length > 0}
        fallback={<p>No icon or font source tokens declared.</p>}
      >
        <For each={iconGroups()}>
          {(group) => <p>Icon group: {group}</p>}
        </For>
      </Show>
      <h2 class="text-xl">Surfaces</h2>
      <p>
        <A href="/surfaces">Corners, edges, elevation, and layering</A>
        {" · "}
        <A href="/motion">Motion</A>
        {" · "}
        <A href="/utilities">Utility explorer</A>
      </p>
    </div>
  );
}

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
      <p>
        {themeSummaries().find((summary) => summary.name === activeName())
          ?.file ?? "apps/docs/themes"} · {rootDescription(themeText())}
      </p>
      <Show when={report().issues.length > 0}>
        <ul>
          <For each={report().issues}>
            {(issue) => <li>{issue}</li>}
          </For>
        </ul>
      </Show>
      <h2 class="text-xl">Palette</h2>
      <div class="flex flex-wrap gap-4">
        <For each={colors().slice(0, 12)}>
          {(row) => (
            <div
              class={`h-8 w-16 bg-${
                row.path.split(".").slice(1).join("-").toLowerCase()
              }`}
            />
          )}
        </For>
      </div>
      <h2 class="text-xl">Type</h2>
      <For each={families()}>
        {(row) => {
          const name = row.path.split(".").slice(2).join("-");
          return <p class={`font-${name}`}>Agile foxes jump quickly.</p>;
        }}
      </For>
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

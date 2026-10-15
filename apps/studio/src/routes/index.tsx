/**
 * Overview — the theme's dashboard.
 *
 * The question this page exists to answer is "does this theme hold
 * together, and what would changing it move?" So it leads with the verdict
 * and the identity, and it stops. A wall of thirty swatches answers a
 * different question — "what is `color.neutral.300` worth?" — and that
 * question is what the Color page is for, reached by one link.
 *
 * What stays: the verdict, who the theme is, the handful of tokens whose
 * change is visible everywhere, and counts that tell you how much is behind
 * each link. Everything else is a click away rather than a scroll away.
 */
import { createMemo, For, Show } from "solid-js";
import { A } from "@solidjs/router";
import { ThemePicker } from "../components/Settings.tsx";
import { analyzeTheme, rootDescription } from "../lib/theme.ts";
import { groupTokens } from "../lib/tokens.ts";
import {
  activeMode,
  activeName,
  library,
  themeSummaries,
  themeText,
} from "../lib/store.ts";

/** The tokens whose change is felt everywhere, with the face that shows them. */
const KEY_TOKENS = [
  {
    path: ["color", "primary"],
    label: "Primary",
    note: "actions and emphasis",
  },
  { path: ["color", "surface"], label: "Surface", note: "the page itself" },
  { path: ["color", "text"], label: "Text", note: "everything you read" },
  { path: ["color", "border"], label: "Border", note: "every edge" },
  {
    path: ["font", "family", "heading"],
    label: "Headings",
    note: "the display face",
  },
  { path: ["font", "family", "body"], label: "Body", note: "paragraphs" },
] as const;

/** Token path to the label and note that name it, for the read-out. */
const TOKEN_LOOKUP = new Map<string, { label: string; note: string }>(
  KEY_TOKENS.map((
    token,
  ) => [token.path.join("."), { label: token.label, note: token.note }]),
);

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
  const active = () =>
    themeSummaries().find((summary) => summary.name === activeName());

  const keyTokens = createMemo(() => {
    const state = tree();
    if (state === undefined) return [];
    return groupTokens(
      state,
      KEY_TOKENS.map((token) => [...token.path]),
      activeMode(),
    )
      .map((token) => {
        const found = TOKEN_LOOKUP.get(token.path);
        return found === undefined ? undefined : { token, ...found };
      })
      .filter((entry): entry is NonNullable<typeof entry> =>
        entry !== undefined
      );
  });

  const counts = createMemo(() => {
    const state = tree();
    if (state === undefined) return { color: 0, space: 0 };
    return {
      color: groupTokens(state, [["color"]], activeMode()).length,
      space: groupTokens(
        state,
        [["spacing"], ["radius"], ["shadow"]],
        activeMode(),
      ).length,
    };
  });

  return (
    <div class="drawer-scroll flex-1 overflow-y-auto p-4 min-h-0 min-w-0">
      <Show when={report().issues.length > 0}>
        <alert variant="danger" class="mb-4">
          {report().issues.length} issue
          {report().issues.length === 1 ? "" : "s"}{" "}
          · the first is what to fix before anything looks wrong
        </alert>
      </Show>

      <header class="row-sm mb-6 max-w-screen-md">
        <h1 class="text-3xl">{activeName()}</h1>
        <span class="text-text-muted text-sm">
          {counts().color} colors · {counts().space} style tokens ·{" "}
          {(library() ?? []).length} components
        </span>
        <span class="flex-1" />
        <ThemePicker compact />
      </header>
      <p>{rootDescription(themeText())}</p>

      <section class="stack mb-6">
        <h2 class="text-xl">What moves everything</h2>
        <div class="flex flex-wrap gap-4">
          <For each={keyTokens()}>
            {({ token, label, note }) => (
              <A
                href={`/${token.path.startsWith("font") ? "type" : "colors"}`}
                class="stack-sm w-[14rem] rounded-lg border border-border bg-surface-raised p-4 no-underline"
              >
                <span class="flex items-center gap-3">
                  <span
                    class="h-10 w-10 shrink-0 rounded-md border border-border"
                    style={`background: var(${token.variable})`}
                  />
                  <span class="flex flex-col">
                    <strong class="text-sm">{label}</strong>
                    <code class="text-text-muted text-xs">{token.path}</code>
                  </span>
                </span>
                <span class="text-text-muted text-xs">{note}</span>
              </A>
            )}
          </For>
        </div>
      </section>

      <section class="stack-sm mb-6 max-w-screen-md">
        <h2 class="text-xl">Scale</h2>
        <SpacingStrip />
      </section>

      <details class="stack-sm max-w-screen-md rounded-lg border border-border p-4">
        <summary class="cursor-pointer text-sm text-text-muted">
          Studio preferences
        </summary>
        <ThemePicker full />
      </details>
    </div>
  );
}

/**
 * The spacing scale as one strip: bars grow with the step, so the curve is
 * visible before any value is touched. Editing the whole scale is the next
 * pass; this pass earns the slot by showing the shape.
 */
function SpacingStrip() {
  const tree = createMemo(() => analyzeTheme(themeText()).tree);
  const steps = createMemo(() => {
    const state = tree();
    if (state === undefined) return [];
    return groupTokens(state, [["spacing"]], activeMode());
  });
  const max = createMemo(() =>
    Math.max(1, ...steps().map((step) => parseFloat(step.value) || 0))
  );
  return (
    <A href="/spacing" class="no-underline">
      <div class="flex items-end gap-2" aria-label="Spacing scale">
        <For each={steps()}>
          {(step) => (
            <div class="stack-sm items-center" title={step.path}>
              <div
                class="w-8 rounded-sm bg-primary"
                style={{
                  height: `${
                    Math.max(4, ((parseFloat(step.value) || 0) / max()) * 64)
                  }px`,
                }}
              />
              <span class="text-text-muted text-xs">
                {step.path.split(".").pop()}
              </span>
            </div>
          )}
        </For>
      </div>
    </A>
  );
}

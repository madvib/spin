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
    <div class="flex-1 overflow-y-auto p-4 min-h-0 min-w-0">
      {
        /* The verdict is the answer to the only question this page is asked:
           does the theme hold together? It comes first and says so either
           way, because a silent readiness signal is one nobody reads. */
      }
      <Show
        when={report().issues.length === 0}
        fallback={
          <alert variant="danger" class="mb-4">
            {report().issues.length} issue
            {report().issues.length === 1 ? "" : "s"}{" "}
            · the first is what to fix before anything looks wrong
          </alert>
        }
      >
        <alert variant="success" class="mb-4">
          Ties together — every legibility check passes in the {activeMode()}
          {" "}
          mode
        </alert>
      </Show>

      <header class="stack mb-6 max-w-screen-md">
        <h1 class="font-heading text-3xl">{activeName()}</h1>
        <p class="text-text-muted">{rootDescription(themeText())}</p>
        <p class="text-text-muted text-sm">
          {active()?.file ?? "packages/theme/src/themes"}{" "}
          · switching themes in the picker swaps this whole page
        </p>
      </header>

      {
        /* The handful of tokens whose change is visible everywhere, each a
           link into the editor that owns it. Six of them, not thirty. */
      }
      <section class="stack mb-6">
        <h2 class="text-xl">What moves everything</h2>
        <div class="flex flex-wrap gap-4">
          <For each={keyTokens()}>
            {({ token, label, note }) => (
              <A
                href={`/${token.path.startsWith("font") ? "type" : "colors"}`}
                class="stack-sm w-56 rounded-lg border border-border bg-surface-raised p-4 no-underline"
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

      {
        /* Counts, so the scale of what is behind each link is visible before
           clicking it. */
      }
      <section class="flex flex-wrap gap-8">
        <A href="/colors" class="stack-sm no-underline">
          <strong class="text-3xl">{counts().color}</strong>
          <span class="text-text-muted text-sm">colour tokens</span>
        </A>
        <A href="/surfaces" class="stack-sm no-underline">
          <strong class="text-3xl">{counts().space}</strong>
          <span class="text-text-muted text-sm">space, radius, shadow</span>
        </A>
        <A href="/components" class="stack-sm no-underline">
          <strong class="text-3xl">{(library() ?? []).length}</strong>
          <span class="text-text-muted text-sm">components to see it in</span>
        </A>
      </section>
    </div>
  );
}

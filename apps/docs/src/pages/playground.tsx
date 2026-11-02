/**
 * Dedicated `/playground` world: live-updating markup editor and recipe
 * gallery, ready for inline or full-page Jibe sandbox integration.
 */
import { useSearchParams } from "@solidjs/router";
import { createMemo, For } from "solid-js";
import type { JSX } from "solid-js";
import { WorkspaceLayout } from "../layouts/studio-layout.tsx";
import {
  PlaygroundEmbed,
  PLAYGROUND_RECIPES,
} from "../ui/playground-embed.tsx";

export default function PlaygroundPage(): JSX.Element {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeId = createMemo(() => {
    const raw = searchParams.example;
    const id = Array.isArray(raw) ? raw[0] : raw;
    return PLAYGROUND_RECIPES.some((r) => r.id === id)
      ? id!
      : PLAYGROUND_RECIPES[0]!.id;
  });
  const activeRecipe = createMemo(
    () =>
      PLAYGROUND_RECIPES.find((r) => r.id === activeId()) ??
      PLAYGROUND_RECIPES[0]!,
  );

  return (
    <WorkspaceLayout>
      <main class="mx-auto flex w-full max-w-screen-xl flex-col gap-6 px-6 py-8 md:py-10">
        <div class="flex flex-col gap-2 border-b border-border pb-6">
          <span class="font-mono text-xs font-semibold uppercase tracking-wider text-primary">
            Interactive Sandbox
          </span>
          <h1 class="text-text">Playground</h1>
          <p class="max-w-prose text-text-muted">
            Edit Spin HTML, classless elements, token utilities, and custom
            elements live. Switch themes or light/dark mode in the top bar to
            test your markup across every palette.
          </p>
        </div>

        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <For each={PLAYGROUND_RECIPES}>
            {(recipe) => {
              const selected = () => activeId() === recipe.id;
              return (
                <button
                  type="button"
                  onClick={() => setSearchParams({ example: recipe.id })}
                  class={`bare flex flex-col items-start gap-1 whitespace-normal rounded-lg border p-3 text-left transition-colors duration-fast ${
                    selected()
                      ? "border-primary bg-surface-raised shadow-sm"
                      : "border-border bg-surface hover:border-border-strong"
                  }`}
                >
                  <span class="font-mono text-xs text-primary">
                    {recipe.category}
                  </span>
                  <span class="text-sm font-semibold text-text">
                    {recipe.title}
                  </span>
                  <span class="text-xs text-text-muted">{recipe.summary}</span>
                </button>
              );
            }}
          </For>
        </div>

        <PlaygroundEmbed
          exampleId={activeRecipe().id}
          title={activeRecipe().title}
        />
      </main>
    </WorkspaceLayout>
  );
}

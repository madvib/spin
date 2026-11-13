/**
 * Playground: Spin across 5 runtimes (vanilla, solid, react, vue, svelte)
 * in a fullscreen Jibe embed. Host picks framework + example; the embed
 * owns chrome, view, and preview mode internally.
 */
import { createSignal, For, Show } from "solid-js";
import type { JSX } from "solid-js";
import {
  activeFileForFramework,
  SpinEmbed,
  type PlaygroundFramework,
} from "../playground/jibe-playground.tsx";
import type { Subject } from "../../examples/shared.ts";

interface Preset {
  readonly title: string;
  readonly subject: Subject;
}

const PRESETS: readonly Preset[] = [
  { title: "Interactive Card", subject: "card" },
  { title: "Theme Token Inspector", subject: "tokens" },
  { title: "Dialog & Form Actions", subject: "dialog" },
];

const FRAMEWORKS: readonly { readonly id: PlaygroundFramework; readonly label: string }[] = [
  { id: "solid", label: "Solid" },
  { id: "react", label: "React" },
  { id: "vue", label: "Vue" },
  { id: "svelte", label: "Svelte" },
  { id: "vanilla", label: "HTML" },
];
export default function PlaygroundPage(): JSX.Element {
  const [preset, setPreset] = createSignal(0);
  const [framework, setFramework] = createSignal<PlaygroundFramework>("solid");
  const [updating, setUpdating] = createSignal(false);
  const [examplesOpen, setExamplesOpen] = createSignal(false);
  const current = (): Preset => PRESETS[preset()] ?? PRESETS[0]!;
  return (
    <div class="flex h-full flex-col bg-surface">
      <div class="relative z-dropdown flex h-10 min-w-0 shrink-0 items-center justify-between gap-3 overflow-visible border-b bg-surface-raised px-4">
        <div class="flex min-w-0 items-center gap-3">
          <div class="relative shrink-0">
            <button
              type="button"
              aria-haspopup="listbox"
              aria-expanded={examplesOpen()}
              onClick={() => setExamplesOpen((open) => !open)}
              class="subtle s-xs inline-flex h-8 items-center gap-2 transition-colors"
            >
              <span class="i-lucide-sparkles icon-sm text-primary" aria-hidden="true" />
              <span>{current().title}</span>
              <span class="i-lucide-chevron-down icon-sm text-muted" aria-hidden="true" />
            </button>
            <Show when={examplesOpen()}>
              <div
                role="listbox"
                aria-label="examples"
                class="absolute left-0 top-full z-dropdown mt-1 min-w-56 rounded-md border bg-surface-raised p-1 shadow-lg"
              >
                <For each={PRESETS}>
                  {(item, index) => (
                    <button
                      type="button"
                      role="option"
                      aria-selected={preset() === index()}
                      onClick={() => {
                        setPreset(index());
                        setExamplesOpen(false);
                      }}
                      class={`bare flex h-8 w-full items-center justify-between gap-2 rounded-sm px-3 text-left type-label transition-colors ${
                        preset() === index()
                          ? "bg-surface text-primary"
                          : "hover:bg-surface"
                      }`}
                    >
                      <span>{item.title}</span>
                      <Show when={preset() === index()}>
                        <span class="i-lucide-check icon-sm text-primary" aria-hidden="true" />
                      </Show>
                    </button>
                  )}
                </For>
              </div>
            </Show>
          </div>

          <div
            role="group"
            aria-label="framework"
            class="inline-flex h-8 items-center gap-1 rounded-md border bg-surface p-1"
          >
            <For each={FRAMEWORKS}>
              {(fw) => {
                const active = () => framework() === fw.id;
                return (
                  <button
                    type="button"
                    aria-pressed={active()}
                    onClick={() => setFramework(fw.id)}
                    class={`bare inline-flex h-6 items-center justify-center rounded-sm px-2 type-caption-emphasized transition-colors ${
                      active()
                        ? "bg-primary text-on-primary"
                        : "text-muted hover:bg-surface-raised"
                    }`}
                  >
                    {fw.label}
                  </button>
                );
              }}
            </For>
          </div>
        </div>

        <Show when={updating()}>
          <span
            role="status"
            class="flex shrink-0 items-center gap-2 type-caption text-muted"
          >
            <span
              class="i-lucide-loader-circle icon-sm animate-spin"
              aria-hidden="true"
            />
            <span>Bundling…</span>
          </span>
        </Show>
      </div>
      <div class="min-h-0 flex-1">
        <SpinEmbed
          files={{}}
          framework={framework()}
          subject={current().subject}
          activeFile={activeFileForFramework(framework())}
          chrome="ide"
          view="split"
          height="h-full"
          onUpdating={setUpdating}
        />
      </div>
    </div>
  );
}

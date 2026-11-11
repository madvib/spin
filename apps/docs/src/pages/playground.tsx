/**
 * Playground: Spin across 5 runtimes (vanilla, solid, react, vue, svelte)
 * in a fullscreen Jibe embed. Host picks framework + example; the embed
 * owns chrome, view, and preview mode internally.
 */
import { A } from "@solidjs/router";
import { createSignal, For, Show } from "solid-js";
import type { JSX } from "solid-js";
import { Logo, ThemePicker } from "@spinjs/kit";
import { version } from "../../../../packages/dev/package.json";
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

const FRAMEWORKS: readonly PlaygroundFramework[] = [
  "vanilla",
  "solid",
  "react",
  "vue",
  "svelte",
];

export default function PlaygroundPage(): JSX.Element {
  const [preset, setPreset] = createSignal(0);
  const [framework, setFramework] = createSignal<PlaygroundFramework>("solid");
  const [updating, setUpdating] = createSignal(false);
  const [examplesOpen, setExamplesOpen] = createSignal(false);
  const current = (): Preset => PRESETS[preset()] ?? PRESETS[0]!;
  return (
    <div class="flex h-full flex-col bg-surface">
      <div class="relative z-dropdown flex h-12 min-w-0 shrink-0 items-center gap-3 overflow-visible border-b bg-surface-raised px-4">
        <A href="/" class="flex shrink-0 items-center gap-2 no-underline" aria-label="spin home">
          <Logo size="sm" />
          <span class="type-code text-muted">v{version}</span>
        </A>
        <div class="relative shrink-0">
          <button
            type="button"
            aria-haspopup="listbox"
            aria-expanded={examplesOpen()}
            onClick={() => setExamplesOpen((open) => !open)}
            class="bare s-sm cursor-pointer rounded-md border bg-surface hover:bg-surface-raised"
          >
            {current().title}
          </button>
          <Show when={examplesOpen()}>
            <div
              role="listbox"
              aria-label="examples"
              class="absolute left-0 top-full z-dropdown mt-1 min-w-64 rounded-md border bg-surface-raised p-1 shadow-lg"
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
                    class={`bare block w-full cursor-pointer rounded-sm px-3 py-1 text-left hover:bg-surface ${
                      preset() === index() ? "type-body-emphasized" : ""
                    }`}
                  >
                    {item.title}
                  </button>
                )}
              </For>
            </div>
          </Show>
        </div>
        <select
          aria-label="framework"
          value={framework()}
          onChange={(event) =>
            setFramework(event.currentTarget.value as PlaygroundFramework)
          }
          class="s-sm w-auto shrink-0 cursor-pointer"
        >
          <For each={FRAMEWORKS}>
            {(name) => <option value={name}>{name}</option>}
          </For>
        </select>
        <Show when={updating()}>
          <span
            role="status"
            class="flex shrink-0 items-center gap-2 type-caption text-muted"
          >
            <span
              class="i-lucide-loader-circle icon-sm animate-spin"
              aria-hidden="true"
            />
            rebuilding…
          </span>
        </Show>
        <span class="ms-auto flex shrink-0 items-center">
          <ThemePicker />
        </span>
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

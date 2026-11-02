/**
 * Playground: Spin across 5 runtimes (vanilla, solid, react, vue, svelte)
 * powered by `@jibe/embed/sdk` (`SpinEmbed` + `ExamplePreview`).
 */
import { createSignal, For, Show } from "solid-js";
import type { JSX } from "solid-js";
import { ExamplePreview } from "../example-preview.tsx";
import { SpinEmbed, type PlaygroundFramework } from "../jibe-playground.tsx";
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

const PRESET_PILL =
  "bare cursor-pointer rounded-full border px-3 py-1 text-xs font-medium transition-colors duration-fast aria-[pressed=true]:border-primary aria-[pressed=true]:bg-primary aria-[pressed=true]:text-on-primary border-border bg-surface text-text-muted hover:text-text";

export default function PlaygroundPage(): JSX.Element {
  const [preset, setPreset] = createSignal(0);
  const [framework, setFramework] = createSignal<PlaygroundFramework>("solid");
  const [editing, setEditing] = createSignal(true);
  const current = (): Preset => PRESETS[preset()] ?? PRESETS[0]!;

  return (
    <div class="flex h-full flex-col bg-surface">
      <div class="flex h-12 shrink-0 items-center gap-3 overflow-x-auto border-b border-border bg-surface-raised px-4">
        <div
          class="flex shrink-0 items-center gap-1"
          role="group"
          aria-label="framework"
        >
          <span class="me-1 font-mono text-xs uppercase tracking-wider text-text-muted">
            runtime
          </span>
          <For each={FRAMEWORKS}>
            {(name) => (
              <button
                type="button"
                class={PRESET_PILL}
                aria-pressed={framework() === name}
                onClick={() => setFramework(name)}
              >
                {name}
              </button>
            )}
          </For>
        </div>
        <span class="h-4 shrink-0 border-e border-border" aria-hidden="true" />
        <div
          class="flex shrink-0 items-center gap-1"
          role="group"
          aria-label="presets"
        >
          <For each={PRESETS}>
            {(item, index) => (
              <button
                type="button"
                class={PRESET_PILL}
                aria-pressed={preset() === index()}
                onClick={() => setPreset(index())}
              >
                {item.title}
              </button>
            )}
          </For>
        </div>
        <button
          type="button"
          class={`${PRESET_PILL} ms-auto`}
          aria-pressed={editing()}
          title="Toggle live Jibe compiler editor"
          onClick={() => setEditing((on) => !on)}
        >
          {editing() ? "Preview only" : "Edit in Jibe"}
        </button>
      </div>
      <div class="min-h-0 flex-1">
        <Show
          when={editing()}
          fallback={
            <ExamplePreview
              kind="module"
              url={`/examples/${framework()}/index.js`}
              subject={current().subject}
              height="h-full"
            />
          }
        >
          <SpinEmbed
            files={{}}
            framework={framework()}
            subject={current().subject}
            activeFile="src/subject.ts"
            chrome="studio"
            view="split"
            height="h-full"
          />
        </Show>
      </div>
    </div>
  );
}

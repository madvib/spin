/**
 * Live-editable Playground surface and reusable inline embed component.
 */
import { A } from "@solidjs/router";
import { createEffect, createMemo, createSignal, Show } from "solid-js";
import type { JSX } from "solid-js";
import { mode, theme } from "@spinjs/kit";
import { CodeFrame } from "./code-frame.tsx";

export interface PlaygroundRecipe {
  readonly id: string;
  readonly title: string;
  readonly category: "Elements" | "Utilities" | "Themes" | "Components";
  readonly summary: string;
  readonly html: string;
}

export const PLAYGROUND_RECIPES: readonly PlaygroundRecipe[] = [
  {
    id: "elements-form",
    title: "Classless Form & Controls",
    category: "Elements",
    summary:
      "Standard HTML inputs, switches, badges, and buttons dressed automatically by the active theme.",
    html: `<card class="w-full max-w-md stack">
  <div class="split">
    <div class="stack-xs">
      <h3>Release channel</h3>
      <p class="text-sm text-text-muted">Configure deployment notifications and gates.</p>
    </div>
    <badge class="primary">Active</badge>
  </div>
  <label>
    Environment name
    <input type="text" value="production-eu-west" />
  </label>
  <label>
    <input type="checkbox" role="switch" checked />
    Require contrast gate before publish
  </label>
  <div class="row justify-end">
    <button type="button" class="secondary">Cancel</button>
    <button type="button">Save settings</button>
  </div>
</card>`,
  },
  {
    id: "utilities-layout",
    title: "Closed-Scale Layout & Surfaces",
    category: "Utilities",
    summary:
      "Token-backed spacing, surface elevation, and semantic badges without arbitrary bracket values.",
    html: `<div class="grid w-full max-w-lg gap-4 sm:grid-cols-2">
  <div class="flex flex-col gap-2 rounded-lg border border-border bg-surface-raised p-4 shadow-sm">
    <span class="font-mono text-xs text-text-muted">color.surface-raised</span>
    <strong class="text-lg text-text">99.98% Uptime</strong>
    <progress value="99" max="100"></progress>
  </div>
  <div class="flex flex-col gap-2 rounded-lg border border-primary bg-primary/15 p-4 shadow-sm">
    <span class="font-mono text-xs text-primary">color.primary / 15%</span>
    <strong class="text-lg text-text">6 Gates Passed</strong>
    <div class="flex gap-2">
      <badge class="success">AA 4.5:1</badge>
      <kbd>⌘K</kbd>
    </div>
  </div>
</div>`,
  },
  {
    id: "themes-dual-mode",
    title: "Dual-Mode Subtree Scoping",
    category: "Themes",
    summary:
      "Scope data-theme and data-mode on any container to render light and dark palettes side by side.",
    html: `<div class="grid w-full max-w-lg gap-4 sm:grid-cols-2">
  <div data-mode="light" class="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 text-text">
    <span class="font-mono text-xs text-text-muted">data-mode="light"</span>
    <h4>Daylight Surface</h4>
    <button type="button" class="s-sm">Primary Action</button>
  </div>
  <div data-mode="dark" class="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 text-text">
    <span class="font-mono text-xs text-text-muted">data-mode="dark"</span>
    <h4>Night Surface</h4>
    <button type="button" class="s-sm">Primary Action</button>
  </div>
</div>`,
  },
  {
    id: "components-select",
    title: "Compiled Custom Element (<docs-select>)",
    category: "Components",
    summary:
      "A headless select machine compiled from lib/components/select.html into a custom element.",
    html: `<div class="flex flex-col items-center gap-3 p-4">
  <span class="font-mono text-xs text-text-muted">&lt;docs-select&gt; custom element</span>
  <docs-select></docs-select>
</div>`,
  },
];

export function PlaygroundEmbed(props: {
  readonly exampleId?: string;
  readonly title?: string;
  readonly initialHtml?: string;
  readonly compact?: boolean;
  readonly jibeUrl?: string;
}): JSX.Element {
  const recipe = createMemo(
    () =>
      PLAYGROUND_RECIPES.find((r) => r.id === props.exampleId) ??
      PLAYGROUND_RECIPES[0]!,
  );
  const [source, setSource] = createSignal(
    props.initialHtml ?? recipe().html,
  );
  createEffect(() => {
    setSource(props.initialHtml ?? recipe().html);
  });

  const externalJibe = () =>
    props.jibeUrl ??
    (import.meta.env.VITE_JIBE_EMBED_URL as string | undefined);

  return (
    <div class="overflow-hidden rounded-lg border border-border-strong bg-surface shadow-sm">
      <div class="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-surface-raised px-4 py-2">
        <div class="flex items-center gap-2">
          <span
            class="i-lucide-terminal icon-sm text-primary"
            aria-hidden="true"
          />
          <span class="text-sm font-semibold text-text">
            {props.title ?? recipe().title}
          </span>
          <span class="rounded-sm border border-border bg-surface px-2 py-1 font-mono text-xs text-text-muted">
            live
          </span>
        </div>
        <div class="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setSource(props.initialHtml ?? recipe().html)}
            class="bare font-mono text-xs text-text-muted hover:text-text"
          >
            Reset
          </button>
          <Show when={props.compact}>
            <A
              href={`/playground?example=${recipe().id}`}
              class="font-mono text-xs font-semibold text-primary no-underline hover:underline"
            >
              Expand in Playground →
            </A>
          </Show>
        </div>
      </div>

      <Show
        when={!externalJibe()}
        fallback={
          <iframe
            src={externalJibe()}
            title={props.title ?? recipe().title}
            class="h-[26rem] w-full border-0 bg-surface"
          />
        }
      >
        <div
          class={`grid divide-y divide-border ${
            props.compact
              ? "lg:grid-cols-2 lg:divide-x lg:divide-y-0"
              : "md:grid-cols-2 md:divide-x md:divide-y-0"
          }`}
        >
          <div class="flex flex-col bg-surface-sunken p-3">
            <div class="mb-2 flex items-center justify-between font-mono text-xs text-text-muted">
              <span>markup.html (editable)</span>
              <span>
                theme: {theme()} ({mode()})
              </span>
            </div>
            <textarea
              aria-label="Live HTML editor"
              value={source()}
              onInput={(e) => setSource(e.currentTarget.value)}
              rows={props.compact ? 10 : 14}
              spellcheck={false}
              class="w-full flex-1 resize-y"
            />
          </div>
          <div class="flex flex-col bg-surface">
            <div class="flex items-center justify-between border-b border-border px-3 py-1 font-mono text-xs text-text-muted">
              <span>Rendered output</span>
              <span>uno.css + spin/components</span>
            </div>
            <div
              class="flex min-h-[14rem] flex-1 items-center justify-center p-6"
              innerHTML={source()}
            />
          </div>
        </div>
      </Show>
      <Show when={!props.compact}>
        <div class="border-t border-border">
          <CodeFrame
            code={source()}
            lang="html"
            title="Formatted snapshot"
            class="rounded-none border-0 shadow-none"
          />
        </div>
      </Show>
    </div>
  );
}

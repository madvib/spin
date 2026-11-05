/**
 * Inline and full-page Playground embed wrapper:
 * - On `/docs/*` pages (`compact`): renders `<ExamplePreview>` immediately with
 *   an "Edit in Jibe" button that mounts `<SpinEmbed>` (`createJibeEmbed`) in place.
 * - On `/playground`: mounts `<SpinEmbed>` directly.
 */
import { A } from "@solidjs/router";
import { createSignal, Show } from "solid-js";
import type { JSX } from "solid-js";
import { CodeFrame } from "./code-frame.tsx";
import { ExamplePreview } from "../example-preview.tsx";
import {
  activeFileForFramework,
  SpinEmbed,
  type PlaygroundFramework,
} from "../jibe-playground.tsx";
import { SUBJECT_HTML, type Subject } from "../../examples/shared.ts";

export interface PlaygroundRecipe {
  readonly id: string;
  readonly title: string;
  readonly subject: Subject;
}

export const PLAYGROUND_RECIPES: readonly PlaygroundRecipe[] = [
  {
    id: "elements-form",
    title: "Interactive Card",
    subject: "card",
  },
  {
    id: "utilities-layout",
    title: "Theme Token Inspector",
    subject: "tokens",
  },
  {
    id: "themes-dual-mode",
    title: "Dialog & Form Actions",
    subject: "dialog",
  },
];

export function PlaygroundEmbed(props: {
  readonly exampleId?: string;
  readonly title?: string;
  readonly compact?: boolean;
  readonly framework?: PlaygroundFramework;
  readonly height?: string;
}): JSX.Element {
  const [showCode, setShowCode] = createSignal(false);
  const recipe = () =>
    PLAYGROUND_RECIPES.find((r) => r.id === props.exampleId) ??
    PLAYGROUND_RECIPES[0]!;

  return (
    <div class="flex flex-col gap-2">
      <Show
        when={props.compact}
        fallback={
          <SpinEmbed
            files={{}}
            framework={props.framework ?? "solid"}
            subject={recipe().subject}
            activeFile={activeFileForFramework(props.framework ?? "solid")}
            chrome="studio"
            view="split"
            height={props.height ?? "h-[26rem]"}
          />
        }
      >
        <div class="flex flex-wrap items-center justify-between gap-2">
          <span class="type-caption text-text-muted">
            {props.title ?? recipe().title}
          </span>
          <div class="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowCode((v) => !v)}
              class="bare cursor-pointer rounded-md border border-border bg-surface-raised px-2 py-1 type-code hover:border-border-strong"
            >
              {showCode() ? "Hide markup" : "Show markup"}
            </button>
            <A
              href="/playground"
              class="text-primary no-underline hover:underline"
            >
              Open in Playground →
            </A>
          </div>
        </div>
        <ExamplePreview
          kind="module"
          url={`/examples/${props.framework ?? "solid"}/index.js`}
          subject={recipe().subject}
          height={props.height ?? "h-[19rem]"}
        />
        <Show when={showCode()}>
          <CodeFrame
            code={SUBJECT_HTML[recipe().subject].trim()}
            lang="html"
            title="Markup"
          />
        </Show>
      </Show>
    </div>
  );
}

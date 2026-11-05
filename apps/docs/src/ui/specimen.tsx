/**
 * One example, as a reader meets it: the preview above, the markup below.
 *
 * Toggle is the default: the preview shows and the markup opens on request,
 * which keeps long pages scannable where the preview is the point. Pass
 * `mode="both"` for the rare example whose markup a reader must see without
 * asking — the code then renders under the preview with no toggle.
 */
import { createSignal, Show } from "solid-js";
import type { JSX } from "solid-js";
import { CodeFrame } from "./code-frame.tsx";

export function Specimen(props: {
  readonly title: string;
  readonly description?: string;
  readonly code: string;
  readonly lang?: "html" | "json" | "ts" | "bash" | "md";
  readonly preview: JSX.Element;
  readonly previewClass?: string;
  readonly controls?: JSX.Element;
  readonly mode?: "toggle" | "both";
}): JSX.Element {
  const [showCode, setShowCode] = createSignal(props.mode === "both");
  const both = () => props.mode === "both";

  return (
    <div class="w-full min-w-0 max-w-full overflow-hidden rounded-lg border border-border bg-surface shadow-sm">
      <div class="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-surface-raised px-4 py-2">
        <div class="flex min-w-0 flex-col">
          <span class="type-code">{props.title}</span>
          <Show when={props.description}>
            <small>{props.description}</small>
          </Show>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          {props.controls}
          <Show when={!both()}>
            <button
              type="button"
              class={
                showCode()
                  ? "primary s-sm type-code"
                  : "s-sm type-code"
              }
              aria-pressed={showCode()}
              onClick={() => setShowCode((open) => !open)}
            >
              {showCode() ? "Hide markup" : "Show markup"}
            </button>
          </Show>
        </div>
      </div>
      <div
        class={`flex min-h-24 flex-col items-stretch justify-center bg-surface p-4 ${props.previewClass ?? ""}`}
      >
        {props.preview}
      </div>
      <Show when={showCode()}>
        <CodeFrame
          code={props.code}
          lang={props.lang ?? "html"}
          title={`${props.title} markup`}
          class="rounded-none border-x-0 border-b-0 shadow-none"
        />
      </Show>
    </div>
  );
}

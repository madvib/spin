/**
 * Structured property / command / option cards that replace dense multi-column
 * log-dump tables on reference and guide pages.
 */
import { For, Show } from "solid-js";
import type { JSX } from "solid-js";

export interface PropEntry {
  readonly name: string;
  readonly badge?: string;
  readonly defaultValue?: string;
  readonly required?: boolean;
  readonly description: JSX.Element | string;
  readonly detail?: JSX.Element | string;
}

export function PropList(props: {
  readonly items: readonly PropEntry[];
  readonly class?: string;
}): JSX.Element {
  return (
    <div
      class={`flex flex-col divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface ${
        props.class ?? ""
      }`}
    >
      <For each={props.items}>
        {(item) => (
          <div class="flex flex-col gap-2 p-4 transition-colors duration-fast hover:bg-surface-raised">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div class="flex flex-wrap items-center gap-2">
                <code>{item.name}</code>
                <Show when={item.badge}>
                  {(badge) => (
                    <span class="rounded-sm border border-border bg-surface px-2 py-1 font-mono text-xs text-text-muted">
                      {badge()}
                    </span>
                  )}
                </Show>
                <Show when={item.required}>
                  <span class="font-mono text-xs font-semibold text-semantic-warning">
                    required
                  </span>
                </Show>
              </div>
              <Show when={item.defaultValue}>
                {(def) => (
                  <span class="font-mono text-xs text-text-muted">
                    default: <code>{def()}</code>
                  </span>
                )}
              </Show>
            </div>
            <div class="text-sm text-text-muted">
              {item.description}
            </div>
            <Show when={item.detail}>
              {(detail) => (
                <div class="pt-1 font-mono text-xs text-text-muted">
                  {detail()}
                </div>
              )}
            </Show>
          </div>
        )}
      </For>
    </div>
  );
}

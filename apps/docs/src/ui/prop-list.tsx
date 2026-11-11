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
      class={`flex flex-col divide-y overflow-hidden rounded-lg border bg-surface ${
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
                    <span class="rounded-sm border bg-surface px-2 py-1 type-caption text-muted">
                      {badge()}
                    </span>
                  )}
                </Show>
                <Show when={item.required}>
                  <span class="type-caption-emphasized text-semantic-warning">
                    required
                  </span>
                </Show>
              </div>
              <Show when={item.defaultValue}>
                {(def) => (
                  <span class="type-code text-muted">
                    default: <code>{def()}</code>
                  </span>
                )}
              </Show>
            </div>
            <div class="type-body text-muted">
              {item.description}
            </div>
            <Show when={item.detail}>
              {(detail) => (
                <div class="pt-1 type-code text-muted">
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

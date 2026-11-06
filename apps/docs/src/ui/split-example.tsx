/**
 * Interactive specimen card paired with syntax-highlighted source and optional
 * Playground handoff, driven by the `<docs-view-tabs>` Spin component.
 */
import { A } from "@solidjs/router";
import { createEffect, createSignal, Show } from "solid-js";
import type { JSX } from "solid-js";
import { createSpinComponent } from "@spinjs/components/solid";
import { tabs } from "@spinjs/components/tabs";
import { CodeFrame } from "./code-frame.tsx";

export function SplitExample(props: {
  readonly title: string;
  readonly description?: string;
  readonly code: string;
  readonly lang?: string;
  readonly playgroundExample?: string;
  readonly children: JSX.Element;
}): JSX.Element {
  const [tabsEl, setTabsEl] = createSignal<HTMLElement>();
  const tabsCtl = createSpinComponent(tabsEl, tabs);
  const [view, setView] = createSignal<"preview" | "code">("preview");

  createEffect(() => {
    tabsCtl.bind(
      { value: view() },
      {
        "value-change": (event: CustomEvent<{ value: string }>) => {
          setView(event.detail.value === "code" ? "code" : "preview");
        },
      },
    );
  });

  return (
    <div class="overflow-hidden rounded-lg border bg-surface shadow-sm">
      <div class="flex flex-wrap items-center justify-between gap-2 border-b bg-surface-raised px-4 py-2">
        <div class="flex flex-col">
          <span class="type-code">{props.title}</span>
          <Show when={props.description}>
            <span class="type-caption text-muted">{props.description}</span>
          </Show>
        </div>
        <div class="flex items-center gap-2">
          <Show when={props.playgroundExample}>
            {(ex) => (
              <A
                href={`/playground?example=${ex()}`}
                class="text-primary no-underline hover:underline"
              >
                Open in Playground →
              </A>
            )}
          </Show>
          <docs-view-tabs ref={setTabsEl} />
        </div>
      </div>
      <Show
        when={view() === "preview"}
        fallback={
          <CodeFrame
            code={props.code}
            lang={props.lang ?? "html"}
            class="rounded-none border-0 shadow-none"
          />
        }
      >
        <div class="flex min-h-[7rem] flex-col items-center justify-center bg-surface p-6">
          {props.children}
        </div>
      </Show>
    </div>
  );
}

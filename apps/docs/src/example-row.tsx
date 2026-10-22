/**
 * A live specimen and its source, one row, from the primitives' own
 * examples — the exact markup a consumer writes, rendered beside itself.
 *
 * `onLoad` is the line that finishes property-driven rows (`data-mixed`,
 * `data-open` name DOM properties): it runs scoped to the row that renders
 * it, exactly as the reference and the studio do.
 *
 * The code face spends the theme's own break token (`break-all`): a long
 * attribute in a specimen has no space in it, and one that cannot break is
 * one that widens the page.
 */
import { createEffect, createSignal } from "solid-js";
import type { JSX } from "solid-js";

export function formatExampleHtml(html: string): string {
  const lines = html.trim().split("\n");
  const indents = lines.filter((l) => l.trim()).map((l) =>
    l.match(/^\s*/)?.[0].length ?? 0
  );
  const strip = Math.min(...indents);
  return lines.map((l) => l.slice(strip)).join("\n");
}

export function ExampleRow(props: {
  name: string;
  html: string;
  onLoad?: string;
}): JSX.Element {
  const [tab, setTab] = createSignal<"see" | "code">("see");
  const [copied, setCopied] = createSignal(false);
  createEffect(() => {
    if (props.onLoad) new Function(props.onLoad)();
  });
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(formatExampleHtml(props.html));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable: no-op */
    }
  };
  return (
    <section class="mb-7">
      <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 class="flex items-center gap-2 text-text">
          <span class="block h-1 w-4 border-t-4 border-solid border-primary" />
          {props.name}
        </h3>
        <div class="flex overflow-hidden border border-border rounded-sm">
          <button
            type="button"
            aria-current={tab() === "see" || undefined}
            onClick={() => setTab("see")}
            class={`px-2.5 py-1 text-xs ${
              tab() === "see"
                ? "bg-surface-raised text-text font-semibold"
                : "bg-surface text-text-muted hover:text-text"
            }`}
          >
            see
          </button>
          <button
            type="button"
            aria-current={tab() === "code" || undefined}
            onClick={() => setTab("code")}
            class={`px-2.5 py-1 text-xs border-l border-border ${
              tab() === "code"
                ? "bg-surface-raised text-text font-semibold"
                : "bg-surface text-text-muted hover:text-text"
            }`}
          >
            code
          </button>
        </div>
      </div>
      <div class="relative grid">
        <pre
          class={`font-mono text-sm bg-surface-raised border border-border rounded-md px-4 py-3.5 col-start-1 row-start-1 overflow-x-auto text-text ${
            tab() === "code" ? "" : "invisible"
          }`}
          aria-hidden={tab() === "code" ? undefined : "true"}
        >
          <code class="break-all">{formatExampleHtml(props.html)}</code>
        </pre>
        <div
          class={`border border-border rounded-md bg-surface-raised p-4 col-start-1 row-start-1 ${
            tab() === "see" ? "" : "invisible"
          }`}
          aria-hidden={tab() === "see" ? undefined : "true"}
          innerHTML={props.html}
        />
        <button
          type="button"
          onClick={copy}
          class="secondary s-sm absolute right-2 bottom-2 hover:border-border-strong transition-colors duration-fast"
        >
          {copied() ? "copied" : "copy"}
        </button>
      </div>
    </section>
  );
}

/**
 * Syntax-highlighted code block with a header bar (filename or language tag)
 * and an always-available copy control.
 */
import { createMemo, createSignal, For, onCleanup, Show } from "solid-js";
import type { JSX } from "solid-js";
import { CODE_INK, tokenizeCode } from "@spinjs/kit";

const COPIED_MS = 1400;

export function CodeFrame(props: {
  readonly code: string;
  readonly lang?: string;
  readonly title?: string;
  readonly copy?: boolean;
  readonly class?: string;
}): JSX.Element {
  const [copied, setCopied] = createSignal(false);
  let timer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => clearTimeout(timer));

  const effectiveLang = () => {
    if (props.lang && props.lang.length > 0) return props.lang;
    const trimmed = props.code.trim();
    if (trimmed.startsWith("<")) return "html";
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) return "json";
    if (
      trimmed.startsWith("npm ") ||
      trimmed.startsWith("npx ") ||
      trimmed.startsWith("bun ")
    ) {
      return "bash";
    }
    return "ts";
  };

  const tokens = createMemo(() =>
    tokenizeCode(props.code.trim(), effectiveLang()),
  );

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(props.code.trim());
      setCopied(true);
      clearTimeout(timer);
      timer = setTimeout(() => setCopied(false), COPIED_MS);
    } catch {
      // Clipboard unavailable in restricted contexts.
    }
  };

  const showCopy = () => props.copy ?? true;
  const headerLabel = () => props.title ?? effectiveLang();

  return (
    <div
      class={`overflow-hidden rounded-lg border bg-surface shadow-sm ${
        props.class ?? ""
      }`}
    >
      <div class="flex items-center justify-between gap-2 border-b bg-surface-raised px-3 py-1">
        <span class="type-caption text-muted">
          {headerLabel()}
        </span>
        <Show when={showCopy()}>
          <button
            type="button"
            onClick={onCopy}
            aria-label={
              props.title ? `Copy ${props.title}` : "Copy code snippet"
            }
            class="bare inline-flex items-center gap-1 rounded-sm px-2 py-1 type-code text-muted transition-colors duration-fast hover:bg-surface"
          >
            <span
              class={
                copied()
                  ? "i-lucide-check icon-sm text-primary"
                  : "i-lucide-copy icon-sm"
              }
              aria-hidden="true"
            />
            <span>{copied() ? "Copied" : "Copy"}</span>
          </button>
        </Show>
      </div>
      <pre class="overflow-x-auto border-0 bg-surface p-4 type-code">
        <code>
          <For each={tokens()}>
            {(token) => (
              <span class={CODE_INK[token.type]}>{token.value}</span>
            )}
          </For>
        </code>
      </pre>
    </div>
  );
}

export function Code(props: {
  code: string;
  class?: string;
  lang?: "html" | "json" | "ts" | "bash" | "md";
  title?: string;
}): JSX.Element {
  return (
    <CodeFrame
      code={props.code}
      class={props.class}
      lang={props.lang}
      title={props.title}
    />
  );
}

/**
 * The page furniture the apps share: a marked section, and a code block.
 *
 * The studio, the docs and the reference each grew their own copy of the same
 * two pieces — a heading with a bar in the acting colour and a note under it,
 * and a block of code with a copy control. They are one design decision, so
 * they live here once: a page that marks its sections differently from the
 * next page is a page that reads as a different product.
 */
import { createMemo, createSignal, For, Show } from "solid-js";
import type { JSX } from "solid-js";
import { CODE_INK, tokenizeCode } from "./specimen.tsx";

/**
 * The bar that marks a section.
 *
 * The acting colour and nothing else: it says "a section starts here", and it
 * is the one mark every page puts in the same place, so a reader who knows one
 * page knows all of them.
 */
export function Marker(props: { tone?: "primary" | "accent" }) {
  return (
    <span
      class={`block h-1 w-4 shrink-0 rounded-full ${
        props.tone === "accent" ? "bg-accent" : "bg-primary"
      }`}
      aria-hidden="true"
    />
  );
}

/**
 * A section: a marked title, an optional fact and control on the right, an
 * optional line of copy, and the content under it.
 */
export function Section(props: {
  title: string;
  /** An anchor for in-page links. */
  id?: string;
  /** The fact the section carries: how many steps, how many curves. */
  fact?: string;
  /** One line: what the section is for. */
  note?: string;
  /** Hover text for the title's info mark: copy that explains, out of the way. */
  info?: string;
  /** The colour the section's family wears. */
  tone?: "primary" | "accent";
  /** A control that belongs to the section, on the right of its heading. */
  aside?: JSX.Element;
  /** Extra classes on the section — page rhythm, anchors, a measure. */
  class?: string;
  /** Whether the section's copy reads muted. The docs' prose does. */
  muted?: boolean;
  children: JSX.Element;
}) {
  return (
    <section
      class={`flex flex-col gap-2 ${props.class ?? ""}`}
      id={props.id}
      aria-label={props.title}
    >
      <div class="flex items-center justify-between gap-4">
        <h2 class="flex items-center gap-2">
          <Marker tone={props.tone} />
          <Show when={props.id} fallback={<span class="min-w-0">{props.title}</span>}>
            {(id) => (
              <a href={`#${id()}`} class="group inline-flex min-w-0 items-center gap-2 no-underline hover:underline"><span class="min-w-0">{props.title}</span><span class="type-code text-text-muted opacity-0 transition-opacity duration-fast group-hover:opacity-100" aria-hidden="true">#</span></a>
            )}
          </Show>
          <Show when={props.info}>
            {(info) => (
              <span class="relative inline-flex items-center">
                <button
                  type="button"
                  class="bare peer inline-flex items-center text-text-muted"
                  aria-label={info()}
                >
                  <span
                    class="i-lucide-info inline-block shrink-0 type-code"
                    aria-hidden="true"
                  />
                </button>
                <tooltip class="start-0 top-full mt-1 translate-none whitespace-normal peer-hover:visible peer-focus-visible:visible">
                  {info()}
                </tooltip>
              </span>
            )}
          </Show>
        </h2>
        <div class="flex shrink-0 items-center gap-2">
          <Show when={props.fact}>
            <span class="type-body text-text-muted">{props.fact}</span>
          </Show>
          {props.aside}
        </div>
      </div>
      <Show when={props.note}>
        <p class="max-w-screen-md text-text-muted">{props.note}</p>
      </Show>
      <Show when={props.muted} fallback={props.children}>
        <div class="flex flex-col gap-4 text-text-muted">{props.children}</div>
      </Show>
    </section>
  );
}

/** The copy control's word, while it holds the clipboard. */
const COPIED_MS = 1500;

/**
 * A block of code, with the optional copy control that belongs to it.
 *
 * The block's type is the prose primitive's (the mono face and the spacing);
 * the chrome here is the app's own surface. A `<pre>` outside a `.prose`
 * column carries no surface of its own, so a code view in a tool has to state
 * one — and every tool states the same one.
 */
export function CodeBlock(props: {
  code: string;
  /** The fenced block's language: ts, json, html, bash, or absent. */
  lang?: string;
  /** Extra classes on the block. */
  class?: string;
  /** Show the copy control. Off for a block that is not meant to be taken. */
  copy?: boolean;
  /** A name for the block, for the copy control's reader. */
  label?: string;
}) {
  const [copied, setCopied] = createSignal(false);
  let timer: number | undefined;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(props.code);
      setCopied(true);
      clearTimeout(timer);
      timer = setTimeout(
        () => setCopied(false),
        COPIED_MS,
      ) as unknown as number;
    } catch {
      // The clipboard is a permission, not a guarantee: no permission, no copy.
    }
  };
  const tokens = createMemo(() =>
    props.lang === undefined
      ? [{ type: "plain" as const, value: props.code }]
      : tokenizeCode(props.code, props.lang)
  );
  return (
    <div class="relative">
      <pre
        class={`m-0 overflow-x-auto rounded-md border border-border bg-surface p-4 type-code leading-relaxed text-text-muted ${
          props.class ? ` ${props.class}` : ""
        }`}
      >
        <code>
          <For each={tokens()}>
            {(token) => (
              <span class={CODE_INK[token.type]}>{token.value}</span>
            )}
          </For>
        </code>
      </pre>
      <Show when={props.copy}>
        <button
          type="button"
          onClick={copy}
          class="secondary s-sm absolute end-2 top-2"
          aria-label={props.label === undefined
            ? "Copy this code"
            : `Copy ${props.label}`}
        >
          {copied() ? "copied" : "copy"}
        </button>
      </Show>
    </div>
  );
}

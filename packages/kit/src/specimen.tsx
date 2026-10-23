/**
 * One example, as a reader meets it: the specimen, the markup that produced
 * it, and the copy control for the markup.
 *
 * The reference app and the docs grew this separately, and the two copies had
 * already drifted — one syntax-highlighted, one not; one able to keep a
 * heading at page width, one not. It is one row, so it lives here once.
 *
 * The two views share a grid cell and the inactive one is `invisible` rather
 * than `display: none`: the row's height is the height of whichever view is
 * taller, so switching between them never moves the page under the pointer.
 */
import { createEffect, createMemo, createSignal, For, Show } from "solid-js";
import type { JSX } from "solid-js";
import { Marker } from "./section.tsx";

/**
 * Example markup, formatted for the code view.
 *
 * The examples are data — written to be read beside a rule, not by a
 * formatter — so they arrive with the indentation of the template literals
 * they were pieced together in. This strips the common indent, trims the
 * trailing spaces, and collapses runs of blank lines: the markup a consumer
 * copies, without the air the template literal needed.
 */
export function formatExampleHtml(html: string): string {
  const lines = html.replace(/\t/g, "  ").split("\n");
  const indents = lines
    .filter((line) => line.trim() !== "")
    .map((line) => line.match(/^\s*/)?.[0].length ?? 0);
  const strip = indents.length === 0 ? 0 : Math.min(...indents);
  const out: string[] = [];
  let blank = 0;
  for (const line of lines) {
    const text = line.slice(strip).replace(/\s+$/, "");
    if (text === "") {
      blank++;
      continue;
    }
    if (blank > 0 && out.length > 0) out.push("");
    blank = 0;
    out.push(text);
  }
  return out.join("\n");
}

type CodeTokenType = "tag" | "attr" | "string" | "comment" | "punct" | "text";

interface CodeToken {
  readonly type: CodeTokenType;
  readonly value: string;
}

const WHITESPACE = /\s/;
const NAME_STOP = /[\s=/>]/;

/**
 * Example HTML, tokenized: tags, attribute names, string values, comments and
 * the text between them. Everything the markup spells is preserved exactly,
 * whitespace included, because the code view is the markup a consumer copies.
 *
 * Self-contained on purpose: the reference demonstrates the styling surface,
 * so a syntax highlighter from a dependency would be a second stylesheet the
 * theme cannot reach. The tokenizer is a single pass over the string and
 * nothing else — no grammar, no recovery, no recursion.
 */
export function tokenizeHtml(html: string): readonly CodeToken[] {
  const out: CodeToken[] = [];
  const push = (type: CodeTokenType, value: string) => {
    if (value !== "") out.push({ type, value });
  };
  let i = 0;
  while (i < html.length) {
    const lt = html.indexOf("<", i);
    if (lt === -1) {
      push("text", html.slice(i));
      break;
    }
    if (lt > i) push("text", html.slice(i, lt));
    if (html.startsWith("<!--", lt)) {
      const end = html.indexOf("-->", lt + 4);
      const stop = end === -1 ? html.length : end + 3;
      push("comment", html.slice(lt, stop));
      i = stop;
      continue;
    }
    if (html.startsWith("<!", lt)) {
      const end = html.indexOf(">", lt);
      const stop = end === -1 ? html.length : end + 1;
      push("comment", html.slice(lt, stop));
      i = stop;
      continue;
    }
    push("punct", "<");
    i = lt + 1;
    if (html[i] === "/") {
      push("punct", "/");
      i += 1;
    }
    let end = i;
    while (
      end < html.length && !WHITESPACE.test(html[end]!) && html[end] !== ">" &&
      html[end] !== "/"
    ) {
      end += 1;
    }
    push("tag", html.slice(i, end));
    i = end;
    while (i < html.length) {
      const ch = html[i]!;
      if (ch === ">") {
        push("punct", ">");
        i += 1;
        break;
      }
      if (ch === "/" && html[i + 1] === ">") {
        push("punct", "/>");
        i += 2;
        break;
      }
      if (WHITESPACE.test(ch)) {
        let stop = i;
        while (stop < html.length && WHITESPACE.test(html[stop]!)) stop += 1;
        push("text", html.slice(i, stop));
        i = stop;
        continue;
      }
      if (ch === "/") {
        push("punct", "/");
        i += 1;
        continue;
      }
      let attrEnd = i;
      while (attrEnd < html.length && !NAME_STOP.test(html[attrEnd]!)) {
        attrEnd += 1;
      }
      push("attr", html.slice(i, attrEnd));
      i = attrEnd;
      if (html[i] === "=") {
        push("punct", "=");
        i += 1;
        const quote = html[i];
        if (quote === '"' || quote === "'") {
          const close = html.indexOf(quote, i + 1);
          const stop = close === -1 ? html.length : close + 1;
          push("string", html.slice(i, stop));
          i = stop;
        } else {
          let stop = i;
          while (
            stop < html.length && !WHITESPACE.test(html[stop]!) &&
            html[stop] !== ">"
          ) {
            stop += 1;
          }
          push("string", html.slice(i, stop));
          i = stop;
        }
      }
    }
  }
  return out;
}

/**
 * The ink each token of the code viewer wears.
 *
 * Every one is a theme token and every one was measured against the panel it
 * sits on, in every theme and both modes: the hues that read as syntax in one
 * palette are illegible in another, so this is the set that clears 4.5:1
 * everywhere rather than the set that looks most like someone else's editor.
 */
const CODE_INK: Readonly<Record<CodeTokenType, string>> = {
  tag: "text-semantic-error",
  attr: "text-link",
  string: "text-semantic-warning",
  comment: "text-text-muted",
  punct: "text-text-muted",
  text: "text-text",
};

/** The word the copy control carries after it has copied. */
const COPIED_MS = 1500;

export interface SpecimenProps {
  /** The example's name, as the row's heading reads it. */
  readonly name: string;
  /** The markup, exactly as a consumer writes it. */
  readonly html: string;
  /** Runs against the row after it mounts, for property-driven examples. */
  readonly onLoad?: string;
  /** The view the row opens on. */
  readonly initial?: "component" | "code";
  /** A rendered tree instead of the HTML, for a component-built preview. */
  readonly preview?: JSX.Element;
  /** A class on the stage, for a specimen that needs a measure of its own. */
  readonly stage?: string;
  /** A class on the code view. */
  readonly codeClass?: string;
}

/**
 * One specimen: a marked heading, a component/code switch, the stage, the
 * markup, and a copy control that belongs to the markup.
 */
export function Specimen(props: SpecimenProps): JSX.Element {
  const [view, setView] = createSignal<"component" | "code">(
    props.initial ?? "component",
  );
  const [copied, setCopied] = createSignal(false);
  let timer: number | undefined;
  const formatted = createMemo(() => formatExampleHtml(props.html));
  const tokens = createMemo(() => tokenizeHtml(formatted()));

  createEffect(() => {
    if (props.onLoad) new Function(props.onLoad)();
  });

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(formatted());
      setCopied(true);
      clearTimeout(timer);
      timer = setTimeout(
        () => setCopied(false),
        COPIED_MS,
      ) as unknown as number;
    } catch {
      // The clipboard is a permission, not a guarantee.
    }
  };

  return (
    <section class="stack-sm mb-8">
      <div class="split">
        <h3 class="row-sm">
          <Marker />
          {props.name}
        </h3>
        <div class="join shrink-0" role="group" aria-label="view">
          <button
            type="button"
            class="join-item secondary s-sm aria-[current]:border-primary aria-[current]:bg-primary aria-[current]:text-on-primary"
            aria-current={view() === "component" || undefined}
            onClick={() => setView("component")}
          >
            component
          </button>
          <button
            type="button"
            class="join-item secondary s-sm aria-[current]:border-primary aria-[current]:bg-primary aria-[current]:text-on-primary"
            aria-current={view() === "code" || undefined}
            onClick={() => setView("code")}
          >
            code
          </button>
        </div>
      </div>
      <div class="relative min-h-24">
        <div
          class={`min-h-16 rounded-md border border-dashed border-border bg-surface p-6 shadow-sm ${
            view() === "component" ? "" : "invisible"
          } ${props.stage ?? ""}`}
          aria-hidden={view() === "component" ? undefined : "true"}
        >
          <Show when={props.preview} fallback={<div innerHTML={props.html} />}>
            {props.preview}
          </Show>
        </div>
        <pre
          class={`absolute inset-0 overflow-auto whitespace-pre-wrap rounded-md border border-dashed border-border bg-surface p-4 text-sm text-text ${
            view() === "code" ? "" : "invisible"
          } ${props.codeClass ?? ""}`}
          aria-hidden={view() === "code" ? undefined : "true"}
        >
          <code class="break-all">
            <For each={tokens()}>
              {(token) => (
                <span class={CODE_INK[token.type]}>{token.value}</span>
              )}
            </For>
          </code>
        </pre>
        <Show when={view() === "code"}>
          <button
            type="button"
            onClick={copy}
            class="secondary s-sm absolute end-2 top-2"
            aria-label={`Copy the ${props.name} example`}
          >
            {copied() ? "copied" : "copy"}
          </button>
        </Show>
      </div>
    </section>
  );
}

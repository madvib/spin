/**
 * One component, read rather than described.
 *
 * This page replaces four hand-written pages that each spelled their own
 * markup: the studio's button page contained `<button class="secondary">
 * Cancel</button>` typed by hand while `button.examples.ts` was shipping the
 * same control as data. Nothing here is a copy — the label, the note, and the
 * markup all arrive from `primitives.list`, so a change to a component's
 * examples is a change this page renders.
 *
 * The markup is set with `innerHTML` because it is sourced markup the studio
 * is asked to render, not markup it writes. The daemon is the only thing that
 * produces it, and the same markup is registered with it so the stylesheet is
 * generated for what is actually on screen.
 */

import {
  createEffect,
  createMemo,
  createResource,
  createSignal,
  For,
  onCleanup,
  onMount,
  Show,
} from "solid-js";
import { A, useParams } from "@solidjs/router";
import { primitivesTokens, type RpcExample } from "../../lib/primitives.ts";
import { library, registerMarkup, themeText } from "../../lib/store.ts";
import { analyzeTheme } from "../../lib/theme.ts";
import { editorRouteFor, tokenPathsByVar } from "../../lib/tokens.ts";
import { type CodeKind, dedent, tokenizeHtml } from "../../lib/code.ts";

/** Where a run of characters sits, and the ink that says so. */
const INK: Record<CodeKind, string> = {
  tag: "text-accent",
  attr: "text-secondary",
  value: "text-text-muted",
  text: "text-text",
};

/**
 * One fixture: the specimen, or the markup that produced it.
 *
 * A component is judged by looking at it, and built by reading the source,
 * so one row carries both behind a toggle rather than one beside the other.
 */
function ExampleSection(props: {
  readonly row: RpcExample;
  readonly onLoad?: string;
}) {
  const [showCode, setShowCode] = createSignal(false);
  const [copied, setCopied] = createSignal(false);
  let copiedFor: number | undefined;

  async function copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(dedent(props.row.html));
    } catch {
      // A clipboard the page cannot reach is a permission, not a failure to
      // report: nothing was copied, so nothing is claimed.
      return;
    }
    setCopied(true);
    clearTimeout(copiedFor);
    // The window's own: the DOM lib types its return as a number, and the
    // peer's `Timeout` is Deno's — a studio file has one dom lib to answer to.
    copiedFor = window.setTimeout(() => setCopied(false), 1200);
  }

  return (
    <section class="mt-4 border-t border-border pt-3">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h3 class="text-sm font-medium">{props.row.name}</h3>
        <div class="flex items-center gap-3">
          <Show when={copied()}>
            <span class="text-xs text-text-muted">copied</span>
          </Show>
          <button
            type="button"
            class="bare text-xs text-text-muted hover:underline"
            onClick={copy}
          >
            Copy code
          </button>
          <div class="row-list overflow-hidden rounded-md border border-border text-xs">
            <button
              type="button"
              class="bare px-2 py-1 text-text-muted"
              classList={{
                "bg-surface-raised font-medium text-text": !showCode(),
              }}
              onClick={() => setShowCode(false)}
            >
              Component
            </button>
            <button
              type="button"
              class="bare px-2 py-1 text-text-muted"
              classList={{
                "bg-surface-raised font-medium text-text": showCode(),
              }}
              onClick={() => setShowCode(true)}
            >
              Code
            </button>
          </div>
        </div>
      </div>
      <Show
        when={!showCode()}
        fallback={
          <pre class="mt-2 overflow-x-auto rounded-md border border-border bg-surface-sunken p-3 text-xs">
            <code>
              <For each={tokenizeHtml(dedent(props.row.html))}>
                {(token) => <span class={INK[token.kind]}>{token.text}</span>}
              </For>
            </code>
          </pre>
        }
      >
        <Specimen html={props.row.html} onLoad={props.onLoad} />
      </Show>
    </section>
  );
}

/**
 * A fixture's markup, under the class the preview stylesheet scopes to.
 *
 * The daemon generates a rule per primitive and per utility in the markup it
 * is given, and scopes the class rules so a preview's styling cannot reach
 * the tool around it — so a specimen that omits the class gets the element
 * rules and none of the utility ones.
 */
function Specimen(props: {
  readonly html: string;
  readonly onLoad?: string;
}) {
  let host!: HTMLDivElement;
  onMount(() => {
    const script = props.onLoad;
    // `document` is shadowed, not reached: a fixture's wiring addresses its
    // own specimen, so `[data-open]` cannot find a control in the chrome.
    if (script !== undefined) new Function("document", script)(host);
  });
  return (
    <div
      ref={host}
      class="spin-preview mt-2 rounded-md border border-dashed border-border p-3"
      innerHTML={props.html}
    />
  );
}

export default function ComponentPage() {
  const params = useParams();
  // The shared registry: the side list and this page are one fetch, and the
  // store owns it so neither can drift from the other.
  const [tokens] = createResource(
    () => params.name,
    (name) => primitivesTokens(name),
  );
  // A memo, not a const: the resource resolves after first render, and a
  // const would snapshot `undefined` and never move. The memo re-derives when
  // the list lands, and the early return below still narrows it.
  const found = createMemo(() =>
    library()?.find((c) => c.name === params.name)
  );
  const rows = () => found()?.examples?.rows ?? [];

  /**
   * Uno reads source text, which is how the chrome gets its CSS — but the
   * primitives here arrive from the daemon at runtime and are never written
   * in a file the scanner can see. Registering the rendered markup is what
   * makes the daemon generate for what is actually on screen. One route
   * writes at a time, so the markup goes back to nothing on unmount.
   */
  createEffect(() => {
    registerMarkup(rows().map((row) => row.html).join("\n"));
  });
  onCleanup(() => registerMarkup(""));

  // The contract names the variables a component reads; the live theme says
  // which token path each one is, so the readout is editable identity rather
  // than emitted output.
  const tokenEntries = () => {
    const tree = analyzeTheme(themeText()).tree;
    if (tree === undefined) return [];
    const byVar = tokenPathsByVar(tree);
    const vars = Object.values(tokens()?.reads ?? {}).flat() as string[];
    const paths = vars
      .map((variable) => byVar.get(variable))
      .filter((path): path is string => path !== undefined);
    return [...new Set(paths)].map((path) => ({ path }));
  };

  return (
    <div class="min-h-0 min-w-0 flex-1 overflow-y-auto p-4">
      <Show
        when={found()}
        keyed
        fallback={
          <Show
            when={library() !== undefined}
            fallback={
              <div>
                <h1 class="text-2xl capitalize">{params.name}</h1>
                <p class="text-sm text-text-muted">Loading…</p>
              </div>
            }
          >
            <p>
              No component named <code>{params.name}</code>.
            </p>
          </Show>
        }
      >
        {(component) => (
          <div>
            <h1 class="text-2xl capitalize">
              {component.name.replace(/-/g, " ")}
            </h1>
            <p class="max-w-screen-md text-sm text-text-muted">
              {component.examples?.note ?? ""}
            </p>

            <Show when={component.tags.length > 0}>
              <h2 class="mt-6 text-xl">Tags</h2>
              <p class="font-mono text-sm">
                {component.tags.map((t: string) => `<${t}>`).join("  ")}
              </p>
            </Show>

            <h2 class="mt-6 text-xl">
              Examples
              <span class="ml-2 text-sm font-normal text-text-muted">
                {rows().length}
              </span>
            </h2>
            <For each={rows()}>
              {(row) => (
                <ExampleSection
                  row={row}
                  onLoad={component.examples?.onLoad}
                />
              )}
            </For>

            {
              /* Tokens this component reads, as paths. A path is the thing the
                editor can edit and a `--variable` is not, so each entry links
                to the editor that owns it. */
            }
            <Show when={tokenEntries().length > 0}>
              <h2 class="mt-6 text-xl">Tokens this reads</h2>
              <ul class="mt-2 flex flex-wrap gap-2">
                <For each={tokenEntries()}>
                  {({ path }) => (
                    <li>
                      <A
                        href={editorRouteFor(path)}
                        class="text-xs hover:underline"
                      >
                        <code>{path}</code>
                      </A>
                    </li>
                  )}
                </For>
              </ul>
            </Show>
          </div>
        )}
      </Show>
    </div>
  );
}

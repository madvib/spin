/**
 * One component, read rather than described.
 *
 * This page replaces four hand-written pages that each spelled their own
 * markup: the studio's button page contained `<button class="secondary">
 * Cancel</button>` typed by hand while `button.examples.ts` was shipping the
 * same control as data. Nothing here is a copy — the label, the note, and the
 * markup all arrive from `primitives.list`, so a change to a component's
 * examples is a change this page renders. The character tokens come from
 * `primitives.contract`: what the manifest says the component starts at, so a
 * theme that has never spelled `button.weight` meets the token HERE, on the
 * component that spends it, and can create it scaffolded as authored.
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
import {
  primitivesContract,
  primitivesTokens,
  type RpcExample,
} from "../../lib/primitives.ts";
import {
  activeMode,
  library,
  registerMarkup,
  themeText,
} from "../../lib/store.ts";
import { createToken, editToken } from "../../lib/editing.ts";
import { analyzeTheme } from "../../lib/theme.ts";
import {
  editorRouteFor,
  tokenPathsByVar,
  tokenRowAt,
} from "../../lib/tokens.ts";
import {
  type CodeKind,
  formatExampleHtml,
  tokenizeHtml,
} from "../../lib/code.ts";
import TokenRow from "../../components/demos/TokenRow.tsx";

/** Where a run of characters sits, and the ink that says so. */
const INK: Record<CodeKind, string> = {
  tag: "text-accent",
  attr: "text-secondary",
  value: "text-text-muted",
  text: "text-text",
};

/**
 * The specimen/code switch: a bordered group of two where unselected is a
 * hole, so the selected one is the only thing drawn. `min-h-0` drops the
 * height floor the button primitive puts under every control — a segmented
 * switch is chrome, not a call to action.
 */
const SEGMENT_GROUP = "flex shrink-0 gap-1 rounded-md border border-border p-1";

const SEGMENT =
  "flex-1 min-h-0 justify-center rounded-md border border-transparent bg-transparent px-2 py-1 font-normal normal-case tracking-normal text-xs text-text-muted not-italic shadow-none cursor-pointer hover:border-border-strong aria-[current]:border-border-strong aria-[current]:bg-surface-raised aria-[current]:text-text aria-[current]:font-medium";

/** The quiet copy: a link-shaped button in the corner of the code panel. */
const COPY_BUTTON =
  "absolute end-2 top-2 inline-flex min-h-0 items-center gap-1 rounded-md border border-border bg-surface-raised px-2 py-1 font-normal normal-case tracking-normal text-xs text-text-muted not-italic shadow-none cursor-pointer hover:border-border-strong hover:text-text";

/**
 * The code block. It WRAPS: the primitive layer pins `overflow-x` on a bare
 * `<pre>`, and a scroller only contains what it is GIVEN — a 4KB data URI as
 * one unbreakable token would widen the page rather than scroll in its own
 * box. So `whitespace-pre-wrap` on the block and `break-all` on the tokens,
 * and the scrollbar stays as the floor for the one line that cannot break.
 */
const CODE_PRE =
  "max-h-80 max-w-full whitespace-pre-wrap overflow-y-auto overflow-x-auto rounded-md border border-dashed border-border bg-surface p-4 font-mono text-text shadow-sm";

/** The panel every specimen sits in: one box, one surface, room to stand. */
const SPECIMEN_PANEL =
  "min-h-16 flex items-center justify-center rounded-md border border-dashed border-border bg-surface p-6 shadow-sm";

/** The measure a specimen's content is set at. */
const SPECIMEN_MEASURE = "max-w-md [--spacing-16:12rem]";

/**
 * One fixture: the specimen, or the markup that produced it.
 *
 * Both live in ONE grid cell, so the section's height is decided by
 * measurement rather than by whichever view happens to be showing — the
 * invisible one holds the room. A stacked pair used to put the markup
 * between every two specimens, which turns a page of components into a page
 * of code with components in it.
 */
function ExampleSection(props: {
  readonly row: RpcExample;
  readonly onLoad?: string;
}) {
  const [tab, setTab] = createSignal<"component" | "code">("component");
  const [copied, setCopied] = createSignal(false);
  let copiedFor: ReturnType<typeof setTimeout> | undefined;
  let pre!: HTMLPreElement;

  // The panel decides the room the specimen gets, and the markup says which
  // room it is: a page header is a page-width thing, and the md measure —
  // where the page's own prose reads — squeezes a header until its trail
  // wraps into a column of links. Everything else reads at the measure.
  const measure = props.row.html.trimStart().startsWith("<header")
    ? ""
    : SPECIMEN_MEASURE;
  const tokens = createMemo(() =>
    tokenizeHtml(formatExampleHtml(props.row.html))
  );

  async function copy(): Promise<void> {
    try {
      // What is SHOWN is what is copied: the formatted string in the panel,
      // not the fixture's source indentation beside it.
      await navigator.clipboard.writeText(pre.textContent ?? "");
    } catch {
      // A clipboard the page cannot reach is a permission, not a failure to
      // report: nothing was copied, so nothing is claimed.
      return;
    }
    setCopied(true);
    clearTimeout(copiedFor);
    // Whatever lib claims the timer — DOM's number, the peer's Timeout —
    // the handle and the clear agree on it.
    copiedFor = setTimeout(() => setCopied(false), 1200);
  }

  return (
    <section class="mb-8">
      <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 class="flex items-center gap-2 text-sm font-semibold">
          <span class="block h-1 w-4 rounded-full bg-primary" />
          {props.row.name}
        </h3>
        <div class={SEGMENT_GROUP} role="group" aria-label="Example view">
          <button
            type="button"
            class={SEGMENT}
            aria-current={tab() === "component" || undefined}
            onClick={() => setTab("component")}
          >
            <i class="i-lucide-eye icon-md" aria-hidden="true" />
            component
          </button>
          <button
            type="button"
            class={SEGMENT}
            aria-current={tab() === "code" || undefined}
            onClick={() => setTab("code")}
          >
            <i class="i-lucide-code-xml icon-md" aria-hidden="true" />
            code
          </button>
        </div>
      </div>
      <div class={`relative grid ${measure ? SPECIMEN_MEASURE : "max-w-full"} mx-auto`}>
        <pre
          ref={pre}
          class={`${CODE_PRE} col-start-1 row-start-1 ${
            tab() === "code" ? "" : "hidden"
          }`}
          aria-hidden={tab() === "code" ? undefined : "true"}
        >
          <span class="text-lg break-all">
            <For each={tokens()}>
              {(token) => <span class={INK[token.kind]}>{token.text}</span>}
            </For>
          </span>
        </pre>
        <button type="button" onClick={copy} class={COPY_BUTTON}>
          <i class="i-lucide-copy icon-md" aria-hidden="true" />
          {copied() ? "copied" : "copy"}
        </button>
        <div
          class={`${SPECIMEN_PANEL} col-start-1 row-start-1 ${
            tab() === "component" ? "" : "hidden"
          }`}
          aria-hidden={tab() === "component" ? undefined : "true"}
        >
          <Specimen
            html={props.row.html}
            onLoad={props.onLoad}
            measure={measure}
          />
        </div>
      </div>
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
  readonly measure: string;
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
      class={`spin-preview ${props.measure}`}
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
  // The contract carries what the list does not: the character tokens this
  // component declares, as the manifest authors them.
  const [contract] = createResource(
    () => params.name,
    (name) => primitivesContract(name),
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

  /**
   * Each declared character token with the theme's own word for it, or
   * nothing where the theme is missing the path — which is the row that
   * offers creation, scaffolded from the manifest's own value. A ref
   * re-derives: an edit or a creation writes the document, and the row that
   * was a Create button comes back as the control that edits it.
   */
  const character = createMemo(() => {
    const declared = contract()?.character ?? [];
    const tree = analyzeTheme(themeText()).tree;
    return declared.map((entry) => ({
      entry,
      row: tree === undefined
        ? undefined
        : tokenRowAt(tree, entry.path, activeMode()),
    }));
  });

  // A character token's slider ceiling is its FAMILY's — icon.sm beside
  // icon.md and icon.lg — so siblings share one track the way a scale's
  // steps do. Alone, the control takes headroom of its own.
  const siblingsFor = (path: string): readonly string[] | undefined => {
    const root = path.split(".")[0];
    const values = character()
      .filter((c) => c.entry.path.split(".")[0] === root && c.row !== undefined)
      .map((c) => c.row!.value);
    return values.length > 1 ? values : undefined;
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
            <header class="mb-4 flex flex-wrap items-start justify-between gap-4">
              <div class="min-w-0">
                <h1 class="text-2xl font-bold capitalize tracking-tight">
                  {component.name.replace(/-/g, " ")}
                </h1>
                <p class="truncate font-mono text-xs text-text-muted">
                  <Show when={component.tags.length > 0}>
                    {component.tags.map((t: string) => `<${t}>`).join("  ")}
                  </Show>
                  <Show when={component.variants.length > 0}>
                    <span class="ml-2 text-text-muted">
                      variants {component.variants.join(" ")}
                    </span>
                  </Show>
                </p>
              </div>
              <span class="shrink-0 rounded-full border border-border bg-surface-raised px-2 py-1 font-mono text-xs text-text-muted">
                {rows().length} examples
              </span>
            </header>

            <p class="mb-6 max-w-screen-md text-sm text-text-muted">
              {component.examples?.note ?? ""}
            </p>

            <For each={rows()}>
              {(row) => (
                <ExampleSection
                  row={row}
                  onLoad={component.examples?.onLoad}
                />
              )}
            </For>

            {
              /* The character axis, editable where it is spent: a token the
                theme holds edits here with its own control; a token it does
                not holds its manifest scaffold and offers to land it. */
            }
            <Show when={character().length > 0}>
              <h2 class="mt-6 text-xl">Character tokens</h2>
              <p class="mt-1 max-w-screen-md text-sm text-text-muted">
                What this component declares as its own character — edited here,
                and created here when the theme has never had to spell it.
              </p>
              <div class="mt-3 stack-sm">
                <For each={character()}>
                  {(entry) =>
                    entry.row !== undefined
                      ? (
                        <TokenRow
                          row={entry.row}
                          onEdit={editToken}
                          variable={entry.row.variable}
                          group={siblingsFor(entry.entry.path)}
                        />
                      )
                      : (
                        <card class="split p-4">
                          <div class="row-sm min-w-0">
                            <span class="truncate font-mono text-sm">
                              {entry.entry.path}
                            </span>
                          </div>
                          <div class="row-sm min-w-0 flex-1 flex-wrap items-center justify-end gap-3">
                            <span class="font-mono text-xs text-text-muted">
                              {entry.entry.type} · {entry.entry.value}
                            </span>
                            <button
                              type="button"
                              class="min-h-0 cursor-pointer rounded-md border border-border bg-surface-raised px-2 py-1 text-xs font-normal normal-case tracking-normal text-text shadow-none hover:border-primary"
                              onClick={() =>
                                createToken(
                                  entry.entry.path.split("."),
                                  entry.entry.type,
                                  entry.entry.value,
                                )}
                            >
                              Create
                            </button>
                          </div>
                        </card>
                      )}
                </For>
              </div>
            </Show>

            {
              /* Tokens this component reads, as paths. A path is the thing the
                editor can edit and a `--variable` is not, so each entry links
                to the editor that owns it. */
            }
            <Show when={tokenEntries().length > 0}>
              <h2 class="mt-6 text-xl">Tokens this reads</h2>
              <p class="mt-2 font-mono text-xs leading-relaxed text-text-muted">
                <For each={tokenEntries()}>
                  {({ path }, i) => (
                    <>
                      {i() > 0 && <span>, </span>}
                      <A href={editorRouteFor(path)} class="hover:text-text hover:underline">{path}</A>
                    </>
                  )}
                </For>
              </p>
            </Show>
          </div>
        )}
      </Show>
    </div>
  );
}

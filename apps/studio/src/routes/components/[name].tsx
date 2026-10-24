/**
 * One component, read rather than described.
 *
 * This page replaces four hand-written pages that each spelled their own
 * markup: the studio's button page contained `<button class="secondary">
 * Cancel</button>` typed by hand while `button.examples.ts` was shipping the
 * same control as data. Nothing here is a copy — the label, the note, and the
 * markup all arrive from `primitives.list`, so a change to a component's
 * examples is a change this page renders. The component tokens come from
 * `primitives.contract`: what the manifest says the component starts at, so a
 * theme that has never spelled `button.weight` meets the token HERE, on the
 * component that spends it, and can create it scaffolded as authored.
 *
 * The markup is set with `innerHTML` because it is sourced markup the studio
 * is asked to render, not markup it writes. The daemon is the only thing that
 * produces it, and the same markup is registered with it so the stylesheet is
 * generated for what is actually on screen.
 *
 * EVERY SECTION OWNS ITS SWITCH, and the switch sits in the section's own
 * header. A reader who wants the markup of the fourth example should not
 * have to scroll back up to a control that governs the whole page, and two
 * sections must be able to show different things at once — so the state
 * belongs to the section, not to the page. The copy is the same way round: it
 * belongs to the code it copies, so it is part of the code block and appears
 * only while that block is on screen.
 */

import {
  createEffect,
  createMemo,
  createResource,
  createSignal,
  For,
  onCleanup,
  Show,
} from "solid-js";
import { A, useParams } from "@solidjs/router";
import {
  copyComponentExample,
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
import { measure } from "../../lib/scale.ts";
import { Specimen } from "@spinjs/kit";
import TokenRow from "../../components/demos/TokenRow.tsx";
import { Badge, Marker, TokenChip } from "../../components/Concern.tsx";

/** The measure a specimen's content is set at. */
const SPECIMEN_MEASURE = "max-w-md [--spacing-16:12rem]";

/**
 * One fixture: the specimen, or the markup that produced it.
 *
 * The two occupy the same place and only one of them is THERE: a section is
 * as tall as what it shows. The panel used to hold the room for both views,
 * so every specimen sat in a box with a hole under it as deep as the longest
 * block on the page. Switching views now changes the section's height, which
 * is what a section that shows one thing at a time does.
 */
function ExampleSection(props: {
  readonly row: RpcExample;
  readonly onLoad?: string;
  readonly componentName?: string;
}) {
  // The section's own view switch lives in the kit specimen: one row, one
  // switch, shared with the reference and docs pages. What stays here is
  // the studio's own: copying the example into the project, which is daemon
  // knowledge the kit must never carry.
  const [copiedFile, setCopiedFile] = createSignal<string | null>(null);
  // The panel decides the room the specimen gets, and the markup says which
  // room it is: a page header is a page-width thing, and the md measure —
  // where the page's own prose reads — squeezes a header until its trail
  // wraps into a column of links. Everything else reads at the measure.
  const measure = props.row.html.trimStart().startsWith("<header")
    ? ""
    : SPECIMEN_MEASURE;
  const copyExample = async (): Promise<void> => {
    if (props.componentName === undefined || props.row.stem === undefined) {
      return;
    }
    const result = await copyComponentExample(
      props.componentName,
      props.row.stem,
    );
    if (result.error === null && result.file !== null) {
      setCopiedFile(result.file);
    }
  };
  return (
    <section class="mb-4">
      <div class="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        <h3 class="flex items-center gap-2">
          <Marker />
          {props.row.name}
        </h3>
        <Show when={props.row.stem !== undefined}>
          <button
            type="button"
            class="secondary s-sm min-h-0 cursor-pointer text-xs hover:border-primary"
            onClick={() => void copyExample()}
          >
            {copiedFile() ?? "copy to project"}
          </button>
        </Show>
      </div>
      <Specimen
        name={props.row.name}
        html={props.row.mountHtml ?? props.row.html}
        source={props.row.html}
        onLoad={props.onLoad ?? props.row.onLoad}
        stage={`spin-preview ${measure}`}
      />
    </section>
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
  // The contract carries what the list does not: the component tokens this
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
  const [showTokens, setShowTokens] = createSignal(false);

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

  /**
   * The tokens the component reads, and what each is worth.
   *
   * The contract names the variables a component reads; the live theme says
   * which token path each one is, so the readout is editable identity rather
   * than emitted output — and the value beside the path is the theme's own
   * answer for it now, so the chip says what the token IS rather than only
   * what it is called.
   */
  const tokenEntries = () => {
    const tree = analyzeTheme(themeText()).tree;
    if (tree === undefined) return [];
    const byVar = tokenPathsByVar(tree);
    const vars = Object.values(tokens()?.reads ?? {}).flat() as string[];
    const paths = vars
      .map((variable) => byVar.get(variable))
      .filter((path): path is string => path !== undefined);
    return [...new Set(paths)].map((path) => ({
      path,
      value: tokenRowAt(tree, path, activeMode())?.value ?? "—",
    }));
  };

  /**
   * Each declared component token with the theme's own word for it, or
   * nothing where the theme is missing the path — which is the row that
   * offers creation, scaffolded from the manifest's own value. A ref
   * re-derives: an edit or a creation writes the document, and the row that
   * was a Create button comes back as the control that edits it.
   */
  const componentTokens = createMemo(() => {
    const declared = contract()?.component ?? [];
    const tree = analyzeTheme(themeText()).tree;
    return declared.map((entry) => ({
      entry,
      row: tree === undefined
        ? undefined
        : tokenRowAt(tree, entry.path, activeMode()),
    }));
  });

  // A component token's slider ceiling is its FAMILY's — icon.sm beside
  // icon.md and icon.lg — so siblings share one track the way a scale's
  // steps do. Alone, the control takes headroom of its own. A family is
  // same-root and same-KIND: `button.weight` is a number and
  // `button.tracking` a length, and letting one rule the other's ceiling
  // turned a hundredth of an em into a seventy-five-em track.
  const siblingsFor = (path: string): readonly string[] | undefined => {
    const root = path.split(".")[0];
    const own = componentTokens().find((c) => c.entry.path === path)?.row;
    const kind = own === undefined ? undefined : measure(own.value)?.kind;
    if (kind === undefined) return undefined;
    const values = componentTokens()
      .filter((c) =>
        c.entry.path.split(".")[0] === root && c.row !== undefined &&
        measure(c.row.value)?.kind === kind
      )
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
                <h1 class="capitalize">{params.name}</h1>
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
                <h1 class="capitalize">
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
              <div class="flex shrink-0 items-center gap-2">
                <Show when={componentTokens().length > 0}>
                  <button
                    type="button"
                    // The chip that opens the panel wears the acting colour
                    // while the panel is open: it is the control that is on,
                    // and a control that is on says so in colour. The two
                    // states are spelled out rather than layered, because a
                    // second colour class on the same element is a coin toss
                    // for which one the sheet writes last.
                    class={`min-h-0 cursor-pointer rounded-md border px-2 py-1 font-mono text-xs font-regular normal-case tracking-normal shadow-none hover:border-primary ${
                      showTokens()
                        ? "border-transparent bg-primary text-on-primary"
                        : "border-border bg-surface-raised text-text"
                    }`}
                    onClick={() => setShowTokens((v) => !v)}
                  >
                    {showTokens() ? "hide" : "component tokens"}{" "}
                    ({componentTokens().length})
                  </button>
                </Show>
                <badge class="shrink-0">
                  {rows().length} examples
                </badge>
              </div>
            </header>

            <p class="max-w-screen-md text-sm text-text-muted">
              {component.examples?.note ?? ""}
            </p>

            <Show
              when={component.kind === "machine" &&
                component.manifest !== undefined}
            >
              <div
                class="mt-3 flex flex-wrap gap-1"
                aria-label="Machine contract"
              >
                <For
                  each={Object.entries(component.manifest!) as [
                    string,
                    readonly string[],
                  ][]}
                >
                  {([tier, names]) => (
                    <Show when={names.length > 0}>
                      <span class="rounded-md border border-border bg-surface-raised px-2 py-1 font-mono text-xs text-text-muted">
                        {tier}: {names.length}
                      </span>
                    </Show>
                  )}
                </For>
              </div>
            </Show>

            <Show when={showTokens() && componentTokens().length > 0}>
              <div class="my-4 stack-sm rounded-md border border-border bg-surface-raised p-4">
                <div class="flex items-center justify-between">
                  <h2>Component tokens</h2>
                  <button
                    type="button"
                    // `bare` takes the theme's button tokens back: the
                    // panel's close is a way out of the panel, not the
                    // loudest action in it. Without it the theme's own
                    // primary fill and hard shadow reach a control that
                    // meant to read as a link.
                    class="bare text-text-muted hover:text-text"
                    onClick={() => setShowTokens(false)}
                  >
                    close
                  </button>
                </div>
                <p class="text-xs text-text-muted">
                  The tokens this component declares as its own — edited inline
                  while you interact with the specimens below, or created here
                  when the theme currently relies on the shared scale.
                </p>
                <div class="stack-sm">
                  <For each={componentTokens()}>
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
                          <card class="split p-2">
                            <div class="row-sm min-w-0">
                              <span class="truncate font-mono text-xs">
                                {entry.entry.path}
                              </span>
                            </div>
                            <div class="row-sm min-w-0 flex-1 flex-wrap items-center justify-end gap-2">
                              <span class="font-mono text-xs text-text-muted">
                                {entry.entry.type} · falls back to{" "}
                                {entry.entry.value}
                              </span>
                              <Badge tone="warning">not declared</Badge>
                              <button
                                type="button"
                                class="secondary s-sm min-h-0 cursor-pointer text-xs hover:border-primary"
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
              </div>
            </Show>

            <For each={rows()}>
              {(row) => (
                <ExampleSection
                  row={row}
                  onLoad={component.examples?.onLoad}
                  componentName={component.name}
                />
              )}
            </For>

            <Show when={tokenEntries().length > 0}>
              <section class="mt-6 stack-sm" aria-label="Tokens this reads">
                <h2 class="row-sm">
                  <Marker />
                  <span>Tokens this reads</span>
                </h2>
                <div class="flex flex-wrap gap-2">
                  <For each={tokenEntries()}>
                    {(entry) => (
                      <A
                        href={editorRouteFor(entry.path)}
                        class="no-underline hover:underline"
                      >
                        <TokenChip path={entry.path} value={entry.value} />
                      </A>
                    )}
                  </For>
                </div>
              </section>
            </Show>
          </div>
        )}
      </Show>
    </div>
  );
}

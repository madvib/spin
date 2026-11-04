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
import { useParams } from "@solidjs/router";
import "@spinjs/components/examples";
import {
  copyComponentExample,
  displayComponentName,
  primitivesContract,
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
import { tokenRowAt } from "../../lib/tokens.ts";
import { measure } from "../../lib/scale.ts";
import { Specimen } from "@spinjs/kit";
import TokenRow from "../../components/demos/TokenRow.tsx";
import { Badge } from "../../components/Concern.tsx";

const NARROW_COMPONENTS = new Set([
  "component-mode-picker",
]);

const OVERLAY_COMPONENTS = new Set([
  "component-cascade-select",
  "component-color-picker",
  "component-combobox",
  "component-date-picker",
  "component-hover-card",
  "component-menu",
  "component-navigation-menu",
  "component-popover",
  "component-select",
  "component-tooltip",
]);
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
  const isNarrow = () =>
    !props.row.html.trimStart().startsWith("<header") &&
    props.componentName !== undefined &&
    NARROW_COMPONENTS.has(props.componentName);
  const isOverlay = () =>
    props.componentName !== undefined &&
    OVERLAY_COMPONENTS.has(props.componentName);
  const stageMeasure = () =>
    isNarrow() && !isOverlay()
      ? "mx-auto flex w-full max-w-md flex-col items-center"
      : "w-full";
  const overlayClass = () =>
    isOverlay() ? "flex flex-col items-stretch justify-start pt-2" : "";
  const copyExample = async (): Promise<void> => {
    if (props.componentName === undefined || props.row.stem === undefined) {
      return;
    }
    const result = await copyComponentExample(
      props.componentName,
      props.row.stem,
    );
    if (result.error === null && result.tag !== null) {
      setCopiedFile(`<${result.tag}>`);
    }
  };
  return (
    <Specimen
      name={props.row.name}
      html={props.row.mountHtml ?? props.row.html}
      source={props.row.html}
      onLoad={props.row.onLoad ?? props.onLoad}
      stage={`spin-preview ${stageMeasure()} ${overlayClass()}`.trim()}
      stageStyle={isOverlay() ? { "min-height": "14rem" } : undefined}
      overlay={isOverlay()}
      panelClass="w-full"
      actions={
        <Show when={props.row.stem !== undefined}>
          <button
            type="button"
            class="secondary s-sm min-h-0 cursor-pointer text-xs hover:border-primary"
            onClick={() => void copyExample()}
          >
            {copiedFile() ?? "copy to project"}
          </button>
        </Show>
      }
    />
  );
}

export default function ComponentPage() {
  const params = useParams();
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
    library()?.find(
      (c) => c.name === params.name || c.name === `component-${params.name}`,
    )
  );
  const rows = () => found()?.examples?.rows ?? [];
  const [showTokens, setShowTokens] = createSignal(false);
  const [showApi, setShowApi] = createSignal(false);
  const [showClasses, setShowClasses] = createSignal(false);

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
   * Each declared component token with the theme's own word for it, or
   * nothing where the theme is missing the path — which is the row that
   * offers creation, scaffolded from the manifest's own value. A ref
   * re-derives: an edit or a creation writes the document, and the row that
   * was a Create button comes back as the control that edits it.
   */
  const declaredTokens = createMemo(() => contract()?.component ?? []);
  const parsedTree = createMemo(() => analyzeTheme(themeText()).tree);

  // A component token's slider ceiling is its FAMILY's — icon.sm beside
  // icon.md and icon.lg — so siblings share one track the way a scale's
  // steps do. Alone, the control takes headroom of its own. A family is
  // same-root and same-KIND: `button.weight` is a number and
  // `button.tracking` a length, and letting one rule the other's ceiling
  // turned a hundredth of an em into a seventy-five-em track.
  const siblingsFor = (path: string): readonly string[] | undefined => {
    const tree = parsedTree();
    if (tree === undefined) return undefined;
    const root = path.split(".")[0];
    const own = tokenRowAt(tree, path, activeMode());
    const kind = own === undefined ? undefined : measure(own.value)?.kind;
    if (kind === undefined) return undefined;
    const values: string[] = [];
    for (const entry of declaredTokens()) {
      if (entry.path.split(".")[0] !== root) continue;
      const row = tokenRowAt(tree, entry.path, activeMode());
      if (row !== undefined && measure(row.value)?.kind === kind) {
        values.push(row.value);
      }
    }
    return values.length > 1 ? values : undefined;
  };

  const classRowsFor = (
    component: NonNullable<ReturnType<typeof found>>,
  ): readonly { name: string; kind: string; description: string }[] => {
    if (
      component.kind === "primitive" &&
      component.examples?.classes !== undefined &&
      component.examples.classes.length > 0
    ) {
      return component.examples.classes;
    }
    // No curated rows: list the tags and stop. Guessing Color/Style/Size
    // from variant names produced filler ("Style class for Details") that
    // reads as documentation but documents nothing.
    const label = displayComponentName(component.name);
    return component.tags
      .filter((tag) => {
        if (component.name === "button" && tag === "span") return false;
        if (
          component.name === "breadcrumbs" &&
          (tag === "a" || tag === "li")
        ) {
          return false;
        }
        return true;
      })
      .map((tag) => ({
        name: `<${tag}>`,
        kind: "Component",
        description:
          component.kind === "machine"
            ? `Custom element host for the ${label} component`
            : `Base HTML element styled by the ${label} primitive`,
      }));
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
                  {displayComponentName(component.name)}
                </h1>
                <Show
                  when={
                    component.kind !== "machine" &&
                    Boolean(component.examples?.note)
                  }
                >
                  <p class="mt-1 max-w-screen-md text-sm text-text-muted">
                    {component.examples?.note}
                  </p>
                </Show>
              </div>
              <div class="flex shrink-0 items-center gap-2">
                <Show
                  when={component.kind === "machine" &&
                    component.manifest !== undefined}
                >
                  <button
                    type="button"
                    class={`min-h-0 cursor-pointer rounded-md border px-2 py-1 font-mono text-xs font-regular normal-case tracking-normal shadow-none hover:border-primary ${
                      showApi()
                        ? "border-transparent bg-primary text-on-primary"
                        : "border-border bg-surface-raised text-text"
                    }`}
                    onClick={() => setShowApi((v) => !v)}
                  >
                    {showApi() ? "hide api" : "api"}
                  </button>
                </Show>
                <Show when={declaredTokens().length > 0}>
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
                    ({declaredTokens().length})
                  </button>
                </Show>
                <Show when={classRowsFor(component).length > 0}>
                  <button
                    type="button"
                    class={`min-h-0 cursor-pointer rounded-md border px-2 py-1 font-mono text-xs font-regular normal-case tracking-normal shadow-none hover:border-primary ${
                      showClasses()
                        ? "border-transparent bg-primary text-on-primary"
                        : "border-border bg-surface-raised text-text"
                    }`}
                    onClick={() => setShowClasses((v) => !v)}
                  >
                    {showClasses() ? "hide" : "classes & tags"}
                  </button>
                </Show>
                <badge class="shrink-0">
                  {rows().length} examples
                </badge>
              </div>
            </header>

            <Show when={showClasses() && classRowsFor(component).length > 0}>
              <div
                data-studio-chrome=""
                class="mb-4 w-fit max-w-full overflow-x-auto rounded-md border border-border bg-surface text-left text-xs"
                aria-label="Classes and tags"
              >
                <table class="m-0 w-full border-collapse text-left text-xs">
                  <thead>
                    <tr class="border-b border-border bg-surface-raised text-text-muted">
                      <th class="whitespace-nowrap px-3 py-2 font-mono text-xs font-medium">
                        Class / Tag
                      </th>
                      <th class="whitespace-nowrap px-3 py-2 font-mono text-xs font-medium">
                        Type
                      </th>
                      <th class="px-3 py-2 text-xs font-medium">
                        Description
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <For each={classRowsFor(component)}>
                      {(item) => (
                        <tr class="border-b border-border last:border-b-0">
                          <td class="whitespace-nowrap px-3 py-1 font-mono text-xs font-medium text-primary">
                            <code>{item.name}</code>
                          </td>
                          <td class="whitespace-nowrap px-3 py-1 font-mono text-xs text-text-muted">
                            <span class="inline-flex items-center rounded-sm border border-border bg-surface-raised px-2 py-0 font-mono text-xs">
                              {item.kind}
                            </span>
                          </td>
                          <td class="px-3 py-1 text-xs text-text-muted">
                            {item.description}
                          </td>
                        </tr>
                      )}
                    </For>
                  </tbody>
                </table>
              </div>
            </Show>
            <Show
              when={showApi() &&
                component.kind === "machine" &&
                component.manifest !== undefined}
            >
              <div
                data-studio-chrome=""
                class="my-4 stack-sm rounded-md border border-border bg-surface-raised p-4"
                aria-label="Machine contract"
              >
                <div class="flex items-center justify-between">
                  <h2>Machine API</h2>
                  <button
                    type="button"
                    class="bare p-0 text-text-muted hover:text-text"
                    onClick={() => setShowApi(false)}
                  >
                    close
                  </button>
                </div>
                <div class="stack-sm">
                  <For
                    each={Object.entries(component.manifest!) as [
                      string,
                      readonly string[],
                    ][]}
                  >
                    {([tier, names]) => (
                      <Show when={names.length > 0}>
                        <div class="flex flex-wrap items-baseline gap-2">
                          <span class="w-20 shrink-0 font-mono text-xs text-text-muted">
                            {tier}
                          </span>
                          <div class="flex flex-wrap gap-1">
                            <For each={names}>
                              {(name) => (
                                <code class="rounded-sm border border-border bg-surface px-1 py-0 font-mono text-xs text-text">
                                  {name}
                                </code>
                              )}
                            </For>
                          </div>
                        </div>
                      </Show>
                    )}
                  </For>
                </div>
              </div>
            </Show>
            <Show when={showTokens() && declaredTokens().length > 0}>
              <div data-studio-chrome="" class="my-4 stack-sm rounded-md border border-border bg-surface-raised p-4">
                <div class="flex items-center justify-between">
                  <h2>Component tokens</h2>
                  <button
                    type="button"
                    // `bare` takes the theme's button tokens back: the
                    // panel's close is a way out of the panel, not the
                    // loudest action in it. Without it the theme's own
                    // primary fill and hard shadow reach a control that
                    // meant to read as a link.
                    class="bare p-0 text-text-muted hover:text-text"
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
                  <For each={declaredTokens()}>
                    {(entry) => {
                      const row = createMemo(() => {
                        const tree = parsedTree();
                        return tree === undefined
                          ? undefined
                          : tokenRowAt(tree, entry.path, activeMode());
                      });
                      return (
                        <Show
                          when={row()}
                          fallback={
                            <card class="min-h-12 flex-row items-center justify-between gap-4 px-3 py-2">
                              <div class="row-sm min-w-0">
                                <span class="truncate font-mono text-xs">
                                  {entry.path}
                                </span>
                              </div>
                              <div class="row-sm min-w-0 shrink-0 items-center justify-end gap-2">
                                <span class="font-mono text-xs text-text-muted">
                                  {entry.type} · falls back to {entry.value}
                                </span>
                                <Badge tone="warning">not declared</Badge>
                                <button
                                  type="button"
                                  class="secondary s-sm min-h-0 cursor-pointer text-xs hover:border-primary"
                                  onClick={() =>
                                    createToken(
                                      entry.path.split("."),
                                      entry.type,
                                      entry.value,
                                    )}
                                >
                                  Create
                                </button>
                              </div>
                            </card>
                          }
                        >
                          {(currentRow) => (
                            <TokenRow
                              row={currentRow()}
                              onEdit={editToken}
                              variable={currentRow().variable}
                              group={siblingsFor(entry.path)}
                            />
                          )}
                        </Show>
                      );
                    }}
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

          </div>
        )}
      </Show>
    </div>
  );
}

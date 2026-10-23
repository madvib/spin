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
import { measure } from "../../lib/scale.ts";
import {
  type CodeKind,
  formatExampleHtml,
  tokenizeHtml,
} from "../../lib/code.ts";
import TokenRow from "../../components/demos/TokenRow.tsx";
import { Badge, Marker, TokenChip } from "../../components/Concern.tsx";

/** Where a run of characters sits, and the ink that says so. */
const INK: Record<CodeKind, string> = {
  tag: "text-accent",
  attr: "text-secondary",
  value: "text-text-muted",
  text: "text-text",
};

/**
 * How a section shows its example: the element as it renders, or the markup
 * that produced it.
 */
type View = "component" | "code";

/**
 * The switch's two buttons.
 *
 * Quiet by default and legible when the pointer or the keyboard arrives: the
 * pair is chrome the studio owns, and chrome that shouts — a bordered bar, a
 * floating toolbar — competes with the specimen it sits above. `aria-pressed`
 * says which one is showing, so the eye and the screen reader read the same
 * fact. `min-h-0` drops the height floor the button primitive puts under
 * every control, because a switch is a way of looking, not a call to action.
 *
 * The button that IS showing wears the acting colour, because "this is what
 * you are looking at" is the one thing a switch has to say, and a raised
 * surface on a raised page says it too quietly to be read at a glance.
 */
const SWITCH =
  "inline-flex min-h-0 items-center justify-center cursor-pointer rounded-sm border border-transparent bg-transparent px-2 py-1 font-regular normal-case tracking-normal text-xs text-text-muted not-italic shadow-none hover:bg-surface-raised hover:text-text focus:bg-surface-raised focus:text-text aria-[pressed=true]:bg-primary aria-[pressed=true]:text-on-primary";

/**
 * The copy control.
 *
 * It belongs to the block it copies, so it is not on the page until the
 * pointer or the keyboard reaches that block: `opacity-0` until the block is
 * hovered, and `pointer-events-none` so an invisible control cannot be hit by
 * accident. It appears in the code view only — the component view shows no
 * markup, so there is nothing there to copy.
 *
 * It sits in the block's bottom corner, where a snippet's last line is
 * shortest, and it sits OUTSIDE the scroller — so it stays put while a long
 * block scrolls inside its own box.
 */
const COPY_CONTROL =
  "absolute end-2 bottom-2 inline-flex min-h-0 items-center gap-1 cursor-pointer rounded-sm border border-border bg-surface-raised px-2 py-1 font-mono text-xs font-regular normal-case tracking-normal text-text-muted not-italic shadow-none opacity-0 pointer-events-none transition-opacity duration-fast group-hover:opacity-100 group-hover:pointer-events-auto focus:opacity-100 focus:pointer-events-auto hover:border-border-strong hover:text-text";

/**
 * The code block. It WRAPS: the primitive layer pins `overflow-x` on a bare
 * `<pre>`, and a scroller only contains what it is GIVEN — a 4KB data URI as
 * one unbreakable token would widen the page rather than scroll in its own
 * box. So `whitespace-pre-wrap` on the block and `break-all` on the tokens,
 * and the scrollbar stays as the floor for the one line that cannot break.
 *
 * The height is bounded: a long block scrolls inside its own box rather than
 * pushing the page down. `max-h-80` was a number in no token and generated no
 * CSS at all, so the bound is the one the rule allows a page to state for
 * itself — a measure in rem.
 */
const CODE_PRE =
  "max-h-[20rem] max-w-full whitespace-pre-wrap overflow-y-auto overflow-x-auto rounded-md border border-dashed border-border bg-surface p-4 font-mono text-text shadow-sm";

/**
 * The panel every specimen sits in: one box, one surface, room to stand.
 *
 * The fill is the RAISED surface, not the page's own: a panel painted in the
 * page's colour is a hole with a dashed edge around it, and the specimen in
 * it looks like it is floating in nothing. A card says "this is a thing on
 * a surface", which is what the specimen is.
 */
const SPECIMEN_PANEL =
  "min-h-[2rem] flex items-center justify-center rounded-md border border-dashed border-border bg-surface-raised p-4 shadow-sm";

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
}) {
  // The section's own view. Two sections can show different things at once,
  // because each one answers to its own switch and to nothing else.
  const [view, setView] = createSignal<View>("component");
  // The panel decides the room the specimen gets, and the markup says which
  // room it is: a page header is a page-width thing, and the md measure —
  // where the page's own prose reads — squeezes a header until its trail
  // wraps into a column of links. Everything else reads at the measure.
  const measure = props.row.html.trimStart().startsWith("<header")
    ? ""
    : SPECIMEN_MEASURE;
  const markup = createMemo(() => formatExampleHtml(props.row.html));
  const tokens = createMemo(() => tokenizeHtml(markup()));
  const code = () => view() === "code";

  return (
    <section class="mb-4">
      <div class="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        <h3 class="flex items-center gap-2">
          <Marker />
          {props.row.name}
        </h3>
        <ViewSwitch view={view()} onChange={setView} />
      </div>
      <Show when={!code()}>
        <div
          class={`${SPECIMEN_PANEL} mx-auto ${
            measure ? SPECIMEN_MEASURE : "max-w-full"
          }`}
        >
          <Specimen
            html={props.row.html}
            onLoad={props.onLoad}
            measure={measure}
          />
        </div>
      </Show>
      <Show when={code()}>
        <div
          class={`group relative mx-auto ${
            measure ? SPECIMEN_MEASURE : "max-w-full"
          }`}
        >
          <pre class={CODE_PRE}>
            <span class="text-lg break-all">
              <For each={tokens()}>
                {(token) => <span class={INK[token.kind]}>{token.text}</span>}
              </For>
            </span>
          </pre>
          <CopyControl markup={markup()} />
        </div>
      </Show>
    </section>
  );
}

/**
 * The section's switch: two small buttons, one per view, each saying whether
 * it is the one showing.
 *
 * Two buttons and `aria-pressed`, rather than an element that claims to be a
 * tab strip: the switch is chrome this page owns, and chrome that reads as
 * borrowed furniture is louder than the specimen it sits above.
 */
function ViewSwitch(props: {
  readonly view: View;
  readonly onChange: (view: View) => void;
}) {
  return (
    <div class="flex items-center gap-1">
      <button
        type="button"
        class={SWITCH}
        aria-pressed={props.view === "component"}
        onClick={() => props.onChange("component")}
      >
        component
      </button>
      <button
        type="button"
        class={SWITCH}
        aria-pressed={props.view === "code"}
        onClick={() => props.onChange("code")}
      >
        code
      </button>
    </div>
  );
}

/**
 * The copy control for one code block.
 *
 * What it puts on the clipboard is the block's own markup, formatted the way
 * the block shows it — what is SHOWN is what is copied. It says so when it
 * has done it, and then goes quiet, so the next block copied does not leave
 * a stale claim behind.
 */
function CopyControl(props: { readonly markup: string }) {
  const [copied, setCopied] = createSignal(false);
  let copiedFor: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => clearTimeout(copiedFor));

  async function copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(props.markup);
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
    <button type="button" class={COPY_CONTROL} onClick={copy}>
      <i
        class={copied() ? "i-lucide-check icon-md" : "i-lucide-copy icon-md"}
        aria-hidden="true"
      />
      {copied() ? "copied" : "copy"}
    </button>
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
                <ExampleSection row={row} onLoad={component.examples?.onLoad} />
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

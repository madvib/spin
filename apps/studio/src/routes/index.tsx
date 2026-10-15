/**
 * The overview — what this project's themes look like, and where to go next.
 *
 * The home page used to be a list of names and a delete button: the one page
 * that could answer "what does this theme look like" answered it with
 * nothing you could see, and every question it did raise had to be asked of
 * a concern page first. This is the surface that replaces it — the themes on
 * disk with their palettes on them, and one card per concern showing a
 * specimen of what that concern spends, each linking to the page that edits
 * it.
 *
 * Everything shown is read from the document being edited, in the mode being
 * shown, so what the overview says and what the concern pages say cannot
 * disagree: they are reading the same text through the same resolvers. The
 * chips are painted by a utility — `bg-primary` resolves the preview
 * stylesheet's own answer — and the value beside each one is that same token
 * resolved here, which is the check that the two answers still match.
 */

import { createEffect, createMemo, createSignal, For, onCleanup, Show } from "solid-js";
import type { JSX } from "solid-js";
import { A } from "@solidjs/router";
import { scaffoldTheme, treeToJson } from "@spin/theme";
import PlayRig from "../components/demos/PlayRig.tsx";
import { ModePicker, ThemePicker } from "../components/Settings.tsx";
import { inDrawer } from "../app.tsx";
import {
  activeComponents,
  activeMode,
  activeName,
  activeModes,
  library,
  refetchThemes,
  registerMarkup,
  registry,
  setActiveName,
  themeSummaries,
  themeText,
} from "../lib/store.ts";
import {
  copyTheme,
  removeTheme,
  saveTheme,
} from "../lib/themes.ts";
import { analyzeTheme } from "../lib/theme.ts";
import { editorRouteFor, groupTokens } from "../lib/tokens.ts";
import type { TokenRow } from "../lib/tokens.ts";
import {
  durationUtility,
  elementSamples,
  faceSpecimens,
  paletteChips,
  spaceSteps,
  surfaceSteps,
} from "../lib/overview.ts";
import type { Chip, ElementSample, Face } from "../lib/overview.ts";
import { DISPLAY, MONOSPACE, PHRASE } from "../lib/specimen-copy.ts";
import type { RoutePath } from "../lib/routes.ts";

export default function OverviewPage() {
  const summaries = createMemo(() => themeSummaries());
  const active = createMemo(() =>
    summaries().find((summary) => summary.name === activeName())
  );

  /** The token rows one group has, in the mode being shown. */
  function rows(prefixes: string[][]): TokenRow[] {
    const tree = analyzeTheme(themeText()).tree;
    return tree === undefined ? [] : groupTokens(tree, prefixes, activeMode());
  }

  const palette = createMemo(() => paletteChips(themeText(), activeMode()));
  const ladder = createMemo(() => surfaceSteps(themeText(), activeMode()));
  const faces = createMemo(() => faceSpecimens(themeText(), activeMode()));
  const space = createMemo(() => spaceSteps(themeText(), activeMode()));
  const radius = createMemo(() => rows([["radius"]]));
  const shadow = createMemo(() => rows([["shadow"]]));
  const durations = createMemo(() => rows([["motion", "duration"]]));
  const samples = createMemo(() => elementSamples(library() ?? []));
  const play = createMemo(() => {
    const row = durations()[0];
    return row === undefined
      ? undefined
      : { path: row.path, utility: durationUtility(row.path) };
  });
  const issues = createMemo(() => {
    const report = analyzeTheme(themeText());
    return [
      ...(report.error === undefined
        ? []
        : [{ path: "", message: report.error }]),
      ...report.issues,
    ];
  });
  const componentsLine = () => (activeComponents() ?? []).join(", ");

  /**
   * The markup this route renders, declared so the preview can be generated
   * for it.
   *
   * Uno reads source text, which is how the chrome gets its CSS — but the
   * primitives in the element sample arrive from the daemon at runtime and
   * the duration utility is named after a token the theme declares, so
   * neither is in any file the scanner can see. Registering the rendered
   * markup is what makes the daemon generate for what is actually on screen.
   * One route writes at a time, so the markup goes back to nothing when this
   * one unmounts.
   */
  createEffect(() => {
    registerMarkup([
      ...samples().map((sample) => sample.row.html),
      ...durations().map((row) => durationUtility(row.path)),
      // What a rig plays beside its own duration, spelled out for the same
      // reason: the rig composes these at runtime.
      "transition-colors duration-base",
    ].join("\n"));
  });
  onCleanup(() => registerMarkup(""));

  // The dialog's state.
  const [open, setOpen] = createSignal(false);
  const [name, setName] = createSignal("");
  const [source, setSource] = createSignal<string | undefined>(undefined);
  const [blanks, setBlanks] = createSignal(false);
  const [problem, setProblem] = createSignal<string | null>(null);
  const [confirming, setConfirming] = createSignal<string | null>(null);

  /**
   * What the copy starts from.
   *
   * The first theme on disk rather than a name the registry may not have:
   * the picker used to be seeded with `starter` while the select beside it
   * showed `default`, so creating a theme copied something that did not
   * exist and said nothing about it.
   */
  const chosen = () => source() ?? registry()?.[0]?.name ?? "";

  async function create(): Promise<void> {
    const next = name().trim();
    if (next === "") return;
    setProblem(null);
    const written = blanks()
      ? await saveTheme(next, treeToJson(scaffoldTheme()))
      : await copyTheme(chosen(), next);
    if (written.error !== null) {
      setProblem(written.error);
      return;
    }
    refetchThemes();
    setOpen(false);
    setName("");
    setSource(undefined);
    setBlanks(false);
    setActiveName(next);
  }

  async function remove(theme: string): Promise<void> {
    if (confirming() !== theme) {
      setConfirming(theme);
      return;
    }
    const { error } = await removeTheme(theme);
    if (error === null) {
      setConfirming(null);
      refetchThemes();
    }
  }

  return (
    // The pane's paper is the project's, because its ink is: a header reading
    // `text-text` on the chrome's surface only agrees by luck.
    <div
      class="drawer-scroll flex-1 overflow-y-auto bg-surface p-4 sm:p-6 min-h-0 min-w-0"
    >
      <div class="mx-auto stack-lg max-w-6xl">
        <header class="stack-sm">
          <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
            <h1 class="text-3xl">Themes</h1>
            <span class="flex-1" />
            <div class="row-sm min-w-0">
              <label
                for="theme-picker-compact"
                class="text-sm text-text-muted"
              >
                Theme
              </label>
              <ThemePicker compact />
            </div>
            <ModePicker />
            <button type="button" onClick={() => setOpen(true)}>
              New theme
            </button>
          </div>
          {
            /* The status line names what every page below is showing. It is
              also what the studio's own gate waits for: the shell renders
              without a theme seated, and this line is the one thing that is
              only true once the registry has answered. */
          }
          <p class="text-sm text-text-muted">
            Editing <strong class="text-text">{activeName()}</strong>
            {" · "}
            {activeMode()}
            {" · "}
            {active()?.tokens ?? 0} tokens
            {" · "}
            {active()?.dirty === true ? "unsaved changes" : "saved"}
          </p>
        </header>

        <section class="stack-sm" aria-label="Themes">
          <div class="split">
            <h2 class="text-xl">On disk</h2>
            <span class="text-sm text-text-muted">
              {summaries().length} themes
            </span>
          </div>
          <div
            class="grid gap-3 grid-cols-1"
            classList={{
              "sm:grid-cols-2": !inDrawer(),
              "xl:grid-cols-3": !inDrawer(),
            }}
          >
            <For each={summaries()}>
              {(summary) => (
                <article
                  class="stack-sm rounded-lg border border-border bg-surface-raised p-3"
                  classList={{
                    "border-primary border-2": summary.name === activeName(),
                  }}
                >
                  <div class="row-sm">
                    <button
                      type="button"
                      // `bare` opts out of the control's paint AND of
                      // `color: inherit`, so the ink has to be spelled or it
                      // falls to the UA default — which is white, on a page
                      // this light. `justify-start` too: the primitive is a
                      // flex box that centers its label, and text-align
                      // cannot answer a justify-content.
                      class="bare min-w-0 flex-1 justify-start text-left font-medium text-text"
                      onClick={() => setActiveName(summary.name)}
                      aria-current={summary.name === activeName()}
                      title="Switch to this theme"
                    >
                      {summary.name}
                    </button>
                    <Show when={summary.dirty}>
                      <span class="shrink-0 text-xs text-semantic-warning">
                        unsaved
                      </span>
                    </Show>
                    <Show when={!summary.valid}>
                      <span class="shrink-0 text-xs text-semantic-error">
                        {summary.issues.length === 1
                          ? "1 issue"
                          : `${summary.issues.length} issues`}
                      </span>
                    </Show>
                    <Show when={summary.name !== activeName()}>
                      <button
                        type="button"
                        class="bare shrink-0 text-sm text-text-muted"
                        title="Delete this theme"
                        onClick={() => remove(summary.name)}
                      >
                        {confirming() === summary.name ? "Confirm?" : "Delete"}
                      </button>
                    </Show>
                  </div>
                  <Show
                    when={summary.swatches.length > 0}
                    fallback={
                      <p class="text-xs text-text-muted">
                        No palette declared yet.
                      </p>
                    }
                  >
                    <div class="flex h-6 overflow-hidden rounded-sm border border-border">
                      <For each={summary.swatches}>
                        {(chip) => (
                          <span
                            class={`flex-1 ${chip.paint}`}
                            title={`${chip.label} ${chip.value}`}
                          />
                        )}
                      </For>
                    </div>
                  </Show>
                  <p class="truncate text-xs text-text-muted">
                    {summary.tokens} tokens · {summary.file}
                  </p>
                </article>
              )}
            </For>
          </div>
        </section>

        {
          /* One card per concern, each a specimen rather than a description:
            a palette you can look at beats a link that says "palette". The
            paths come from the route table, so a card cannot name an editor
            that is not there, and a concern can be added by adding an entry
            and a card rather than by remembering two lists. */
        }
        <section class="stack-sm" aria-label="Concerns">
          <div
            class="grid gap-3 grid-cols-1 items-start"
            classList={{
              "sm:grid-cols-2": !inDrawer(),
              "xl:grid-cols-3": !inDrawer(),
            }}
          >
            <PaletteCard chips={palette()} wide />
            <SurfaceCard steps={ladder()} />
            <TypeCard faces={faces()} />
            <ShapeCard radius={radius()} shadow={shadow()} />
            <SpaceCard steps={space()} />
            <MotionCard play={play()} />
            <ElementsCard samples={samples()} />
          </div>
        </section>

        <section class="stack-sm" aria-label="Issues">
          <h2 class="text-xl">Issues</h2>
          <Show
            when={issues().length > 0}
            fallback={
              <p class="text-sm text-text-muted">
                Nothing to report: the document parses, and every value it
                declares clears the floors.
              </p>
            }
          >
            <ul class="stack-sm">
              <For each={issues()}>
                {(issue) => (
                  <li class="panel flex flex-wrap items-baseline gap-2 text-sm">
                    <A href={editorRouteFor(issue.path)} class="hover:underline">
                      <code>{issue.path === "" ? "(document)" : issue.path}</code>
                    </A>
                    <span class="min-w-0 flex-1 text-text-muted">
                      {issue.message}
                    </span>
                  </li>
                )}
              </For>
            </ul>
          </Show>
        </section>

        <footer class="stack-sm border-t border-border pt-4 text-xs text-text-muted">
          <div class="flex flex-wrap gap-x-4 gap-y-1">
            <span>{active()?.file ?? ""}</span>
            <span>{active()?.tokens ?? 0} tokens</span>
            <span>Modes: {activeModes().join(", ")}</span>
            <span>
              Components:{" "}
              {componentsLine() === "" ? "preset defaults" : componentsLine()}
            </span>
          </div>
        </footer>
      </div>

      <Show when={open()}>
        <dialog
          aria-label="New theme"
          class="stack panel w-72"
          ref={(el: HTMLDialogElement) => {
            requestAnimationFrame(() => {
              if (el.isConnected && !el.open) el.showModal();
            });
          }}
          onClose={() => setOpen(false)}
        >
          <h2 class="text-lg">New theme</h2>
          <input
            type="text"
            placeholder="Name"
            value={name()}
            onInput={(event) => setName(event.currentTarget.value)}
          />
          <fieldset class="stack-sm border-0 p-0">
            <legend class="text-sm text-text-muted">Start from</legend>
            <label class="row-sm text-sm">
              <input
                type="radio"
                name="new-theme-source"
                checked={!blanks()}
                onChange={() => setBlanks(false)}
              />
              <span>Copy a theme on disk</span>
            </label>
            <Show when={!blanks()}>
              <select
                value={chosen()}
                onChange={(event) => setSource(event.currentTarget.value)}
                title="Source theme"
              >
                <For each={registry() ?? []}>
                  {(theme) => <option value={theme.name}>{theme.name}</option>}
                </For>
              </select>
            </Show>
            <label class="row-sm text-sm">
              <input
                type="radio"
                name="new-theme-source"
                checked={blanks()}
                onChange={() => setBlanks(true)}
              />
              <span>Scaffold the required roles</span>
            </label>
          </fieldset>
          <Show when={problem() !== null}>
            <p class="text-sm text-semantic-error" role="alert">
              {problem()}
            </p>
          </Show>
          <footer class="row-sm justify-end">
            <button type="button" onClick={create}>
              Create
            </button>
            <button type="button" onClick={() => setOpen(false)}>
              Cancel
            </button>
          </footer>
        </dialog>
      </Show>
    </div>
  );
}

/**
 * One concern: what it is for, and a specimen of what it spends.
 *
 * The path is typed against the route table rather than spelled as a string,
 * so a card cannot link to an editor the studio does not serve.
 */
function ConcernCard(props: {
  path: RoutePath;
  title: string;
  blurb: string;
  children?: JSX.Element;
}) {
  return (
    <article class="stack-sm rounded-lg border border-border bg-surface-raised p-4">
      <h3 class="text-lg">
        <A href={props.path} class="row-sm no-underline hover:underline">
          <span class="min-w-0">{props.title}</span>
          <span
            class="inline-block icon-md i-lucide-arrow-up-right shrink-0"
            aria-hidden="true"
          />
        </A>
      </h3>
      <p class="text-sm text-text-muted">{props.blurb}</p>
      {props.children}
    </article>
  );
}

function PaletteCard(props: { chips: readonly Chip[]; wide?: boolean }) {
  return (
    <ConcernCard
      path="/colors"
      title="Palette"
      blurb="The colours a theme is for — accents first, then status."
    >
      <div classList={{ "sm:col-span-2": props.wide === true }}>
        <Show
          when={props.chips.length > 0}
          fallback={
            <p class="text-sm text-text-muted">
              This theme declares no palette roles yet.
            </p>
          }
        >
          <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <For each={props.chips}>
              {(chip) => (
                <div class="stack-sm">
                  <span
                    class={`h-10 rounded-md border border-border ${chip.paint}`}
                    title={`${chip.label} ${chip.value}`}
                  />
                  <code class="truncate text-xs">{chip.label}</code>
                  <code class="truncate text-xs text-text-muted">
                    {chip.value}
                  </code>
                </div>
              )}
            </For>
          </div>
        </Show>
      </div>
    </ConcernCard>
  );
}

/**
 * The depth ladder, nested the way depth is.
 *
 * A page sits on what is sunken and what is raised sits on the page, so the
 * three steps are drawn inside each other rather than beside each other —
 * beside each other they are three colours, and the question the ladder
 * answers is whether they separate.
 *
 * Built from the steps rather than typed three deep, because a theme may
 * declare two of them: a card that assumes three shows a hole where the
 * third would be.
 */
function ladderElements(steps: readonly Chip[]): JSX.Element {
  return steps.reduceRight<JSX.Element>(
    (inner, step) => (
      <div
        class={`stack-sm rounded-md border border-border p-3 ${step.paint}`}
      >
        <div class="split">
          {/* Named, not inherited: the box paints the step's own surface, so
              the label needs the ink that theme pairs with it. */}
          <span class="text-sm text-text">{step.label}</span>
          <code class="text-xs text-text">{step.value}</code>
        </div>
        {inner}
      </div>
    ),
    null,
  );
}

function SurfaceCard(props: { steps: readonly Chip[] }) {
  return (
    <ConcernCard
      path="/colors"
      title="Surface"
      blurb="What sits below the page, the page, and what sits above it."
    >
      <Show
        when={props.steps.length > 0}
        fallback={
          <p class="text-sm text-text-muted">
            This theme declares no surface ladder yet.
          </p>
        }
      >
        <div class="stack-sm">{ladderElements(props.steps)}</div>
      </Show>
    </ConcernCard>
  );
}

/** What a slot's specimen says, when the specimen wants saying. */
const SPECIMEN: Record<string, string> = {
  heading: DISPLAY,
  mono: MONOSPACE,
};

function TypeCard(props: { faces: readonly Face[] }) {
  return (
    <ConcernCard
      path="/type"
      title="Type"
      blurb="The faces this theme spends, slot by slot."
    >
      <Show
        when={props.faces.length > 0}
        fallback={
          <p class="text-sm text-text-muted">
            This theme declares no faces yet.
          </p>
        }
      >
        <div class="stack-sm">
          <For each={props.faces}>
            {(face) => (
              <div class="stack-sm border-b border-border pb-2 last:border-b-0">
                <div class="split">
                  <code class="text-xs text-text-muted">
                    {`font.family.${face.slot}`}
                  </code>
                  <span class="truncate text-xs text-text-muted">
                    {face.stack}
                  </span>
                </div>
                <p class={`${face.paint} truncate text-xl`}>
                  {SPECIMEN[face.slot] ?? PHRASE}
                </p>
              </div>
            )}
          </For>
        </div>
      </Show>
    </ConcernCard>
  );
}

function ShapeCard(props: {
  radius: readonly TokenRow[];
  shadow: readonly TokenRow[];
}) {
  const empty = () => props.radius.length + props.shadow.length === 0;
  return (
    <ConcernCard
      path="/style"
      title="Shape"
      blurb="Corners, and what each shadow lifts."
    >
      <Show
        when={!empty()}
        fallback={
          <p class="text-sm text-text-muted">
            This theme declares no radius or shadow steps yet.
          </p>
        }
      >
        <div class="flex flex-wrap items-end gap-3">
          <For each={props.radius}>
            {(row) => (
              <div class="stack-sm w-14">
                <div
                  class="h-12 w-full border-2 border-primary bg-surface"
                  style={{ "border-radius": `var(${row.variable})` }}
                />
                <code class="truncate text-xs">{row.path.split(".").pop()}</code>
              </div>
            )}
          </For>
          <For each={props.shadow}>
            {(row) => (
              <div class="stack-sm w-20">
                <div
                  class="h-12 w-full rounded-md bg-surface-raised"
                  style={{ "box-shadow": `var(${row.variable})` }}
                />
                <code class="truncate text-xs">{row.path.split(".").pop()}</code>
              </div>
            )}
          </For>
        </div>
      </Show>
    </ConcernCard>
  );
}

function SpaceCard(props: { steps: readonly TokenRow[] }) {
  return (
    <ConcernCard
      path="/spacing"
      title="Space"
      blurb="The scale sampled: where it starts, its middle, where it ends."
    >
      <Show
        when={props.steps.length > 0}
        fallback={
          <p class="text-sm text-text-muted">
            This theme declares no spacing steps yet.
          </p>
        }
      >
        <div class="stack-sm">
          <For each={props.steps}>
            {(row) => (
              <div class="row-sm">
                <code class="w-12 shrink-0 text-xs">
                  {row.path.split(".").pop()}
                </code>
                <span class="min-w-0 flex-1 overflow-hidden">
                  <span
                    class="block h-4 rounded-sm bg-primary"
                    style={{ width: `var(${row.variable})` }}
                  />
                </span>
                <code class="shrink-0 text-xs text-text-muted">{row.value}</code>
              </div>
            )}
          </For>
        </div>
      </Show>
    </ConcernCard>
  );
}

function MotionCard(props: {
  play: { path: string; utility: string } | undefined;
}) {
  return (
    <ConcernCard
      path="/motion"
      title="Motion"
      blurb="A duration, played — the one family a static sample cannot show."
    >
      <Show
        when={props.play}
        keyed
        fallback={
          <p class="text-sm text-text-muted">
            This theme declares no durations yet.
          </p>
        }
      >
        {(play) => (
          <div class="stack-sm">
            <PlayRig utility={play.utility} />
            <code class="text-xs text-text-muted">{play.path}</code>
          </div>
        )}
      </Show>
    </ConcernCard>
  );
}

function ElementsCard(props: { samples: readonly ElementSample[] }) {
  return (
    <ConcernCard
      path="/components"
      title="Elements"
      blurb="The primitives this theme styles, read from the library."
    >
      <Show
        when={props.samples.length > 0}
        fallback={
          <p class="text-sm text-text-muted">The library has not answered.</p>
        }
      >
        <div class="stack-sm">
          <For each={props.samples}>
            {(sample) => (
              <div class="stack-sm">
                <code class="text-xs text-text-muted">
                  {`<${sample.component}> · ${sample.row.name}`}
                </code>
                <div
                  class="flex flex-wrap items-center gap-2 rounded-md border border-dashed border-border p-3"
                  // The daemon scopes every class rule it generates under
                  // `.spin-preview` — that is the contract that keeps a
                  // preview's rules out of the app around it. A sample
                  // rendered without that class on an ancestor gets the tag
                  // rules (`<alert>` lights up) and none of the class ones
                  // (`<avatar>` stays a raw image), which reads as a card
                  // that half works.
                  classList={{ "spin-preview": true }}
                  innerHTML={sample.row.html}
                />
              </div>
            )}
          </For>
        </div>
      </Show>
    </ConcernCard>
  );
}

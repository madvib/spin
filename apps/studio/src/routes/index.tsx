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
 *
 * The checks are NOT here: they are the same on every route, so a section on
 * one page would be a section missing from the other eight. They live in the
 * bar along the bottom, where the count sits beside the state it is about.
 */

import {
  createEffect,
  createMemo,
  createSignal,
  For,
  onCleanup,
  Show,
} from "solid-js";
import type { JSX } from "solid-js";
import { A } from "@solidjs/router";
import { scaffoldTheme, treeToJson } from "@spin/theme";
import { refetchProjectThemes } from "../components/Settings.tsx";
import { inDrawer } from "../app.tsx";
import {
  activeComponents,
  activeMode,
  activeModes,
  activeName,
  library,
  project,
  projectFailure,
  refetchProject,
  refetchThemes,
  registerMarkup,
  registry,
  reloadFromDisk,
  revertToSaved,
  setActiveName,
  themeSummaries,
  themeText,
} from "../lib/store.ts";
import {
  copyTheme,
  initProject,
  listProjectThemes,
  problemText,
  removeTheme,
  saveTheme,
} from "../lib/themes.ts";
import { analyzeTheme } from "../lib/theme.ts";
import { groupTokens } from "../lib/tokens.ts";
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
import { durationMs } from "../lib/motion.ts";
import { DISPLAY, MONOSPACE, PHRASE } from "../lib/specimen-copy.ts";
import type { RoutePath } from "../lib/routes.ts";

export default function OverviewPage() {
  const summaries = createMemo(() => themeSummaries());
  const active = createMemo(() =>
    summaries().find((summary) => summary.name === activeName())
  );

  /**
   * The project, when it is not one yet.
   *
   * `undefined` while the daemon has not answered, and `undefined` again
   * when the answer is "this is a project": the first-run surface belongs
   * to the folder that has no `spin/` directory in it, and to nothing else.
   */
  const firstRun = createMemo(() => {
    const report = project();
    if (report === undefined) return undefined;
    return report.spin ? undefined : report;
  });

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
  const easings = createMemo(() => rows([["motion", "easing"]]));
  const samples = createMemo(() => elementSamples(library() ?? []));
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
      // The specimens the motion card plays. They are the library's own
      // animation utilities, and they are named here for the same reason
      // the elements are: what is on screen is what the sheet is generated
      // for.
      "animate-slide-up animate-fade-in animate-spin",
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
  /** The error a delete reported, per theme: the card wears it. */
  const [deleteProblems, setDeleteProblems] = createSignal<
    Record<string, string>
  >({});
  /** What the studio did about a theme's file, said on the page. */
  const [note, setNote] = createSignal<string | null>(null);
  /** The first theme's name, for a project that has none. */
  const [projectName, setProjectName] = createSignal("default");
  /** Why the project could not be created, when it could not. */
  const [projectProblem, setProjectProblem] = createSignal<string | null>(null);

  /**
   * What the copy starts from.
   *
   * The first theme in the registry rather than a name it may not have:
   * the picker was once seeded with one name while the select beside it
   * showed another, so creating a theme copied something that did not
   * exist and said nothing about it.
   */
  const chosen = () => source() ?? registry()?.[0]?.name ?? "";

  /**
   * Whether the project already serves a theme under this name.
   *
   * A name that is taken is a name the daemon refuses to overwrite: the
   * copy answers "a theme named X already exists", and a scaffold's write
   * would destroy the theme that was there. The studio asks the project
   * itself, freshly — a list read a moment ago may not know about a theme
   * another tab created since — and says the daemon's words.
   */
  async function taken(next: string): Promise<boolean> {
    const listed = await listProjectThemes();
    return listed.some((theme) => theme.name === next);
  }

  async function create(): Promise<void> {
    const next = name().trim();
    if (next === "") return;
    setProblem(null);
    try {
      if (await taken(next)) {
        setProblem(`a theme named ${next} already exists`);
        return;
      }
      const written = blanks()
        ? await saveTheme(next, treeToJson(scaffoldTheme()))
        : await copyTheme(chosen(), next);
      if (written.error !== null) {
        setProblem(written.error);
        return;
      }
      refetchThemes();
      refetchProjectThemes();
      setOpen(false);
      setName("");
      setSource(undefined);
      setBlanks(false);
      setActiveName(next);
    } catch (err) {
      // A refused call rejects rather than answering: the contract turned
      // the request down — a name the file system will not take, a shape
      // the schema will not accept — and an uncaught rejection leaves the
      // dialog open with nothing said. The reason is what the author needs.
      setProblem(problemText(err));
    }
  }

  async function remove(theme: string): Promise<void> {
    if (confirming() !== theme) {
      setConfirming(theme);
      return;
    }
    try {
      const { error } = await removeTheme(theme);
      if (error !== null) {
        // The theme is still there: the card says so, and the button goes
        // back to asking, so the author can try again or leave it alone.
        setDeleteProblems((prev) => ({ ...prev, [theme]: error }));
        setConfirming(null);
        return;
      }
      setDeleteProblems((prev) => {
        const next = { ...prev };
        delete next[theme];
        return next;
      });
      setConfirming(null);
      refetchThemes();
      refetchProjectThemes();
    } catch (err) {
      setDeleteProblems((prev) => ({ ...prev, [theme]: problemText(err) }));
      setConfirming(null);
    }
  }

  /**
   * Re-reads a theme from disk.
   *
   * The file moved under the studio — another tab wrote it, an editor
   * saved it, a branch was checked out — and the document the author is
   * looking at is a document that no longer exists. The reload replaces it
   * with the file's, and the note says what the file turned out to be:
   * a file that differs from what the studio wrote is a change the author
   * has to know about before the next save overwrites it.
   */
  async function reload(theme: string): Promise<void> {
    setNote(null);
    try {
      const state = await reloadFromDisk(theme);
      refetchThemes();
      setNote(
        state === "changed"
          ? `${theme} changed on disk — the studio now shows the file.`
          : `${theme} reloaded from disk.`,
      );
    } catch (err) {
      setNote(problemText(err));
    }
  }

  /**
   * Creates the project the daemon is serving.
   *
   * The daemon's own composer: the themes directory, a first theme, and
   * the uno config that wires spin into the build. A studio that told the
   * author to make a directory by hand would leave two of the three.
   */
  async function init(): Promise<void> {
    const report = project();
    if (report === undefined) return;
    const next = projectName().trim();
    if (next === "") return;
    setProjectProblem(null);
    try {
      const made = await initProject(report.root, next, "silk");
      if (made.error !== null) {
        setProjectProblem(made.error);
        return;
      }
      refetchProject();
      refetchThemes();
      refetchProjectThemes();
      setActiveName(next);
    } catch (err) {
      setProjectProblem(problemText(err));
    }
  }

  return (
    // The pane's paper is the project's, because its ink is: a header reading
    // `text-text` on the chrome's surface only agrees by luck.
    <div
      class={inDrawer()
        ? "drawer-flow bg-surface p-4 sm:p-6"
        : "drawer-scroll overflow-y-auto bg-surface p-4 sm:p-6"}
    >
      <div class="mx-auto stack-lg max-w-6xl">
        <header class="stack-sm">
          <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
            <h1 class="text-3xl">Themes</h1>
            <span class="flex-1" />
            <button type="button" onClick={() => setOpen(true)}>
              New theme
            </button>
          </div>
          {
            /* The theme picker, the mode and the state of the file are NOT
              here. They are in the bar along the bottom, on every route,
              because they are facts about the whole studio rather than
              about this page — and a fact that is visible everywhere does
              not need a second telling on one page. */
          }
          <Show when={note() !== null}>
            <p class="text-sm text-text-muted" role="status">{note()}</p>
          </Show>
        </header>

        {
          /* The first run. A project is a folder with a `spin/` directory in
            it, and the daemon is the only one who can look — so the studio
            asks, and when the answer is "this is not a project" it says so
            and offers the step that makes it one. The daemon's own composer
            does the work: the directory, a first theme, and the uno config
            that wires spin into the build. */
        }
        <Show when={projectFailure()}>
          {(failure) => (
            <section class="stack-sm panel" aria-label="No project">
              <h2 class="text-xl">There is no project here</h2>
              <p class="text-sm text-text-muted">
                The studio edits a project on disk, and the daemon it is talking
                to is not serving one: {problemText(failure())}
              </p>
            </section>
          )}
        </Show>
        <Show when={firstRun()}>
          {(report) => (
            <section class="stack-sm panel" aria-label="First run">
              <h2 class="text-xl">This folder is not a spin project yet</h2>
              <p class="text-sm text-text-muted">
                A project is a folder with a <code>spin/</code>{" "}
                directory in it. The daemon is serving{" "}
                <code class="break-all">{report().root}</code>, and that folder
                has no such directory — so the themes below are the shipped
                starters, and nothing here is the project's own yet.
              </p>
              <p class="text-sm text-text-muted">
                Creating the project writes the directory, a first theme, and
                the uno config that wires spin into the build.
              </p>
              <div class="row-sm">
                <label for="project-theme-name" class="text-sm text-text-muted">
                  First theme
                </label>
                <input
                  id="project-theme-name"
                  type="text"
                  value={projectName()}
                  onInput={(event) => setProjectName(event.currentTarget.value)}
                />
                <button type="button" onClick={init}>Create the project</button>
              </div>
              <Show when={projectProblem() !== null}>
                <p class="text-sm text-semantic-error" role="alert">
                  {projectProblem()}
                </p>
              </Show>
            </section>
          )}
        </Show>

        <section class="stack-sm" aria-label="Themes">
          <div class="split">
            <h2 class="text-xl">Themes</h2>
            <span class="text-sm text-text-muted">
              {summaries().length} themes
            </span>
          </div>
          <div
            class="grid gap-3 grid-cols-1"
            classList={{
              "sm:grid-cols-2": !inDrawer(),
              "xl:grid-cols-4": !inDrawer(),
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
                    <Show when={summary.state === "changed"}>
                      <span
                        class="shrink-0 text-xs text-semantic-warning"
                        title="The file on disk is not what the studio wrote"
                      >
                        changed on disk
                      </span>
                    </Show>
                    <Show when={!summary.valid}>
                      <span class="shrink-0 text-xs text-semantic-error">
                        {summary.issues.length === 1
                          ? "1 issue"
                          : `${summary.issues.length} issues`}
                      </span>
                    </Show>
                    <Show
                      when={summary.name !== activeName() &&
                        summary.file !== null}
                    >
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
                  <Show when={deleteProblems()[summary.name]}>
                    {(message) => (
                      <p class="text-xs text-semantic-error" role="alert">
                        {message()}
                      </p>
                    )}
                  </Show>
                  {
                    /*
                      The file's own two verbs. The author is editing a
                      document that a file holds, and there are two things
                      they may want to do with that: take the file's word
                      for it (reload), or drop their own edits and go back
                      to the last thing that was written (discard). Both
                      live here rather than behind an API, because an
                      author whose file changed underneath them has to be
                      able to say so without leaving the page.
                    */
                  }
                  <div class="row-sm">
                    <button
                      type="button"
                      class="bare text-xs text-text-muted"
                      title="Re-read this theme from disk"
                      onClick={() => reload(summary.name)}
                    >
                      Reload from disk
                    </button>
                    <Show when={summary.dirty}>
                      <button
                        type="button"
                        class="bare text-xs text-text-muted"
                        title="Drop the edits that have not been saved"
                        onClick={() => {
                          revertToSaved(summary.name);
                          setNote(
                            `${summary.name} — the unsaved edits were dropped.`,
                          );
                        }}
                      >
                        Discard changes
                      </button>
                    </Show>
                  </div>
                  <Show
                    when={summary.swatches.some((group) =>
                      group.chips.length > 0
                    )}
                    fallback={
                      <p class="text-xs text-text-muted">
                        No palette declared yet.
                      </p>
                    }
                  >
                    <div class="stack-sm">
                      <For
                        each={summary.swatches.filter((group) =>
                          group.chips.length > 0
                        )}
                      >
                        {(group) => (
                          <div class="flex items-center gap-2">
                            <span class="w-10 shrink-0 font-mono text-xs text-text-muted">
                              {group.mode}
                            </span>
                            <div class="flex h-6 flex-1 overflow-hidden rounded-sm border border-border">
                              <For each={group.chips}>
                                {(chip) => (
                                  <span
                                    class="flex-1"
                                    // Every theme's OWN colour: a utility can
                                    // only paint the active theme's tokens,
                                    // and this strip sits beside every theme —
                                    // the resolved value IS the data shown.
                                    style={{ background: chip.value }}
                                    title={`${chip.label} ${chip.value}`}
                                  />
                                )}
                              </For>
                            </div>
                          </div>
                        )}
                      </For>
                    </div>
                  </Show>
                  <p class="truncate text-xs text-text-muted">
                    {summary.tokens} tokens · {summary.file ?? "@spin/theme"}
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
            class="grid gap-3 grid-cols-1"
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
            <MotionCard durations={durations()} easings={easings()} />
            <ElementsCard samples={samples()} />
          </div>
        </section>

        <footer class="stack-sm border-t border-border pt-4 text-xs text-text-muted">
          <div class="flex flex-wrap gap-x-4 gap-y-1">
            <span>{active()?.file ?? "@spin/theme"}</span>
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
              <span>Copy a theme</span>
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
  /** Stretches the card across the row: for a specimen that needs width. */
  wide?: boolean;
  children?: JSX.Element;
}) {
  return (
    <article
      class="stack-sm rounded-lg border border-border bg-surface-raised p-4"
      // The span rides the ARTICLE, because the article is the grid item —
      // and it follows the drawer, which drops the grid to a single column
      // where a span would conjure a second one.
      classList={{
        "sm:col-span-2": props.wide === true && !inDrawer(),
        "xl:col-span-3": props.wide === true && !inDrawer(),
      }}
    >
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
      wide={props.wide === true}
      blurb="The named colour roles in palette order — accents first, then status — resolved for the active mode."
    >
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
          {
            /* Named, not inherited: the box paints the step's own surface, so
              the label needs the ink that theme pairs with it. */
          }
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
      blurb="The three depths nested — sunken, page, raised — so a step that does not separate fails visibly."
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
      blurb="Every face slot the theme declares, set in the face it names."
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
      blurb="How round the theme's corners are, and how high each shadow step lifts."
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
                <code class="truncate text-xs">
                  {row.path.split(".").pop()}
                </code>
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
                <code class="truncate text-xs">
                  {row.path.split(".").pop()}
                </code>
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
      blurb="First, middle and last of the scale: the spacing, without the whole table."
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
                <code class="shrink-0 text-xs text-text-muted">
                  {row.value}
                </code>
              </div>
            )}
          </For>
        </div>
      </Show>
    </ConcernCard>
  );
}

/**
 * The motion card: the theme's own clock, spent on things that move.
 *
 * The card this replaces showed a swatch changing colour on a loop. That is a
 * slideshow: a colour fading in and out says nothing about how the theme
 * MOVES, and a theme's motion is exactly that — how long things take and how
 * they arrive. So the card spends the theme's own scale instead: the durations
 * it declares as a ladder of shares, the easings it declares beside them,
 * and three specimens that move at the theme's tempo — a card that slides in,
 * a row that arrives one after another, and a spinner at the theme's cadence.
 *
 * The specimens are the library's `animate-*` utilities, and those spend the
 * theme's motion tokens rather than naming a time: `animate-slide-up` runs
 * for `--motion-duration-base` and curves by `--motion-easing-decelerate`.
 * So what moves here moves at the edited theme's tempo, and the numbers
 * beside it are that theme's own.
 */
function MotionCard(props: {
  durations: readonly TokenRow[];
  easings: readonly TokenRow[];
}) {
  /** The counter that makes the specimens arrive again. */
  const [run, setRun] = createSignal(0);

  /** One token's own value, read by the name it ends in. */
  const valueOf = (
    rows: readonly TokenRow[],
    name: string,
  ): string | undefined =>
    rows.find((row) => row.path.split(".").pop() === name)?.value;

  const fast = () => valueOf(props.durations, "fast");
  const base = () => valueOf(props.durations, "base");
  const slow = () => valueOf(props.durations, "slow");
  const decelerate = () => valueOf(props.easings, "decelerate");
  const linear = () => valueOf(props.easings, "linear");

  /**
   * The longest run on the ladder, so a share is a share of something.
   */
  const longest = () =>
    Math.max(1, ...props.durations.map((row) => durationMs(row.value) ?? 0));

  /**
   * The step between the arrivals of a staggered row.
   *
   * The theme's shortest breath: a row that waits as long as the theme's
   * fastest step is a row the theme set, not one the studio invented.
   */
  const step = () => durationMs(fast() ?? base() ?? "") ?? 150;

  return (
    <ConcernCard
      path="/motion"
      title="Motion"
      blurb="The theme's own clock: the durations and easings it declares, spent on something that actually moves."
    >
      <Show
        when={props.durations.length > 0}
        fallback={
          <p class="text-sm text-text-muted">
            This theme declares no durations yet, so nothing here has a time to
            take.
          </p>
        }
      >
        <div class="stack-sm">
          <div class="stack-sm">
            <span class="text-xs font-semibold uppercase text-text-muted">
              Durations
            </span>
            <ul class="flow-list stack-sm">
              <For each={props.durations}>
                {(row) => (
                  <li class="stack-sm">
                    <div class="split">
                      <code class="truncate text-xs text-text-muted">
                        {row.path}
                      </code>
                      <span class="shrink-0 text-xs text-text-muted">
                        {row.value}
                      </span>
                    </div>
                    <div class="h-2 w-full overflow-hidden rounded-sm bg-surface-sunken">
                      <div
                        class="h-full rounded-sm bg-primary"
                        // The share is arithmetic over the theme's own
                        // numbers — not a length the studio chose — so it is
                        // written here rather than named by a token.
                        style={{
                          width: `${
                            ((durationMs(row.value) ?? 0) / longest()) * 100
                          }%`,
                        }}
                      />
                    </div>
                    <code class="truncate text-xs text-text-muted">
                      {durationUtility(row.path)}
                    </code>
                  </li>
                )}
              </For>
            </ul>
          </div>

          <Show when={props.easings.length > 0}>
            <div class="stack-sm">
              <span class="text-xs font-semibold uppercase text-text-muted">
                Easings
              </span>
              <ul class="flow-list stack-sm">
                <For each={props.easings}>
                  {(row) => (
                    <li class="split">
                      <code class="truncate text-xs text-text-muted">
                        {row.path}
                      </code>
                      <span
                        class="min-w-0 truncate text-xs text-text-muted"
                        title={row.value}
                      >
                        {row.value}
                      </span>
                    </li>
                  )}
                </For>
              </ul>
            </div>
          </Show>

          <div class="stack-sm">
            <div class="split">
              <span class="text-xs font-semibold uppercase text-text-muted">
                Spent
              </span>
              <button
                type="button"
                class="bare shrink-0 text-xs text-text-muted hover:text-text"
                title="Run the specimens again"
                onClick={() => setRun(run() + 1)}
              >
                play
              </button>
            </div>
            {
              /*
                The specimens. The counter is the key: a new one remakes
                the elements, and an element that is made afresh runs its
                entrance again. The spinner is outside — it never stops.
              */
            }
            <For each={[run()]}>
              {() => (
                <div class="stack-sm">
                  <div class="animate-slide-up rounded-md border border-border bg-surface-raised p-3 text-sm">
                    A card that slides in — {base() ?? "base"} by{" "}
                    {decelerate() ?? "decelerate"}.
                  </div>
                  <div class="flex items-center gap-2">
                    <For each={[0, 1, 2]}>
                      {(index) => (
                        <span
                          class="animate-fade-in rounded-md bg-surface-sunken px-2 py-1 text-xs text-text"
                          style={{ "animation-delay": `${index * step()}ms` }}
                        >
                          {index + 1}
                        </span>
                      )}
                    </For>
                    <span class="text-xs text-text-muted">
                      A row that arrives one after another, {step()}ms apart.
                    </span>
                  </div>
                </div>
              )}
            </For>
            <div class="row-sm">
              <span
                class="inline-block shrink-0 animate-spin icon-md i-lucide-loader-circle"
                aria-hidden="true"
              />
              <span class="text-xs text-text-muted">
                A spinner at the theme's cadence — {slow() ?? "slow"} by{" "}
                {linear() ?? "linear"}.
              </span>
            </div>
          </div>
        </div>
      </Show>
    </ConcernCard>
  );
}

function ElementsCard(props: { samples: readonly ElementSample[] }) {
  return (
    <ConcernCard
      path="/components"
      title="Elements"
      blurb="Three of the library's primitives, dressed by this theme alone."
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
                  // The daemon scopes every rule it generates for a theme —
                  // tag rules included — under `.spin-preview`, and the
                  // preview pane carries it: the theme dresses what is
                  // inside the pane, and nothing outside it.
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

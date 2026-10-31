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
import { createSpinComponent } from "@spinjs/components/solid";
import { menu } from "@spinjs/components/menu";
import { toHex } from "@spinjs/theme";
import { refetchProjectThemes } from "../components/Settings.tsx";
import { inDrawer } from "../lib/host.ts";
import {
  activeComponents,
  activeMode,
  activeModes,
  activeName,
  activeTree,
  library,
  note,
  project,
  projectFailure,
  refetchProject,
  refetchThemes,
  registerMarkup,
  seed,
  setThemeTextFor,
  themeText,
  registry,
  reloadFromDisk,
  revertToSaved,
  setActiveName,
  noteDiscarded,
  themeSummaries,
} from "../lib/store.ts";
import type { ThemeSummary } from "../lib/store.ts";
import {
  copyTheme,
  initProject,
  listProjectThemes,
  problemText,
  removeTheme,
} from "../lib/themes.ts";
import { groupTokens, toPx } from "../lib/tokens.ts";
import type { TokenRow } from "../lib/tokens.ts";
import { addMode, declaredModes, removeMode } from "../lib/theme.ts";
import Palette from "../components/Palette.tsx";
import { GenerateTheme } from "../components/GenerateTheme.tsx";
import { ensureDraftFontStyles, facesOf } from "../components/ThemePreview.tsx";
import {
  elementSamples,
  faceSpecimens,
  paletteChips,
  spaceSteps,
  seedToken,
  surfaceSteps,
  themeCardMenuItems,
} from "../lib/overview.ts";
import type { CardMenuItem, Chip, ElementSample, Face } from "../lib/overview.ts";
import { DISPLAY, PANGRAM } from "../lib/specimen-copy.ts";
import type { RoutePath } from "../lib/routes.ts";
function ThemeCardMenu(props: {
  summary: ThemeSummary;
  onReload: () => void;
  onToggleMode: (mode: "light" | "dark", add: boolean) => void;
  onDuplicate: () => void;
  onDiscard: () => void;
  onDelete: () => void;
  confirmingName: string | null;
}) {
  const [el, setEl] = createSignal<HTMLElement>();
  const ctl = createSpinComponent(el, menu);
  createEffect(() => {
    const text = seed(props.summary.name) ?? "";
    ensureDraftFontStyles(facesOf(text));
  });
  createEffect(() =>
    ctl.bind(
      {
        items: themeCardMenuItems(
          props.summary,
          seed(props.summary.name) ?? "",
          activeName(),
          props.confirmingName,
        ),
      },
      {
        select: (event: CustomEvent<{ value: string }>) => {
          const value = event.detail.value;
          if (value === "reload") props.onReload();
          else if (value === "add-light") props.onToggleMode("light", true);
          else if (value === "remove-light") props.onToggleMode("light", false);
          else if (value === "add-dark") props.onToggleMode("dark", true);
          else if (value === "remove-dark") props.onToggleMode("dark", false);
          else if (value === "duplicate") props.onDuplicate();
          else if (value === "discard") props.onDiscard();
          else if (value === "delete") props.onDelete();
        },
      },
    ),
  );
  return <studio-theme-menu ref={setEl} />;
}
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
    const tree = activeTree();
    return groupTokens(tree, prefixes, activeMode());
  }

  const palette = createMemo(() => paletteChips(themeText(), activeMode()));
  const ladder = createMemo(() => surfaceSteps(themeText(), activeMode()));
  /**
   * The theme's own acting colour, as a value.
   *
   * The specimens are painted with the value rather than with a utility: a
   * specimen shows the theme's colour, and a utility paints whatever the
   * studio's own sheet happens to say.
   */
  const acting = createMemo(
    () => palette().find((chip) => chip.path === "color.primary")?.value,
  );
  const faces = createMemo(() => faceSpecimens(themeText(), activeMode()));
  const space = createMemo(() => spaceSteps(themeText(), activeMode()));
  const radius = createMemo(() => rows([["radius"]]));
  const shadow = createMemo(() => rows([["shadow"]]));
  const durations = createMemo(() => rows([["motion", "duration"]]));
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
      "animate-fade-in",
    ].join("\n"));
  });
  onCleanup(() => registerMarkup(""));

  // The dialog's state.
  const [open, setOpen] = createSignal(false);
  const [confirming, setConfirming] = createSignal<string | null>(null);
  /** The error a delete reported, per theme: the card wears it. */
  const [deleteProblems, setDeleteProblems] = createSignal<
    Record<string, string>
  >({});
  /** The first theme's name, for a project that has none. */
  const [projectName, setProjectName] = createSignal("default");
  /** Why the project could not be created, when it could not. */
  const [projectProblem, setProjectProblem] = createSignal<string | null>(null);

  /**
   * Copies a theme into the project's own files.
   *
   * A built-in is read-only until a project copies it: the save copies it on
   * the first write, but an author looking at a built-in has no obvious way
   * to start, and a built-in that is only ever edited in memory is a theme
   * that never reaches a build. So the card offers the copy, names it after
   * the theme it came from, and seats it.
   */
  async function duplicate(theme: string): Promise<void> {
    try {
      const taken = new Set(
        (await listProjectThemes()).map((item) => item.name),
      );
      let next = `${theme}-copy`;
      for (let index = 2; taken.has(next); index++) {
        next = `${theme}-copy-${index}`;
      }
      const written = await copyTheme(theme, next);
      if (written.error !== null) {
        note(written.error);
        return;
      }
      refetchThemes();
      refetchProjectThemes();
      setActiveName(next);
      note(`${theme} duplicated to ${next}.`);
    } catch (err) {
      note(problemText(err));
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
    try {
      const state = await reloadFromDisk(theme);
      refetchThemes();
      note(
        state === "changed"
          ? `${theme} changed on disk — the studio now shows the file.`
          : `${theme} reloaded from disk.`,
      );
    } catch (err) {
      note(problemText(err));
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
      <div class="mx-auto stack-lg max-w-[72rem]">
        <header class="stack-sm">
          <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
            <h1>Themes</h1>
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
              <h2>There is no project here</h2>
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
              <h2>This folder is not a spin project yet</h2>
              <p class="text-sm text-text-muted">
                A project is a folder with a <code>spin/</code>{" "}
                directory in it. The daemon is serving{" "}
                <code class="break-all">{report().root}</code>, and that folder
                has no such directory — so the themes below are the built-ins,
                and nothing here is the project's own yet.
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
          <div class="flex justify-end">
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
              {(summary) => {
                const cardText = (): string | undefined => {
                  const text = seed(summary.name) ?? "";
                  if (declaredModes(text).length !== 1) return undefined;
                  return seedToken(text, "color.text") || undefined;
                };
                const cardMuted = (): string | undefined => {
                  const text = seed(summary.name) ?? "";
                  if (declaredModes(text).length !== 1) return undefined;
                  return seedToken(text, "color.text-muted") || cardText();
                };
                return (
                <article
                  class="flex min-h-44 flex-col gap-2 rounded-lg border border-border bg-surface-raised p-3"
                  classList={{
                    "border-primary border-2": summary.name === activeName(),
                  }}
                  style={{
                    background: declaredModes(seed(summary.name) ?? "").length === 1
                      ? seedToken(seed(summary.name) ?? "", "color.surface") || undefined
                      : undefined,
                    color: cardText(),
                  }}
                >
                  <div class="row-sm flex-wrap">
                    <button
                      type="button"
                      class="bare min-w-0 flex-1 justify-start text-left font-medium text-text"
                      style={{
                        "font-family": seedToken(seed(summary.name) ?? "", "font.family.heading", "inherit"),
                        color: cardText(),
                      }}
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
                    <ThemeCardMenu
                      summary={summary}
                      onReload={() => void reload(summary.name)}
                      onToggleMode={(mode, add) => {
                        const text = seed(summary.name) ?? "";
                        try {
                          const next = add ? addMode(text, mode) : removeMode(text, mode);
                          if (setThemeTextFor(summary.name, next)) {
                            note(add ? `${mode} mode added.` : `${mode} mode removed.`);
                          }
                        } catch (err) {
                          note(problemText(err));
                        }
                      }}
                      onDuplicate={() => void duplicate(summary.name)}
                      onDiscard={() => {
                        revertToSaved(summary.name);
                        noteDiscarded(summary.name);
                      }}
                      onDelete={() => void remove(summary.name)}
                      confirmingName={confirming()}
                    />
                  </div>
                  <Show when={deleteProblems()[summary.name]}>
                    {(message) => (
                      <p class="text-xs text-semantic-error" role="alert">
                        {message()}
                      </p>
                    )}
                  </Show>
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
                            <span class="w-10 shrink-0 font-mono text-xs text-text-muted" style={{ color: cardMuted() }}>
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
                  <p class="mt-auto truncate text-xs text-text-muted" style={{ color: cardMuted() }}>
                    {summary.tokens} tokens · {summary.file ?? "@spinjs/theme"}
                  </p>
                </article>
                );
              }}
            </For>
          </div>
        </section>

        {
          /* One card per concern, each a specimen rather than a description:
            a palette you can look at beats a link that says "palette". The
            paths come from the route table, so a card cannot name an editor
            that is not there, and a concern can be added by adding an entry
            and a card rather than by remembering two lists.

            The order is the order of the SCALE — the palette, the surfaces,
            the shape, the space — and then the order of what is SET — the
            type, the motion, the elements. A grid row is as tall as its
            tallest card, so the cards that answer the same kind of question
            sit in the same row and none of them is stretched against
            another. */
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
            <ShapeCard radius={radius()} shadow={shadow()} />
            <SpaceCard steps={space()} fill={acting()} />
            <TypeCard faces={faces()} />
            <MotionCard
              durations={durations()}
              fill={acting()}
            />
            <ElementsCard samples={samples()} />
          </div>
        </section>

        {
          /* The rule above the last line is the theme's own: an `<hr>` is
            the element the theme draws a rule with, and the space it keeps
            above and below it is the theme's rhythm. */
        }
        <hr class="w-full" />
        <footer class="stack-sm text-xs text-text-muted">
          <div class="flex flex-wrap gap-x-4 gap-y-1">
            <span>{active()?.file ?? "@spinjs/theme"}</span>
            <span>{active()?.tokens ?? 0} tokens</span>
          </div>
        </footer>
      </div>

      <Show when={open()}>
        <dialog
          aria-label="New theme"
          class="stack panel w-[56rem] max-w-[calc(100vw-2rem)]"
          ref={(el: HTMLDialogElement) => {
            requestAnimationFrame(() => {
              if (el.isConnected && !el.open) el.showModal();
            });
          }}
          onClose={() => setOpen(false)}
        >
          <GenerateTheme
            onDone={() => setOpen(false)}
            onCancel={() => setOpen(false)}
          />
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
 *
 * The specimen gets the room the card has. A grid row is as tall as its
 * tallest card, so a card whose specimen stops early is a card with an empty
 * box under it — the shape the studio's own overview used to wear, and the
 * reason the specimen is given a column of its own that grows: the specimen
 * fills the card, and the card fills the row.
 */
function ConcernCard(props: {
  path: RoutePath;
  title: string;
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
      <h3>
        <A href={props.path} class="row-sm no-underline hover:underline">
          <span class="min-w-0">{props.title}</span>
          <span
            class="inline-block icon-md i-lucide-arrow-up-right shrink-0"
            aria-hidden="true"
          />
        </A>
      </h3>
      <div class="flex min-h-0 flex-1 flex-col">{props.children}</div>
    </article>
  );
}

/**
 * The palette, as swatches.
 *
 * The card is the studio's summary of the theme's named roles, and the
 * specimen is the same one the colours page draws in full: large swatches,
 * and the name and the hex on one line under each. The hex is a button
 * there too, so a hex can be copied from either page.
 */
function PaletteCard(props: { chips: readonly Chip[]; wide?: boolean }) {
  return (
    <ConcernCard
      path="/colors"
      title="Palette"
      wide={props.wide === true}
    >
      <Show
        when={props.chips.length > 0}
        fallback={
          <p class="text-sm text-text-muted">
            This theme declares no palette roles yet.
          </p>
        }
      >
        <Palette
          chips={props.chips}
          columns="grid-cols-2 sm:grid-cols-4 lg:grid-cols-8"
          tall
        />
      </Show>
    </ConcernCard>
  );
}

/**
 * The depth ladder, as layers.
 *
 * A surface is a RELATIONSHIP: a page sits on something, and something sits
 * on the page. Drawn as three nested boxes the ladder is three colours in a
 * row — the question the ladder answers is whether the steps SEPARATE, and
 * that question is only asked of neighbours. Drawn as bands stacked one on
 * the next, each band is a layer, the order is the ladder, and two steps
 * that do not separate are visible as two bands that do.
 *
 * Each band carries the same line of ink, because that is the other half of
 * the question: a step that separates but takes the ink with it is a step
 * that has failed as well. The band paints the step's own surface, so the
 * ink on it is the ink this theme pairs with that surface.
 */
function SurfaceCard(props: { steps: readonly Chip[] }) {
  const recessed = () => props.steps.find((step) => step.path === "color.surface-sunken");
  const page = () => props.steps.find((step) => step.path === "color.surface");
  const raised = () => props.steps.find((step) => step.path === "color.surface-raised");
  return (
    <ConcernCard
      path="/colors"
      title="Surface"
    >
      <Show
        when={props.steps.length > 0}
        fallback={
          <p class="text-sm text-text-muted">
            This theme declares no surface ladder yet.
          </p>
        }
      >
        <div
          class="flex flex-1 flex-col rounded-md border border-border p-2"
          style={{ background: recessed()?.value ?? page()?.value ?? "transparent" }}
        >
          <span
            class="px-2 py-1 font-mono text-xs"
            style={{ color: recessed()?.ink ?? page()?.ink ?? "inherit" }}
          >
            {toHex(recessed()?.value ?? page()?.value ?? "") ?? recessed()?.value ?? page()?.value ?? ""}
          </span>
          <div
            class="flex flex-1 flex-col rounded-md border border-border p-2"
            style={{ background: page()?.value ?? "transparent" }}
          >
            <span
              class="px-2 py-1 font-mono text-xs"
              style={{ color: page()?.ink ?? "inherit" }}
            >
              {toHex(page()?.value ?? "") ?? page()?.value ?? ""}
            </span>
            <div
              class="flex flex-1 flex-col justify-end rounded-md border border-border p-2"
              style={{ background: raised()?.value ?? "transparent" }}
            >
              <span
                class="px-2 py-1 font-mono text-xs"
                style={{ color: raised()?.ink ?? "inherit" }}
              >
                {toHex(raised()?.value ?? "") ?? raised()?.value ?? ""}
              </span>
            </div>
          </div>
        </div>
      </Show>
    </ConcernCard>
  );
}
/** What a slot's specimen says, when the specimen wants saying. */
const SPECIMEN: Record<string, string> = {
  heading: DISPLAY,
  mono: "0123456789idarwin",
  body: PANGRAM,
  sans: PANGRAM,
  serif: PANGRAM,
};

function TypeCard(props: { faces: readonly Face[] }) {
  return (
    <ConcernCard
      path="/type"
      title="Type"
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
                  <code>
                    {`font.family.${face.slot}`}
                  </code>
                  <span class="truncate text-xs text-text-muted">
                    {face.stack}
                  </span>
                </div>
                <h3 class={`${face.paint} truncate`}>
                  {SPECIMEN[face.slot] ?? PANGRAM}
                </h3>
              </div>
            )}
          </For>
        </div>
      </Show>
    </ConcernCard>
  );
}

/**
 * The radius ladder, as nested shapes.
 *
 * A radius is not a number, it is a corner — and a row of little boxes with
 * a number under each says a number. So the ladder is drawn the way the
 * corners relate: each step nested inside the one before it, so the figure
 * is the whole ladder at once, from the sharpest corner to the roundest, and
 * the eye reads the progression rather than five separate shapes.
 *
 * The corners are the theme's own: each shape spends the step's own
 * custom property, so the figure is the edited theme's ladder and not the
 * studio's.
 */
function RadiusLadder(props: { rows: readonly TokenRow[] }) {
  /** How many shapes are in the ladder; the figure spaces them by it. */
  const count = () => Math.max(1, props.rows.length);
  return (
    <div class="relative mx-auto h-[11rem] w-[11rem]">
      <For each={props.rows}>
        {(row, index) => (
          <div
            class="absolute rounded-md border border-border bg-surface"
            style={{
              // Each step is inset a little further than the last, so the
              // shapes nest: the sharp corner is the outermost, the round
              // one the core.
              inset: `${(index() / count()) * 50}%`,
              "border-radius": `var(${row.variable})`,
            }}
          />
        )}
      </For>
    </div>
  );
}

/**
 * The shape concern: how round the corners are, and how high the lift is.
 *
 * The radius is the figure — the nested ladder above — and the shadows are
 * the steps they are: each a card stood off the sunken ground, because a
 * shadow read as a string of offsets says nothing about how far the card
 * stands off the page.
 */
function ShapeCard(props: {
  radius: readonly TokenRow[];
  shadow: readonly TokenRow[];
}) {
  const empty = () => props.radius.length + props.shadow.length === 0;
  return (
    <ConcernCard
      path="/style"
      title="Shape"
    >
      <Show
        when={!empty()}
        fallback={
          <p class="text-sm text-text-muted">
            This theme declares no radius or shadow steps yet.
          </p>
        }
      >
        <div class="stack-sm flex-1 justify-between">
          <Show when={props.radius.length > 0}>
            <div class="stack-sm">
              <RadiusLadder rows={props.radius} />
              <ul class="stack-sm">
                <For each={props.radius}>
                  {(row) => (
                    <li class="split">
                      <code>
                        {row.path.split(".").pop()}
                      </code>
                      <code>{row.value}</code>
                    </li>
                  )}
                </For>
              </ul>
            </div>
          </Show>
          <Show when={props.shadow.length > 0}>
            <div class="stack-sm">
              <span class="text-xs font-semibold uppercase text-text-muted">
                Lift
              </span>
              <div class="flex flex-wrap items-end gap-3 rounded-md bg-surface-sunken p-3">
                <For each={props.shadow}>
                  {(row) => (
                    <figure class="stack-sm w-16">
                      <div
                        class="h-10 w-full rounded-md bg-surface-raised"
                        style={{ "box-shadow": `var(${row.variable})` }}
                      />
                      <figcaption class="truncate">
                        {row.path.split(".").pop()}
                      </figcaption>
                    </figure>
                  )}
                </For>
              </div>
            </div>
          </Show>
        </div>
      </Show>
    </ConcernCard>
  );
}

/**
 * The spacing scale, drawn as the scale.
 *
 * A spacing step is a LENGTH, and a length is only legible against another
 * length: three bars in the top-left corner, each as wide as its own value,
 * is three numbers — the biggest of them a third of the card, because six
 * rem is a third of six hundred pixels.
 *
 * So the steps stand on one baseline and rise by their own value, which
 * makes the ladder the subject: the first step is a hair because it IS a
 * hair next to the last, and the card is full because the last step is.
 * Every column stands in the scale's own height, so the share a step takes
 * of the whole is visible as well as its value.
 *
 * The scale is the theme's own: each column is as tall as the step's own
 * value, measured against the scale's longest, and the number under it is
 * that value as the theme wrote it.
 */
function SpaceCard(props: {
  steps: readonly TokenRow[];
  fill: string | undefined;
}) {
  /** The scale's longest step: the column that fills the track is this one. */
  const longest = () =>
    Math.max(1, ...props.steps.map((row) => toPx(row.value) ?? 0));

  return (
    <ConcernCard
      path="/spacing"
      title="Space"
    >
      <Show
        when={props.steps.length > 0}
        fallback={
          <p class="text-sm text-text-muted">
            This theme declares no spacing steps yet.
          </p>
        }
      >
        <div class="flex flex-1 flex-col gap-2">
          <div class="flex min-h-24 flex-1 items-stretch gap-3">
            <For each={props.steps}>
              {(row) => (
                <div class="flex flex-1 items-end rounded-sm bg-surface-sunken">
                  <div
                    class="w-full rounded-sm"
                    style={{
                      background: props.fill,
                      height: `${((toPx(row.value) ?? 0) / longest()) * 100}%`,
                    }}
                  />
                </div>
              )}
            </For>
          </div>
          <div class="flex gap-3">
            <For each={props.steps}>
              {(row) => (
                <div class="flex-1 stack-sm text-center">
                  <code class="font-semibold">
                    {row.path.split(".").pop()}
                  </code>
                  <code>{row.value}</code>
                </div>
              )}
            </For>
          </div>
        </div>
      </Show>
    </ConcernCard>
  );
}

/**
 * The motion card: every duration the theme declares, racing.
 *
 * A duration is a TIME, and a time is only legible against another time:
 * every step runs the same arrival at once, so the ladder reads as the
 * stagger it is — the fast one lands while the slow one is still travelling.
 * The track replays on press, because a race run once is a result and a race
 * re-run is a comparison.
 */
function MotionCard(props: {
  durations: readonly TokenRow[];
  fill: string | undefined;
}) {
  /** The counter that restages the race. */
  const [run, setRun] = createSignal(0);

  return (
    <ConcernCard
      path="/motion"
      title="Motion"
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
        <For each={[run()]}>
          {() => (
            <button
              type="button"
              class="bare flex flex-1 flex-col justify-center gap-3 rounded-md p-1 text-left"
              title="Run the race again"
              onClick={() => setRun(run() + 1)}
            >
              <For each={props.durations}>
                {(row) => (
                  <div class="flex items-center gap-2">
                    <code class="w-16 shrink-0 truncate text-xs">
                      {row.path.split(".").pop()}
                    </code>
                    <div class="h-8 flex-1 overflow-hidden rounded-sm bg-surface-sunken">
                      <div
                        class="flex h-full w-16 items-center rounded-sm px-2 animate-fade-in"
                        style={{
                          background: props.fill,
                          "animation-duration": row.value,
                          "animation-fill-mode": "both",
                        }}
                      >
                        <code class="shrink-0 text-xs">{row.value}</code>
                      </div>
                    </div>
                  </div>
                )}
              </For>
            </button>
          )}
        </For>
      </Show>
    </ConcernCard>
  );
}

function ElementsCard(props: { samples: readonly ElementSample[] }) {
  return (
    <ConcernCard
      path="/components"
      title="Elements"
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
                <code>
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

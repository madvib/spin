/**
 * The bar along the top of the window: the controls, and the state they act
 * on.
 *
 * The chrome used to be a rail and a bottom bar, and the bottom bar carried
 * everything at once — the state of the file, the checks on it, the pickers
 * and the verbs that change it. A bar that says and does at the same time
 * reads as one thing, and a reader cannot tell which part of it to reach
 * for: the sentence in the middle and the buttons at the ends belong to
 * different jobs, and a job that shares a row with another job is a job
 * nobody can find.
 *
 * So the jobs are split by what they are, and then the state is brought UP.
 * The bar carries the CONTROLS — the theme picker, the mode control, and
 * the three verbs that change the document — and the STATE sits in the
 * middle of it, between the swatch that says what is being edited and the
 * verbs that change it. A control is something the reader presses; a state
 * is something the reader reads, and the reader's hand and eye are already
 * at the top of the window.
 *
 * The state is CENTRED, and not merely left in the middle: it is the bar's
 * subject, and a sentence pinned to one end of a row of buttons reads as a
 * caption on the buttons rather than as what the buttons are for. So the
 * bar is in quarters — the pickers, the state, the verbs — with the state
 * holding the middle half. The halves are equal, so the state is centred in
 * the BAR and not in whatever room the controls happen to leave.
 *
 * The bar is SLIM: one row, the height of a control. A bar that grew to
 * carry a heading would be a banner, and a banner is a thing that tells you
 * what the page is.
 *
 * The verbs are three compact icon buttons with AIR between them. Undo, redo
 * and save are three different actions, and a row of three identical glyph
 * buttons shoulder to shoulder reads as ONE control with three states; the
 * air between them is what tells the reader that they are three different
 * things.
 *
 * It is CHROME, and it wears the studio's own theme: the control that saves
 * a theme must not be restyled by the theme it is saving.
 */

import { createEffect, createSignal, Show } from "solid-js";
import {
  activeName,
  canRedo,
  canUndo,
  closeSaveCopy,
  divergedFromDisk,
  isDirty,
  note,
  noteDiscarded,
  noteRefusal,
  pendingSaveCopy,
  redo,
  registry,
  reloadFromDisk,
  revertToSaved,
  saveStarterAsProjectTheme,
  saveThemeToDisk,
  undo,
} from "../lib/store.ts";
import { problemText } from "../lib/themes.ts";
import { inDrawer } from "../lib/host.ts";
import { refetchProjectThemes } from "./Settings.tsx";
import SeatPill from "./SeatPill.tsx";
import StudioNav from "./StudioNav.tsx";
import StudioOverflow from "./StudioOverflow.tsx";
import CommandPalette from "./CommandPalette.tsx";
/**
 * The bar's own look.
 *
 * A strip, not a toolbar: the row is short, quiet, and the items in it are
 * pressed rather than read. It sits on the studio's raised surface and draws
 * a rule below itself, so it reads as a different thing from the page under
 * it — the same separation the mark has from the concerns in the rail.
 */
const BAR =
  "flex h-10 shrink-0 items-center gap-2 border-b bg-surface-raised px-3";

/**
 * A glyph button in the bar.
 *
 * One size, one ink, one hover — so the controls in the strip are a row of
 * equals. The box is smaller than the glyph's own measure and borderless:
 * `bare` clears the fill but not the hairline, so the edge is stated here
 * rather than inherited from the chrome. The air between the verbs is wider
 * than the box, so three quiet glyphs read as three controls and not as
 * one smudge.
 */
const ICON_BUTTON =
  "bare flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-0 text-muted hover:bg-surface-raised disabled:bg-transparent disabled:opacity-50";

const VERBS = "flex items-center gap-2";

const EDIT_PILL =
  "inline-flex items-center rounded-full border bg-surface";

export default function TopBar() {
  /** The theme being edited. */
  const theme = () => activeName();
  /** Whether the editor holds edits the file does not. */
  const dirty = () => isDirty(theme());
  /** Whether the file moved under the studio. */
  const diverged = () => divergedFromDisk(theme());
  const [copyName, setCopyName] = createSignal("");
  const [copyProblem, setCopyProblem] = createSignal<string | null>(null);

  createEffect(() => {
    const source = pendingSaveCopy();
    if (source === null) return;
    const existing = new Set((registry() ?? []).map((t) => t.name));
    let candidate = `${source}-copy`;
    let i = 2;
    while (existing.has(candidate)) {
      candidate = `${source}-copy-${i++}`;
    }
    setCopyName(candidate);
    setCopyProblem(null);
  });

  async function submitCopy(): Promise<void> {
    const source = pendingSaveCopy();
    if (source === null) return;
    const outcome = await saveStarterAsProjectTheme(source, copyName());
    if (!outcome.written) {
      setCopyProblem(outcome.problem ?? "Could not save copy.");
      return;
    }
    refetchProjectThemes();
  }
  /**
   * Takes the file's word for it.
   *
   * The same verb the state carries, on the theme being edited: the file's
   * text moves into the editor, and the edits that were never written go
   * with it.
   */
  async function reload(): Promise<void> {
    const name = theme();
    try {
      const found = await reloadFromDisk(name);
      note(
        found === "changed"
          ? `${name} changed on disk — the studio now shows the file.`
          : `${name} reloaded from disk.`,
      );
    } catch (err) {
      noteRefusal(problemText(err));
    }
  }

  /** Drops the edits that have not been written. */
  function discard(): void {
    const name = theme();
    revertToSaved(name);
    noteDiscarded(name);
  }

  return (
    <header
      aria-label="Document controls"
      class={BAR}
      classList={{
        // The drawer is a page the host scrolls, so the bar has to hold
        // its place at the top of it — the same promise the rail makes.
        "sticky top-0 z-dropdown": inDrawer(),
      }}
    >
      {
        /*
          What the studio is showing: the seat pill — mode, theme, and the
          badge naming the seat. The facts the sentence narrated live on the
          badge's hover card now.
        */
      }
      <div class="flex min-w-0 flex-1 items-center justify-start">
        <StudioNav />
      </div>

      <div class="flex shrink-0 items-center justify-center">
        <CommandPalette />
      </div>

      <div class="flex min-w-0 flex-1 items-center justify-end gap-2">
        <div class={VERBS}>
          <div data-testid="edit-pill" class={EDIT_PILL}>
            <Show when={diverged()}>
              <span class="relative inline-flex items-center">
                <button
                  type="button"
                  class={ICON_BUTTON}
                  aria-label="Reload from disk"
                  onClick={() => {
                    void reload();
                  }}
                >
                  <span
                    class="inline-block shrink-0 icon-md i-lucide-refresh-cw"
                    aria-hidden="true"
                  />
                </button>
                <tooltip class="end-0 top-full whitespace-nowrap peer-hover:visible peer-focus-visible:visible">
                  Re-read this theme from disk
                </tooltip>
              </span>
              <span class="h-5 border-s" aria-hidden="true" />
            </Show>
            <Show when={dirty() && !diverged()}>
              <span class="relative inline-flex items-center">
                <button
                  type="button"
                  class={ICON_BUTTON}
                  aria-label="Discard changes"
                  onClick={discard}
                >
                  <span
                    class="inline-block shrink-0 icon-md i-lucide-eraser"
                    aria-hidden="true"
                  />
                </button>
                <tooltip class="end-0 top-full whitespace-nowrap peer-hover:visible peer-focus-visible:visible">
                  Drop the edits that have not been saved
                </tooltip>
              </span>
              <span class="h-5 border-s" aria-hidden="true" />
            </Show>
            <span class="relative hidden items-center sm:inline-flex">
              <button
                type="button"
                class={ICON_BUTTON}
                aria-label="Undo"
                disabled={!canUndo()}
                onClick={() => undo()}
              >
                <span
                  class="inline-block shrink-0 icon-md i-lucide-undo-2"
                  aria-hidden="true"
                />
              </button>
              <tooltip class="end-0 top-full whitespace-nowrap peer-hover:visible peer-focus-visible:visible">
                Undo
              </tooltip>
            </span>
            <span class="hidden h-5 border-s sm:inline-block" aria-hidden="true" />
            <span class="relative hidden items-center sm:inline-flex">
              <button
                type="button"
                class={ICON_BUTTON}
                aria-label="Redo"
                disabled={!canRedo()}
                onClick={() => redo()}
              >
                <span
                  class="inline-block shrink-0 icon-md i-lucide-redo-2"
                  aria-hidden="true"
                />
              </button>
              <tooltip class="end-0 top-full whitespace-nowrap peer-hover:visible peer-focus-visible:visible">
                Redo
              </tooltip>
            </span>
            <span class="hidden h-5 border-s sm:inline-block" aria-hidden="true" />
            <span class="relative inline-flex items-center">
              <button
                type="button"
                data-testid="save"
                class={ICON_BUTTON}
                aria-label={dirty() || diverged() ? "Save to disk" : "Saved"}
                disabled={!dirty()}
                onClick={() => {
                  void saveThemeToDisk(theme());
                }}
              >
                <span
                  class="inline-block shrink-0 icon-md i-lucide-save"
                  aria-hidden="true"
                />
              </button>
              <tooltip class="end-0 top-full whitespace-nowrap peer-hover:visible peer-focus-visible:visible">
                {diverged()
                  ? "The file changed on disk — reload from disk first"
                  : dirty()
                  ? "Save to disk"
                  : "Saved"}
              </tooltip>
            </span>
          </div>
          <SeatPill />
          <StudioOverflow />
        </div>
      </div>
      <Show when={pendingSaveCopy()}>
        <div
          class="fixed inset-0 z-modal flex items-center justify-center bg-surface/60"
          onClick={(event) => {
            if (event.target === event.currentTarget) closeSaveCopy();
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") closeSaveCopy();
          }}
        >
          <dialog
            open
            aria-label="Save as project theme"
            class="stack panel w-[20rem]"
          >
            <div class="split">
              <h2>Save as project theme</h2>
              <button
                type="button"
                class="secondary s-sm"
                onClick={() => closeSaveCopy()}
              >
                Close
              </button>
            </div>
            <p class="text-muted">
              This theme is read-only here. Save your edits as a project
              theme in <code>spin/</code>.
            </p>
            <div class="flex flex-col gap-1">
              <label for="save-copy-name">Theme name</label>
              <input
                id="save-copy-name"
                type="text"
                aria-label="Theme name"
                value={copyName()}
                onInput={(event) => {
                  setCopyName(event.currentTarget.value);
                  setCopyProblem(null);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void submitCopy();
                  }
                }}
              />
            </div>
            <Show when={copyProblem()}>
              {(msg) => (
                <p class="text-semantic-error" role="alert">
                  {msg()}
                </p>
              )}
            </Show>
            <div class="row justify-end">
              <button
                type="button"
                class="secondary"
                onClick={() => closeSaveCopy()}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  void submitCopy();
                }}
              >
                Save copy
              </button>
            </div>
          </dialog>
        </div>
      </Show>
    </header>
  );
}

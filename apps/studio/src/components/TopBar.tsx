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

import { Show } from "solid-js";
import {
  activeMode,
  activeName,
  activeTokenCount,
  canRedo,
  canUndo,
  divergedFromDisk,
  isDirty,
  note,
  noteRefusal,
  redo,
  reloadFromDisk,
  revertToSaved,
  saveThemeToDisk,
  undo,
} from "../lib/store.ts";
import { problemText } from "../lib/themes.ts";
import { stateLabel } from "../lib/theme.ts";
import { inDrawer } from "../lib/host.ts";
import { ModePicker, ThemePicker } from "./Settings.tsx";

/**
 * The bar's own look.
 *
 * A strip, not a toolbar: the row is short, quiet, and the items in it are
 * pressed rather than read. It sits on the studio's raised surface and draws
 * a rule below itself, so it reads as a different thing from the page under
 * it — the same separation the mark has from the concerns in the rail.
 */
const BAR =
  "flex h-10 shrink-0 items-center gap-2 border-b border-border bg-surface-raised px-3";

/**
 * A glyph button in the bar.
 *
 * One size, one ink, one hover — so the controls in the strip are a row of
 * equals. A control that is a word wide beside controls that are a glyph
 * wide reads as a different kind of thing, and the row stops being a strip
 * and becomes a list.
 */
const ICON_BUTTON =
  "bare flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-text-muted hover:text-text disabled:opacity-50";

/**
 * The three verbs, and the air between them.
 *
 * The gap is wider than the gap between the pickers and the verbs on the
 * other side of the bar: the pickers say WHAT is being edited, and the
 * verbs CHANGE it, and the space between the two says so before anything
 * is read.
 */
const VERBS = "flex items-center gap-3";

/**
 * What is true about the file, in the studio's words.
 *
 * Two facts can hold at once: the editor holds edits the file does not
 * ("unsaved changes"), and the file holds something the studio did not
 * write ("changed on disk"). The second is the one that bites — the save
 * that would overwrite it is refused — so it is said even when the first is
 * true as well.
 */
function fileStateText(
  dirty: boolean,
  diverged: boolean,
): string {
  const parts: string[] = [];
  if (dirty) parts.push(stateLabel("unsaved"));
  if (diverged) parts.push(stateLabel("changed"));
  if (parts.length === 0) parts.push(stateLabel("saved"));
  return parts.join(" · ");
}

export default function TopBar() {
  /** The theme being edited. */
  const theme = () => activeName();
  /** Whether the editor holds edits the file does not. */
  const dirty = () => isDirty(theme());
  /** Whether the file moved under the studio. */
  const diverged = () => divergedFromDisk(theme());

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
    note(`${name} — the unsaved edits were dropped.`);
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
          What the studio is showing: the theme under edit and the mode it
          is shown in. Both are a glyph-sized control that opens a panel
          floating over the content, so neither takes the bar's room.

          The left quarter: the bar is in quarters, and this is the first
          one.
        */
      }
      <div class="flex flex-1 items-center gap-2">
        <ThemePicker />
        <ModePicker />
      </div>

      {
        /*
          The state of the document, in the middle of the bar: what is being
          edited, in which mode, how big it is, and whether the file agrees.

          Each fact is its own nowrap run, so the line can break BETWEEN
          them and never inside one — "Editing" and the theme's name are one
          run, because a line that broke between them would leave the
          studio saying it was editing nothing. The line is TRUNCATED rather
          than wrapped: a bar is one line at every width, and a state that
          wrapped would push the controls off the end of the row. The theme's
          name comes first, so a narrow bar gives way at the end of the
          sentence and keeps saying what is being edited.

          It takes HALF the bar, and the controls a quarter each — and that
          is what keeps it centred: the state is the bar's subject, and a
          subject squeezed into a third of the row is a caption. The two
          quarters are equal, so the middle half is centred in the BAR and
          not in whatever room the controls happen to leave.
        */
      }
      <div
        aria-label="Editing"
        class="flex min-w-0 flex-[2_2_0%] items-center justify-center"
      >
        <p class="min-w-0 truncate text-center text-sm text-text-muted">
          <span class="whitespace-nowrap">
            Editing <strong class="text-text">{theme()}</strong>
          </span>
          {" · "}
          <span class="whitespace-nowrap">{activeMode()}</span>
          {" · "}
          <span class="whitespace-nowrap">{activeTokenCount()} tokens</span>
          {" · "}
          <span class="whitespace-nowrap">
            {fileStateText(dirty(), diverged())}
          </span>
        </p>
      </div>

      {
        /*
          The verbs, at the far end of the bar: what the reader can DO with
          the document, held apart from what the document IS. The last
          quarter, and the one that ends the row.
        */
      }
      <div class="flex flex-1 items-center justify-end gap-3">
        {
          /*
            The action that answers the state, and only that one: re-reading
            the file is the answer when the file moved under the studio, and
            dropping the edits is the answer when the editor holds edits the
            file does not. The other one is not offered, because it would not
            answer anything: re-reading the file when the file has not moved
            gives back what dropping the edits gives back, and dropping the
            edits when the file HAS moved leaves the save just as refused.

            A control that is always there and never does anything is a
            control the reader learns to skip.

            These are the state's own answers, so they sit BESIDE the verbs
            rather than among them: they are a different kind of action, and
            they only exist while the state is asking for them.
          */
        }
        <Show when={diverged()}>
          <button
            type="button"
            class={ICON_BUTTON}
            aria-label="Reload from disk"
            title="Re-read this theme from disk"
            onClick={() => {
              void reload();
            }}
          >
            <span
              class="inline-block shrink-0 icon-md i-lucide-refresh-cw"
              aria-hidden="true"
            />
          </button>
        </Show>
        <Show when={dirty() && !diverged()}>
          <button
            type="button"
            class={ICON_BUTTON}
            aria-label="Discard changes"
            title="Drop the edits that have not been saved"
            onClick={discard}
          >
            <span
              class="inline-block shrink-0 icon-md i-lucide-eraser"
              aria-hidden="true"
            />
          </button>
        </Show>

        <div class={VERBS}>
          <button
            type="button"
            class={ICON_BUTTON}
            title="Undo"
            aria-label="Undo"
            disabled={!canUndo()}
            onClick={() => undo()}
          >
            <span
              class="inline-block shrink-0 icon-md i-lucide-undo-2"
              aria-hidden="true"
            />
          </button>
          <button
            type="button"
            class={ICON_BUTTON}
            title="Redo"
            aria-label="Redo"
            disabled={!canRedo()}
            onClick={() => redo()}
          >
            <span
              class="inline-block shrink-0 icon-md i-lucide-redo-2"
              aria-hidden="true"
            />
          </button>
          {
            /*
              The save says what it does. A theme that is written says
              "Saved" and offers nothing; a theme with edits in it says
              "Save to disk", and the title says what will happen when it is
              pressed — or why it cannot be.
            */
          }
          <button
            type="button"
            data-testid="save"
            class={ICON_BUTTON}
            title={diverged()
              ? "The file changed on disk — reload from disk first"
              : dirty()
              ? "Save to disk"
              : "Saved"}
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
        </div>
      </div>
    </header>
  );
}

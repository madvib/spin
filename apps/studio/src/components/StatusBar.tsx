/**
 * The editing bar — the studio's status line, along the bottom of the window.
 *
 * The chrome used to be a rail and a header: the rail carried the tool's own
 * verbs (undo, redo, save, settings) under the navigation, and the header
 * above the preview carried the state of the file being edited. Both were
 * furniture in the wrong place — a verb that changes the document is not
 * navigation, and a status line that sits above the work is a banner rather
 * than a status.
 *
 * So the rail is navigation and nothing else, and everything that speaks
 * about the document lives here, in one line across the bottom: what is
 * being edited and what is true about it, which theme, which mode, the three
 * verbs that change the file, and the checks on it.
 *
 * It is CHROME, and it wears the studio's own theme: the control that saves
 * a theme must not be restyled by the theme it is saving.
 */

import { A } from "@solidjs/router";
import { createMemo, createSignal, For, Show } from "solid-js";
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
  themeText,
  undo,
} from "../lib/store.ts";
import { analyzeTheme, stateLabel } from "../lib/theme.ts";
import { problemText } from "../lib/themes.ts";
import { editorRouteFor } from "../lib/tokens.ts";
import { hostPath } from "../lib/client.ts";
import { BAR } from "../lib/routes.ts";
import { ModePicker, ThemePicker } from "./Settings.tsx";

/**
 * The bar's own look.
 *
 * A strip, not a toolbar: the row is short, quiet, and the items in it are
 * read rather than hunted for. The bar sits on the studio's raised surface
 * and draws a rule above itself, so it reads as a different thing from the
 * page above it — the same separation the mark has from the concerns in the
 * rail.
 */
const BAR_CLASS =
  "sticky bottom-0 z-dropdown flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 border-t border-border bg-surface-raised px-3 py-1.5 text-sm";

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

export default function StatusBar() {
  /** The theme being edited. */
  const theme = () => activeName();
  /** Whether the editor holds edits the file does not. */
  const dirty = () => isDirty(theme());
  /** Whether the file moved under the studio. */
  const diverged = () => divergedFromDisk(theme());

  /**
   * The checks on the document being edited.
   *
   * The same analysis the daemon judges the document with, read here so the
   * bar can say whether there is anything to say. A document that does not
   * parse is one finding, not a page: the reason is the finding.
   */
  const issues = createMemo(() => {
    const report = analyzeTheme(themeText());
    return [
      ...(report.error === undefined
        ? []
        : [{ path: "", message: report.error }]),
      ...report.issues,
    ];
  });

  /** Whether the checks panel is open. */
  const [checksOpen, setChecksOpen] = createSignal(false);

  /**
   * Takes the file's word for it.
   *
   * The same verb the card carries, on the theme being edited: the file's
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
    <footer aria-label="Editing" class={BAR_CLASS}>
      {
        /*
          The state of the document, first and leftmost: what is being
          edited, in which mode, how big it is, and whether the file agrees.

          Each fact is its own nowrap run, so the line can break BETWEEN
          them and never inside one — "Editing" and the theme's name are one
          run, because a line that broke between them would leave the
          studio saying it was editing nothing.
        */
      }
      <p class="min-w-0 text-text-muted">
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

      {
        /*
          The two actions that answer the state, and only when there is
          something to answer: re-reading the file is worth offering when
          the editor and the file differ, and dropping the edits is worth
          offering when there are edits. A button that is always there and
          never does anything is a control the reader learns to skip.
        */
      }
      <Show when={dirty() || diverged()}>
        <button
          type="button"
          class="bare shrink-0 whitespace-nowrap text-text-muted hover:text-text"
          title="Re-read this theme from disk"
          onClick={() => {
            void reload();
          }}
        >
          Reload from disk
        </button>
      </Show>
      <Show when={dirty()}>
        <button
          type="button"
          class="bare shrink-0 whitespace-nowrap text-text-muted hover:text-text"
          title="Drop the edits that have not been saved"
          onClick={discard}
        >
          Discard changes
        </button>
      </Show>

      <span class="flex-1" />

      {
        /*
          The theme under edit, and the mode it is shown in.

          These two are the studio's OWN controls — a popover for the
          theme, a toggle group for the mode — and the runtime's are the
          right ones: a menu that filters as it opens, a segmented control
          that reads as one choice. They are plain controls here for now,
          because those primitives are not in this tree yet. When they
          arrive, these two slots are where they go.
        */
      }
      <div class="row-sm shrink-0">
        <label for="theme-picker-compact" class="text-text-muted">
          Theme
        </label>
        <ThemePicker compact />
      </div>
      <ModePicker />

      {
        /* The three verbs that change the document, as the icons they have
          always been: undo, redo, and the write. */
      }
      <div class="row-sm shrink-0">
        <button
          type="button"
          class="bare shrink-0 text-text disabled:opacity-50"
          title="Undo"
          aria-label="Undo"
          disabled={!canUndo()}
          onClick={() => undo()}
        >
          <span
            class="inline-block shrink-0 text-xl i-lucide-undo-2"
            aria-hidden="true"
          />
        </button>
        <button
          type="button"
          class="bare shrink-0 text-text disabled:opacity-50"
          title="Redo"
          aria-label="Redo"
          disabled={!canRedo()}
          onClick={() => redo()}
        >
          <span
            class="inline-block shrink-0 text-xl i-lucide-redo-2"
            aria-hidden="true"
          />
        </button>
        <button
          type="button"
          class="bare shrink-0 text-text disabled:opacity-50"
          title={diverged()
            ? "The file changed on disk — reload from disk first"
            : dirty()
            ? "Save to disk"
            : "Saved"}
          aria-label="Save to disk"
          disabled={!dirty()}
          onClick={() => {
            void saveThemeToDisk(theme());
          }}
        >
          <span
            class="inline-block shrink-0 text-xl i-lucide-save"
            aria-hidden="true"
          />
        </button>
      </div>

      {
        /*
          The checks, as a status and not as a page.

          The findings are the document's, and they are the same on every
          route — so a section on one page would be a section that is
          missing from the other eight. The bar carries the count, and the
          count opens the panel that lists them.
        */
      }
      <button
        type="button"
        class="bare row-sm shrink-0 whitespace-nowrap"
        classList={{
          "text-semantic-error": issues().length > 0,
          "text-text-muted": issues().length === 0,
        }}
        aria-expanded={checksOpen()}
        aria-haspopup="dialog"
        title="What the checks say about this document"
        onClick={() => setChecksOpen(true)}
      >
        <span
          class={`inline-block shrink-0 icon-md ${
            issues().length > 0
              ? "i-lucide-shield-alert"
              : "i-lucide-shield-check"
          }`}
          aria-hidden="true"
        />
        <span>
          {issues().length === 0
            ? "no issues"
            : `${issues().length} ${
              issues().length === 1 ? "issue" : "issues"
            }`}
        </span>
      </button>

      {
        /* The studio's own routes, which the rail does not carry: the rail
          is navigation to the PROJECT, and the settings are the tool's. A
          LINK, so it is not a button wearing a link's clothes — and the
          underline is taken off, because an underlined glyph is a glyph
          with a line through the page. */
      }
      <For each={BAR}>
        {(route) => (
          <A
            href={hostPath(route.path)}
            class="no-underline flex shrink-0 items-center justify-center text-text"
            title={route.label}
            aria-label={route.label}
          >
            <span
              class={`inline-block shrink-0 text-xl ${route.icon}`}
              aria-hidden="true"
            />
          </A>
        )}
      </For>

      {
        /*
          The checks panel. A dialog rather than a popover, because the
          runtime's popover is not in this tree yet and a dialog is a
          thing the browser has: it takes the focus, it closes on Escape,
          and it puts the findings where the eye already is.
        */
      }
      <Show when={checksOpen()}>
        <dialog
          aria-label="Checks"
          class="stack panel w-96 max-w-[90vw]"
          ref={(el: HTMLDialogElement) => {
            requestAnimationFrame(() => {
              if (el.isConnected && !el.open) el.showModal();
            });
          }}
          onClose={() => setChecksOpen(false)}
        >
          <h2 class="text-lg">Checks</h2>
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
                  <li class="flex flex-wrap items-baseline gap-2 text-sm">
                    <A
                      href={editorRouteFor(issue.path)}
                      class="hover:underline"
                    >
                      <code>
                        {issue.path === "" ? "(document)" : issue.path}
                      </code>
                    </A>
                    <span class="min-w-0 flex-1 text-text-muted">
                      {issue.message}
                    </span>
                  </li>
                )}
              </For>
            </ul>
          </Show>
          <footer class="row-sm justify-end">
            <button type="button" onClick={() => setChecksOpen(false)}>
              Close
            </button>
          </footer>
        </dialog>
      </Show>
    </footer>
  );
}

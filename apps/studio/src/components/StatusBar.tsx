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
 * In the DRAWER the bar is two lines: the state on one, the controls on the
 * other, centred and evenly spaced. The drawer is narrow because the host
 * made it narrow, and a strip of controls that wraps is a strip whose
 * spacing is whatever the width left over — a control that ends up beside a
 * different kind of control, half a row down from where its neighbours are.
 * Two lines with the controls gathered in the middle of the second one says
 * the same thing at any width.
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
import {
  closeStudio,
  embedded,
  inDrawer,
  toggleHostMode,
} from "../lib/host.ts";
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
  "sticky bottom-0 z-dropdown flex shrink-0 border-t border-border bg-surface-raised px-3 py-1.5 text-sm";

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
    <footer
      aria-label="Editing"
      class={BAR_CLASS}
      classList={{
        // Modal: one line, the state on the left and the controls on the
        // right. Drawer: two lines, the state above and the controls
        // gathered in the middle of the second.
        "flex-row items-center gap-x-4": !inDrawer(),
        "flex-col items-stretch gap-1": inDrawer(),
      }}
    >
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
      <div
        class="flex min-w-0 items-center gap-2"
        classList={{ "justify-between": inDrawer() }}
      >
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
          <div class="row-sm shrink-0">
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
          </div>
        </Show>
      </div>

      {
        /*
          The controls: the theme under edit, the mode it is shown in, the
          three verbs that change the document, the checks on it, the
          studio's own routes, and the host's own verbs.

          In the drawer they are gathered in the middle of their own line —
          centred, evenly spaced, and all the same kind of control. A strip
          that wraps is a strip whose spacing is whatever the width left
          over.
        */
      }
      <div
        class="flex items-center gap-1"
        classList={{
          "ml-auto": !inDrawer(),
          "justify-center": inDrawer(),
        }}
      >
        <ThemePicker compact />
        <ModePicker />

        {
          /* The three verbs that change the document, as the icons they have
            always been: undo, redo, and the write. */
        }
        <button
          type="button"
          class={ICON_BUTTON}
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
          class={ICON_BUTTON}
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
          class={ICON_BUTTON}
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
          class={ICON_BUTTON}
          classList={{
            "text-semantic-error": issues().length > 0,
            "text-text-muted": issues().length === 0,
          }}
          aria-expanded={checksOpen()}
          aria-haspopup="dialog"
          aria-label={issues().length === 0
            ? "No issues"
            : `${issues().length} ${
              issues().length === 1 ? "issue" : "issues"
            }`}
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
          <Show when={issues().length > 0}>
            <span class="text-xs">{issues().length}</span>
          </Show>
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
              class={`${ICON_BUTTON} no-underline`}
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
            The host's own verbs: the edge the studio is shown at, and the
            way out of it.

            They were a strip of their own above the work — a band of
            nothing that pushed the page down — and they are the HOST's
            controls, so they belong with the rest of the chrome rather than
            inside the project's own theme. The bar is where the studio's
            own furniture lives, so that is where they are.
          */
        }
        <Show when={embedded()}>
          <button
            type="button"
            class={ICON_BUTTON}
            aria-label={inDrawer() ? "Modal" : "Drawer"}
            title={inDrawer() ? "Modal" : "Drawer"}
            onClick={toggleHostMode}
          >
            <span
              class="inline-block shrink-0 icon-md i-lucide-panel-right"
              aria-hidden="true"
            />
          </button>
          <button
            type="button"
            class={ICON_BUTTON}
            aria-label="Close"
            title="Close"
            onClick={closeStudio}
          >
            <span
              class="inline-block shrink-0 icon-md i-lucide-x"
              aria-hidden="true"
            />
          </button>
        </Show>
      </div>

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
          // The chrome's own type. A heading in the chrome is not a heading
          // in a document: the theme's heading face belongs to the document
          // the studio previews, and the studio's chrome has one face — the
          // body face it reads in everywhere else.
          class="stack panel w-96 max-w-[90vw] font-sans"
          ref={(el: HTMLDialogElement) => {
            requestAnimationFrame(() => {
              if (el.isConnected && !el.open) el.showModal();
            });
          }}
          onClose={() => setChecksOpen(false)}
        >
          <h2 class="text-lg font-sans">Checks</h2>
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

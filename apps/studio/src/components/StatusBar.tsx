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
 * Then the state and the controls shared one bar, and that was furniture in
 * the wrong shape: a bar that says and does at the same time reads as one
 * thing. So the jobs are split by what they are. The bar along the TOP
 * carries the controls — the theme picker, the mode control, the verbs that
 * change the document — and this one carries the STATE, and nothing else:
 * what is being edited, what is true about the file, and the checks on it.
 *
 * The editing state is in the MIDDLE of the bar, because it is the bar's
 * subject and the checks flank it: what the studio is checking on the left,
 * and the sentence that says what all of it means in the middle. A bar whose
 * state sits at one end with everything else crowded at the other reads as a
 * toolbar with a caption, and the caption is the part the reader came for.
 *
 * The bar is ONE LINE at every width. The drawer is narrow because the host
 * made it narrow, and a strip that wraps is a strip whose spacing is
 * whatever the width left over — a control that ends up beside a different
 * kind of control, half a row down from where its neighbours are. So the
 * state TRUNCATES rather than wrapping.
 *
 * It is CHROME, and it wears the studio's own theme: the control that saves a
 * theme must not be restyled by the theme it is saving.
 */

import { A } from "@solidjs/router";
import { createMemo, createSignal, For, Show } from "solid-js";
import {
  activeMode,
  activeName,
  activeTokenCount,
  divergedFromDisk,
  isDirty,
  themeText,
} from "../lib/store.ts";
import { stateLabel } from "../lib/theme.ts";
import { editorRouteFor } from "../lib/tokens.ts";
import { hostPath } from "../lib/client.ts";
import { checks, remedyText } from "../lib/floors.ts";
import type { Remedy } from "../lib/floors.ts";
import { editToken } from "../lib/editing.ts";
import { inDrawer } from "../lib/host.ts";

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
  "sticky bottom-0 z-dropdown flex shrink-0 items-center gap-2 border-t border-border bg-surface-raised px-3 py-1.5 text-sm";

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
   *
   * Each finding carries what would put it right — the value the token would
   * have to take and which way it has to move — so a finding is an offer
   * rather than a complaint.
   */
  const findings = createMemo(() => checks(themeText()));

  /** Whether the checks panel is open. */
  const [checksOpen, setChecksOpen] = createSignal(false);

  /**
   * Writes a remedy into the token it belongs to.
   *
   * The finding names the token, so the studio can offer the edit rather
   * than only describe it. The value goes into the token's own slot — the
   * base, which is the slot the finding was measured on — and the studio's
   * own gate has the last word: an edit that breaks a floor the document
   * used to keep is refused and says why.
   */
  function apply(remedy: Remedy): void {
    editToken(remedy.path.split("."), remedy.value, "base");
  }

  return (
    <footer
      aria-label="Editing"
      class={BAR_CLASS}
    >
      {
        /*
          The checks, as a status and not as a page.

          The findings are the document's, and they are the same on every
          route — so a section on one page would be a section that is
          missing from the other eight. The bar carries the count, and the
          count opens the panel that lists them. The tip says what the
          first finding is and what would clear it, so the pointer learns
          the answer without opening anything.
        */
      }
      <div
        class="flex items-center gap-2"
        classList={{
          // Drawer: the checks are the width they are, and the state takes
          // the rest. Modal: the state is centred in the bar, so the side
          // that carries nothing still takes its third of the width.
          "shrink-0": inDrawer(),
          "flex-1 justify-start": !inDrawer(),
        }}
      >
        <button
          type="button"
          data-testid="checks"
          class="bare flex h-8 w-8 shrink-0 items-center justify-center text-text-muted hover:text-text"
          classList={{
            "text-semantic-error": findings().length > 0,
            "text-text-muted": findings().length === 0,
          }}
          aria-expanded={checksOpen()}
          aria-haspopup="dialog"
          aria-label={findings().length === 0
            ? "No issues"
            : `${findings().length} ${
              findings().length === 1 ? "issue" : "issues"
            }`}
          title={findings().length === 0
            ? "What the checks say about this document"
            : `${findings()[0]!.message}${
              findings()[0]!.remedy === undefined
                ? ""
                : ` — ${remedyText(findings()[0]!.remedy!)}`
            }`}
          onClick={() => setChecksOpen(true)}
        >
          <span
            class={`inline-block shrink-0 icon-md ${
              findings().length > 0
                ? "i-lucide-shield-alert"
                : "i-lucide-shield-check"
            }`}
            aria-hidden="true"
          />
          <Show when={findings().length > 0}>
            <span class="text-xs">{findings().length}</span>
          </Show>
        </button>
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
        */
      }
      <div class="flex min-w-0 flex-1 items-center justify-center">
        <p class="min-w-0 truncate text-center text-text-muted">
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
          The far side of the bar, which carries nothing.

          It is here so that the state in the middle is centred in the BAR
          rather than in the space the checks leave: a state that sits
          beside its own caption is a caption, and a caption is not what the
          reader came for. In the drawer the bar is narrow, and the checks
          take the width they are worth and the state takes the rest.
        */
      }
      <Show when={!inDrawer()}>
        <div class="flex-1" />
      </Show>

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
          class="stack panel max-w-[90vw] font-sans"
          ref={(el: HTMLDialogElement) => {
            requestAnimationFrame(() => {
              if (el.isConnected && !el.open) el.showModal();
            });
          }}
          onClose={() => setChecksOpen(false)}
        >
          <h2>Checks</h2>
          <Show
            when={findings().length > 0}
            fallback={
              <p class="text-sm text-text-muted">
                Nothing to report: the document parses, and every value it
                declares clears the floors.
              </p>
            }
          >
            <ul class="stack-sm">
              <For each={findings()}>
                {(finding) => (
                  <li class="stack-sm text-sm">
                    <A
                      href={hostPath(editorRouteFor(finding.path))}
                      class="hover:underline"
                    >
                      <code>
                        {finding.path === "" ? "(document)" : finding.path}
                      </code>
                    </A>
                    <p class="text-text-muted">{finding.message}</p>
                    {
                      /*
                        What would put it right.

                        A finding that names a ratio and a floor and stops
                        there is a complaint; one that also names the value
                        the token would have to take is an offer. The value
                        is written into the token when the author takes it,
                        and the studio's own gate has the last word on
                        whether the document may hold it.
                      */
                    }
                    <Show when={finding.remedy}>
                      {(remedy) => (
                        <div class="row-sm flex-wrap">
                          <span class="text-text-muted">
                            {remedyText(remedy())}
                          </span>
                          <button
                            type="button"
                            class="bare s-sm flex min-h-0 shrink-0 items-center justify-start gap-2 text-left text-text hover:bg-surface-sunken"
                            title={`Write ${remedy().value} into ${remedy().path}`}
                            onClick={() => apply(remedy())}
                          >
                            Use {remedy().value}
                          </button>
                        </div>
                      )}
                    </Show>
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

/**
 * The checks on the document being edited.
 *
 * The chrome used to have a bar along the bottom that carried the state and
 * the checks together: what was being edited, what was true about the file,
 * and what the checks had to say about it. The state moved to the bar along
 * the top — a bar of controls is where the reader's hand goes, and the state
 * is what the reader reads — so what is left of the bottom bar is the
 * checks alone.
 *
 * A check is a VERDICT, not a sentence, and a verdict belongs where verdicts
 * live: in the rail, on a shield that says whether there is anything to say.
 * The shield is the rail's own shape — the same box, the same glyph, the
 * same hover as every other row in the foot — and it carries a count when
 * the document has findings.
 *
 * The count is a BADGE in the semantic colour the findings are: an error's
 * badge is the error's fill and its ink, a warning's is the warning's. The
 * badge is the colour that survives the pointer, because the shield takes
 * the accent under the pointer like every other icon in the rail — and the
 * badge keeps saying how bad it is.
 *
 * The panel it opens is the panel it always opened: the same findings, the
 * same sentences, and the same offer — "Darken `color.semantic.success` to
 * `#4d7474` — 4.52:1 on color.surface." with the value to take. A finding
 * that names a ratio and stops there is a complaint; one that names the
 * value is an offer.
 */

import { A } from "@solidjs/router";
import { createMemo, createSignal, For, Show } from "solid-js";
import type { JSX } from "solid-js";
import { themeText } from "../lib/store.ts";
import { checks, remedyText } from "../lib/floors.ts";
import type { Check, Remedy } from "../lib/floors.ts";
import { editToken } from "../lib/editing.ts";
import { editorRouteFor } from "../lib/tokens.ts";
import { hostPath } from "../lib/client.ts";

/**
 * How bad the findings are.
 *
 * Two answers, because the theme's own findings are two kinds of thing.
 */
type Severity = "error" | "warning";

/**
 * The badge's tone, by the severity of the findings.
 *
 * The classes are LITERAL so the scanner sees them: a class name assembled
 * at runtime is a class nothing generates, and the badge would be a badge
 * with no fill.
 */
const TONE: Record<Severity, string> = {
  error: "badge-danger",
  warning: "badge-warning",
};

/**
 * The shield's ink, by the severity of the findings.
 *
 * The badge carries the fill and the shield carries the ink, because they
 * are two answers to one question said at two sizes: a reader who cannot
 * read the count still sees that something is wrong.
 */
const INK: Record<Severity, string> = {
  error: "text-semantic-error",
  warning: "text-semantic-warning",
};

/**
 * How bad the findings are.
 *
 * The theme module judges a document and does not GRADE its findings, so the
 * studio reads the one thing a finding itself carries: whether the studio
 * can put it right.
 *
 * A finding the studio can FIX is a contrast floor the document does not
 * clear: the theme builds and works, and one pair of colours is too close
 * to read. That is a WARNING. A finding the studio cannot fix with a value
 * — a document that does not parse, a role the contract requires and the
 * document does not declare, a value the browser will not take — is a theme
 * that does not build, and that is an ERROR.
 *
 * The worst finding decides: one error among ten warnings is an error.
 */
function severityOf(found: readonly Check[]): Severity | undefined {
  if (found.length === 0) return undefined;
  return found.some((finding) => finding.remedy === undefined)
    ? "error"
    : "warning";
}

/**
 * The shield's own look.
 *
 * The rail's shape: a box the width of the column and a glyph in it. The
 * hover is the rail's hover — the accent, like every other icon — and the
 * badge is what says how bad it is.
 */
const BUTTON =
  "bare peer relative flex h-10 w-full items-center justify-center rounded-md hover:bg-surface hover:text-accent";

export default function Checks(props: {
  /** The rail's tip for this row, drawn by the rail beside every other. */
  readonly tip: JSX.Element;
}) {
  /**
   * The checks on the document being edited.
   *
   * The same analysis the daemon judges the document with, read here so the
   * rail can say whether there is anything to say. A document that does not
   * parse is one finding, not a page: the reason is the finding.
   *
   * Each finding carries what would put it right — the value the token would
   * have to take and which way it has to move — so a finding is an offer
   * rather than a complaint.
   */
  const findings = createMemo(() => checks(themeText()));

  /** How bad the findings are, if there are any. */
  const severity = createMemo(() => severityOf(findings()));

  /** Whether the checks panel is open. */
  const [checksOpen, setChecksOpen] = createSignal(false);

  /**
   * Writes a remedy into the token it belongs to.
   *
   * The finding names the token, so the studio can offer the edit rather
   * than only describe it. The value goes into the slot the finding was
   * measured in — a restatement's fix into that mode, so the value the
   * panel measured is the value the document ends up holding — and the
   * studio's own gate has the last word: an edit that breaks a floor the
   * document used to keep is refused and says why.
   */
  function apply(remedy: Remedy): void {
    // Into the slot the finding was measured in: a dark restatement's fix
    // written into the base would leave the dark value exactly as it was.
    editToken(
      remedy.path.split("."),
      remedy.value,
      remedy.mode === "dark"
        ? "dark"
        : remedy.mode === "light"
        ? "light"
        : "base",
    );
  }

  return (
    <li class="m-0 w-full">
      <button
        type="button"
        data-testid="checks"
        class={`${BUTTON} ${
          severity() === undefined ? "text-text" : INK[severity()!]
        }`}
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
        {
          /*
            The count, as a badge in the findings' own colour.

            It sits at the corner of the row rather than beside the glyph:
            the rail is forty pixels wide and a shield and a number side by
            side do not both fit in it. The badge is the primitive's own, so
            the fill and the ink are the theme's pair — the error's fill with
            the error's ink on it — and not two colours the studio chose.
          */
        }
        <Show when={severity() !== undefined}>
          <badge
            class={`${TONE[severity()!]} badge-sm absolute end-1 top-1`}
          >
            {findings().length}
          </badge>
        </Show>
      </button>
      {props.tip}
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
    </li>
  );
}

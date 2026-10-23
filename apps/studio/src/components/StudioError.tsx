/**
 * The studio's own error boundary.
 *
 * A studio that cannot show you its own error is a studio you cannot trust.
 * The failure that matters most is the one that happens while the studio is
 * talking to the daemon about a document that has just broken — and a blank
 * window tells the author nothing at all: not what broke, not where, and not
 * what to do about it. A white screen is the one answer a tool must never
 * give.
 *
 * So the failure is shown IN the studio, in the studio's own theme and the
 * studio's own words, and the way out is offered: try again, or reload.
 * The chrome around the boundary is still there — the studio is broken, not
 * gone, and the document being edited is still the author's.
 */

import { ErrorBoundary } from "solid-js";
import type { JSX } from "solid-js";

/**
 * The studio's failure panel.
 *
 * The message is the error's own: the studio does not translate what went
 * wrong into a nicer sentence, because a sentence about a failure that is
 * not the failure's own words is a guess. What the studio adds is the way
 * out, and the fact that nothing was lost.
 */
function Failure(props: { error: unknown; reset: () => void }) {
  const message = () =>
    props.error instanceof Error ? props.error.message : String(props.error);
  return (
    <div role="alert" class="stack panel m-4 max-w-[42rem]">
      <h1>The studio hit an error</h1>
      <p class="text-sm text-text-muted">
        The page could not be drawn. The theme being edited is untouched —
        nothing it holds was lost, and the file on disk is as it was.
      </p>
      <pre class="overflow-auto rounded-md bg-surface-sunken text-xs whitespace-pre-wrap">
        {message()}
      </pre>
      <div class="row-sm">
        <button type="button" onClick={() => props.reset()}>
          Try again
        </button>
        <button type="button" onClick={() => location.reload()}>
          Reload the studio
        </button>
      </div>
    </div>
  );
}

/**
 * The boundary around the studio's own work.
 *
 * It wraps the shell's CONTENT rather than the shell itself, so the theme
 * the failure is drawn in is the studio's own — the panel needs the studio's
 * surfaces and ink, and a failure outside the themed shell would be drawn
 * with no theme at all.
 */
export default function StudioError(props: { children: JSX.Element }) {
  return (
    <ErrorBoundary
      fallback={(error, reset) => <Failure error={error} reset={reset} />}
    >
      {props.children}
    </ErrorBoundary>
  );
}

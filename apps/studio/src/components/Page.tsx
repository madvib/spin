import type { JSX } from "solid-js";

/**
 * The frame every full-page concern sits in: its own scroll rail, a column
 * that is centred and padded, and a measure wide enough to read.
 *
 * Padding and centring are not decoration here — a specimen flush against
 * the edge reads as the layout's accident rather than as the thing being
 * shown, and a page that fills any viewport from edge to edge cannot tell
 * you where its own content ends. `wide` is for surfaces that carry stages
 * and charts rather than prose.
 */
export default function Page(props: {
  title: string;
  note: string;
  /** Rooms for a stage instead of a paragraph of prose. */
  wide?: boolean;
  children: JSX.Element;
}) {
  return (
    <div class="drawer-scroll min-h-0 min-w-0 flex-1 overflow-y-auto p-4 sm:p-6">
      <div
        class="stack mx-auto mb-8"
        classList={{
          "max-w-screen-lg": props.wide === true,
          "max-w-screen-md": props.wide !== true,
        }}
      >
        <header class="stack-sm">
          <h1 class="text-3xl font-semibold">{props.title}</h1>
          <p class="text-sm text-text-muted">{props.note}</p>
        </header>
        {props.children}
      </div>
    </div>
  );
}

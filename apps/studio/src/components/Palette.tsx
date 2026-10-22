/**
 * The palette — the named colour roles, as swatches you can read, copy, and
 * change.
 *
 * A palette is a list of colours and a list of names, and a page that draws
 * them as two lists asks the reader to hold one in their head while they look
 * at the other. So each role is ONE thing here: a large swatch, and under it
 * a single line carrying the name and the hex side by side. The line is one
 * line because the name and the hex are the same fact said twice, and a hex
 * on a line of its own is a fact about nothing.
 *
 * The name is never the thing that truncates: it is the short half of the
 * fact and the one that identifies the role, so the value gives way first
 * (a theme that writes `oklch(...)` says more than a column holds) and the
 * whole value is in the title and on the clipboard either way.
 *
 * The hex is a button, because a hex is the one value an author reaches for
 * — into a stylesheet, into a message, into another tool — and reading it off
 * a screen and typing it back is the copy the studio can do for them. It
 * says `copied` when it has, which is the studio's own acknowledgement (the
 * icons page and the component pages say the same word), and it says nothing
 * when the clipboard was refused: a clipboard the page cannot reach is a
 * permission, not a failure, and nothing was copied.
 *
 * The hex is the hex, whatever the document wrote. A theme may spell a
 * colour `oklch(…)`, and a value nobody can paste into a stylesheet is a
 * value they convert by hand every time — so the colour is read as hex
 * (the theme module knows the colour spaces) and the hex is what the
 * clipboard carries. The document's own spelling stays in the title, where
 * the author can still see what the theme says.
 *
 * The swatch is painted with the value the document resolves to, not with a
 * utility: the studio wears its own theme, so a utility here would paint the
 * studio's colour and call it the theme being edited. The value is data,
 * and data is what the swatch shows.
 *
 * A palette is also where a colour is changed. When the page says how, the
 * swatch is the control: a press hands the role to the page's own picker,
 * and the picker holds the value, the floor and the choices.
 */

import { createMemo, createSignal, For, onCleanup, Show } from "solid-js";
import { toHex } from "@spin/theme";
import type { Chip } from "../lib/overview.ts";

export default function Palette(props: {
  /** The roles this theme declares, in palette order. */
  chips: readonly Chip[];
  /** The grid they sit in; the page decides how many across. */
  columns?: string;
  /** How tall a swatch is: the page decides how much room a colour gets. */
  tall?: boolean;
  /**
   * Called with the role's path when a swatch is pressed.
   *
   * A palette that can only be read is half a tool: the page that owns the
   * picker says which role is being edited, and the swatch is the way in.
   */
  onPick?: (path: string) => void;
}) {
  return (
    <div
      class={`grid gap-3 ${props.columns ?? "grid-cols-2 sm:grid-cols-4"}`}
    >
      <For each={props.chips}>
        {(chip) => (
          <Swatch
            chip={chip}
            tall={props.tall === true}
            onPick={props.onPick}
          />
        )}
      </For>
    </div>
  );
}

/**
 * One role: the colour, and the name and the hex on one line under it.
 *
 * The swatch is the role's own value, resolved from the document, and it is
 * marked as decoration: the name and the hex beside it are what a reader
 * needs, and a colour with no name is not an announcement.
 */
function Swatch(props: {
  chip: Chip;
  tall: boolean;
  onPick?: (path: string) => void;
}) {
  const swatch = (
    <span
      class={`block w-full rounded-md border border-border ${
        props.tall ? "h-24" : "h-16"
      }`}
      style={{ background: props.chip.value }}
      title={`${props.chip.label} ${props.chip.value}`}
      aria-hidden="true"
    />
  );
  return (
    <figure class="stack-sm">
      <Show
        when={props.onPick}
        fallback={swatch}
      >
        <button
          type="button"
          // `bare`: a swatch is a colour, not a control with a fill of its
          // own — the button's own paint would frame every colour in the
          // palette with the theme's primary.
          class="bare block w-full cursor-pointer text-left"
          title={`Edit ${props.chip.label}`}
          aria-label={`Edit ${props.chip.label}`}
          onClick={() => props.onPick?.(props.chip.path)}
        >
          {swatch}
        </button>
      </Show>
      <figcaption class="flex items-baseline gap-2">
        <span class="shrink-0 text-sm font-medium text-text">
          {props.chip.label}
        </span>
        <Hex value={props.chip.value} />
      </figcaption>
    </figure>
  );
}

/**
 * The hex, as a control.
 *
 * `bare` and nothing else: the control is chrome, so it wears no paint of
 * its own, and the ink is spelled because the opt-out takes `color: inherit`
 * with it — a bare button left to the user agent would be white on a light
 * page. The word it shows when it has copied is the studio's own.
 *
 * What it shows and what it copies is the hex — the colour read as hex,
 * whatever the document wrote — because the hex is the value an author
 * reaches for. A value that is not a colour at all (a reference the caller
 * failed to resolve) is shown as it stands: there is no hex to give.
 */
export function Hex(props: { value: string }) {
  const [copied, setCopied] = createSignal(false);
  let copiedFor: ReturnType<typeof globalThis.setTimeout> | undefined;
  const hex = createMemo(() => toHex(props.value) ?? props.value);

  async function copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(hex());
    } catch {
      // A clipboard the page cannot reach is a permission, not a failure to
      // report over a word: nothing was copied, so nothing is claimed.
      return;
    }
    setCopied(true);
    clearTimeout(copiedFor);
    copiedFor = globalThis.setTimeout(() => setCopied(false), 1200);
  }

  onCleanup(() => clearTimeout(copiedFor));

  return (
    <button
      type="button"
      class="bare min-w-0 shrink cursor-pointer justify-start text-left font-mono text-xs text-text-muted hover:text-text"
      title={props.value}
      aria-label={`Copy ${hex()}`}
      onClick={() => void copy()}
    >
      <Show
        when={copied()}
        fallback={
          /*
            The value truncates when the column is narrow — a theme that
            writes `oklch(...)` says more than fits — and the span is what
            truncates: a bare button is a flex box, and text-overflow does
            not reach the items of one.
          */
          <span class="min-w-0 truncate">{hex()}</span>
        }
      >
        <span class="shrink-0 truncate">
          <span class="i-lucide-check icon-sm" aria-hidden="true" /> copied
        </span>
      </Show>
    </button>
  );
}

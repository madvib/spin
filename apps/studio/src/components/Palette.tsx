/**
 * The palette — the named colour roles, as swatches you can read and copy.
 *
 * A palette is a list of colours and a list of names, and a page that draws
 * them as two lists asks the reader to hold one in their head while they look
 * at the other. So each role is ONE thing here: a large swatch, and under it
 * a single line carrying the name on the left and the hex on the right. The
 * line is one line because the name and the hex are the same fact said twice,
 * and a hex on a line of its own is a fact about nothing.
 *
 * The hex is a button, because a hex is the one value an author reaches for
 * — into a stylesheet, into a message, into another tool — and reading it off
 * a screen and typing it back is the copy the studio can do for them. It
 * says `copied` when it has, which is the studio's own acknowledgement (the
 * icons page and the component pages say the same word), and it says nothing
 * when the clipboard was refused: a clipboard the page cannot reach is a
 * permission, not a failure, and nothing was copied.
 *
 * The swatch is painted by the token's own utility, so it wears the theme
 * being edited rather than a colour the page chose; the hex beside it is the
 * same token resolved from the document. The two are the same fact from two
 * directions, and a theme whose paint and whose text disagree shows it here.
 */

import { createSignal, For, onCleanup, Show } from "solid-js";
import type { Chip } from "../lib/overview.ts";

export default function Palette(props: {
  /** The roles this theme declares, in palette order. */
  chips: readonly Chip[];
  /** The grid they sit in; the page decides how many across. */
  columns?: string;
  /** How tall a swatch is: the page decides how much room a colour gets. */
  tall?: boolean;
}) {
  return (
    <div
      class={`grid gap-3 ${props.columns ?? "grid-cols-2 sm:grid-cols-4"}`}
    >
      <For each={props.chips}>
        {(chip) => <Swatch chip={chip} tall={props.tall === true} />}
      </For>
    </div>
  );
}

/**
 * One role: the colour, and the name and the hex on one line under it.
 *
 * The swatch is the role's own utility — `bg-primary` for the primary — so
 * the colour on screen is the theme's answer rather than the page's copy of
 * it, and it is marked as decoration: the name and the hex beside it are
 * what a reader needs, and a colour with no name is not an announcement.
 */
function Swatch(props: { chip: Chip; tall: boolean }) {
  return (
    <figure class="stack-sm">
      <span
        class={`block w-full rounded-md border border-border ${
          props.tall ? "h-24" : "h-16"
        } ${props.chip.paint}`}
        title={`${props.chip.label} ${props.chip.value}`}
        aria-hidden="true"
      />
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
 */
function Hex(props: { value: string }) {
  const [copied, setCopied] = createSignal(false);
  let copiedFor: ReturnType<typeof globalThis.setTimeout> | undefined;

  async function copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(props.value);
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
      aria-label={`Copy ${props.value}`}
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
          <span class="min-w-0 truncate">{props.value}</span>
        }
      >
        <span class="shrink-0 truncate">
          <span class="i-lucide-check icon-sm" aria-hidden="true" /> copied
        </span>
      </Show>
    </button>
  );
}

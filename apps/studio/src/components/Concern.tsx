import { Show } from "solid-js";
import type { JSX } from "solid-js";
import { inDrawer } from "../lib/host.ts";
import { refusalFor } from "../lib/store.ts";

/**
 * The furniture every concern page is built from.
 *
 * The overview is the model. It opens with a name and one line saying what
 * the page is for; it marks a section with a bar in the acting colour and
 * carries the fact the section holds on the right; it shows a token as its
 * path beside its value; and it frames a figure in a card, so a figure reads
 * as a figure and not as part of the page around it.
 *
 * These pieces are written down here so the pages that EDIT a concern are
 * made of the same vocabulary as the page that SHOWS it — and so the
 * vocabulary lives in one place instead of in five copies of the same three
 * class strings.
 *
 * The colour means something, and the meanings are the theme's own:
 *
 * - `primary` is the acting colour: the specimen under edit, a scale's
 *   bars, the control that is on.
 * - `accent` is the thing in play: the step a reader has chosen, the curve
 *   being dragged, the family that is not the page's subject.
 * - the semantic colours are statuses, and only statuses: a role the theme
 *   owes and has not declared is an error, a token a component wants and
 *   the theme has never spelled is a warning.
 * - `on-*` is the ink ON a fill, and it is only ever used on a fill: the
 *   theme says what reads on its own colours, and the page asks.
 */

/**
 * The frame a concern page sits in.
 *
 * The overview's frame: the page's own scroll rail, a column that is
 * centred and padded, and a measure wide enough for a table of tokens to
 * sit in. The pane's paper is the project's, because its ink is — a header
 * reading `text-text` on the chrome's surface only agrees by luck.
 */
export function ConcernPage(props: {
  title: string;
  /** One line, in plain words: what the page is for. */
  note: string;
  children: JSX.Element;
}) {
  return (
    <div
      class={inDrawer()
        ? "drawer-flow bg-surface p-4 sm:p-6"
        : "drawer-scroll overflow-y-auto bg-surface p-4 sm:p-6"}
    >
      <div class="mx-auto stack-lg max-w-screen-lg">
        <header class="stack-sm">
          <h1>{props.title}</h1>
          <p class="max-w-screen-md text-sm text-text-muted">{props.note}</p>
        </header>
        {props.children}
      </div>
    </div>
  );
}

/**
 * A section on a concern page.
 *
 * The marker is a bar in the acting colour — the same mark the component
 * pages put beside an example's name — and it says "a section starts here"
 * in the one place on the page where a reader looks for it. The fact on the
 * right says what the section holds, so the shape of what follows is known
 * before it is read.
 */
export function Section(props: {
  title: string;
  /** The fact the section carries: how many steps, how many curves. */
  fact?: string;
  /** One line: what the section is for. */
  note?: string;
  /**
   * The colour the section's family wears.
   *
   * A page that holds two kinds of token says so with the colours: the
   * subject wears the acting colour and the other family wears the accent,
   * so the reader knows which set of tokens the section is about before the
   * first row is read.
   */
  tone?: "primary" | "accent";
  /** A control that belongs to the section, on the right of its heading. */
  aside?: JSX.Element;
  children: JSX.Element;
}) {
  return (
    <section class="stack-sm" aria-label={props.title}>
      <div class="split">
        <h2 class="row-sm">
          <Marker tone={props.tone} />
          <span class="min-w-0">{props.title}</span>
        </h2>
        <div class="row-sm shrink-0">
          <Show when={props.fact}>
            <span class="text-sm text-text-muted">{props.fact}</span>
          </Show>
          {props.aside}
        </div>
      </div>
      <Show when={props.note}>
        <p class="max-w-screen-md text-sm text-text-muted">{props.note}</p>
      </Show>
      {props.children}
    </section>
  );
}

/**
 * The colours a marker can wear, and the classes each one wears.
 *
 * Written out rather than composed: the scanner reads source text, so a
 * class name assembled at runtime is a class nothing generates.
 */
const MARKERS: Record<string, string> = {
  primary: "bg-primary",
  accent: "bg-accent",
};

/**
 * The bar that marks a section.
 *
 * The acting colour and nothing else. It says "this is a section", and it
 * is the one mark the studio puts in the same place on every page, so a
 * reader who knows one page knows all of them.
 */
export function Marker(props: { tone?: "primary" | "accent" }) {
  return (
    <span
      class={`block h-1 w-4 shrink-0 rounded-full ${
        MARKERS[props.tone ?? "primary"] ?? ""
      }`}
      aria-hidden="true"
    />
  );
}

/**
 * The frame a figure stands in.
 *
 * A raised card, the way the overview frames a concern: the figure is not
 * part of the page around it, and the card is what says so.
 */
export function Frame(props: { children: JSX.Element; class?: string }) {
  return (
    <div
      class={`rounded-lg border border-border bg-surface-raised p-4 ${
        props.class ?? ""
      }`}
    >
      {props.children}
    </div>
  );
}

/**
 * One line of a token table.
 *
 * The columns are the same on every table the concern pages draw: the
 * token's path, the utility an author writes, and the editor that changes
 * it. The first two are FIXED widths, so the columns line up down the table
 * and the eye reads a column rather than a row — and the editor follows the
 * name instead of being pushed to the far edge of a wide page, which is what
 * a stretched row is: a name at one end and a control at the other with
 * nothing in between. The editor may SHRINK, so a row whose control is
 * wider than the page wraps inside itself rather than pushing the page
 * sideways — a page that scrolls sideways in a drawer is a page the reader
 * cannot widen.
 */
export function TokenLine(props: {
  path: string;
  /** The utility an author writes, when the family spends one. */
  utility?: string;
  editor: JSX.Element;
}) {
  return (
    <li class="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border py-3 last:border-b-0">
      <code class="w-[10rem] shrink-0 truncate">
        {props.path}
      </code>
      <Show when={props.utility}>
        <code class="w-[7rem] shrink-0 truncate">
          {props.utility}
        </code>
      </Show>
      <div class="min-w-0">{props.editor}</div>
      {
        /* A refused value is said where the value was asked for. The banner
          at the top of the work says what the studio last refused; a reader
          scrolled to a token halfway down a page is not looking at it, and
          the message they need is the one beside the control they hold. */
      }
      <Show when={refusalFor(props.path)}>
        {(message) => (
          <p class="w-full text-xs text-semantic-error" role="alert">
            {message()}
          </p>
        )}
      </Show>
    </li>
  );
}

/**
 * The tones a badge can wear, and the classes each one wears.
 *
 * Written out rather than composed: the scanner reads source text, so a
 * class name assembled at runtime is a class nothing generates.
 */
const TONES: Record<string, string> = {
  primary: "bg-primary text-on-primary",
  accent: "bg-accent text-on-accent",
  warning: "bg-semantic-warning text-on-semantic-warning",
  error: "bg-semantic-error text-on-semantic-error",
  info: "bg-semantic-info text-on-semantic-info",
};

/**
 * A status, as a pill.
 *
 * The fill says what the status is and the ink on it is the theme's own
 * answer for what reads on that fill — so a badge is legible in a theme
 * that has never been looked at, and a theme that changes its palette
 * changes the badge with it.
 */
export function Badge(props: {
  tone: "primary" | "accent" | "warning" | "error" | "info";
  children: JSX.Element;
}) {
  return (
    <span
      class={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
        TONES[props.tone] ?? ""
      }`}
    >
      {props.children}
    </span>
  );
}

/**
 * A token, as a chip: its path beside its value.
 *
 * The path is the token's name and the value is what it is worth now; the
 * two are one fact, so they share a line and one chip. The chip is a raised
 * surface with a hairline — the studio's own small chip, the one the count
 * beside a component's name wears — because a token is a fact on the page
 * rather than a control, and the value is the half that gives way when the
 * column is narrow: the path is what identifies the token.
 *
 * The two halves are spans and not `code` elements: the theme draws inline
 * code on a surface of its own, and a chip that carried one would have two
 * fills inside it and read as two things.
 *
 * The chip's own air is the theme's nearest named step. `py-0.5` and
 * `px-1.5` are half steps the scale does not declare, so they generate no
 * CSS at all and the chip would have had no padding whatsoever; the named
 * steps stand in, and the chip is a little more open than the half steps
 * would have made it.
 */
export function TokenChip(props: { path: string; value: string }) {
  return (
    <span class="inline-flex max-w-full items-baseline gap-2 rounded-sm border border-border bg-surface-raised px-1 py-1">
      <span class="truncate font-mono text-xs text-text-muted">
        {props.path}
      </span>
      <span class="shrink-0 font-mono text-xs text-text">{props.value}</span>
    </span>
  );
}

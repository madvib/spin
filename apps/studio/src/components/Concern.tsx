import { createMemo, Show } from "solid-js";
import type { JSX } from "solid-js";
import { inDrawer } from "../lib/host.ts";
import { tokenStatus } from "../lib/live-edit.ts";
import {
  activeMode,
  activeName,
  refusalFor,
  registry,
  themeText,
} from "../lib/store.ts";

/**
 * The section furniture is the product's, not the studio's: `@spinjs/kit`
 * exports the marked heading, the note and the fact on the right, and the
 * docs and the reference app read the same component. The pages here import
 * them from this module so a concern page reads as one vocabulary.
 */
export { Marker, Section } from "@spinjs/kit";

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
  note?: string;
  /** Optional header action beside the page title. */
  action?: JSX.Element;
  children: JSX.Element;
}) {
  return (
    <div
      data-studio-chrome=""
      class={inDrawer()
        ? "drawer-flow bg-surface p-4 sm:p-6"
        : "drawer-scroll overflow-y-auto bg-surface p-4 sm:p-6"}
    >
      <div class="mx-auto stack-lg max-w-screen-lg">
        <header class="stack-sm">
          <div class="split">
            <h1>{props.title}</h1>
            {props.action}
          </div>
          {props.note ? <p class="max-w-screen-md text-sm text-text-muted">{props.note}</p> : null}
        </header>
        {props.children}
      </div>
    </div>
  );
}

/**
 * The frame a figure stands in.
 *
 * A raised card, the way the overview frames a concern: the figure is not
 * part of the page around it, and the card is what says so. The surface, the
 * corner, the edge and the air are the card primitive's decisions, so the
 * studio does not restate them.
 */
export function Frame(props: { children: JSX.Element; class?: string }) {
  const hasPad = () => /\bp[xytrbl]?-\d|\bp-\[/.test(props.class ?? "");
  return (
    <card
      data-studio-specimen=""
      class={`${hasPad() ? "" : "p-4"} ${props.class ?? ""}`.trim()}
    >
      {props.children}
    </card>
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
  /** Optional inline specimen or bar rendered between the label and the control. */
  specimen?: JSX.Element;
  editor: JSX.Element;
}) {
  const projectText = () =>
    registry()?.find((theme) => theme.name === activeName())?.text;
  const status = createMemo(() =>
    tokenStatus(themeText(), projectText(), props.path, activeMode())
  );
  return (
    <li data-studio-chrome="" class="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border py-3 last:border-b-0">
      <div class="row-sm min-w-[10rem] shrink-0">
        <code class="truncate">
          {props.path}
        </code>
        <Show when={status().aliasOf}>
          {(target) => (
            <span class="inline-flex items-center">
              <span
                tabindex="0"
                class="rounded-sm bg-surface-sunken px-1 py-1 font-mono text-xs text-text-muted"
              >
                → {target()}
              </span>
              <tooltip class="start-0 translate-none">
                Points at {target()}
              </tooltip>
            </span>
          )}
        </Show>
        <Show when={activeMode() === "dark" && status().restatedInDark}>
          <span class="inline-flex items-center">
            <span
              tabindex="0"
              class="rounded-sm bg-surface-sunken px-1 py-1 font-mono text-xs text-accent"
            >
              dark
            </span>
            <tooltip class="start-0 translate-none">
              Overridden in dark mode
            </tooltip>
          </span>
        </Show>
        <Show when={status().modified}>
          <span class="inline-flex items-center">
            <span
              tabindex="0"
              class="rounded-sm bg-surface-sunken px-1 py-1 font-mono text-xs text-primary"
            >
              edited
            </span>
            <tooltip class="start-0 translate-none">
              Modified in this session
            </tooltip>
          </span>
        </Show>
      </div>
      <Show when={props.utility}>
        <code class="w-[7rem] shrink-0 truncate">
          {props.utility}
        </code>
      </Show>
      <Show when={props.specimen}>
        <div data-studio-specimen="" class="min-w-[8rem] flex-1">{props.specimen}</div>
      </Show>
      <div class="ms-auto min-w-0">{props.editor}</div>
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
 * A status, as a pill.
 *
 * The primitive's own badge, with the studio's tone names mapped onto the
 * variants the theme declares. The fill, the ink on it, the radius and the
 * padding are the badge's decisions — the studio does not restate them, so a
 * theme that changes its palette changes every status in the tool.
 */
const TONE_VARIANTS = {
  primary: "primary",
  accent: "accent",
  warning: "warning",
  error: "danger",
  info: "info",
} as const;

export function Badge(props: {
  tone: keyof typeof TONE_VARIANTS;
  children: JSX.Element;
}) {
  return (
    <badge variant={TONE_VARIANTS[props.tone]} class="shrink-0">
      {props.children}
    </badge>
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

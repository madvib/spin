import {
  createEffect,
  createMemo,
  createSignal,
  For,
  onCleanup,
  Show,
} from "solid-js";
import { SECTIONS, utilitiesFor } from "@spin/preset/organization.ts";
import {
  describeCatalog,
  primitiveCategories,
  primitiveElements,
} from "@spin/preset";
import { parseTokens } from "@spin/theme";
import { starterThemes, themeModes } from "@spin/theme/themes";
import { MontagePage } from "./montage.tsx";
import { PRIMITIVES } from "./primitives.ts";
import { MONTAGE_ROUTE } from "./routes.ts";
import { THEMES } from "./themes.ts";
import { UtilitiesLanding, UtilitiesPage } from "./utilities.tsx";

import type { CatalogSection } from "@spin/preset";
import type { Accessor } from "solid-js";
import type { TokenTree } from "@spin/theme";

/**
 * The glyph each element wears, keyed by the element's name.
 *
 * The taxonomy lives with the elements it files, in the preset: the studio's
 * rail and the docs' gallery read the same one, so a row cannot be drawn
 * here with one glyph and drawn elsewhere with another.
 */
const ICONS: Readonly<Record<string, string>> = Object.fromEntries(
  primitiveElements.map((element) => [element.name, element.icon]),
);

let themeTree: TokenTree | undefined;
function themeTreeOrParse(): TokenTree {
  if (themeTree === undefined) {
    const parsed = parseTokens(
      starterThemes.silk as unknown as Parameters<typeof parseTokens>[0],
    );
    if (!parsed.ok) throw new Error(parsed.error);
    themeTree = parsed.tree;
  }
  return themeTree;
}

function useTheme() {
  const [theme, setTheme] = createSignal(
    localStorage.getItem("spin-theme") ?? "silk",
  );
  const doc = () =>
    (starterThemes as unknown as Record<string, unknown>)[theme()] as never;
  const modes = () => [...themeModes(doc())];
  // The mode the theme actually serves, in preference order: a theme with no
  // dark group has one rendering, so it never reads "dark"; a theme whose
  // base is light never reads "system" as dark-first.
  const resolved = (requested: string): string => {
    if (requested === "system") {
      return modes().includes("dark")
        ? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "base")
        : "base";
    }
    if (requested === "dark" && !modes().includes("dark")) return "base";
    if (requested === "light") return "base";
    return requested === "base" ? "base" : requested;
  };
  const [want, setWant] = createSignal(
    localStorage.getItem("spin-mode") ?? "system",
  );
  // A theme switch can strand the want: neobrut never serves dark, so a
  // reader arriving from a dark default theme with "dark" wanted must land
  // on its base instead of a mode that renders nothing different.
  const wantFor = (t: string): string => {
    const stored = t === theme()
      ? localStorage.getItem("spin-mode") ?? "system"
      : "system";
    const m = [...themeModes(
      (starterThemes as unknown as Record<string, unknown>)[t] as never,
    )];
    if (stored === "dark" && !m.includes("dark")) return "base";
    return stored;
  };
  const wrappedSetTheme = (t: string) => {
    setTheme(t);
    setWant(wantFor(t));
  };
  const mode = () => resolved(want());
  const setMode = (next: string) => setWant(next);
  createEffect(() => {
    document.documentElement.dataset.theme = theme();
    document.documentElement.dataset.mode = mode();
    localStorage.setItem("spin-theme", theme());
    localStorage.setItem("spin-mode", want());
  });
  // The platform preference is live: a reader on "system" whose OS flips
  // must see the page follow without touching the control again.
  createEffect(() => {
    const mql = matchMedia("(prefers-color-scheme: dark)");
    const sync = () => setWant((w) => w);
    mql.addEventListener("change", sync);
    onCleanup(() => mql.removeEventListener("change", sync));
  });
  return { theme, setTheme: wrappedSetTheme, mode, setMode, want, modes };
}

/**
 * The utilities/primitives/themes switch, and the specimen's segmented
 * toggle. Both are one shape: a bordered group, where unselected is a hole —
 * transparent edge, transparent fill, muted ink — so the selected one is the
 * only thing drawn: raised surface, strong edge, full ink and a step of
 * weight. A hover that painted the text token would put text on text in
 * console, where that token is a mint slab rather than ink, so hover moves
 * the edge only.
 *
 * `min-h-0` drops the height floor the button primitive puts under every
 * bare control: a segmented switch is chrome, not a call to action, and the
 * floor that makes a button comfortable to press makes a toolbar two rows
 * taller than its labels.
 */
const SURFACE_LINK =
  "flex-1 min-h-0 justify-center rounded-md border border-solid border-transparent bg-transparent px-2 py-1 font-mono text-xs font-regular normal-case tracking-normal text-text-muted not-italic shadow-none cursor-pointer hover:border-border-strong aria-[current]:border-border-strong aria-[current]:bg-surface-raised aria-[current]:text-text aria-[current]:font-medium";

/** The group either switch or toggle is drawn in. */
const SEGMENT_GROUP =
  "flex shrink-0 gap-1 rounded-md border border-solid border-border p-1";

/**
 * The quiet rail row every entry shares: a hole until it is current, at which
 * point the surface is raised, the edge answers and the ink is full. The
 * button fills the tile it is given — a hit target that stops at the end of
 * the word is a hit target a reader has to aim at, so the state paints the
 * whole row rather than the glyph and the text.
 *
 * The rows of both surfaces wear the same tile: a primitive and a section are
 * the same kind of thing to a reader looking for one, and a rail that styled
 * them differently would be a rail that explained its taxonomy instead of its
 * contents.
 *
 * `justify-start` and `text-left` re-state what the button primitive
 * centers: a bare `<button>` packs its contents to the middle, and a rail row
 * that floats its glyph and label in the middle of the tile is a rail that
 * looks sloppy in a column this narrow — the glyph should start at the tile's
 * own edge, the way the utilities side already reads. The state still paints
 * the whole tile; only where the glyph sits changes.
 */
const RAIL_LINK =
  "flex w-full items-center gap-2 justify-start ghost rounded-md border border-solid border-transparent bg-transparent p-2 text-left text-sm font-regular normal-case tracking-normal text-text-muted not-italic shadow-none cursor-pointer hover:bg-surface-raised hover:text-text aria-[current]:border-border-strong aria-[current]:bg-surface-raised aria-[current]:text-text aria-[current]:font-medium";

/**
 * The band a run of rows is bucketed into.
 *
 * A heading outranks the rows under it: a size that is the same or larger, a
 * heavier weight, and full ink rather than the muted step — a rail whose
 * group titles are SMALLER than its members reads as one flat list of
 * unrelated things, and one whose titles are quieter reads as a caption over
 * the very things it captains. The air above is a bigger step than the air
 * below, so the heading belongs to its group rather than to the rail.
 *
 * The padding is a step wider than the row's own, so the band hangs over the
 * column of tiles instead of hiding in it: a band that is indented exactly as
 * far as its rows does not read as their title.
 */
const RAIL_BAND =
  "mt-4 mb-2 flex items-center gap-2 px-2 py-1 text-md font-semibold normal-case tracking-normal text-text first:mt-0";

/**
 * The heading over the rail's list.
 *
 * It outranks the group bands beneath it, which outrank the rows beneath those:
 * three levels of rail, three distinct sizes. A list heading the same size as
 * its own groups reads as one band among many, and a rail whose hierarchy is
 * flat is a rail you have to read end to end.
 */
const RAIL_HEAD =
  "mb-2 flex items-center gap-2 px-2 pt-3 text-lg font-bold normal-case tracking-normal text-text first:mt-0";

/** What the rail says when the search has left it nothing to say. */
const RAIL_EMPTY = "px-2 py-1 text-xs text-text-muted";

/**
 * The glyph beside a page title: the small step in ink, so it supports the
 * heading rather than competing with it. Sized in `em` by the theme, like
 * every other glyph.
 */
const TITLE_ICON = "icon-sm mt-1 shrink-0 text-text-muted";

/**
 * The sub-heading every section of a page carries. Same rule as the rail's:
 * never smaller than the items under it, so the size matches the prose it
 * captains and the hierarchy is carried by weight and ink alone.
 */
const SUBHEAD =
  "mt-8 mb-2 text-md font-semibold normal-case tracking-normal text-text first:mt-0";

/**
 * The spin mark: a spinnaker in full hoist.
 *
 * A spinnaker is the balloon sail — a rounded head at the tack, a long curve
 * out to the clew, a straight luff back down to the throat. The shape is the
 * whole mark, so it is drawn as that: one filled path for the cloth, one line
 * for the luff that keeps it reading as a sail rather than a blob.
 *
 * It animates on hover only. A brand that moves on its own is a brand that
 * competes with the page for attention — a loader's job — so at rest it is
 * still, and the pointer asking about it is what fills the cloth. The wind is
 * the theme's own motion tokens, so a theme with no motion ships a mark that
 * simply doesn't animate.
 */
function BrandMark() {
  return (
    <svg
      class="block h-[1.25rem] w-[1.25rem] shrink-0 text-primary"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        class="fill-current"
        d="M5 4 C 12 4 19 9 20 20 L 5 20 Z"
      />
      <path
        class="stroke-current"
        d="M5 4 L5 20"
        stroke-width="1.25"
        stroke-linecap="round"
        fill="none"
      />
    </svg>
  );
}

/**
 * The search field the rail is filtered through, and the input in it: one
 * line, an icon and a box, and no chrome beyond the field itself.
 */
const SEARCH_FIELD =
  "flex min-w-0 items-center gap-2 rounded-md border border-solid border-border bg-field px-2 py-1 text-xs";
// The field primitive pads and borders every `<input>` it claims, so a
// control inside a chrome of its own is a box within a box: the input spends
// its border and its padding here, and the field it sits in supplies both.
const SEARCH_INPUT =
  "w-full border-transparent bg-transparent p-0 text-xs text-text";

/** The theme picker: a real form control, named by the label that wraps it. */
const SELECT_LABEL = "shrink-0 text-xs font-medium text-text-muted";
const SELECT =
  "min-w-0 flex-1 rounded-md border border-solid border-border bg-field px-2 py-1 text-xs text-text";

/** The copy, within the revealed block: it acts on the code beside it. */
const COPY_BUTTON =
  "absolute end-2 top-2 inline-flex min-h-0 items-center gap-1 rounded-md border border-solid border-border bg-surface-raised px-2 py-1 font-mono text-xs font-medium normal-case tracking-normal text-text-muted not-italic shadow-none cursor-pointer hover:border-border-strong hover:text-text";

/** The quiet way out of a specimen: a link-shaped button. */
const QUIET_BUTTON =
  "self-start inline-flex min-h-0 items-center gap-1 rounded-md border border-solid border-transparent bg-transparent px-2 py-1 font-mono text-xs font-medium normal-case tracking-normal text-text-muted not-italic shadow-none cursor-pointer hover:border-border-strong hover:text-text";

/**
 * The panel every specimen sits in: ONE box, one surface, and only as much
 * room as the thing in it needs.
 *
 * The padding is the page's own step, not a full measure of it. A demo panel
 * is a stage, and a stage the size of a page turns every component into a
 * slab of nothing: the specimen is the subject, the panel is the floor it
 * stands on, and the floor should not compete. Tall content — a table, a
 * dialog — still gets its room by the panel growing, never by the padding.
 */
const SPECIMEN_PANEL =
  "min-h-16 rounded-md border border-dashed border-solid border-border bg-surface p-6 shadow-sm";

/**
 * The code block of a specimen. It is ALWAYS in the flow — never a box the
 * component is laid over — so the section's height is decided by measurement
 * rather than by whichever view happens to be showing.
 *
 * It WRAPS. A code block's chrome belongs to the document column it sits in,
 * so a bare `<pre>` here brings its own: `overflow-x` is what let an
 * example's inline data URI — a 4KB face as one unbroken token — widen the
 * page to seven thousand pixels instead of scrolling in its own box: a
 * scroller only contains what it is GIVEN, and a min-content chain with one
 * unbreakable line refuses to shrink. So the block takes
 * `whitespace-pre-wrap` and the tokens `break-all`, and the scrollbar has
 * nothing left to do — it stays as the floor for the one line that somehow
 * still cannot break.
 */
const CODE_PRE =
  "max-w-full whitespace-pre-wrap overflow-x-auto rounded-md border border-dashed border-solid border-border bg-surface p-4 font-mono text-text shadow-sm";

/** The measure a specimen's content is set at. */
const SPECIMEN_MEASURE = "max-w-md [--spacing-16:12rem]";

/**
 * One token of example markup, as the code viewer reads it.
 *
 * Self-contained on purpose: the reference demonstrates the styling surface,
 * so a syntax highlighter from a dependency would be a second stylesheet the
 * theme cannot reach. The tokenizer is a single pass over the string and
 * nothing else — no grammar, no recovery, no recursion.
 */
type CodeTokenType =
  | "tag"
  | "attr"
  | "string"
  | "comment"
  | "punct"
  | "text";

interface CodeToken {
  readonly type: CodeTokenType;
  readonly value: string;
}

const WHITESPACE = /\s/;
const NAME_STOP = /[\s=/>]/;

/**
 * Example HTML, tokenized: tags, attribute names, string values, comments and
 * the text between them. Everything the markup spells is preserved exactly,
 * whitespace included, because the code view is the markup a consumer copies.
 */
function tokenizeHtml(html: string): CodeToken[] {
  const out: CodeToken[] = [];
  const push = (type: CodeTokenType, value: string) => {
    if (value !== "") out.push({ type, value });
  };
  let i = 0;
  while (i < html.length) {
    const lt = html.indexOf("<", i);
    if (lt === -1) {
      push("text", html.slice(i));
      break;
    }
    if (lt > i) push("text", html.slice(i, lt));
    // A comment runs to its close, or to the end of the document.
    if (html.startsWith("<!--", lt)) {
      const end = html.indexOf("-->", lt + 4);
      const stop = end === -1 ? html.length : end + 3;
      push("comment", html.slice(lt, stop));
      i = stop;
      continue;
    }
    // A declaration (`<!doctype html>`) is read as one opaque run.
    if (html.startsWith("<!", lt)) {
      const end = html.indexOf(">", lt);
      const stop = end === -1 ? html.length : end + 1;
      push("comment", html.slice(lt, stop));
      i = stop;
      continue;
    }
    // The opening bracket is a token of its own. Without it the view read
    // `div class=…>` — a tag with no bracket, and a closer with no bracket at
    // all — so every `<`, `/` and `>` the markup spells is spent as punct.
    push("punct", "<");
    i = lt + 1;
    if (html[i] === "/") {
      push("punct", "/");
      i += 1;
    }
    let end = i;
    while (
      end < html.length && !WHITESPACE.test(html[end]!) && html[end] !== ">" &&
      html[end] !== "/"
    ) {
      end += 1;
    }
    push("tag", html.slice(i, end));
    i = end;
    while (i < html.length) {
      const ch = html[i]!;
      if (ch === ">") {
        push("punct", ">");
        i += 1;
        break;
      }
      if (ch === "/" && html[i + 1] === ">") {
        push("punct", "/>");
        i += 2;
        break;
      }
      if (WHITESPACE.test(ch)) {
        let stop = i;
        while (stop < html.length && WHITESPACE.test(html[stop]!)) stop += 1;
        push("text", html.slice(i, stop));
        i = stop;
        continue;
      }
      if (ch === "/") {
        push("punct", "/");
        i += 1;
        continue;
      }
      let attrEnd = i;
      while (attrEnd < html.length && !NAME_STOP.test(html[attrEnd]!)) {
        attrEnd += 1;
      }
      push("attr", html.slice(i, attrEnd));
      i = attrEnd;
      if (html[i] === "=") {
        push("punct", "=");
        i += 1;
        const quote = html[i];
        if (quote === '"' || quote === "'") {
          const close = html.indexOf(quote, i + 1);
          const stop = close === -1 ? html.length : close + 1;
          push("string", html.slice(i, stop));
          i = stop;
        } else {
          // An unquoted value runs to the whitespace or the bracket.
          let stop = i;
          while (
            stop < html.length && !WHITESPACE.test(html[stop]!) &&
            html[stop] !== ">"
          ) {
            stop += 1;
          }
          push("string", html.slice(i, stop));
          i = stop;
        }
      }
    }
  }
  return out;
}

/**
 * Example markup, formatted for the code view.
 *
 * The examples are data — written to be read beside a rule, not by a
 * formatter — so they arrive with the indentation of the template literals
 * they were pieced together in: ten spaces of air before every variant, a
 * closing tag at column eight. The code view is the markup a consumer copies,
 * so it shows that markup as a consumer would write it: nested tags indented
 * one step per depth, runs of blank lines collapsed to a single break, and a
 * tag with more than two attributes spelled one attribute per line, so the
 * parts are visible instead of a wall.
 *
 * It is FORMATTING, not rewriting. The only text replaced is whitespace the
 * markup does not need; every tag, attribute name, attribute value and word
 * of content survives exactly as authored. Content whose whitespace IS its
 * meaning — a `<pre>`, a `<textarea>` — is copied through untouched, and text
 * that spells anything never moves onto a line of its own.
 */
const FORMAT_INDENT = "  ";

/** Tags whose content is whitespace: never re-indented, never re-flowed. */
const VERBATIM_TAGS: Record<string, true> = {
  pre: true,
  textarea: true,
  listing: true,
};

/** Tags that never take a close. */
const VOID_TAGS: Record<string, true> = {
  area: true,
  base: true,
  br: true,
  col: true,
  embed: true,
  hr: true,
  img: true,
  input: true,
  link: true,
  meta: true,
  param: true,
  source: true,
  track: true,
  wbr: true,
};

interface FormatElement {
  readonly kind: "element";
  readonly tag: string;
  readonly attrs: readonly (readonly [string, string | undefined])[];
  readonly children: FormatNode[];
  readonly selfClose: boolean;
  /** The raw inside of a verbatim element, copied through as authored. */
  raw?: string;
}

interface FormatText {
  readonly kind: "text";
  readonly text: string;
}

interface FormatRaw {
  readonly kind: "raw";
  readonly text: string;
}

type FormatNode = FormatElement | FormatText | FormatRaw;

/**
 * Example HTML, parsed into a tree shallow enough to re-indent and no
 * deeper: an element, the text, and the two kinds of run that are copied
 * whole (comments and declarations). A close that matches nothing on the
 * stack is kept as raw text rather than guessed at.
 */
function parseForFormat(html: string): FormatNode[] {
  const roots: FormatNode[] = [];
  const stack: FormatElement[] = [];
  const parentChildren = (): FormatNode[] =>
    stack.length === 0 ? roots : stack[stack.length - 1]!.children;
  let i = 0;
  while (i < html.length) {
    const lt = html.indexOf("<", i);
    if (lt === -1) {
      parentChildren().push({ kind: "text", text: html.slice(i) });
      break;
    }
    if (lt > i) {
      parentChildren().push({ kind: "text", text: html.slice(i, lt) });
    }
    if (html.startsWith("<!--", lt)) {
      const end = html.indexOf("-->", lt + 4);
      const stop = end === -1 ? html.length : end + 3;
      parentChildren().push({ kind: "raw", text: html.slice(lt, stop) });
      i = stop;
      continue;
    }
    if (html.startsWith("<!", lt)) {
      const end = html.indexOf(">", lt);
      const stop = end === -1 ? html.length : end + 1;
      parentChildren().push({ kind: "raw", text: html.slice(lt, stop) });
      i = stop;
      continue;
    }
    if (html.startsWith("</", lt)) {
      const end = html.indexOf(">", lt);
      const stop = end === -1 ? html.length : end + 1;
      const name = html.slice(lt + 2, stop - 1).trim().toLowerCase();
      // The close matches the OPENEST copy on the stack from the top down:
      // a nested `<div>` closes itself, not its ancestor of the same name.
      let match = -1;
      for (let s = stack.length - 1; s >= 0; s--) {
        if (stack[s]!.tag.toLowerCase() === name) {
          match = s;
          break;
        }
      }
      if (match !== -1) {
        stack.length = match;
      } else {
        parentChildren().push({ kind: "raw", text: html.slice(lt, stop) });
      }
      i = stop;
      continue;
    }
    // An open tag: the name, then the attributes — quoted, unquoted, or bare.
    i = lt + 1;
    let nameEnd = i;
    while (
      nameEnd < html.length && !WHITESPACE.test(html[nameEnd]!) &&
      html[nameEnd] !== ">" && html[nameEnd] !== "/"
    ) {
      nameEnd += 1;
    }
    const tag = html.slice(i, nameEnd);
    i = nameEnd;
    const attrs: [string, string | undefined][] = [];
    let selfClose = false;
    while (i < html.length) {
      const ch = html[i]!;
      if (WHITESPACE.test(ch)) {
        i += 1;
        continue;
      }
      if (ch === ">") {
        i += 1;
        break;
      }
      if (ch === "/") {
        if (html[i + 1] === ">") {
          selfClose = true;
          i += 2;
          break;
        }
        i += 1;
        continue;
      }
      let attrEnd = i;
      while (attrEnd < html.length && !NAME_STOP.test(html[attrEnd]!)) {
        attrEnd += 1;
      }
      const name = html.slice(i, attrEnd).toLowerCase();
      i = attrEnd;
      if (html[i] !== "=") {
        attrs.push([name, undefined]);
        continue;
      }
      i += 1;
      const quote = html[i];
      if (quote === '"' || quote === "'") {
        const close = html.indexOf(quote, i + 1);
        const stop = close === -1 ? html.length : close + 1;
        attrs.push([name, html.slice(i, stop)]);
        i = stop;
      } else {
        let stop = i;
        while (
          stop < html.length && !WHITESPACE.test(html[stop]!) &&
          html[stop] !== ">"
        ) {
          stop += 1;
        }
        attrs.push([name, stop > i ? `"${html.slice(i, stop)}"` : undefined]);
        i = stop;
      }
    }
    const element: FormatElement = {
      kind: "element",
      tag,
      attrs,
      children: [],
      selfClose,
    };
    parentChildren().push(element);
    const lower = tag.toLowerCase();
    if (!selfClose && VOID_TAGS[lower] !== true) {
      if (VERBATIM_TAGS[lower] === true) {
        const close = html.toLowerCase().indexOf(`</${lower}`, i);
        const stop = close === -1 ? html.length : close;
        element.raw = html.slice(i, stop);
        if (close !== -1) {
          const gt = html.indexOf(">", close);
          i = gt === -1 ? html.length : gt + 1;
        }
      } else {
        stack.push(element);
      }
    }
  }
  return roots;
}

/**
 * One open tag: the attributes on one line when there are two or fewer, one
 * per line — indented a step past the tag — when there are more, so a long
 * value has its own line instead of ploughing through its neighbours.
 */
function formatOpenTag(
  tag: string,
  attrs: readonly (readonly [string, string | undefined])[],
  depth: number,
): string {
  const spelled = attrs.map(([name, value]) =>
    value === undefined ? name : `${name}=${value}`
  );
  if (spelled.length > 2) {
    const pad = FORMAT_INDENT.repeat(depth + 1);
    return `<${tag}\n${spelled.map((s) => `${pad}${s}`).join("\n")}\n${
      FORMAT_INDENT.repeat(depth)
    }`;
  }
  return `<${tag}${spelled.length === 0 ? "" : ` ${spelled.join(" ")}`}`;
}

function formatNode(node: FormatNode, depth: number): string {
  if (node.kind === "text" || node.kind === "raw") return node.text;
  const pad = FORMAT_INDENT.repeat(depth);
  const open = formatOpenTag(node.tag, node.attrs, depth);
  if (node.raw !== undefined) return `${pad}${open}>${node.raw}</${node.tag}>`;
  const close = node.selfClose ? "/>" : `</${node.tag}>`;
  if (node.children.length === 0) {
    return VOID_TAGS[node.tag.toLowerCase()] === true
      ? `${pad}${open}${node.selfClose ? "/>" : ">"}`
      : `${pad}${open}>${close}`;
  }
  // Text that spells anything keeps its element on one line: breaking
  // `Press <kbd>Enter</kbd> to submit.` across four lines would put the
  // formatter's indentation INSIDE the sentence.
  const inline = node.children.some(
    (c) => c.kind === "text" && !/^\s*$/.test(c.text),
  );
  if (inline) {
    const inner = node.children.map((c) => formatNode(c, 0)).join("");
    return `${pad}${open}>${inner}${close}`;
  }
  const body = node.children
    .filter((c) => c.kind !== "text" || !/^\s*$/.test(c.text))
    .map((c) => formatNode(c, depth + 1))
    .join("\n");
  return `${pad}${open}>\n${body}\n${pad}${close}`;
}

/**
 * Example HTML, formatted. Idempotent: formatting what was formatted
 * changes nothing, because it replaces whitespace-only runs and nothing
 * else.
 */
function formatExampleHtml(html: string): string {
  // Roots that are only elements break between siblings; a root that spells
  // text keeps its neighbours on the same line, because a newline a
  // formatter adds beside text is text the markup did not have.
  const roots = parseForFormat(html).filter(
    (n) => n.kind !== "text" || !/^\s*$/.test(n.text),
  );
  const inline = roots.some((n) => n.kind === "text");
  return roots.map((n) => formatNode(n, 0)).join(inline ? "" : "\n");
}

/**
 * The ink each token of the code viewer wears.
 *
 * Every one is a theme token and every one was MEASURED against the panel it
 * sits on, in all three starter themes and both modes: the hues that read as
 * syntax in one palette are illegible in another — `semantic-success` is a
 * 3.3:1 slab on neobrut's white — so this is the set that clears 4.5:1
 * everywhere rather than the set that looks most like someone else's editor.
 * Tag and attribute are the two that carry the structure, so they take the
 * two brand inks; a string is the one value a reader copies, and the muted
 * step is the ink comments and punctuation are written in.
 */
const CODE_INK: Readonly<Record<CodeTokenType, string>> = {
  tag: "text-semantic-error",
  attr: "text-primary",
  string: "text-semantic-warning",
  comment: "text-text-muted",
  punct: "text-text-muted",
  text: "text-text",
};

/**
 * The three specimens the landing shows. Each is the example that shows the
 * most of the component at once — the variants, every part, the whole tone
 * set.
 */
const FEATURED: readonly string[] = ["button", "card", "alert"];

/**
 * One example of one primitive: the component, or its markup — one or the
 * other, never both. A stacked pair put the markup between every two
 * specimens, which turns a page of components into a page of code with
 * components in the gaps; the toggle puts the choice where it belongs, on the
 * specimen, and leaves the page a single surface at a time.
 *
 * The two views are TWO BOXES, not two surfaces over one box — an overlay
 * preview had to clip, because the panel could only be as tall as the code
 * that framed it. Both live in the flow now, in the SAME cell of a one-cell
 * grid: the cell is as tall as the taller of the two, so the section reserves
 * the max of the code's height and the component's, the view that is not
 * showing is `invisible` — out of sight, still in flow — and switching tabs
 * moves nothing under the reader. Neither view scrolls inside its own box
 * and neither is ever clipped: the tall specimens are the ones a reader most
 * needs all of, so the page grows to fit them.
 */
function ExampleSection(props: {
  name: string;
  html: string;
  onLoad?: string;
}) {
  let pre!: HTMLPreElement;
  const [tab, setTab] = createSignal<"component" | "code">("component");
  const [copied, setCopied] = createSignal(false);
  createEffect(() => {
    if (props.onLoad) new Function(props.onLoad)();
  });
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(pre.textContent ?? "");
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable: no-op */
    }
  };
  // The panel decides the room the specimen gets, and the markup says which
  // room it is: a page header is a page-width thing, and the md measure —
  // where the page's own prose reads — squeezes a header until its trail
  // wraps into a column of links. Everything else reads at the measure.
  const measure = props.html.trimStart().startsWith("<header")
    ? ""
    : SPECIMEN_MEASURE;
  const tokens = createMemo(() => tokenizeHtml(formatExampleHtml(props.html)));
  return (
    <section class="mb-8">
      <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 class="m-0 flex items-center gap-2 text-sm font-semibold text-text">
          <span class="block h-1 w-4 rounded-full bg-primary" />
          {props.name}
        </h3>
        <div class={SEGMENT_GROUP}>
          <button
            type="button"
            onClick={() => setTab("component")}
            aria-current={tab() === "component" || undefined}
            class={SURFACE_LINK}
          >
            <i class="i-lucide-eye icon-md" />
            component
          </button>
          <button
            type="button"
            onClick={() => setTab("code")}
            aria-current={tab() === "code" || undefined}
            class={SURFACE_LINK}
          >
            <i class="i-lucide-code-xml icon-md" />
            code
          </button>
        </div>
      </div>
      <div class="relative grid">
        {
          /* The face the code reads at is spent on the tokens, not on the
            block: a bare `<pre>` is claimed by the primitive layer, which
            pins the block's own size, so the step a reader sees is the one the
            text carries. This is also the step that makes the specimens
            bigger — the code reads a size up from the demos around it, and
            `break-all` spends the theme's break on the one token that is
            wider than the view: a 4KB data URI has no space in it, and a
            token that cannot break is a token that widens the page. */
        }
        <pre
          ref={pre}
          class={`${CODE_PRE} col-start-1 row-start-1 ${
            tab() === "code" ? "" : "invisible"
          }`}
          aria-hidden={tab() === "code" ? undefined : "true"}
        >
          <span class="text-lg break-all">
            <For each={tokens()}>
              {(token) => (
                <span class={CODE_INK[token.type]}>{token.value}</span>
              )}
            </For>
          </span>
        </pre>
        <button type="button" onClick={copy} class={COPY_BUTTON}>
          <i class="i-lucide-copy icon-md" />
          {copied() ? "copied" : "copy"}
        </button>
        {
          /* The demo is the markup exactly as a consumer writes it, in the
            flow beside the code rather than over it: the same cell, the same
            surface, the same edges — so the visible view is the whole box
            and the swap is a change of content and not a change of page. */
        }
        <div
          class={`${SPECIMEN_PANEL} col-start-1 row-start-1 ${
            tab() === "component" ? "" : "invisible"
          }`}
          aria-hidden={tab() === "component" ? undefined : "true"}
        >
          <div class={measure} innerHTML={props.html} />
        </div>
      </div>
    </section>
  );
}

function PrimitivePage(props: { id: string; onLoad?: string }) {
  const fixture = createMemo(() => PRIMITIVES.find((r) => r.id === props.id));
  return (
    <Show when={fixture()} fallback={<p>Not found</p>}>
      {(f) => (
        <>
          <header class="mb-8 flex items-start justify-between gap-4">
            <div class="flex items-start gap-2">
              <i class={`${ICONS[f().id]} ${TITLE_ICON}`} />
              <div>
                <h2 class="m-0 text-2xl font-bold tracking-tight">
                  {f().title}
                </h2>
                <div class="font-mono text-xs text-text-muted">
                  {f().kind}
                </div>
              </div>
            </div>
            <span class="shrink-0 rounded-full border border-solid border-border bg-surface-raised px-2 py-1 font-mono text-xs text-text-muted">
              {f().examples.length} examples
            </span>
          </header>
          <p class="mb-8 max-w-screen-md text-md text-text-muted">
            {f().note}
          </p>
          <For each={[...f().examples]}>
            {(e) => (
              <ExampleSection
                name={e.name}
                html={e.html}
                onLoad={f().onLoad ?? props.onLoad}
              />
            )}
          </For>
        </>
      )}
    </Show>
  );
}

/** Every primitive, by id, for the index rows. */
const PAGE_BY_ID: Record<string, (typeof PRIMITIVES)[number]> = Object
  .fromEntries(PRIMITIVES.map((p) => [p.id, p]));

/** One specimen on the landing: a component, as a consumer writes it. */
function FeaturedSpecimen(props: { id: string }) {
  const page = PAGE_BY_ID[props.id];
  return (
    <section class="flex min-w-0 flex-col gap-2">
      <div class="flex items-center gap-2">
        <i class={`${ICONS[props.id]} icon-md text-text-muted`} />
        <h4 class="m-0 text-sm font-semibold text-text">{page.title}</h4>
      </div>
      <div class={SPECIMEN_PANEL}>
        <div class={SPECIMEN_MEASURE} innerHTML={page.examples[0].html} />
      </div>
      <button
        type="button"
        onClick={() => (location.hash = `#/components/${props.id}`)}
        class={QUIET_BUTTON}
      >
        <i class="i-lucide-arrow-right icon-md" />
        open {page.title.toLowerCase()}
      </button>
    </section>
  );
}

/**
 * One row of the landing's index: the glyph, the name, the count. Alphabetical,
 * because a reader looking for a name scans a sorted list rather than a
 * taxonomy they have to learn first — and a filing is an opinion about where a
 * component belongs, which is a decision the reference has no business making
 * on a reader's behalf.
 */
function IndexRow(props: { id: string }) {
  const page = PAGE_BY_ID[props.id];
  return (
    <button
      type="button"
      onClick={() => (location.hash = `#/components/${props.id}`)}
      class="flex w-full items-center gap-2 rounded-md border border-solid border-border bg-surface-raised p-2 text-left shadow-sm hover:border-border-strong"
    >
      <i
        class={`${ICONS[props.id]} icon-md shrink-0 text-text-muted`}
      />
      <span class="min-w-0 flex-1 truncate text-sm text-text">
        {page.title}
      </span>
      <span class="shrink-0 font-mono text-xs text-text-muted">
        {page.examples.length}
      </span>
    </button>
  );
}

/**
 * The landing.
 *
 * Not a menu: the rail is the navigable list and it is on screen at the same
 * time, so a landing that repeats it is the same menu twice. What a landing
 * can say that a rail cannot is what the thing IS — the mark, the line it
 * stands for, three specimens to look at, and the index a reader scans.
 */
function LandingPage() {
  const components = createMemo(() =>
    [...PRIMITIVES].sort((a, b) => a.title.localeCompare(b.title))
  );
  return (
    <>
      <header class="mb-8">
        <div class="flex items-center gap-3">
          <BrandMark />
          <h2 class="m-0 text-2xl font-bold tracking-tight">Primitives</h2>
        </div>
        <div class="font-mono text-xs text-text-muted">
          spin reference · {PRIMITIVES.length} components
        </div>
        <p class="mt-4 max-w-screen-md text-md text-text-muted">
          A verification layer and primitives for agent-authored UI. The tag is
          the component and the theme is the only value source: nothing in this
          app carries a color, a space or a radius that is not a token.
        </p>
      </header>

      <section class="mb-8">
        <h3 class={SUBHEAD}>Specimens</h3>
        <p class="mb-4 max-w-screen-md text-sm text-text-muted">
          Three of the{" "}
          {PRIMITIVES.length}, rendered from the markup a consumer writes — no
          wrapper, no adapter, the rules beside the rule they came from.
        </p>
        <div class="grid grid-cols-3 gap-4">
          <For each={FEATURED}>
            {(id) => <FeaturedSpecimen id={id} />}
          </For>
        </div>
      </section>

      <section class="mb-8">
        <h3 class={SUBHEAD}>Index</h3>
        <p class="mb-4 max-w-screen-md text-sm text-text-muted">
          Every component, alphabetical, with the number of examples each one
          carries.
        </p>
        <div class="grid grid-cols-3 gap-2">
          <For each={components()}>
            {(page) => <IndexRow id={page.id} />}
          </For>
        </div>
      </section>
    </>
  );
}

/**
 * The header: the brand, and the two controls that choose the look — the theme
 * and the mode. Sticky at the top of the SIDEBAR, not above the page: the
 * look is the rail's own control, and a top bar would spend the page's width
 * on chrome that only ever touches the rail.
 *
 * The search is NOT here. It filters the rail's list, so it lives in the rail,
 * in its own row above the list it filters — a filter that sits in the header
 * is a filter that looks like it applies to the page.
 *
 * Every row is one line and one control. The taller a sticky block is, the
 * more of the rail it covers while the rail scrolls under it, so the chrome is
 * the compact thing here and the list is the prominent one.
 *
 * The brand is a lockup rather than a control: the mark and the wordmark sit
 * in their own row with a real step of air above and below, and there is no
 * button wrapper around them. The wordmark used to be a click target that went
 * home, but the rail's list is the navigation and a reader who clicks a logo
 * to get back has to aim at a 74-pixel target in the corner of a 224-pixel
 * column. A word that cannot be clicked is a word that can be given room.
 */
function AppHeader(props: {
  theme: Accessor<string>;
  setTheme: (theme: string) => void;
  mode: Accessor<string>;
  setMode: (mode: string) => void;
  want: Accessor<string>;
  modes: Accessor<readonly string[]>;
}) {
  // The cycle the reader walks: light -> dark -> system. A theme with one
  // rendering disables the control rather than cycling to somewhere that
  // does not exist: an enabled switcher on neobrut promises a dark
  // rendering neobrut never ships.
  const single = () => props.modes().length <= 1;
  const next = (): string => {
    const want = props.want();
    if (single()) return want;
    return want === "light" ? "dark" : want === "dark" ? "system" : "light";
  };
  const glyph = (): string => {
    if (single()) return "i-lucide-minus icon-md";
    const want = props.want();
    if (want === "light") return "i-lucide-sun icon-md";
    if (want === "dark") return "i-lucide-moon icon-md";
    return "i-lucide-monitor icon-md";
  };
  const label = (): string => {
    if (single()) return "This theme serves one mode";
    const want = props.want();
    if (want === "light") return "Use dark mode";
    if (want === "dark") return "Follow the system";
    return "Use light mode";
  };
  return (
    <div class="sticky top-0 z-dropdown -mx-4 -mt-4 mb-2 flex flex-col gap-1 border-b border-solid border-border bg-surface px-4 pt-2 pb-2">
      <div class="flex items-center gap-2 py-4">
        <BrandMark />
        <span class="text-lg font-bold tracking-tight text-text">spin</span>
      </div>
      <div class="flex items-center gap-2">
        <label class="flex min-w-0 flex-1 items-center gap-1">
          <span class={SELECT_LABEL}>theme</span>
          <select
            class={SELECT}
            onChange={(event) => props.setTheme(event.currentTarget.value)}
          >
            <For each={THEMES}>
              {(t) => (
                <option value={t} selected={t === props.theme()}>
                  {t}
                </option>
              )}
            </For>
          </select>
        </label>
        <button
          type="button"
          class="mode"
          onClick={() => props.setMode(next())}
          aria-label={label()}
          title={label()}
          disabled={single() || undefined}
          aria-disabled={single() || undefined}
        >
          <i class={glyph()} />
        </button>
      </div>
    </div>
  );
}

/**
 * One row of the rail, whichever side it came from.
 *
 * The two sides are the same thing to a reader looking for one — a place to go
 * — so they are the same row here, and the only difference is what each one
 * carries: a component has the glyph that names it, a section has the number
 * of utilities it draws. Building the union once means the rail has ONE row
 * renderer rather than two that drift.
 */
interface RailRow {
  readonly id: string;
  readonly title: string;
  readonly icon?: string;
  readonly count?: number;
}

/**
 * The rail: the header, the side switch, the search that filters the list, and
 * the list itself — bucketed into bands. Everything the rail does to narrow
 * the list is in the rail: a filter that lived in the header was a filter that
 * looked like it applied to the page.
 *
 * A row the search empties is hidden rather than drawn as a heading over
 * nothing, and the count tells the reader what the filter did without their
 * having to compare against what they remember.
 */
function Rail(props: {
  route: Accessor<string>;
  query: Accessor<string>;
  setQuery: (query: string) => void;
  catalog: Accessor<readonly CatalogSection[]>;
  theme: Accessor<string>;
  setTheme: (theme: string) => void;
  mode: Accessor<string>;
  setMode: (mode: string) => void;
  want: Accessor<string>;
  modes: Accessor<readonly string[]>;
}) {
  const needle = createMemo(() => props.query().trim().toLowerCase());
  const utilities = () => props.route().startsWith("/utilities");
  // The montage is a page of the app, not a surface of components: it holds
  // every theme side by side, so the rail's list has nothing to say about it
  // and the switch is the only thing that moves.
  const montage = () => props.route().startsWith(MONTAGE_ROUTE);

  const components = createMemo(() =>
    PRIMITIVES.filter((page) => page.title.toLowerCase().includes(needle()))
      .sort((a, b) => a.title.localeCompare(b.title))
  );

  const sections = createMemo(() =>
    SECTIONS.filter((s) => s.title.toLowerCase().includes(needle()))
  );

  const shown = () => utilities() ? sections().length : components().length;
  const total = () => utilities() ? SECTIONS.length : PRIMITIVES.length;

  const byId = createMemo(
    () => new Map(components().map((page) => [page.id, page])),
  );

  /**
   * The groups. The primitives side is grouped by what a reader came for —
   * inputs, actions, containers — because a letter bucket is a filing
   * convention rather than a way to find anything. The utilities side keeps
   * its own section titles, which are already groups.
   */
  const groups = createMemo<
    readonly {
      readonly label: string;
      readonly count?: number;
      readonly rows: readonly RailRow[];
    }[]
  >(() =>
    utilities()
      ? sections().map((sec) => ({
        label: sec.title,
        count: utilitiesFor(sec, props.catalog()).length,
        // A utility is a token's spelling — `bg-primary`, `p-2` — and has no
        // page of its own, so a rail row per utility is a column of links
        // that go nowhere.
        rows: [],
      }))
      : primitiveCategories
        .map((cat) => ({
          label: cat.label,
          rows: primitiveElements
            .filter((element) => element.category === cat.id)
            .map((element) => byId().get(element.name))
            .filter((page) => page !== undefined)
            .map((page) => ({
              id: page.id,
              title: page.title,
              icon: ICONS[page.id],
            })),
        }))
        .filter((group) => group.rows.length > 0)
  );

  return (
    <nav class="sticky top-0 flex h-screen w-[16rem] shrink-0 flex-col border-e border-solid border-border">
      <div class="shrink-0 px-4 pt-4 pb-3">
        <AppHeader
          theme={props.theme}
          setTheme={props.setTheme}
          mode={props.mode}
          setMode={props.setMode}
          want={props.want}
          modes={props.modes}
        />
        <div class={SEGMENT_GROUP}>
          <button
            type="button"
            onClick={() => (location.hash = "#/utilities")}
            aria-current={utilities() || undefined}
            class={SURFACE_LINK}
          >
            utilities
          </button>
          <button
            type="button"
            onClick={() => (location.hash = "#/components")}
            aria-current={!utilities() && !montage() || undefined}
            class={SURFACE_LINK}
          >
            primitives
          </button>
          <button
            type="button"
            onClick={() => (location.hash = `#${MONTAGE_ROUTE}`)}
            aria-current={montage() || undefined}
            class={SURFACE_LINK}
          >
            themes
          </button>
        </div>
        <Show when={!montage()}>
          <label class={SEARCH_FIELD}>
            <i class="i-lucide-search icon-sm shrink-0 text-text-muted" />
            <input
              type="search"
              value={props.query()}
              onInput={(event) => props.setQuery(event.currentTarget.value)}
              aria-label="Filter the rail"
              class={SEARCH_INPUT}
            />
          </label>
        </Show>
      </div>
      <div class="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        <div class={RAIL_HEAD}>
          <span>
            {montage() ? "themes" : utilities() ? "sections" : "components"}
          </span>
          <span class="font-mono text-xs font-regular">
            {montage()
              ? `${THEMES.length}`
              : needle() === ""
              ? `${total()}`
              : `${shown()} of ${total()}`}
          </span>
        </div>
        <Show
          when={!montage() && groups().length > 0}
          fallback={
            <p class={RAIL_EMPTY}>
              {montage()
                ? "Every starter theme, side by side. The page compares them."
                : `No ${
                  utilities() ? "section" : "component"
                } matches “${props.query()}”.`}
            </p>
          }
        >
          <For each={groups()}>
            {(group) => (
              <>
                {
                  /*
                  A group with no rows IS its row: the utilities side
                  navigates by section, and a section's name is the thing you
                  click.
                */
                }
                <Show when={group.rows.length === 0}>
                  <button
                    type="button"
                    onClick={() => (location.hash =
                      `#/utilities/${group.label.toLowerCase()}`)}
                    aria-current={routeSection(props.route()) ===
                        group.label.toLowerCase() || undefined}
                    class={RAIL_LINK}
                  >
                    <span class="min-w-0 truncate">{group.label}</span>
                    <span class="ms-auto shrink-0 font-mono text-xs text-text-muted">
                      {group.count}
                    </span>
                  </button>
                </Show>
                <Show when={group.rows.length > 0}>
                  <div class={RAIL_BAND}>{group.label}</div>
                </Show>
                <For each={group.rows}>
                  {(row) => {
                    const current = () =>
                      utilities()
                        ? routeSection(props.route()) === row.id
                        : props.route() === `/components/${row.id}`;
                    return (
                      <button
                        type="button"
                        onClick={() => (location.hash = `#/${
                          utilities() ? "utilities" : "components"
                        }/${row.id}`)}
                        aria-current={current() || undefined}
                        class={RAIL_LINK}
                      >
                        <Show when={row.icon !== undefined}>
                          <i class={`${row.icon} icon-md`} />
                        </Show>
                        <span class="min-w-0 truncate">{row.title}</span>
                        <Show when={row.count !== undefined}>
                          <span class="ms-auto shrink-0 font-mono text-xs text-text-muted">
                            {row.count}
                          </span>
                        </Show>
                      </button>
                    );
                  }}
                </For>
              </>
            )}
          </For>
        </Show>
      </div>
    </nav>
  );
}

/**
 * The section a utilities route names, or the empty string for the bare one —
 * a bare route is a question ("what is on this side"), the first section is
 * not an answer to it, and the landing is.
 */
function routeSection(route: string): string {
  const parts = route.split("/");
  if (parts[1] !== "utilities") return "";
  return parts[2] ?? "";
}

export default function App() {
  const { theme, setTheme, mode, setMode, want, modes } = useTheme();
  const [query, setQuery] = createSignal("");
  const [route, setRoute] = createSignal(
    location.hash.slice(1) || "/components",
  );
  createEffect(() => {
    const onHash = () => setRoute(location.hash.slice(1) || "/components");
    addEventListener("hashchange", onHash);
    return () => removeEventListener("hashchange", onHash);
  });
  const catalog = createMemo(() => describeCatalog(themeTreeOrParse()));

  const primitiveId = createMemo(() => {
    const parts = route().split("/");
    return parts[1] === "components" && (parts[2] ?? "") !== ""
      ? parts[2]
      : undefined;
  });
  const utilities = createMemo(() => route().startsWith("/utilities"));
  const sectionId = createMemo(() => routeSection(route()));
  const montage = createMemo(() => route().startsWith(MONTAGE_ROUTE));
  const landing = createMemo(
    () => primitiveId() === undefined && !utilities() && !montage(),
  );

  return (
    <div class="flex min-h-screen bg-surface">
      {
        /*
        `min-w-0` on the wrapper and not only on `main`: the wrapper is the
        flex item, and a flex item's automatic minimum size is its
        min-content — which, with one unbreakable line of markup anywhere
        below, was the whole page width. The specimen's pre wraps now, but
        the column that holds it has to be ALLOWED to shrink. */
      }
      <div class="flex min-w-0 flex-1 items-start">
        <Rail
          route={route}
          query={query}
          setQuery={setQuery}
          catalog={catalog}
          theme={theme}
          setTheme={setTheme}
          mode={mode}
          setMode={setMode}
          want={want}
          modes={modes}
        />
        <main class="min-w-0 flex-1 p-8 pb-16">
          <Show when={primitiveId()} keyed>
            {(id) => <PrimitivePage id={id} />}
          </Show>
          <Show when={landing()}>
            <LandingPage />
          </Show>
          <Show when={utilities()}>
            <Show when={sectionId() !== ""} fallback={<UtilitiesLanding />}>
              <UtilitiesPage group={sectionId()} />
            </Show>
          </Show>
          <Show when={montage()}>
            <MontagePage />
          </Show>
        </main>
      </div>
    </div>
  );
}

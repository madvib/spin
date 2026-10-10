import { createEffect, createMemo, createSignal, For, Show } from "solid-js";
import { SECTIONS, utilitiesFor } from "@spin/preset/organization.ts";
import { describeCatalog } from "@spin/preset";
import { parseTokens } from "@spin/theme";
import { starterThemes } from "@spin/theme/themes";
import { PRIMITIVE_ICONS, PRIMITIVES } from "./primitives.ts";
import { UtilitiesLanding, UtilitiesPage } from "./utilities.tsx";

import type { CatalogSection } from "@spin/preset";
import type { Accessor } from "solid-js";
import type { TokenTree } from "@spin/theme";

const THEMES = Object.keys(starterThemes);

let themeTree: TokenTree | undefined;
function themeTreeOrParse(): TokenTree {
  if (themeTree === undefined) {
    const parsed = parseTokens(
      starterThemes.default as unknown as Parameters<typeof parseTokens>[0],
    );
    if (!parsed.ok) throw new Error(parsed.error);
    themeTree = parsed.tree;
  }
  return themeTree;
}

function useTheme() {
  const [theme, setTheme] = createSignal(
    localStorage.getItem("spin-theme") ?? "default",
  );
  const [mode, setMode] = createSignal(
    localStorage.getItem("spin-mode") ?? "base",
  );
  createEffect(() => {
    document.documentElement.dataset.theme = theme();
    document.documentElement.dataset.mode = mode();
    localStorage.setItem("spin-theme", theme());
    localStorage.setItem("spin-mode", mode());
  });
  return { theme, setTheme, mode, setMode };
}

/**
 * The utilities/primitives switch, and the specimen's segmented toggle. Both
 * are one shape: a bordered group of two, where unselected is a hole —
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
 */
const RAIL_LINK =
  "flex w-full items-center gap-2 rounded-md border border-solid border-transparent bg-transparent p-2 text-sm font-regular normal-case tracking-normal text-text-muted not-italic shadow-none cursor-pointer hover:bg-surface-raised hover:text-text aria-[current]:border-border-strong aria-[current]:bg-surface-raised aria-[current]:text-text aria-[current]:font-medium";

/**
 * The heading over the rail's list.
 *
 * A heading outranks the rows under it: a size that is the same or larger, a
 * heavier weight, and full ink rather than the muted step — a rail whose
 * group titles are SMALLER than its members reads as one flat list of
 * unrelated things, and one whose titles are quieter reads as a caption over
 * the very things it captains. The air above is a bigger step than the air
 * below, so the heading belongs to its group rather than to the header.
 */
const RAIL_HEAD =
  "mt-8 mb-2 flex items-center gap-2 px-2 text-md font-semibold normal-case tracking-normal text-text first:mt-0";

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
 * The brand mark: a small orbit — a ring, and one dot sweeping it continuously
 * on the theme's own motion scale, because `animate-spin` spends
 * `--motion-duration-slow` rather than naming a number. A theme moves every
 * animation by moving the scale, and this one moves with them.
 *
 * The ink is the brand hue and nothing else: `text-primary` is the one color
 * the mark is allowed, and it is the color the focus ring already spends, so
 * the mark is the product's own hue rather than a second opinion about it.
 *
 * Motion is decoration: the reduced-motion clamp in the preflight sets
 * `animation-duration: 0.01ms !important` and `animation-iteration-count: 1
 * !important` on every element, which stops the sweep without this component
 * re-deciding anything.
 */
function BrandMark() {
  return (
    <span
      class="relative block h-[1.25rem] w-[1.25rem] shrink-0"
      aria-hidden="true"
    >
      <i class="absolute inset-0 rounded-full border border-solid border-primary" />
      <i class="absolute inset-0 animate-spin flex items-start justify-center">
        <i class="block h-1 w-1 rounded-full bg-primary" />
      </i>
    </span>
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

/** The mode switch: one button, one icon, and the label it answers to. */
const ICON_BUTTON =
  "inline-flex min-h-0 shrink-0 items-center justify-center rounded-md border border-solid border-border bg-surface-raised p-1 text-sm text-text-muted shadow-none cursor-pointer hover:border-border-strong hover:text-text";

/** The copy, within the revealed block: it acts on the code beside it. */
const COPY_BUTTON =
  "absolute end-2 top-2 inline-flex min-h-0 items-center gap-1 rounded-md border border-solid border-border bg-surface-raised px-2 py-1 font-mono text-xs font-medium normal-case tracking-normal text-text-muted not-italic shadow-none cursor-pointer hover:border-border-strong hover:text-text";

/** The quiet way out of a specimen: a link-shaped button. */
const QUIET_BUTTON =
  "self-start inline-flex min-h-0 items-center gap-1 rounded-md border border-solid border-transparent bg-transparent px-2 py-1 font-mono text-xs font-medium normal-case tracking-normal text-text-muted not-italic shadow-none cursor-pointer hover:border-border-strong hover:text-text";

/**
 * The panel a specimen is demoed in. The largest spacing step is three steps
 * tall so a demo's own fixed-height scroller (`h-16`) has something to
 * scroll, and the panel is the scroller for anything taller still — so the
 * padding went up a step, because a demonstration with a hairline of air
 * around it reads as a screenshot rather than as a surface.
 *
 * The fill is the page's own surface rather than the raised step: the code
 * view beside it is a `<pre>`, and a bare `pre` is claimed by the primitive
 * layer, which pins its background to the same surface — so the two views of
 * one specimen are the same paper, and swapping between them changes the
 * content and nothing else.
 */
const SPECIMEN_PANEL =
  "min-h-16 max-h-screen overflow-auto rounded-md border border-dashed border-solid border-border bg-surface p-8 shadow-sm";
const SPECIMEN_MEASURE = "max-w-md [--spacing-16:12rem]";

/**
 * The code block of a specimen. It is ALWAYS in the flow — it is the element
 * that decides the height of the specimen's box — so the component view is
 * laid over the same box instead of replacing it and switching between the
 * two cannot move the page under the reader.
 *
 * The declarations that the primitive layer already pins on a bare `<pre>`
 * are still spelled here — the padding, the radius, the ink — because a class
 * that names what it means survives the day the pin is lifted, and a panel
 * that relied on a rule it cannot see is a panel that breaks silently.
 */
const CODE_PRE =
  "max-w-full overflow-x-auto rounded-md border border-dashed border-solid border-border bg-surface p-4 font-mono text-text shadow-sm";

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
        }
      }
    }
  }
  return out;
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
 * The two views are not two boxes. The code is always in the flow and the
 * component is laid over the very same box, so the panel's height is decided
 * once and switching tabs cannot move the page under the reader — a viewer
 * that reflows on every toggle is a viewer that loses your place.
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
  const tokens = createMemo(() => tokenizeHtml(props.html.trim()));
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
      <div class="relative">
        {
          /* The face the code reads at is spent on the tokens, not on the
            block: a bare `<pre>` is claimed by the primitive layer, which
            pins the block's own size, so the step a reader sees is the one the
            text carries. This is also the step that makes the specimens
            bigger — the code reads a size up from the demos around it. */
        }
        <pre ref={pre} class={CODE_PRE}>
          <span class="text-md">
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
          /* The demo is the markup exactly as a consumer writes it, laid over
            the code's box: the same panel, the same surface, the same edges,
            so the swap is a change of content and not a change of page. */
        }
        <Show when={tab() === "component"}>
          <div class={`${SPECIMEN_PANEL} absolute inset-0`}>
            <div class={measure} innerHTML={props.html} />
          </div>
        </Show>
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
              <i class={`${PRIMITIVE_ICONS[f().id]} ${TITLE_ICON}`} />
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
        <i class={`${PRIMITIVE_ICONS[props.id]} icon-md text-text-muted`} />
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
        class={`${PRIMITIVE_ICONS[props.id]} icon-md shrink-0 text-text-muted`}
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
 * The header: the brand, the search that filters the rail, and the controls
 * that choose the look. Sticky at the top of the SIDEBAR, not above the page:
 * the filters are the rail's controls, and a top bar would spend the page's
 * width on chrome that only ever touches the rail.
 *
 * Every row is one line and one control. The taller a sticky block is, the
 * more of the rail it covers while the rail scrolls under it, so the chrome is
 * the compact thing here and the list is the prominent one.
 */
function AppHeader(props: {
  route: Accessor<string>;
  theme: Accessor<string>;
  setTheme: (theme: string) => void;
  mode: Accessor<string>;
  setMode: (mode: string) => void;
  query: Accessor<string>;
  setQuery: (query: string) => void;
}) {
  const utilities = () => props.route().startsWith("/utilities");
  const dark = () => props.mode() === "dark";
  return (
    <div class="sticky top-0 z-dropdown -mx-4 -mt-4 mb-2 flex flex-col gap-1 border-b border-solid border-border bg-surface px-4 pt-2 pb-2">
      <div class="flex items-center gap-2">
        <button
          type="button"
          onClick={() => (location.hash = "#/components")}
          class="flex min-h-0 min-w-0 items-center gap-2 rounded-md border border-solid border-transparent bg-transparent px-1 py-0 text-text shadow-none cursor-pointer hover:border-border-strong"
        >
          <BrandMark />
          <span class="text-md font-bold tracking-tight">spin</span>
        </button>
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
          onClick={() => props.setMode(dark() ? "base" : "dark")}
          aria-label={dark() ? "Switch to base mode" : "Switch to dark mode"}
          title={dark() ? "base mode" : "dark mode"}
          class={ICON_BUTTON}
        >
          <i
            class={dark() ? "i-lucide-sun icon-md" : "i-lucide-moon icon-md"}
          />
        </button>
      </div>
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
          aria-current={!utilities() || undefined}
          class={SURFACE_LINK}
        >
          primitives
        </button>
      </div>
    </div>
  );
}

/**
 * The rail: ONE alphabetical list of every primitive, or the sections of the
 * utility catalogue, filtered by the search in the header. A row the search
 * empties is hidden rather than drawn as a heading over nothing, and the count
 * tells the reader what the filter did without their having to compare
 * against what they remember.
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
}) {
  const needle = createMemo(() => props.query().trim().toLowerCase());
  const utilities = () => props.route().startsWith("/utilities");

  const components = createMemo(() =>
    PRIMITIVES.filter((page) => page.title.toLowerCase().includes(needle()))
      .sort((a, b) => a.title.localeCompare(b.title))
  );

  const sections = createMemo(() =>
    SECTIONS.filter((s) => s.title.toLowerCase().includes(needle()))
  );

  const shown = () => utilities() ? sections().length : components().length;
  const total = () => utilities() ? SECTIONS.length : PRIMITIVES.length;

  return (
    <nav class="sticky top-0 flex max-h-screen w-[14rem] shrink-0 flex-col overflow-y-auto border-e border-solid border-border p-4">
      <AppHeader
        route={props.route}
        theme={props.theme}
        setTheme={props.setTheme}
        mode={props.mode}
        setMode={props.setMode}
        query={props.query}
        setQuery={props.setQuery}
      />
      <div class={RAIL_HEAD}>
        <span>{utilities() ? "sections" : "components"}</span>
        <span class="font-mono text-xs font-regular">
          {needle() === "" ? `${total()}` : `${shown()} of ${total()}`}
        </span>
      </div>
      <Show
        when={utilities()}
        fallback={
          <Show
            when={components().length > 0}
            fallback={
              <p class={RAIL_EMPTY}>No component matches “{props.query()}”.</p>
            }
          >
            <For each={components()}>
              {(page) => {
                const current = () =>
                  props.route() === `/components/${page.id}`;
                return (
                  <button
                    type="button"
                    onClick={() => (location.hash = `#/components/${page.id}`)}
                    aria-current={current() || undefined}
                    class={RAIL_LINK}
                  >
                    <i class={`${PRIMITIVE_ICONS[page.id]} icon-md`} />
                    {page.title}
                  </button>
                );
              }}
            </For>
          </Show>
        }
      >
        <Show
          when={sections().length > 0}
          fallback={
            <p class={RAIL_EMPTY}>No section matches “{props.query()}”.</p>
          }
        >
          <For each={sections()}>
            {(sec) => (
              <button
                type="button"
                onClick={() => (location.hash = `#/utilities/${sec.id}`)}
                aria-current={routeSection(props.route()) === sec.id ||
                  undefined}
                class={RAIL_LINK}
              >
                <span>{sec.title}</span>
                <span class="ms-auto shrink-0 font-mono text-xs text-text-muted">
                  {utilitiesFor(sec, props.catalog()).length}
                </span>
              </button>
            )}
          </For>
        </Show>
      </Show>
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
  const { theme, setTheme, mode, setMode } = useTheme();
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
  const landing = createMemo(
    () => primitiveId() === undefined && !utilities(),
  );

  return (
    <div class="flex min-h-screen bg-surface">
      <div class="flex flex-1 items-start">
        <Rail
          route={route}
          query={query}
          setQuery={setQuery}
          catalog={catalog}
          theme={theme}
          setTheme={setTheme}
          mode={mode}
          setMode={setMode}
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
        </main>
      </div>
    </div>
  );
}

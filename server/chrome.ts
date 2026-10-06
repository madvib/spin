/* ──────────────────────────────────────────────────────────────────────────
 * THE SHOWCASE'S ONE STYLESHEET.
 *
 * Generated from the FIXTURES, every class the chrome itself uses, every
 * utility the reference pages RENDER, and — the part that was missing — every
 * class a SAMPLE wears. A reference page shows classes, and a class with no
 * rule in the sheet does not demonstrate anything: it renders as an unstyled
 * element that looks exactly like a broken utility.
 *
 * The samples are generated here by CALLING the sample functions rather than
 * by listing their classes, so the sheet and the markup cannot drift apart.
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * Every class the page's own chrome uses, declared once.
 *
 * Markup interpolates these and the stylesheet is generated from the same
 * record, which is the only way to keep the two in step: a hand-kept list of
 * the classes a stylesheet needs is a list that drifts.
 */
export const CHROME = {
  // A flex shell rather than a two-column grid: the rail's width is a
  // fraction of the viewport and the arbitrary-value grid template
  // (`grid-cols-[15rem_minmax(0,1fr)]`) is a wind4 spelling the surface does
  // not carry — it generates no rule at all, which left the rail and the page
  // stacked in one column. A fraction and a flex child say the same thing in
  // utilities we actually ship.
  shell: "flex min-h-screen",
  rail:
    "sticky top-0 flex max-h-screen w-1/4 shrink-0 flex-col gap-1 self-start overflow-y-auto border-e border-solid border-border p-4",
  railHead:
    "mb-4 text-xs font-semibold uppercase tracking-wide text-text-muted",
  railLink:
    "flex items-center justify-between gap-2 rounded-md px-2 py-1 text-sm text-text-muted no-underline hover:bg-surface-raised hover:text-text aria-[current]:bg-surface-raised aria-[current]:text-text aria-[current]:font-medium",
  railCount: "shrink-0 font-mono text-xs text-text-muted",
  switcher:
    "mb-4 flex flex-wrap items-center gap-1 rounded-md border border-solid border-border p-1",
  chip:
    "inline-flex items-center gap-1 rounded-full border border-solid border-border bg-surface-raised px-2 py-1 font-mono text-xs font-medium normal-case tracking-normal whitespace-nowrap text-text-muted not-italic shadow-none cursor-pointer hover:border-border-strong hover:text-text disabled:cursor-not-allowed disabled:opacity-40 aria-[current]:border-text aria-[current]:bg-text aria-[current]:text-surface",
  on:
    "aria-[current]:border-text aria-[current]:bg-text aria-[current]:text-surface",
  sep: "mx-1 h-4 shrink-0 bg-border-strong hairline",
  // The bottom rule under the surface switch. `border-b` is the utility this
  // wants and the surface does not have it: its side rule reads
  // `border-([xystrel])` — `b` is missing from the class, so `border-b` matches
  // nothing and generates nothing, while `border-e` and `border-t` do. It is a
  // hairline, so it belongs with the other hairlines rather than in the scale.
  surfaceSwitch: "mb-2 flex gap-1 pb-2 text-sm rule-b",
  surfaceLink:
    "flex-1 justify-center rounded-md border border-solid border-border bg-surface-raised px-2 py-1 font-mono text-xs text-text-muted no-underline hover:border-border-strong hover:text-text aria-[current]:border-text aria-[current]:bg-text aria-[current]:text-surface",
  main: "min-w-0 flex-1 p-8 pb-16",
  pageHead: "mb-8 flex items-start justify-between gap-4",
  title: "m-0 text-2xl font-bold tracking-tight",
  kind: "font-mono text-xs text-text-muted",
  badge:
    "shrink-0 rounded-full border border-solid border-border bg-surface-raised px-2 py-1 font-mono text-xs text-text-muted",
  note: "mt-4 max-w-screen-md text-md text-text-muted",
  section: "mb-8",
  subhead:
    "mb-2 mt-8 text-xs font-semibold uppercase tracking-wide text-text-muted",
  prose: "max-w-screen-md text-md text-text-muted",
  familyDemo:
    "flex flex-wrap items-start gap-4 rounded-lg border border-solid border-border bg-surface-raised p-4",
  legend: "mt-2 font-mono text-xs text-text-muted",
  railWrap: "mt-4 flex flex-wrap items-start gap-2",
  label: "mb-1 text-xs font-semibold uppercase tracking-wide text-text-muted",
  pair: "flex flex-col items-start gap-2",
  pairBox:
    "flex min-h-16 w-1/3 min-w-0 items-center justify-center rounded-md border border-solid border-border bg-surface p-4",
  scaleStage:
    "flex min-h-16 w-full min-w-0 items-center justify-center overflow-hidden rounded-lg border border-solid border-border bg-surface-raised p-8",
  scaleControls: "mt-4 flex flex-wrap items-start gap-8",
  scaleGroup: "flex flex-col items-start gap-2",
  scaleButtons: "flex flex-wrap gap-1",
  decl:
    "mt-4 max-w-full overflow-x-auto rounded-md border border-solid border-border bg-surface-raised px-2 py-2 font-mono text-xs text-text-muted",
  declName: "font-mono text-xs text-text",
  nameList: "flex flex-wrap gap-2",
  noteBox:
    "mt-4 max-w-screen-md rounded-md border border-solid border-border bg-surface-raised p-4 text-sm text-text-muted",
  example: "mb-8",
  rendered:
    "rounded-md border border-dashed border-solid border-border bg-surface-raised p-4",
  reveal:
    "reveal mt-2 inline-flex items-center gap-1 rounded-md border-0 bg-transparent p-0 font-mono text-xs font-medium normal-case tracking-normal text-text-muted not-italic shadow-none hover:text-text",
  copy:
    "inline-flex items-center gap-1 rounded-md border-0 bg-transparent p-0 font-mono text-xs font-medium normal-case tracking-normal text-text-muted not-italic shadow-none hover:text-text",
  panel: "mb-8 rounded-lg border border-solid border-border bg-surface p-4",
} as const;

export const chromeClasses = Object.values(CHROME).join(" ");

/* ──────────────────────────────────────────────────────────────────────────
 * The page's own styles — everything our own utilities cannot say.
 * ────────────────────────────────────────────────────────────────────────── */
export const STYLE = `
/* Font smoothing. No utility in the surface sets it, and every measurement on
   the page is a measurement of this type. */
body { -webkit-font-smoothing: antialiased; }

/* The fieldset fixture ships its own class name, and spin already claims the
   token "group" for the role=group primitive, so a shortcut by that name would
   displace the primitive's own rules. The element selector is the one hook
   that does not collide with anything. */
fieldset {
  display: flex;
  flex-direction: column;
  gap: .625rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 1rem;
}
fieldset > legend {
  padding-inline: .375rem;
  font-size: var(--font-size-sm);
  font-weight: 600;
}

/* The table fixture's scroller is an attribute in markup the showcase does not
   own, so there is no element to hang a utility on. */
[data-scroller] { max-height: 9rem; overflow: auto; }

/* The 1px divider in the rail. A hairline is a BORDER, not a step on a scale:
   our spacing scale answers "how far apart", and this is "how thick is the
   line", which is the border scale's business — and the border scale carries
   a full token for it. A width utility is the wrong instrument twice over: it
   would answer a question about thickness with a number about distance, and
   the scale has no entry to read, so the showcase would be inventing a
   token to decorate a page the product does not have. The token does exist —
   so this spends it rather than hard-coding a pixel. */
.hairline { width: var(--border-width); }

/* The rule under the surface switch. Same reasoning and the same gap as the
   hairline above: the surface's border rule spells its sides "([xystrel])",
   which omits "b", so border-b matches nothing and generates nothing while
   border-t and border-e generate normally. There is no utility to spend,
   and a 1px bottom edge is the hairline the border token already describes. */
.rule-b {
  border-block-end: var(--border-width) solid var(--color-border);
}
`;

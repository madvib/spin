/**
 * What each primitive paints.
 *
 * The claim is AUTHORED, not observed: a rule that reaches outside what its
 * primitive declared here is a failure the codegen reports, not a widening
 * the manifest absorbs. The derivation reads these declarations, checks the
 * rules against them, and writes the result into the manifest — so the
 * manifest records what the rules DO, and the rules are held to what the
 * manifest DECLARES.
 *
 * Two words carry the whole of a claim:
 *
 * - **global** — the element is painted wherever it is. Spin owns the
 *   typography of the whole application, and a global claim is how that is
 *   said: the heading ladder is global, and so is the paragraph's spacing, the
 *   link's ink and the code face. A heading is a heading everywhere, and the
 *   type it reads in is the type it reads in outside a document column too.
 * - **descendant** — the element is painted only INSIDE the primitive's own
 *   element. The document surface is the one that matters: the quotation's
 *   inset, the media's box and the code block's chrome are painted by the
 *   prose column they sit in, not by every quotation in the world.
 *
 * `self` is the element the primitive IS — the tag (or class) an author
 * writes — and a descendant placement is relative to it.
 */

import type { Claim } from "./scope.ts";

/**
 * The claim of every primitive.
 *
 * A tag may be claimed twice — once globally and once as a descendant — when
 * the primitive gives it two different treatments: a quotation's TYPE is the
 * theme's wherever it is written, and its PLACE in a document belongs to the
 * document.
 *
 * The elements are the ones the rules actually reach: the codegen fails on a
 * rule that styles a tag this table does not name, and on a rule that places
 * its painting somewhere other than the claim says.
 */
export const primitiveClaims: Record<string, Claim> = {
  a11y: { self: "a11y", paints: [] },
  alert: { self: "alert", paints: [{ tag: "alert", where: "global" }] },
  // The face is the image the avatar frames, so it is painted inside the
  // avatar and nowhere else.
  avatar: { self: "avatar", paints: [{ tag: "img", where: "descendant" }] },
  "avatar-group": { self: "avatar-group", paints: [] },
  badge: { self: "badge", paints: [{ tag: "badge", where: "global" }] },
  // The trail's links and items are the trail's, not every link on the page.
  breadcrumbs: {
    self: "breadcrumbs",
    paints: [
      { tag: "a", where: "descendant" },
      { tag: "li", where: "descendant" },
    ],
  },
  // The control, the joined group's container, and the controls the group
  // joins.
  button: {
    self: "button",
    paints: [
      { tag: "button", where: "global" },
      { tag: "button", where: "descendant" },
      { tag: "span", where: "global" },
    ],
  },
  // The card and its parts: each part is its own element, and each is
  // painted wherever it is written.
  card: {
    self: "card",
    paints: [
      { tag: "card", where: "global" },
      { tag: "card-action", where: "global" },
      { tag: "card-content", where: "global" },
      { tag: "card-description", where: "global" },
      { tag: "card-figure", where: "global" },
      { tag: "card-footer", where: "global" },
      { tag: "card-header", where: "global" },
      { tag: "card-title", where: "global" },
    ],
  },
  checkbox: { self: "checkbox", paints: [{ tag: "input", where: "global" }] },
  details: {
    self: "details",
    paints: [
      { tag: "details", where: "global" },
      { tag: "summary", where: "global" },
      { tag: "summary", where: "descendant" },
    ],
  },
  // The dialog's own parts: the header, the footer, and the headings a
  // dialog writes for itself.
  dialog: {
    self: "dialog",
    paints: [
      { tag: "dialog", where: "global" },
      { tag: "footer", where: "descendant" },
      { tag: "h1", where: "descendant" },
      { tag: "h2", where: "descendant" },
      { tag: "h3", where: "descendant" },
      { tag: "header", where: "descendant" },
    ],
  },
  // The box is one thing with two contents: a field and a textarea are the
  // same box.
  field: {
    self: "field",
    paints: [
      { tag: "input", where: "global" },
      { tag: "textarea", where: "global" },
    ],
  },
  fieldset: {
    self: "fieldset",
    paints: [
      { tag: "fieldset", where: "global" },
      { tag: "legend", where: "descendant" },
    ],
  },
  // The group's members: the controls the join draws together.
  group: {
    self: "group",
    paints: [
      { tag: "badge", where: "descendant" },
      { tag: "button", where: "descendant" },
      { tag: "input", where: "descendant" },
      { tag: "textarea", where: "descendant" },
    ],
  },
  hr: { self: "hr", paints: [{ tag: "hr", where: "global" }] },
  icon: { self: "icon", paints: [] },
  join: { self: "join", paints: [] },
  kbd: { self: "kbd", paints: [{ tag: "kbd", where: "global" }] },
  label: { self: "label", paints: [{ tag: "label", where: "global" }] },
  meter: { self: "meter", paints: [{ tag: "meter", where: "global" }] },
  mode: { self: "mode", paints: [] },
  popover: {
    self: "popover",
    paints: [
      { tag: "popover", where: "global" },
      { tag: "tooltip", where: "global" },
      // The tip as it is shown: a sibling of the trigger it belongs to.
      { tag: "tooltip", where: "descendant" },
    ],
  },
  progress: {
    self: "progress",
    paints: [{ tag: "progress", where: "global" }],
  },
  radio: { self: "radio", paints: [{ tag: "input", where: "global" }] },
  skeleton: { self: "skeleton", paints: [] },
  stat: { self: "stat", paints: [] },
  switch: { self: "switch", paints: [{ tag: "input", where: "global" }] },
  // The table and its cells: a cell is painted where the table is, and a
  // header cell is the table's own.
  table: {
    self: "table",
    paints: [
      { tag: "caption", where: "global" },
      { tag: "table", where: "global" },
      { tag: "td", where: "global" },
      { tag: "td", where: "descendant" },
      { tag: "th", where: "global" },
      { tag: "th", where: "descendant" },
    ],
  },
};

/**
 * The prose claim.
 *
 * The element typography is GLOBAL, and it is spin's own for the whole
 * application: the heading ladder, the paragraph's spacing, the list's spacing,
 * the link, the code face, the strong weight, the small size, the caption.
 * Those are the elements' own statements, and they read the same wherever
 * they are written — a heading outside a document column is still a heading,
 * and a paragraph outside one is still a paragraph.
 *
 * The document treatment is a DESCENDANT: the quotation's inset, the figure
 * and its caption, the media's box, the code block's chrome, the highlight,
 * the inserted and deleted runs. Those are the document's decisions, and they
 * belong to the document that makes them — they are the furniture of a
 * long-form column, and a column is what a `<prose>` is for.
 */
primitiveClaims["prose"] = {
  self: "prose",
  paints: [
    // The element typography — the theme's, everywhere in the application.
    { tag: "a", where: "global" },
    { tag: "abbr", where: "global" },
    { tag: "b", where: "global" },
    { tag: "blockquote", where: "global" },
    { tag: "body", where: "global" },
    { tag: "code", where: "global" },
    { tag: "dd", where: "global" },
    { tag: "dl", where: "global" },
    { tag: "dt", where: "global" },
    { tag: "figcaption", where: "global" },
    { tag: "figure", where: "global" },
    { tag: "h1", where: "global" },
    { tag: "h2", where: "global" },
    { tag: "h3", where: "global" },
    { tag: "h4", where: "global" },
    { tag: "h5", where: "global" },
    { tag: "h6", where: "global" },
    { tag: "li", where: "global" },
    { tag: "ol", where: "global" },
    { tag: "p", where: "global" },
    { tag: "pre", where: "global" },
    { tag: "prose", where: "global" },
    { tag: "samp", where: "global" },
    { tag: "small", where: "global" },
    { tag: "strong", where: "global" },
    { tag: "sub", where: "global" },
    { tag: "sup", where: "global" },
    { tag: "ul", where: "global" },
    // The document treatment — the furniture of a column.
    { tag: "blockquote", where: "descendant" },
    { tag: "canvas", where: "descendant" },
    // The chip inside a code block is the block's, not the column's: the
    // block undoes it.
    { tag: "code", where: "descendant" },
    { tag: "del", where: "descendant" },
    { tag: "embed", where: "descendant" },
    { tag: "figcaption", where: "descendant" },
    { tag: "figure", where: "descendant" },
    { tag: "footer", where: "descendant" },
    { tag: "iframe", where: "descendant" },
    { tag: "img", where: "descendant" },
    { tag: "ins", where: "descendant" },
    { tag: "mark", where: "descendant" },
    { tag: "object", where: "descendant" },
    { tag: "pre", where: "descendant" },
    { tag: "svg", where: "descendant" },
    { tag: "video", where: "descendant" },
  ],
};

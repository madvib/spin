/**
 * The sample product every specimen draws from.
 *
 * Specimens used to describe themselves — "Card Title", "Card Description",
 * "Card content. Seven parts, each its own tag" — which is documentation
 * voice, not a product. It tells the reader about the component instead of
 * showing the component being used, and 34 disconnected demos read as 34
 * disconnected demos.
 *
 * One sample content fixes both problems at once: every specifier renders the
 * same fictional product, so a card and an alert and a table are parts of one
 * site rather than one demo each, and the copy is real enough to judge type,
 * measure, and tone against. A theme is easier to evaluate when you are
 * reading about something.
 *
 * The subject is deliberately ordinary — a small roastery — because the point
 * is the theme, not the content. Nothing here is a placeholder: every string
 * is one a real site would ship.
 */

/** The roastery the specimens sell. */
export const sample = {
  name: "Halden & Roe",
  tagline: "Small-batch coffee, roasted on Wednesdays",

  product: {
    name: "Ethiopia Guji",
    origin: "Guji, Ethiopia · 1,950m",
    process: "Washed, dried on raised beds",
    notes: "Apricot, jasmine, black tea",
    price: "$22",
    weight: "250g",
  },

  order: {
    id: "#4021",
    placed: "Tuesday, 14 October",
    total: "$44.00",
    items: 2,
    status: "Roasting",
  },

  member: {
    name: "Ada Okonjo",
    email: "ada@example.com",
    plan: "Every two weeks",
    since: "2024",
  },

  article: {
    title: "Why we roast on Wednesdays",
    standfirst:
      "A roast day is a constraint, not a preference. Here is what it costs and what it buys.",
    body: [
      "Coffee is at its most generous between four and fourteen days off the roaster. Before four it is still exhaling carbon dioxide; after fourteen the aromatics have begun to leave. A weekly roast puts every bag inside that window for most of its life.",
      "Which means the decision is not really when to roast. It is how much to roast, and what to do with the coffee that ages out. We rather than blend it away, we discount it and say why.",
    ],
  },

  note: {
    title: "Your next box ships Friday",
    body:
      "Two bags of Ethiopia Guji, ground for pour-over. Change or cancel any time before Thursday.",
  },

  nav: {
    home: "Shop",
    section: "Single origin",
    current: "Ethiopia Guji",
  },

  actions: {
    primary: "Add to box",
    secondary: "Save for later",
    dismiss: "Not now",
  },

  figure: {
    caption: "Drying beds, Guji zone",
  },
} as const;

/** A face for a specimen, as initials plus a colour already in the theme. */
export function initials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0] ?? "")
    .join("")
    .toUpperCase();
}

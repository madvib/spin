/**
 * The sample content every specifier draws from.
 *
 * Specimens used to say what they were — "Card Title", "Card Description",
 * "Card content. Seven parts, each its own tag" — which is documentation
 * voice applied to the wrong thing: it describes the component instead of
 * showing it used, and thirty-four disconnected demos read as thirty-four
 * disconnected demos.
 *
 * This is one concrete subject rendered plainly, so a card and an alert and a
 * table are parts of one site rather than one demo each. Concrete beats
 * abstract: `foo` and `Item` teach nothing about measure, weight, or rhythm,
 * while a real paragraph tells you whether your h3 actually reads as a step
 * down from h2.
 *
 * The voice is documentation, not marketing. Plain, factual, no flourish —
 * the same register a good reference page uses for its examples. A subject
 * that talks about itself is a subject you cannot judge a theme against.
 */

/** One concrete subject, described plainly. */
export const sample = {
  // A small roastery: ordinary enough to stay out of the way, specific enough
  // to show real numbers, lengths, and names.
  name: "Halden Roe Coffee Roasters",
  established: "2019",

  product: {
    name: "Ethiopia Guji",
    origin: "Guji, Ethiopia",
    altitude: "1,950m",
    process: "Washed, dried on raised beds",
    notes: "Apricot, jasmine, black tea",
    price: "$22",
    weight: "250g",
  },

  order: {
    id: "4021",
    placed: "14 October 2025",
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
    title: "Roast schedule",
    standfirst:
      "Roasts are Tuesdays, shipping Wednesdays. Orders placed before Monday are in the following week's batch.",
    paragraphs: [
      "Coffee is most generous between four and fourteen days off the roaster. Before four it is still releasing carbon dioxide; after fourteen the aromatics begin to fade. A weekly roast keeps most bags inside that window for most of their shelf life.",
      "The constraint is not the roast day but the batch size. Bags that age past two weeks are discounted and marked with their roast date rather than blended away.",
    ],
  },

  note: {
    title: "Next box ships Wednesday",
    body:
      "Two bags of Ethiopia Guji, ground for pour-over. Changes can be made until Tuesday.",
  },

  nav: {
    shop: "Shop",
    section: "Single origin",
    current: "Ethiopia Guji",
  },

  actions: {
    primary: "Add to box",
    secondary: "Save",
    dismiss: "Dismiss",
  },

  figure: {
    caption: "Drying beds, Guji zone",
  },
} as const;

/** Initials for a face specifier, from a full name. */
export function initials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0] ?? "")
    .join("")
    .toUpperCase();
}

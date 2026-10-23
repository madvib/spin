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
 * abstract: `foo` and `Item` teach nothing about measure, weight, or spacing,
 * while a real paragraph tells you whether your h3 actually reads as a step
 * down from h2.
 *
 * The subject is Lodestar, a deployment console: the kind of tool a team
 * ships software with, so its vocabulary is services, releases, regions and
 * on-call engineers, and its numbers are the ones such a tool shows. The
 * numbers are real-shaped — a duration, a share of traffic, a count of
 * instances — because a specimen that says "42%" teaches less than one that
 * says "0.42%".
 *
 * The voice is documentation, not marketing. Plain, factual, no flourish —
 * the same register a good reference page uses for its examples. A subject
 * that talks about itself is a subject you cannot judge a theme against.
 */

/** One concrete subject, described plainly. */
export const sample = {
  // A deployment console: ordinary enough to stay out of the way, specific
  // enough to show real numbers, lengths, and names.
  name: "Lodestar",
  established: "2021",

  service: {
    name: "checkout-api",
    owner: "Payments",
    instances: "12",
    regions: "3",
    version: "v4.12.0",
    status: "healthy",
  },

  release: {
    id: "4821",
    version: "v4.12.0",
    author: "Tomas Berg",
    started: "19 October 2026, 09:14 UTC",
    duration: "4m 12s",
    traffic: "10%",
    status: "Running",
  },

  engineer: {
    name: "Priya Raman",
    email: "priya@lodestar.dev",
    role: "Platform engineer",
    since: "2023",
  },

  article: {
    title: "Rolling back a release",
    standfirst:
      "A rollback sends every instance back to the previous release. It takes under two minutes, and it keeps the failed release in the history.",
    paragraphs: [
      "A release is promoted by traffic, not by a switch. Ten per cent goes to the new version first, and the share only grows while the health checks stay green.",
      "When the checks fail, the rollout stops where it is rather than starting again. The instances already on the new version are replaced, and the share returns to the previous release.",
    ],
  },

  note: {
    title: "Deploy #4821 is running",
    body:
      "Ten per cent of traffic is on v4.12.0 in eu-west-1. Health checks pass; the share grows in five minutes.",
  },

  nav: {
    app: "Lodestar",
    section: "checkout-api",
    current: "Deploy #4821",
  },

  actions: {
    primary: "Deploy",
    secondary: "Roll back",
    dismiss: "Dismiss",
  },

  figure: {
    caption: "Deploy #4821, eu-west-1",
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

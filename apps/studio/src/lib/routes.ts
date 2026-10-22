/**
 * The studio's routes, as one table.
 *
 * Data only: no JSX, no Solid — this is read by the oracle's Deno scripts and
 * by tests as well as by the app.
 */

/**
 * Where an entry sits in the studio's chrome.
 *
 * The chrome is three places now, and each of them says something different
 * about the route it carries. The rail is navigation and nothing else: the
 * mark that goes home, and the concerns the project is filed by. The rail's
 * FOOT is the studio's own: the verbs that are not about the document at all.
 * A route the chrome does not offer is served but not offered, which is a fact
 * the table states rather than the app guessing.
 */
export type ChromePlace = "mark" | "concern" | "foot";

/** One route, and what the studio knows about it. */
export interface StudioRoute {
  readonly path: string;
  /** The chrome's tooltip. */
  readonly label: string;
  /** The chrome's glyph, as a whole utility class — the scanner reads source. */
  readonly icon: string;
  /** Absent means the route is served but the chrome does not offer it. */
  readonly place?: ChromePlace;
  /** Token path prefixes this route's editor owns, so a readout can link to it. */
  readonly owns?: readonly (readonly string[])[];
  /**
   * Children as patterns joined onto `path`, `""` being the index. A pattern
   * with an open segment matches but is never navigated to directly.
   */
  readonly children?: readonly string[];
}

/** Every navigable route, in chrome order. */
export const ROUTES = [
  {
    path: "/",
    label: "Overview",
    icon: "i-lucide-loader-pinwheel",
    place: "mark",
  },
  {
    path: "/colors",
    label: "Color",
    icon: "i-lucide-palette",
    place: "concern",
    owns: [["color"]],
  },
  {
    path: "/type",
    label: "Type",
    icon: "i-lucide-type",
    place: "concern",
    owns: [["font"]],
  },
  {
    path: "/icons",
    label: "Icons",
    // A stack of glyphs, not a shapes glyph: `shapes` reads as geometry —
    // a concern the style page already owns — where the concern here is a
    // SET of glyphs to choose from.
    icon: "i-lucide-layers",
    place: "concern",
    owns: [["icon"]],
  },
  {
    path: "/motion",
    label: "Motion",
    icon: "i-lucide-square-play",
    place: "concern",
    owns: [["motion"]],
  },
  {
    path: "/spacing",
    label: "Spacing",
    icon: "i-lucide-ruler",
    place: "concern",
    owns: [["spacing"], ["breakpoint"]],
  },
  {
    path: "/style",
    label: "Style",
    icon: "i-lucide-contrast",
    place: "concern",
    owns: [["radius"], ["shadow"], ["z-index"], ["opacity"], ["border"], [
      "focus",
    ]],
  },
  {
    path: "/components",
    label: "Elements",
    icon: "i-lucide-layout-dashboard",
    place: "concern",
    children: ["", "/:name"],
  },
  {
    path: "/preferences",
    label: "Preferences",
    icon: "i-lucide-settings",
    place: "foot",
  },
] as const satisfies readonly StudioRoute[];

/** Every path the studio can be told to go to, for links and for gates. */
export const ROUTE_PATHS: readonly string[] = ROUTES.map((route) => route.path);

/** Every child pattern joined onto its route's path; open segments left open. */
export const CHILD_PATHS: readonly string[] = ROUTES.flatMap((route) =>
  ("children" in route ? route.children ?? [] : []).map((child) =>
    `${route.path}${child}`
  )
);

/** One route's path, as a type — so a router path cannot drift from the table. */
export type RoutePath = (typeof ROUTES)[number]["path"];

/** The chrome's places, derived. */
function placed(place: ChromePlace): readonly StudioRoute[] {
  return ROUTES.filter((route) => route.place === place);
}

/** The single route placed at a mark. Two claiming it is an error. */
function chromeAt(place: ChromePlace): StudioRoute {
  const claimed = ROUTES.filter((route) => route.place === place);
  if (claimed.length === 0) {
    throw new Error(
      `no route is placed at "${place}" in the chrome — one of the entries has to set place: "${place}"`,
    );
  }
  if (claimed.length > 1) {
    throw new Error(
      `the chrome's "${place}" is claimed by ${
        claimed.map((route) => route.path).join(" and ")
      } — a place in the chrome is one route`,
    );
  }
  return claimed[0]!;
}

/** The rail's mark: the link back to the overview. */
export const MARK: StudioRoute = chromeAt("mark");

/**
 * The rail's concerns, in the order the rail offers them.
 */
export const CONCERNS: readonly StudioRoute[] = placed("concern");

/**
 * The rail's foot: the studio's own routes.
 *
 * The rail is navigation to the PROJECT's concerns, and the studio's own
 * settings are not one of them — they are chrome verbs, and the chrome verbs
 * live at the foot of the rail, in the same visual language as the concerns
 * above them. A list rather than one route, because a foot can carry more
 * than one thing and the table should say so.
 */
export const FOOT: readonly StudioRoute[] = placed("foot");

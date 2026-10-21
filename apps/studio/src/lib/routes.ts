/**
 * The studio's routes, as one table.
 *
 * Data only: no JSX, no Solid — this is read by the oracle's Deno scripts and
 * by tests as well as by the app.
 */

/** Where an entry sits in the icon rail. */
export type RailPlace = "mark" | "concern" | "foot";

/** One route, and what the studio knows about it. */
export interface StudioRoute {
  readonly path: string;
  /** The rail's tooltip. */
  readonly label: string;
  /** The rail's glyph, as a whole utility class — the scanner reads source. */
  readonly icon: string;
  /** Absent means link-only; nothing has needed that yet. */
  readonly rail?: RailPlace;
  /** Token path prefixes this route's editor owns, so a readout can link to it. */
  readonly owns?: readonly (readonly string[])[];
  /**
   * Children as patterns joined onto `path`, `""` being the index. A pattern
   * with an open segment matches but is never navigated to directly.
   */
  readonly children?: readonly string[];
}

/** Every navigable route, in rail order. */
export const ROUTES = [
  {
    path: "/",
    label: "Overview",
    icon: "i-lucide-loader-pinwheel",
    rail: "mark",
  },
  {
    path: "/colors",
    label: "Color",
    icon: "i-lucide-palette",
    rail: "concern",
    owns: [["color"]],
  },
  {
    path: "/type",
    label: "Type",
    icon: "i-lucide-type",
    rail: "concern",
    owns: [["font"]],
  },
  {
    path: "/icons",
    label: "Icons",
    icon: "i-lucide-grid-2x2",
    rail: "concern",
    owns: [["icon"]],
  },
  {
    path: "/motion",
    label: "Motion",
    icon: "i-lucide-square-play",
    rail: "concern",
    owns: [["motion"]],
  },
  {
    path: "/spacing",
    label: "Spacing",
    icon: "i-lucide-ruler",
    rail: "concern",
    owns: [["spacing"], ["breakpoint"]],
  },
  {
    path: "/style",
    label: "Style",
    icon: "i-lucide-sliders-horizontal",
    rail: "concern",
    owns: [["radius"], ["shadow"], ["z-index"], ["opacity"], ["border"], [
      "focus",
    ]],
  },
  {
    path: "/components",
    label: "Elements",
    icon: "i-lucide-layout-dashboard",
    rail: "concern",
    children: ["", "/:name"],
  },
  {
    path: "/preferences",
    label: "Preferences",
    icon: "i-lucide-settings",
    rail: "foot",
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

/** The rail's three places, derived. */
function rail(place: RailPlace): readonly StudioRoute[] {
  return ROUTES.filter((route) => route.rail === place);
}

/** The single route placed at a mark or a foot. Two claiming it is an error. */
function railAt(place: RailPlace): StudioRoute {
  const placed = ROUTES.filter((route) => route.rail === place);
  if (placed.length === 0) {
    throw new Error(
      `no route is placed at "${place}" in the rail — one of the entries has to set rail: "${place}"`,
    );
  }
  if (placed.length > 1) {
    throw new Error(
      `the rail's "${place}" is claimed by ${
        placed.map((route) => route.path).join(" and ")
      } — a place in the rail is one route`,
    );
  }
  return placed[0]!;
}

/** The rail's mark: the link back to the overview. */
export const MARK: StudioRoute = railAt("mark");

/** The rail's concerns, in the order the rail offers them. */
export const CONCERNS: readonly StudioRoute[] = rail("concern");

/** The rail's foot: the entry that sits with undo, redo and save. */
export const FOOT: StudioRoute = railAt("foot");

/**
 * The studio's routes, as one table.
 *
 * Data only: no JSX, no Solid — this is read by the oracle's Deno scripts and
 * by tests as well as by the app.
 */

/**
 * Where an entry sits in the studio's chrome.
 *
 * The chrome is three pieces and each of them says something different: the
 * rail on the edge is navigation and nothing else, the bar along the top of
 * the work is the studio's controls, and the bar along the bottom is the
 * studio's own state. A route is placed in the rail or it is not offered at
 * all — the bars carry no routes, because a route is a place the studio can
 * go and the bars are places it reads and acts.
 *
 * Within the rail there are three places, and each says something different
 * about the route it carries: the mark that goes home, the concerns the
 * project is filed by, and the foot, which is the studio's own. A route the
 * chrome does not offer is served but not offered, which is a fact the
 * table states rather than the app guessing.
 */
export type ChromePlace = "mark" | "concern" | "foot";

/** One route, and what the studio knows about it. */
export interface StudioRoute {
  readonly path: string;
  /** The chrome's tooltip. */
  readonly label: string;
  /** The chrome's glyph, as a whole utility class — the scanner reads source. */
  readonly icon: string;
  /** One plain-words line under the label in the navigation card. */
  readonly description: string;
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
    description: "Project dashboard: active brand, token groups, components, and diagnostics",
    place: "mark",
  },
  {
    path: "/brand",
    label: "Brand",
    icon: "i-lucide-layers",
    description: "Brand identity, parent design language, authored layers, and facets",
    place: "concern",
  },
  {
    path: "/tokens",
    label: "Tokens",
    icon: "i-lucide-palette",
    description: "Color, type, spacing, style, motion, and icon tokens",
    place: "concern",
    owns: [["color"], ["font"], ["icon"], ["motion"], ["spacing"], ["breakpoint"], ["radius"], ["shadow"], ["z-index"], ["opacity"], ["border"], [
      "focus",
    ]],
    children: ["", "/colors", "/type", "/type/faces", "/type/styles", "/type/ramps", "/icons", "/motion", "/spacing", "/style"],
  },
  {
    path: "/components",
    label: "Components",
    icon: "i-lucide-layout-dashboard",
    description: "Primitives and machine components",
    place: "concern",
    children: ["", "/:name"],
  },
  {
    path: "/diagnostics",
    label: "Diagnostics",
    icon: "i-lucide-list-checks",
    description: "Theme contract checks, source lints, and shortcut opportunities",
    place: "concern",
  },
  {
    path: "/inbox",
    label: "Inbox",
    icon: "i-lucide-inbox",
    description: "Annotated UI issues queued for coding agents",
    place: "concern",
  },
  {
    path: "/preferences",
    label: "Preferences",
    icon: "i-lucide-settings",
    description: "Project wiring and studio behavior",
    place: "foot",
  },
  {
    path: "/init",
    label: "Create your brand",
    icon: "i-lucide-sparkles",
    description: "The init sequence: brand, language, palette, type",
  },
] as const satisfies readonly StudioRoute[];

/**
 * Redirects for legacy paths so bookmarks and older links resolve cleanly
 * to the current Brand / Tokens / Components / Diagnostics routes.
 */
export const REDIRECTS: Readonly<Record<string, string>> = {
  "/themes": "/tokens/colors",
  "/themes/colors": "/tokens/colors",
  "/themes/type": "/tokens/type/styles",
  "/themes/type/faces": "/tokens/type/faces",
  "/themes/type/styles": "/tokens/type/styles",
  "/themes/type/ramps": "/tokens/type/ramps",
  "/themes/icons": "/tokens/icons",
  "/themes/motion": "/tokens/motion",
  "/themes/spacing": "/tokens/spacing",
  "/themes/style": "/tokens/style",
  "/findings": "/diagnostics",
  "/colors": "/tokens/colors",
  "/type": "/tokens/type/styles",
  "/icons": "/tokens/icons",
  "/motion": "/tokens/motion",
  "/spacing": "/tokens/spacing",
  "/style": "/tokens/style",
};

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
  return ROUTES.filter((route) => "place" in route && route.place === place);
}

/** The single route placed at a mark. Two claiming it is an error. */
function chromeAt(place: ChromePlace): StudioRoute {
  const claimed = ROUTES.filter((route) => "place" in route && route.place === place);
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

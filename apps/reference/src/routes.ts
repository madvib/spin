/**
 * The app's routes.
 *
 * The app owns its routes, and the visual check reads them from here rather
 * than from a list kept beside it: a route the app serves is a route the
 * check walks, and a route that is added here is covered by the next run
 * without anybody remembering to add it twice.
 *
 * The routes a REGISTRY derives are not here — a primitive is a route
 * because the primitive registry says so, and a utilities section is a route
 * for the same reason. What is here is the small remainder the app owns:
 * the two landings and the montage.
 */

/** One route, as the app routes on it. */
export interface AppRoute {
  /** The hash the app routes on, without the leading '#'. */
  readonly hash: string;
  /** The heading the route has to render, when it has one to render. */
  readonly expectHeading: string | null;
}

/** The route the montage lives at. */
export const MONTAGE_ROUTE = "/themes";

/**
 * The routes the app owns.
 *
 * The montage's heading is spelled here because the page's own `<h2>` is
 * what a reader sees first, and the check reads that heading to know the
 * route rendered.
 */
export const APP_ROUTES: readonly AppRoute[] = [
  { hash: "/components", expectHeading: "Primitives" },
  { hash: "/utilities", expectHeading: null },
  { hash: "/classless-off", expectHeading: "Classless off" },
  { hash: MONTAGE_ROUTE, expectHeading: "Themes" },
];

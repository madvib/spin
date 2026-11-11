/**
 * The rendered checks: what a running app looks like, measured.
 *
 * The lints read the source; these read the page. A theme can be legal in
 * every way the source can be legal and still be unreadable on screen — a
 * fill and an ink the palette does not pair, a control no pointer can
 * reach, a route that rendered an error instead of content. So the
 * diagnostics have a second half, and this module is its contract.
 *
 * The checks themselves are the harness's: it is what knows how to ask a
 * browser what it painted, and it holds the app's own facts — the routes,
 * the themes, how the app says it has rendered. So the service does not
 * look at a page itself; it calls the harness, through the port below. A
 * second set of eyes would be a second set of answers.
 */

/**
 * The names the rendered checks report under.
 *
 * The same names the harness reports them under: a check earns its name
 * by being mechanical — a ratio, a rect, a console line, a request that
 * did not complete.
 */
export type CheckName =
  | "contrast"
  | "state-contrast"
  | "zero-area-interactive"
  | "strobe-animation"
  | "geometry"
  | "console-error"
  | "failed-request"
  | "render-defect";

/** The state a subject was measured in. */
export type SubjectState =
  | "rest"
  | "hover"
  | "focus"
  | "focus-visible"
  | "active"
  | "disabled";

/**
 * One thing a rendered check found.
 *
 * Where it was seen (the route, the theme, the mode), what it was (the
 * check's own name), which subject it was about, what was measured, and
 * the state the subject was in when it was measured. Everything a report
 * needs, and nothing a baseline does not need.
 */
export interface RenderedFinding {
  /** The route it was seen on. */
  readonly route: string;
  /** The theme it was seen in. */
  readonly theme: string;
  /** The mode it was seen in. */
  readonly mode: string;
  /** The check that found it. */
  readonly check: CheckName;
  /** What it is about, so a later run can tell it from its neighbours. */
  readonly subject: string;
  /** What was measured, as one line. */
  readonly detail: string;
  /** The state the subject was measured in. */
  readonly state: SubjectState;
}

/** What one run of the checks found. */
export interface RenderedRun {
  /** The findings, in the order they were found. */
  readonly findings: readonly RenderedFinding[];
  /**
   * The harness's verdict.
   *
   * 0 when the run passed, 1 when a check that has earned fatality found
   * something, 2 when the run could not be made at all — the app was not
   * there, or the browser would not start.
   */
  readonly code: number;
}

/**
 * The rendered checks, as the service calls them.
 *
 * The port: the service hands the harness a URL and reads what it found.
 */
export interface RenderedHarness {
  /** The checks, over the app at the URL. */
  run(url: string): Promise<RenderedRun>;
}

/* ------------------------------------------------- what an app tells the checks -- */

/** A route the checks visit. */
export interface CheckRoute {
  /** The hash the app routes on, without the leading '#'. */
  readonly hash: string;
  /** Absolute path the app routes on, e.g. "/colors". When set, loads `${url}${path}${query ?? ""}` instead of `${url}#${hash}`. */
  readonly path?: string;
  /** Query string appended after path or hash, e.g. "?mode=drawer". */
  readonly query?: string;
  /** The heading the route has to render, when it has one to render. */
  readonly expectHeading: string | null;
}

/** One geometry claim, and what the browser measured for it. */
export interface GeometryClaim {
  readonly id: string;
  readonly ok: boolean;
  /** What was measured, as one line. */
  readonly detail: string;
}

/** What the app reports about the page once it has painted. */
export interface FrameState {
  readonly heading: string | null;
  readonly text: string;
  /** What the app says the theme and mode are. */
  readonly theme: string | null;
  readonly mode: string | null;
}

/**
 * The app-side probes, each serialised into the tab by its source.
 *
 * The app knows how it renders; the harness cannot guess. So the app hands
 * its probes over, and the harness asks them.
 */
export interface PageAdapter {
  /** True once the app has booted on the route it was given. */
  readonly renderReady: () => boolean;
  /** What the rendered page looks like to someone reading it. */
  readonly pageState: () => FrameState;
  /** Seeds the theme and mode the way the app itself stores them. */
  readonly seedTheme: (
    seed: { readonly theme: string; readonly mode: string },
  ) => void | Promise<void>;
  /** The geometry claims a route is held to; routes with none carry none. */
  readonly geometryClaimsFor: (hash: string) => readonly string[];
  /** The claims, measured where they render. */
  readonly geometryAudit: (
    options: { readonly claims: readonly string[] },
  ) => readonly GeometryClaim[];
}

/**
 * What the harness cannot know: the app it is checking.
 *
 * The contract between an app and the checks. The harness reads it; the
 * app writes it.
 */
export interface CheckConfig {
  /** Relative --out/--baseline values resolve against this directory. */
  readonly baseDir: string;
  /** The URL to check when --url is not given. */
  readonly defaultUrl: string;
  /** The route source, e.g. the app's own registry rather than a list beside it. */
  readonly routes: () => readonly CheckRoute[];
  /** The themes to render when --themes is not given. */
  readonly themes: readonly string[];
  /** The modes a theme is checked in, e.g. `base` plus its own `dark`. */
  readonly modesFor: (theme: string) => readonly string[];
  /** The chrome hover states are measured on, or null for the resting page. */
  readonly hoverSelector: string | null;
  /**
   * Where the state-contrast pass looks for controls to drive.
   *
   * Null for an app that has no controls to drive.
   */
  readonly stateScope: string | null;
  /** Where screenshots go. */
  readonly outDir: string;
  /** The baseline to compare against. */
  readonly baseline: string;
  /** Body text that means the route rendered an error instead of content. */
  readonly errorText: readonly string[];
  /** The page conventions the harness cannot guess. */
  readonly page: PageAdapter;
}

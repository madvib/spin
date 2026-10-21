/**
 * The visual check harness: one browser session against one app, one report.
 *
 * The harness knows how to look; the app knows what it is. A `CheckConfig`
 * supplies the routes, the themes and their modes, the chrome to hover, the
 * geometry claims, the paths, and the page conventions the harness cannot
 * guess — how the app seeds a theme, how it signals it has rendered, and what
 * it reports about itself once it has. Everything the app hands over is
 * serialised into the tab, so each function must carry everything it reads.
 *
 * It is mechanical on purpose. Every rule it enforces is one a person can
 * restate — text at least 4.5 times further from its background than that
 * background is from black, controls a pointer can actually reach, a console
 * with nothing thrown into it, motion a reader can follow, geometry the theme
 * itself named — and the output is a verdict table and an exit code, so it
 * runs on its own.
 *
 * A run compares its findings against the committed baseline: it reports what
 * changed, and `--allow-baseline` makes "what changed" the exit code.
 */

import { chromium, type Page } from "playwright-core";
import {
  AUDIT_GLOBAL,
  type AuditFinding,
  auditInstallScript,
  type AuditResult,
  type ContrastFinding,
} from "./audit.ts";
import {
  animationsSettled,
  blankDocument,
  hoverCandidates,
  type HoverPoint,
  hoverPoint,
} from "./page.ts";
import {
  allMarked,
  markedSelector,
  STATE_MARK,
  STATE_PSEUDO,
  type StateCandidate,
  stateCandidates,
  stateDetail,
  stateFocus,
  stateGuard,
  statesFor,
  stateSubject,
  type SubjectState,
} from "./state.ts";
import { STROBE_FLOOR_MS } from "../../packages/theme/src/contract/motion.ts";
/** Lowest ratio a text node may measure against its background. */
const MIN_CONTRAST = 4.5;
/**
 * An endless animation below this is a strobe: a sweep nobody can follow.
 * The number is the theme contract's (`STROBE_FLOOR_MS`): every starter's
 * loop duration holds it, and this check holds what rendered to it.
 */
const STROBE_MS = STROBE_FLOOR_MS;
const VIEWPORT = { width: 1280, height: 800 };

/** Parses the `--viewport` flag: `1440x900`, not `1440,900`. */
function parseViewport(value: string): { width: number; height: number } {
  const match = /^(\d+)x(\d+)$/.exec(value.trim());
  if (match === null) {
    throw new Error(`--viewport wants WxH, got "${value}"`);
  }
  return { width: Number(match[1]), height: Number(match[2]) };
}

const RENDER_TIMEOUT_MS = 20000;
const NAV_SETTLE_MS = 150;

export type CheckName =
  | "contrast"
  | "state-contrast"
  | "zero-area-interactive"
  | "strobe-animation"
  | "geometry"
  | "console-error"
  | "failed-request"
  | "render-defect";

const CHECKS: readonly CheckName[] = [
  "contrast",
  "state-contrast",
  "zero-area-interactive",
  "strobe-animation",
  "geometry",
  "console-error",
  "failed-request",
  "render-defect",
];

/**
 * The checks whose findings are reported but do not decide the run.
 *
 * A check earns fatality by being right: it fails on nothing, so a failure
 * means something. The state-contrast check is a measurement the themes have
 * not been held to yet, so it reports what it finds and leaves the verdict
 * alone. The owner promotes it by naming it in `--state-contrast-strict`.
 */
const ADVISORY_CHECKS: readonly CheckName[] = ["state-contrast"];

/** One thing the check found, complete enough to appear in a baseline. */
export interface Finding {
  readonly route: string;
  readonly theme: string;
  readonly mode: string;
  readonly check: CheckName;
  /** What the finding is about, so a later run can tell it from its neighbours. */
  readonly subject: string;
  /** What was measured, as one line. */
  readonly detail: string;
  /** The state the subject was measured in. */
  readonly state: SubjectState;
}

/**
 * Identity of a finding in a baseline. The measured value is deliberately not
 * part of it: the same chip in the same state is the same finding whether it
 * measures 1.0:1 or 3.9:1, and a baseline that renamed everything on a ratio
 * change would diff nothing worth reading.
 */
export function findingKey(finding: Finding): string {
  return [
    finding.route,
    finding.theme,
    finding.mode,
    finding.check,
    finding.state,
    finding.subject,
  ].join("|");
}

// ── the app the harness is pointed at ───────────────────────────────────────

export interface Route {
  /** The hash the app routes on, without the leading '#'. */
  readonly hash: string;
  /** The heading the route has to render, when it has one to render. */
  readonly expectHeading: string | null;
}

export interface Matrix {
  readonly route: Route;
  readonly theme: string;
  readonly mode: string;
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

/** The app-side probes, each serialised into the tab by its source. */
export interface PageAdapter {
  /** True once the app has booted on the route it was given. */
  readonly renderReady: () => boolean;
  /** What the rendered page looks like to someone reading it. */
  readonly pageState: () => FrameState;
  /** Seeds the theme and mode the way the app itself stores them. */
  readonly seedTheme: (
    seed: { readonly theme: string; readonly mode: string },
  ) => void;
  /** The geometry claims a route is held to; routes with none carry none. */
  readonly geometryClaimsFor: (hash: string) => readonly string[];
  /** The claims, measured where they render. */
  readonly geometryAudit: (
    options: { readonly claims: readonly string[] },
  ) => readonly GeometryClaim[];
}

/** What the harness cannot know: the app it is checking. */
export interface CheckConfig {
  /** Relative --out/--baseline values resolve against this directory. */
  readonly baseDir: string;
  /** The URL to check when --url is not given. */
  readonly defaultUrl: string;
  /** The route source, e.g. the app's own registry rather than a list beside it. */
  readonly routes: () => readonly Route[];
  /** The themes to render when --themes is not given. */
  readonly themes: readonly string[];
  /** The modes a theme is checked in, e.g. `base` plus its own `dark`. */
  readonly modesFor: (theme: string) => readonly string[];
  /** The chrome hover states are measured on, or null for the resting page. */
  readonly hoverSelector: string | null;
  /**
   * Where the state-contrast pass looks for controls to drive.
   *
   * The app knows which of its parts are chrome and which are the specimen:
   * the harness can drive a control but it cannot tell a nav row from a
   * button. Null for an app that has no controls to drive.
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

// ── the run ─────────────────────────────────────────────────────────────────

interface Options {
  readonly url: string;
  readonly routes: readonly Route[];
  readonly matrix: readonly { theme: string; mode: string }[];
  readonly hover: string | null;
  readonly outDir: string;
  readonly baseline: string | null;
  readonly writeBaseline: string | null;
  readonly allowBaseline: boolean;
  readonly chrome: string | undefined;
  /** Measure the states the app's controls can be in. */
  readonly stateContrast: boolean;
  /** Let the state-contrast findings decide the run. */
  readonly stateStrict: boolean;
}

interface ComboResult {
  readonly matrix: Matrix;
  readonly measured: number;
  readonly unresolved: number;
  readonly hovered: number;
  /** The states the state-contrast pass drove. */
  readonly states: number;
  readonly screenshot: string | null;
  readonly findings: readonly Finding[];
}

/** What the console and the network said while one combo was on screen. */
class PageLog {
  #errors = new Set<string>();
  #failures = new Set<string>();

  install(page: Page): void {
    page.on("console", (message) => {
      if (message.type() !== "error") return;
      const line = message.text().slice(0, 300);
      // A resource the network refused is reported from the request itself
      // below, with the reason attached; the console merely repeats it.
      if (line === "" || line.startsWith("Failed to load resource")) return;
      this.#errors.add(line);
    });
    page.on("pageerror", (error) => {
      const line = error.message.slice(0, 300);
      if (line !== "") this.#errors.add(line);
    });
    page.on("requestfailed", (request) => {
      const reason = request.failure()?.errorText ?? "failed";
      // Navigating away aborts whatever the page it replaced had in flight,
      // which is the browser working rather than the page breaking.
      if (reason === "net::ERR_ABORTED") return;
      this.#failures.add(`${request.url()} — ${reason}`);
    });
  }

  reset(): void {
    this.#errors.clear();
    this.#failures.clear();
  }

  take(): { errors: readonly string[]; failures: readonly string[] } {
    return { errors: [...this.#errors], failures: [...this.#failures] };
  }
}

class Driver {
  readonly #page: Page;
  readonly #log: PageLog;
  readonly #options: Options;
  readonly #config: CheckConfig;
  /**
   * True when the pointer is parked where the browser hit-tests nothing.
   *
   * The state pass moves the pointer onto controls, and a control that is
   * still under the pointer is a control that is still hovered: the resting
   * measurement of the next control has to know whether the pointer is
   * anywhere at all.
   */
  #pointerParked = true;

  constructor(
    page: Page,
    log: PageLog,
    options: Options,
    config: CheckConfig,
  ) {
    this.#page = page;
    this.#log = log;
    this.#options = options;
    this.#config = config;
  }

  async evalPage<T>(expression: string): Promise<T> {
    return await this.#page.evaluate(expression) as T;
  }

  /** A page-side function, called with a JSON argument. */
  #call<T>(source: string, args?: unknown): Promise<T> {
    const expression = args === undefined
      ? `(${source})()`
      : `(${source})(${JSON.stringify(args)})`;
    return this.evalPage<T>(expression);
  }

  /** A pointer outside the viewport, where the browser hit-tests nothing. */
  async neutralPointer(): Promise<void> {
    await this.#page.mouse.move(-100, -100);
    this.#pointerParked = true;
  }

  /**
   * Seeds the theme and mode the way the app stores them. The combos that
   * follow reload the document, so each one boots on the seeded values rather
   * than clicking its way to them.
   */
  async seed(theme: string, mode: string): Promise<void> {
    this.#log.reset();
    await this.#load(`${this.#options.url}`);
    await this.#call(this.#config.page.seedTheme.toString(), { theme, mode });
  }

  /**
   * Loads a fresh document for the given URL.
   *
   * The detour through about:blank is what makes the load real: a browser
   * treats a URL that differs only by hash as the same document, so going
   * straight to the URL would leave the previous route on screen to be
   * measured as this one. The blank is waited for rather than assumed, because
   * the frame it replaces is alive until the navigation commits.
   */
  async #load(url: string): Promise<void> {
    await this.#page.goto("about:blank", {
      waitUntil: "domcontentloaded",
      timeout: RENDER_TIMEOUT_MS,
    }).catch(() => {});
    await this.#waitFor(blankDocument.toString());
    await this.#page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: RENDER_TIMEOUT_MS,
    }).catch(() => {});
    // A route that never paints is a finding below, not a dead run: the app
    // boots, the theme check fires, and the report says what it saw.
    await this.#waitFor(this.#config.page.renderReady.toString());
    await this.#waitFor(animationsSettled.toString());
  }

  /** Polls a page-side predicate until it is true, or until the deadline. */
  async #waitFor(source: string): Promise<boolean> {
    const deadline = Date.now() + RENDER_TIMEOUT_MS;
    while (Date.now() < deadline) {
      if (await this.#call<boolean>(source)) return true;
      await sleep(50);
    }
    return false;
  }

  /** The geometry claims this route is held to, measured where it renders. */
  private async geometry(route: Route): Promise<readonly GeometryClaim[]> {
    const { geometryAudit, geometryClaimsFor } = this.#config.page;
    const claims = geometryClaimsFor(route.hash);
    if (claims.length === 0) return [];
    return await this.#call<readonly GeometryClaim[]>(
      geometryAudit.toString(),
      { claims },
    );
  }

  async check(matrix: Matrix): Promise<ComboResult> {
    const { route, theme, mode } = matrix;
    const findings: Finding[] = [];
    this.#log.reset();
    await this.#load(`${this.#options.url}#${route.hash}`);
    await this.neutralPointer();
    let state = await this.#call<FrameState>(
      this.#config.page.pageState.toString(),
    );

    // A boot that beat the theme write reads null; one reload is about
    // catching that race, not about tolerating a wrong rendering.
    if (state.theme !== theme || state.mode !== mode) {
      await this.#load(`${this.#options.url}#${route.hash}`);
      await this.neutralPointer();
      state = await this.#call<FrameState>(
        this.#config.page.pageState.toString(),
      );
    }
    // A theme or mode that still did not take means everything below
    // measures some other rendering, so the run stops instead of reporting
    // a lie.
    if (state.theme !== theme || state.mode !== mode) {
      throw new Error(
        `${route.hash} · ${theme}/${mode}: rendered as ${state.theme}/${state.mode}`,
      );
    }
    findings.push(
      ...renderDefects(route, state, theme, mode, this.#config.errorText),
    );

    for (const claim of await this.geometry(route)) {
      if (claim.ok) continue;
      findings.push({
        route: route.hash,
        theme,
        mode,
        check: "geometry",
        subject: claim.id,
        detail: claim.detail,
        state: "rest",
      });
    }

    const rested = await this.audit(null);
    for (const finding of rested.findings) {
      findings.push(toFinding(finding, matrix, "rest"));
    }
    const screenshot = await this.screenshot(screenshotName(matrix));

    let hovered = 0;
    if (this.#options.hover !== null) {
      const candidates = await this.#call<readonly { index: number }[]>(
        hoverCandidates.toString(),
        this.#options.hover,
      );
      for (const candidate of candidates) {
        const result = await this.hover(candidate.index);
        hovered++;
        for (const finding of result.findings) {
          findings.push(toFinding(finding, matrix, "hover"));
        }
      }
      await this.neutralPointer();
    }

    let states = 0;
    if (this.#options.stateContrast) {
      const driven = await this.stateContrast(matrix);
      states = driven.states;
      findings.push(...driven.findings);
    }
    await sleep(NAV_SETTLE_MS);

    const log = this.#log.take();
    for (const error of log.errors) {
      findings.push({
        route: route.hash,
        theme,
        mode,
        check: "console-error",
        subject: error,
        detail: "reached the console",
        state: "rest",
      });
    }
    for (const failure of log.failures) {
      findings.push({
        route: route.hash,
        theme,
        mode,
        check: "failed-request",
        subject: failure,
        detail: "the request did not complete",
        state: "rest",
      });
    }

    return {
      matrix,
      measured: rested.measured,
      unresolved: rested.unresolved,
      hovered,
      states,
      screenshot,
      findings,
    };
  }

  /**
   * The audit on the whole page, or on one element. When it is one element,
   * the audit and the hover check are a single round trip, because a finding
   * about a hover state only means something if the pointer landed there.
   */
  private async audit(
    root: { selector: string; index: number } | null,
  ): Promise<AuditResult & { hovered: boolean }> {
    const options = { minContrast: MIN_CONTRAST, strobeMs: STROBE_MS };
    if (root === null) {
      const result = await this.evalPage<AuditResult>(
        `globalThis.${AUDIT_GLOBAL}(${JSON.stringify(options)})`,
      );
      return { ...result, hovered: false };
    }
    const expression = [
      "(() => {",
      `const el = document.querySelectorAll(${
        JSON.stringify(root.selector)
      })[${root.index}] ?? null;`,
      `const result = globalThis.${AUDIT_GLOBAL}({ ...${
        JSON.stringify(options)
      }, root: el });`,
      "return { findings: result.findings, measured: result.measured,",
      '         unresolved: result.unresolved, hovered: el !== null && el.matches(":hover") };',
      "})()",
    ].join("\n");
    return this.evalPage<AuditResult & { hovered: boolean }>(expression);
  }

  private async hover(
    index: number,
  ): Promise<AuditResult & { hovered: boolean }> {
    const selector = this.#options.hover ?? "";
    const point = await this.#call<HoverPoint | null>(hoverPoint.toString(), {
      selector,
      index,
    });
    if (point === null) {
      return { findings: [], measured: 0, unresolved: 0, hovered: false };
    }
    await this.#page.mouse.move(point.x, point.y);
    // Wait out the page's own hover transition, if it has one, so the state
    // measured is the state it settles in.
    if (point.settleMs > 0) await sleep(point.settleMs);
    const result = await this.audit({ selector, index });
    if (!result.hovered) {
      // Occluded, or `pointer-events: none`: no hover state exists to measure.
      return { findings: [], measured: 0, unresolved: 0, hovered: false };
    }
    return result;
  }

  /**
   * The state-contrast pass: every control the app offers, driven into the
   * states a reader can put it in, and measured there.
   *
   * The states are driven in the order a reader meets them — the pointer
   * arrives, the control is pressed, the keyboard arrives — so each state is
   * measured with the states before it already in place. A measurement taken
   * without the state it claims is thrown away: a control under a sticky
   * header is never hovered, and a finding about a hover that never happened
   * is a finding about nothing.
   */
  private async stateContrast(
    matrix: Matrix,
  ): Promise<{
    readonly states: number;
    readonly findings: readonly Finding[];
  }> {
    const scope = this.#config.stateScope;
    if (scope === null) return { states: 0, findings: [] };
    // The page is measured, not operated: a press that lands on a link would
    // navigate, and the document the measurement was taken in would be gone.
    await this.#call(stateGuard.toString());
    const candidates = await this.#call<readonly StateCandidate[]>(
      stateCandidates.toString(),
      { scope, mark: STATE_MARK },
    );
    const findings: Finding[] = [];
    let states = 0;
    for (let index = 0; index < candidates.length; index++) {
      const candidate = candidates[index];
      if (candidate === undefined) continue;
      // Where the pointer reaches the control, found once: the point is the
      // same for every state, and finding it scrolls the page.
      const point = await this.#point(index);
      const driven = await this.#drive(candidate, index, point);
      states += driven.states;
      for (const finding of driven.findings) {
        findings.push({
          route: matrix.route.hash,
          theme: matrix.theme,
          mode: matrix.mode,
          check: "state-contrast",
          ...finding,
        });
      }
    }
    await this.neutralPointer();
    return { states, findings };
  }

  /**
   * Drives one candidate through the states a reader can put it in, and
   * measures what it paints in each.
   *
   * The states are driven in the order a reader meets them — the pointer
   * arrives, the control is pressed, the keyboard arrives — so each state is
   * measured with the states before it already in place, and each one costs
   * only what it has to: a press leaves the focus behind, so the focus state
   * is measured after the press rather than through a second one.
   *
   * A measurement taken without the state it claims is thrown away: a control
   * under a sticky header is never hovered, and a finding about a hover that
   * never happened is a finding about nothing.
   */
  async #drive(
    candidate: StateCandidate,
    index: number,
    point: HoverPoint | null,
  ): Promise<{
    readonly states: number;
    readonly findings:
      readonly (Omit<Finding, "route" | "theme" | "mode" | "check">)[];
  }> {
    const findings: (Omit<
      Finding,
      "route" | "theme" | "mode" | "check"
    >)[] = [];
    let states = 0;
    // The pointer is over the control.
    let onControl = false;
    // The pointer is down on the control.
    let held = false;
    // The control holds the focus, because it was pressed.
    let focused = false;
    for (const state of statesFor(candidate)) {
      switch (state) {
        case "rest":
        case "disabled": {
          // Nothing hovered, nothing focused: the control as it is found.
          if (!this.#pointerParked) {
            await this.neutralPointer();
            this.#pointerParked = true;
          }
          // The control may have been under the pointer a moment ago — the
          // panel that holds it, say — and a control that fades its ink is
          // still fading when the pointer leaves. The resting measurement is
          // of the state the control settles in, not of the way there.
          if (point !== null) await this.#settle(point);
          onControl = false;
          focused = false;
          break;
        }
        case "hover": {
          if (point === null) continue;
          await this.#page.mouse.move(point.x, point.y);
          await this.#settle(point);
          onControl = true;
          this.#pointerParked = false;
          break;
        }
        case "active": {
          if (point === null) continue;
          if (!onControl) {
            await this.#page.mouse.move(point.x, point.y);
            onControl = true;
            this.#pointerParked = false;
          }
          await this.#page.mouse.down();
          held = true;
          await this.#settle(point);
          break;
        }
        case "focus": {
          // The focus a pointer press leaves behind: the control is focused,
          // and the ring is not drawn, because the reader did not ask for it.
          if (!candidate.focusable) continue;
          if (!focused) {
            if (point === null) continue;
            if (!onControl) {
              await this.#page.mouse.move(point.x, point.y);
              onControl = true;
              this.#pointerParked = false;
            }
            await this.#page.mouse.down();
            held = true;
            // The press is released away from the control: a release on top
            // of it is a click, and a click on a link is a route change.
            await this.#page.mouse.move(-100, -100);
            await this.#page.mouse.up();
            held = false;
            onControl = false;
            this.#pointerParked = true;
            focused = true;
          }
          if (point !== null) await this.#settle(point);
          break;
        }
        case "focus-visible": {
          if (!candidate.focusable) continue;
          // A key press is what makes the focus visible: the keyboard
          // arrived, and the browser draws the ring for it.
          await this.#page.keyboard.press("Shift");
          await this.#call(stateFocus.toString(), {
            index,
            mark: STATE_MARK,
          });
          // The focus may repaint the control, and a control that fades its
          // ink is still fading when the measurement is taken.
          if (point !== null) await this.#settle(point);
          focused = true;
          break;
        }
      }
      const measured = await this.#measure(index, state);
      if (measured.reached) states++;
      for (const audit of measured.findings) {
        findings.push({
          subject: stateSubject(candidate.path, audit.sample),
          detail: stateDetail(audit.ratio, audit.color, audit.background),
          state,
        });
      }
      if (state === "active" && held) {
        // The press is released away from the control: a release on top of
        // it is a click, and a click on a link is a route change.
        await this.#page.mouse.move(-100, -100);
        await this.#page.mouse.up();
        held = false;
        onControl = false;
        this.#pointerParked = true;
        focused = candidate.focusable;
      }
    }
    if (held) await this.#page.mouse.up();
    return { states, findings };
  }

  /**
   * The contrast of one candidate in the state it is in, measured by the
   * audit the resting page is measured with.
   *
   * The measurement comes back only if the state was reached: the pseudo-class
   * the state claims has to match, or the measurement is of a state that
   * never happened.
   */
  async #measure(
    index: number,
    state: SubjectState,
  ): Promise<{
    readonly reached: boolean;
    readonly findings: readonly ContrastFinding[];
  }> {
    const options = { minContrast: MIN_CONTRAST, strobeMs: STROBE_MS };
    const resting = state === "rest" || state === "disabled";
    const expression = [
      "(() => {",
      `const all = [...document.querySelectorAll(${
        JSON.stringify(allMarked())
      })];`,
      `const el = all[${index}] ?? null;`,
      "const exclude = el === null ? []",
      "  : all.filter((other) => other !== el && el.contains(other));",
      // The resting measurement is taken of a page at rest: whatever the
      // last control left focused is let go of first.
      ...(resting
        ? [
          "const active = document.activeElement;",
          "if (active instanceof HTMLElement) active.blur();",
        ]
        : []),
      `const result = globalThis.${AUDIT_GLOBAL}({ ...${
        JSON.stringify(options)
      }, root: el, includeInactive: true, exclude });`,
      "return { findings: result.findings,",
      `         reached: el !== null && el.matches(${
        JSON.stringify(STATE_PSEUDO[state])
      }) };`,
      "})()",
    ].join("\n");
    const result = await this.evalPage<
      { findings: readonly AuditFinding[]; reached: boolean }
    >(expression);
    return {
      reached: result.reached,
      findings: result.reached
        ? result.findings.filter((finding) => finding.check === "contrast")
        : [],
    };
  }

  /** Where the pointer must reach to hover a candidate. */
  async #point(index: number): Promise<HoverPoint | null> {
    return await this.#call<HoverPoint | null>(hoverPoint.toString(), {
      selector: markedSelector(index),
      index: 0,
    });
  }

  /** Waits out a transition, if the control has one. */
  async #settle(point: HoverPoint): Promise<void> {
    if (point.settleMs > 0) await sleep(point.settleMs);
  }

  async screenshot(name: string): Promise<string> {
    await Deno.mkdir(this.#options.outDir, { recursive: true });
    const path = `${this.#options.outDir}/${name}.png`;
    // A frozen frame. An animation captured mid-sweep is a different image
    // every run, and a capture that cannot be compared is not evidence.
    await this.#page.screenshot({ path, animations: "disabled" });
    return path;
  }
}

function renderDefects(
  route: Route,
  state: FrameState,
  theme: string,
  mode: string,
  errorText: readonly string[],
): readonly Finding[] {
  const defects: Finding[] = [];
  const finding = (subject: string, detail: string): Finding => ({
    route: route.hash,
    theme,
    mode,
    check: "render-defect",
    subject,
    detail,
    state: "rest",
  });
  if (route.expectHeading !== null && state.heading !== route.expectHeading) {
    defects.push(
      finding(
        "route heading",
        `expected "${route.expectHeading}", rendered "${
          state.heading ?? "nothing"
        }"`,
      ),
    );
  }
  if (errorText.some((text) => state.text.includes(text))) {
    defects.push(finding("route body", "rendered an error instead of content"));
  }
  if (state.text.length < 40) {
    defects.push(
      finding("route body", `rendered ${state.text.length} characters`),
    );
  }
  return defects;
}

function toFinding(
  audit: AuditFinding,
  matrix: Matrix,
  state: SubjectState,
): Finding {
  const { route, theme, mode } = matrix;
  const base = { route: route.hash, theme, mode, state };
  switch (audit.check) {
    case "contrast":
      return {
        ...base,
        check: "contrast",
        subject: `${audit.selector} "${audit.sample}"`,
        detail: `${
          audit.ratio.toFixed(2)
        }:1 — ${audit.color} on ${audit.background}`,
      };
    case "zero-area-interactive":
      return {
        ...base,
        check: "zero-area-interactive",
        subject: `${audit.selector} "${audit.sample}"`,
        detail: "occupies no area, so no pointer reaches it",
      };
    case "strobe-animation":
      return {
        ...base,
        check: "strobe-animation",
        subject: `${audit.selector} ${audit.animation}`,
        detail: `endless loop at ${audit.durationMs}ms`,
      };
  }
}

function screenshotName(matrix: Matrix): string {
  const route = matrix.route.hash.replace(/^\/+/, "").replace(/\//g, "-");
  return `${route === "" ? "landing" : route}-${matrix.theme}-${matrix.mode}`;
}

function sleep(ms: number): Promise<void> {
  const { promise, resolve } = Promise.withResolvers<void>();
  setTimeout(resolve, ms);
  return promise;
}

// ── the report ──────────────────────────────────────────────────────────────

interface Baseline {
  readonly findings: readonly Finding[];
}

async function readBaseline(path: string): Promise<Baseline | null> {
  try {
    const parsed = JSON.parse(await Deno.readTextFile(path)) as {
      findings?: unknown;
    };
    return {
      findings: Array.isArray(parsed.findings)
        ? parsed.findings as Finding[]
        : [],
    };
  } catch {
    return null;
  }
}

interface Diff {
  readonly added: number;
  readonly removed: number;
  readonly addedFindings: readonly Finding[];
}

function diffAgainst(baseline: Baseline, findings: readonly Finding[]): Diff {
  const known = new Set(baseline.findings.map(findingKey));
  const current = new Map(
    findings.map((finding) => [findingKey(finding), finding]),
  );
  const added = [...current.keys()].filter((key) => !known.has(key));
  const removed = [...known].filter((key) => !current.has(key));
  const addedFindings: Finding[] = [];
  for (const key of added) {
    const finding = current.get(key);
    if (finding !== undefined) addedFindings.push(finding);
  }
  return {
    added: addedFindings.length,
    removed: removed.length,
    addedFindings,
  };
}

async function writeBaseline(
  path: string,
  results: readonly ComboResult[],
  options: Options,
): Promise<void> {
  const findings = results.flatMap((result) => result.findings);
  const counts: Record<string, number> = {};
  for (const finding of findings) {
    counts[finding.check] = (counts[finding.check] ?? 0) + 1;
  }
  const baseline = {
    url: options.url,
    themes: [...new Set(results.map((result) => result.matrix.theme))],
    modes: [...new Set(results.map((result) => result.matrix.mode))],
    routes: results.length,
    findings,
    counts,
  };
  // Atomic: a half-written baseline is worse than no baseline — it would
  // read as "the reference has no defects" to the next run. Write beside the
  // target, then rename over it.
  const payload = `${JSON.stringify(baseline, null, 1)}\n`;
  const temporary = `${path}.partial`;
  await Deno.writeTextFile(temporary, payload);
  await Deno.rename(temporary, path);
  console.log(`baseline written to ${path}: ${findings.length} findings`);
}

/**
 * Findings that describe one place in one state: same route, same subject,
 * same state. A matrix repeats each of them once per theme/mode pair, which is
 * the point of the matrix and not worth printing one line per pair for.
 */
function groupBy(findings: readonly Finding[]): readonly Group[] {
  const groups = new Map<string, Finding[]>();
  for (const finding of findings) {
    const key = [finding.route, finding.subject, finding.state].join("|");
    const group = groups.get(key);
    if (group === undefined) groups.set(key, [finding]);
    else group.push(finding);
  }
  const ordered: Group[] = [];
  for (const group of groups.values()) {
    ordered.push({ findings: group });
  }
  return ordered;
}

interface Group {
  readonly findings: readonly Finding[];
}

/**
 * Whether a check's findings decide the run.
 *
 * A check earns fatality by being right: it fails on nothing, so a failure
 * means something. An advisory check reports what it measured and leaves the
 * verdict to the checks that have earned it.
 */
function isFatal(check: CheckName, options: Options): boolean {
  if (!ADVISORY_CHECKS.includes(check)) return true;
  return options.stateStrict;
}

async function report(
  results: readonly ComboResult[],
  options: Options,
  elapsedMs: number,
  viewport: { readonly width: number; readonly height: number },
): Promise<Diff> {
  const findings = results.flatMap((result) => result.findings);
  const combos = new Map<CheckName, { count: number; combos: Set<string> }>();
  for (const check of CHECKS) {
    combos.set(check, { count: 0, combos: new Set() });
  }
  for (const finding of findings) {
    const entry = combos.get(finding.check);
    if (entry === undefined) continue;
    entry.count++;
    entry.combos.add(`${finding.route}|${finding.theme}|${finding.mode}`);
  }

  const measured = results.reduce((sum, result) => sum + result.measured, 0);
  const unresolved = results.reduce(
    (sum, result) => sum + result.unresolved,
    0,
  );
  const probes = results.reduce((sum, result) => sum + result.hovered, 0);
  const states = results.reduce((sum, result) => sum + result.states, 0);

  console.log(
    `\nspin visual check — ${results.length} combos over ` +
      `${options.routes.length} routes × ${options.matrix.length} theme/mode pairs`,
  );
  console.log(
    `url ${options.url} · viewport ${viewport.width}×${viewport.height} · ` +
      `${(elapsedMs / 1000).toFixed(1)}s`,
  );
  console.log(
    `${measured} text nodes measured · ${unresolved} skipped over a gradient · ` +
      `${probes} hover probes · ${states} state probes · screenshots in ${options.outDir}`,
  );
  console.log("");
  console.log("CHECK                   FINDINGS  COMBOS  RESULT");
  for (const check of CHECKS) {
    const entry = combos.get(check) ?? { count: 0, combos: new Set<string>() };
    const ran = check !== "state-contrast" || options.stateContrast;
    const result = !ran
      ? "skipped"
      : entry.count === 0
      ? "ok"
      : isFatal(check, options)
      ? "FAIL"
      : "REPORT";
    console.log(
      `${check.padEnd(22)}  ${String(entry.count).padStart(8)}  ` +
        `${String(entry.combos.size).padStart(6)}  ${result}`,
    );
  }

  // Findings repeat across the matrix — the same chip in the same state is the
  // same finding in five theme/mode pairs — so they are reported once, with
  // the pairs they were measured in and every value that measured.
  for (const check of CHECKS) {
    const groups = groupBy(
      findings.filter((finding) => finding.check === check),
    );
    if (groups.length === 0) continue;
    console.log(
      `\n${isFatal(check, options) ? "FAIL" : "REPORT"} ${check} — ${
        groups.reduce((sum, g) => sum + g.findings.length, 0)
      } findings in ${groups.length} places`,
    );
    for (const group of groups) {
      const first = group.findings[0];
      if (first === undefined) continue;
      console.log(
        `  ${first.route}${
          first.state === "rest" ? "" : ` (${first.state})`
        } · ${group.findings.length} pair${
          group.findings.length === 1 ? "" : "s"
        }`,
      );
      console.log(`      ${first.subject}`);
      const measured = new Map<string, number>();
      for (const finding of group.findings) {
        measured.set(finding.detail, (measured.get(finding.detail) ?? 0) + 1);
      }
      for (const [detail, count] of measured) {
        console.log(`      ${detail}${count > 1 ? ` (${count}×)` : ""}`);
      }
    }
  }

  if (options.baseline === null) {
    console.log("\nno baseline comparison");
    return { added: findings.length, removed: 0, addedFindings: findings };
  }
  const baseline = await readBaseline(options.baseline);
  if (baseline === null) {
    console.log(`\nno baseline at ${options.baseline}`);
    return { added: findings.length, removed: 0, addedFindings: findings };
  }
  const diff = diffAgainst(baseline, findings);
  const advisory =
    diff.addedFindings.filter((finding) => !isFatal(finding.check, options))
      .length;
  console.log(
    `\nbaseline ${options.baseline}: ${baseline.findings.length} findings known`,
  );
  console.log(
    `  +${diff.added} new since the baseline  -${diff.removed} no longer found`,
  );
  if (advisory > 0) {
    console.log(
      `  ${advisory} of the new findings are advisory: they are reported, ` +
        "not counted against the run",
    );
  }
  for (const finding of diff.addedFindings) {
    console.log(
      `  + ${finding.route} · ${finding.theme}/${finding.mode} — ${finding.subject}${
        finding.state === "rest" ? "" : ` (${finding.state})`
      }`,
    );
  }
  return diff;
}

// ── the entry point ─────────────────────────────────────────────────────────

function usage(config: CheckConfig): string {
  return `usage: check.ts [options]

  --url URL              app under test (default ${config.defaultUrl})
  --route SUBSTRING      only routes whose hash contains this (repeatable)
  --themes a,b,c         themes to render (default ${config.themes.join(", ")})
  --modes a,b,c          modes to render (default: each theme's own modes)
  --hover SELECTOR       elements to hover while measuring (default ${
    config.hoverSelector ?? "none"
  })
  --no-hover             measure the resting page only
  --state-contrast       measure every control in the states it can be in
                         (advisory: reported, but the run still passes)
  --state-contrast-strict  the same, and let its findings decide the run
  --out DIR              where screenshots go (default ${config.outDir})
  --baseline PATH        compare against this baseline (default ${config.baseline})
  --no-baseline          run without a baseline comparison
  --write-baseline PATH  write a baseline report to this path
  --allow-baseline       exit 0 when nothing new appears beyond the baseline
  --chrome PATH          Chromium executable to drive (default: playwright's own)
  --viewport WxH         viewport for every capture (default 1280x800)
  --help                 this message
`;
}

interface ParsedArgs {
  readonly values: Map<string, string[]>;
  readonly present: Set<string>;
}

function parseArgs(argv: readonly string[]): ParsedArgs {
  const values = new Map<string, string[]>();
  const present = new Set<string>();
  for (let index = 0; index < argv.length; index++) {
    const argument = argv[index];
    if (argument === undefined || !argument.startsWith("--")) continue;
    const equals = argument.indexOf("=");
    if (equals >= 0) {
      const key = argument.slice(2, equals);
      const value = argument.slice(equals + 1);
      values.set(key, [...(values.get(key) ?? []), value]);
      present.add(key);
      continue;
    }
    const key = argument.slice(2);
    const next = argv[index + 1];
    if (next !== undefined && !next.startsWith("--")) {
      values.set(key, [...(values.get(key) ?? []), next]);
      index++;
    }
    present.add(key);
  }
  return { values, present };
}

function selectRoutes(
  config: CheckConfig,
  filters: readonly string[],
): readonly Route[] {
  const routes = config.routes();
  if (filters.length === 0) return routes;
  return routes.filter((route) =>
    filters.some((filter) => route.hash.includes(filter))
  );
}

function resolveMatrix(
  config: CheckConfig,
  themes: readonly string[],
  modes: readonly string[],
): readonly { theme: string; mode: string }[] {
  const chosen = themes.length === 0 ? config.themes : themes;
  const matrix: { theme: string; mode: string }[] = [];
  for (const theme of chosen) {
    if (!config.themes.includes(theme)) {
      throw new Error(
        `no theme named "${theme}". Known themes: ${config.themes.join(", ")}.`,
      );
    }
    // A theme's own modes, because a theme with one rendering checked
    // twice would measure the same frame twice. "base" is the app's name for
    // the theme's own base; "dark" is the override set a theme that serves
    // it carries.
    const declared = modes.length === 0 ? config.modesFor(theme) : modes;
    for (const mode of declared) matrix.push({ theme, mode });
  }
  return matrix;
}

/** A relative path in an argument, resolved against the app's own directory. */
function resolvePath(baseDir: string, value: string): string {
  return value.startsWith("/") ? value : `${baseDir}${value}`;
}

export async function runCheck(
  config: CheckConfig,
  argv: readonly string[],
): Promise<number> {
  const args = parseArgs(argv);
  if (args.present.has("help")) {
    console.log(usage(config).trimEnd());
    return 0;
  }
  const viewport = last(args.values.get("viewport")) === undefined
    ? VIEWPORT
    : parseViewport(last(args.values.get("viewport")) ?? "");
  const options: Options = {
    url: last(args.values.get("url")) ?? config.defaultUrl,
    routes: selectRoutes(config, args.values.get("route") ?? []),
    matrix: resolveMatrix(
      config,
      args.values.get("themes") ?? [],
      args.values.get("modes") ?? [],
    ),
    hover: args.present.has("no-hover")
      ? null
      : (last(args.values.get("hover")) ?? config.hoverSelector),
    outDir: resolvePath(
      config.baseDir,
      last(args.values.get("out")) ?? config.outDir,
    ),
    baseline: args.present.has("no-baseline") ? null : resolvePath(
      config.baseDir,
      last(args.values.get("baseline")) ?? config.baseline,
    ),
    writeBaseline: args.present.has("write-baseline")
      ? resolvePath(
        config.baseDir,
        last(args.values.get("write-baseline")) ?? config.baseline,
      )
      : null,
    allowBaseline: args.present.has("allow-baseline"),
    chrome: last(args.values.get("chrome")),
    // The state-contrast pass is opt-in: it drives every control in every
    // state, which costs a pointer press per control, and the themes have
    // not been held to it yet. The strict form lets its findings decide the
    // run, which is where it goes once they do.
    stateContrast: args.present.has("state-contrast") ||
      args.present.has("state-contrast-strict"),
    stateStrict: args.present.has("state-contrast-strict"),
  };
  if (options.routes.length === 0) {
    console.error("no routes match the filters given");
    return 2;
  }

  const reachable = await checkReachable(options.url);
  if (reachable !== null) {
    console.error(reachable);
    return 2;
  }

  const browser = await chromium.launch({
    executablePath: options.chrome,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  try {
    const page = await browser.newPage({ viewport });
    // The audit lives in the document, not in the call: each combo loads a
    // fresh one, and every evaluation after this is a symbol lookup.
    await page.addInitScript({ content: auditInstallScript() });
    const log = new PageLog();
    log.install(page);
    const driver = new Driver(page, log, options, config);

    const startedAt = Date.now();
    const results: ComboResult[] = [];
    let seeded: { theme: string; mode: string } | null = null;
    const total = options.matrix.length * options.routes.length;
    let done = 0;
    for (const pair of options.matrix) {
      if (seeded?.theme !== pair.theme || seeded?.mode !== pair.mode) {
        await driver.seed(pair.theme, pair.mode);
        seeded = pair;
      }
      for (const route of options.routes) {
        const matrix: Matrix = { route, theme: pair.theme, mode: pair.mode };
        const result = await driver.check(matrix);
        results.push(result);
        done++;
        console.log(
          `[${done}/${total}] ${route.hash} · ${pair.theme}/${pair.mode} — ` +
            `${result.findings.length} findings`,
        );
      }
    }

    const diff = await report(
      results,
      options,
      Date.now() - startedAt,
      viewport,
    );
    if (options.writeBaseline !== null) {
      await writeBaseline(options.writeBaseline, results, options);
      // The refresh is the job: the exit code says nothing about the old
      // baseline it just replaced.
      return 0;
    }
    // The verdict is the checks that have earned it. An advisory check reports
    // what it measured and leaves the exit code to the ones that fail.
    const fatal = results
      .flatMap((result) => result.findings)
      .filter((finding) => isFatal(finding.check, options));
    if (fatal.length === 0) return 0;
    const fatalAdded = diff.addedFindings.filter((finding) =>
      isFatal(finding.check, options)
    ).length;
    return options.allowBaseline && fatalAdded === 0 ? 0 : 1;
  } finally {
    await browser.close();
  }
}

function last(values: readonly string[] | undefined): string | undefined {
  return values === undefined || values.length === 0
    ? undefined
    : values[values.length - 1];
}

/** The reason the app is unreachable, or null when it answered. */
async function checkReachable(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    await fetch(url, { signal: controller.signal });
    return null;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return `the app under test is not reachable at ${url} (${reason}). ` +
      `Start it first: deno task serve`;
  } finally {
    clearTimeout(timer);
  }
}

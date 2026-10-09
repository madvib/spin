#!/usr/bin/env -S deno run --allow-read --allow-write --allow-net --allow-run --allow-env
/**
 * The visual oracle: a check that runs the reference in a real browser and
 * reports what someone looking at it could not miss.
 *
 * It is mechanical on purpose. Every rule it enforces is one a person can
 * restate — text at least 4.5 times further from its background than that
 * background is from black, controls a pointer can actually reach, a console
 * with nothing thrown into it, motion a reader can follow — and the output is
 * a verdict table and an exit code, so it runs on its own.
 *
 *   deno task visual                                   # the whole matrix
 *   deno task visual -- --route components/button      # one route
 *   deno task visual -- --write-baseline               # refresh the baseline
 *
 * A run compares its findings against the committed baseline: it reports what
 * changed, and `--allow-baseline` makes "what changed" the exit code.
 */

import {
  AUDIT_GLOBAL,
  type AuditFinding,
  auditInstallScript,
  type AuditResult,
} from "./audit.ts";
import { launchChromium } from "./chromium.ts";
import type { CdpSession } from "./cdp.ts";
import {
  animationsSettled,
  blankDocument,
  hoverCandidates,
  hoverPoint,
  pageState,
  renderReady,
  seedTheme,
} from "./pages.ts";
import type { HoverPoint } from "./pages.ts";
import { PRIMITIVES } from "../../apps/reference/src/primitives.ts";
import { SECTIONS } from "../../packages/preset/src/organization.ts";
import {
  starterThemes,
  themeModes,
} from "../../packages/theme/src/themes/index.ts";

/** The worktree root, so every path means the same thing wherever it is run. */
const REPO_ROOT = new URL("../../", import.meta.url).pathname;

const DEFAULT_URL = "http://localhost:5199";
const DEFAULT_OUT = "oracles/visual/out";
const DEFAULT_BASELINE = "oracles/visual/baseline.json";
/** Lowest ratio a text node may measure against its background. */
const MIN_CONTRAST = 4.5;
/**
 * An endless animation below this is a strobe: a sweep nobody can follow. The
 * reference's own loader sweeps at `motion.slow` (400ms), so anything under a
 * quarter of a second is a decision that has to be named.
 */
const STROBE_MS = 250;
const VIEWPORT = { width: 1280, height: 800 };

/** Parses the `--viewport` flag: `1440x900`, not `1440,900`. */
function parseViewport(value: string): { width: number; height: number } {
  const match = /^(\d+)x(\d+)$/.exec(value.trim());
  if (match === null) {
    throw new Error(`--viewport wants WxH, got "${value}"`);
  }
  return { width: Number(match[1]), height: Number(match[2]) };
}
/** The chrome every route shares, which is where hover states are decided. */
const HOVER_SELECTOR = "nav button, nav a";
const RENDER_TIMEOUT_MS = 20000;
const NAV_SETTLE_MS = 150;

export type CheckName =
  | "contrast"
  | "zero-area-interactive"
  | "strobe-animation"
  | "console-error"
  | "failed-request"
  | "render-defect";

const CHECKS: readonly CheckName[] = [
  "contrast",
  "zero-area-interactive",
  "strobe-animation",
  "console-error",
  "failed-request",
  "render-defect",
];

/** One thing the oracle found, complete enough to appear in a baseline. */
export interface Finding {
  readonly route: string;
  readonly theme: string;
  readonly mode: string;
  readonly check: CheckName;
  /** What the finding is about, so a later run can tell it from its neighbours. */
  readonly subject: string;
  /** What was measured, as one line. */
  readonly detail: string;
  /** True when the pointer was on the subject when it was measured. */
  readonly hovered: boolean;
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
    finding.hovered ? "hover" : "rest",
    finding.subject,
  ].join("|");
}

// ── the matrix ──────────────────────────────────────────────────────────────

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

/**
 * Routes come from the app rather than from a list kept beside it: a primitive
 * added to the registry is a route the next run checks, and one removed stops
 * being checked.
 */
export function defaultRoutes(): readonly Route[] {
  return [
    { hash: "/components", expectHeading: "Primitives" },
    ...PRIMITIVES.map((primitive) => ({
      hash: `/components/${primitive.id}`,
      expectHeading: primitive.title,
    })),
    // The bare utilities route is the section index. It has to render the
    // index; today it renders the section it was not given. No heading is
    // pinned here: what the index is called is the app's to decide.
    { hash: "/utilities", expectHeading: null },
    ...SECTIONS.map((section) => ({
      hash: `/utilities/${section.id}`,
      expectHeading: section.title,
    })),
  ];
}

const THEMES = starterThemes as unknown as Record<
  string,
  Parameters<typeof themeModes>[0]
>;

const DEFAULT_THEMES = Object.keys(THEMES);

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
}

interface ComboResult {
  readonly matrix: Matrix;
  readonly measured: number;
  readonly unresolved: number;
  readonly hovered: number;
  readonly screenshot: string | null;
  readonly findings: readonly Finding[];
}

interface FrameState {
  readonly heading: string | null;
  readonly text: string;
  readonly theme: string | null;
  readonly mode: string | null;
}

/** What the console and the network said while one combo was on screen. */
class PageLog {
  #errors = new Set<string>();
  #warnings = new Set<string>();
  #requestUrls = new Map<string, string>();
  #failures = new Map<string, string>();

  install(session: CdpSession): void {
    session.on("Runtime.exceptionThrown", (params) => {
      const details = params.exceptionDetails as {
        text?: string;
        exception?: { description?: string };
      } | undefined;
      const parts = [details?.text, details?.exception?.description]
        .filter((part) => part !== undefined && part !== "");
      if (parts.length > 0) this.#errors.add(parts.join(" ").slice(0, 300));
    });
    session.on("Runtime.consoleAPICalled", (params) => {
      const level = String(params.type);
      const parts =
        ((params.args ?? []) as { value?: unknown; description?: string }[])
          .map((arg) => String(arg.value ?? arg.description ?? ""))
          .filter((part) => part !== "");
      if (parts.length === 0) return;
      const line = parts.join(" ").slice(0, 300);
      if (level === "error") this.#errors.add(line);
      else if (level === "warning") this.#warnings.add(line);
    });
    session.on("Log.entryAdded", (params) => {
      const entry = params.entry as {
        level?: string;
        text?: string;
        source?: string;
      } | undefined;
      // The Network domain already reports failures with more detail than the
      // log entry that repeats them.
      if (entry?.source === "network") return;
      const line = (entry?.text ?? "").slice(0, 300);
      if (line === "") return;
      if (entry?.level === "error") this.#errors.add(line);
      else if (entry?.level === "warning") this.#warnings.add(line);
    });
    session.on("Network.requestWillBeSent", (params) => {
      const url = (params.request as { url?: string } | undefined)?.url;
      if (url !== undefined) {
        this.#requestUrls.set(String(params.requestId), url);
      }
    });
    session.on("Network.loadingFailed", (params) => {
      const errorText = String(params.errorText ?? "failed");
      // Navigating away aborts whatever the page it replaced had in flight,
      // which is the browser working rather than the page breaking.
      if (errorText === "net::ERR_ABORTED" || params.canceled === true) return;
      const url = this.#requestUrls.get(String(params.requestId)) ?? "unknown";
      this.#failures.set(url, errorText);
    });
  }

  reset(): void {
    this.#errors.clear();
    this.#warnings.clear();
    this.#requestUrls.clear();
    this.#failures.clear();
  }

  take(): {
    errors: readonly string[];
    warnings: readonly string[];
    failures: readonly string[];
  } {
    return {
      errors: [...this.#errors],
      warnings: [...this.#warnings],
      failures: [...this.#failures].map(([url, reason]) =>
        `${url} — ${reason}`
      ),
    };
  }
}

class Driver {
  readonly #session: CdpSession;
  readonly #log: PageLog;
  readonly #options: Options;

  constructor(session: CdpSession, log: PageLog, options: Options) {
    this.#session = session;
    this.#log = log;
    this.#options = options;
  }

  async evalPage<T>(expression: string): Promise<T> {
    const outcome = await this.#session.command<{
      result: { value: T };
      exceptionDetails?: {
        text: string;
        exception?: { description?: string };
      };
    }>("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (outcome.exceptionDetails !== undefined) {
      const details = outcome.exceptionDetails;
      throw new Error(
        `page evaluation failed: ${
          details.exception?.description ?? details.text
        }\n  in: ${expression.slice(0, 300)}`,
      );
    }
    return outcome.result.value;
  }

  /** A page-side function, called with a JSON argument. */
  #call<T>(source: string, args?: unknown): Promise<T> {
    const expression = args === undefined
      ? `(${source})()`
      : `(${source})(${JSON.stringify(args)})`;
    return this.evalPage<T>(expression);
  }

  /** A pointer outside the viewport, where Chromium hit-tests nothing. */
  async neutralPointer(): Promise<void> {
    await this.#session.command("Input.dispatchMouseEvent", {
      type: "mouseMoved",
      x: -100,
      y: -100,
    });
  }

  /**
   * Seeds the theme and mode the way the app stores them. The combos that
   * follow reload the document, so each one boots on the seeded values rather
   * than clicking its way to them.
   */
  async seed(theme: string, mode: string): Promise<void> {
    this.#log.reset();
    await this.#load(`${this.#options.url}`);
    await this.#call(seedTheme.toString(), { theme, mode });
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
    await this.#session.command("Page.navigate", { url: "about:blank" });
    await this.#waitFor(blankDocument.toString());
    await this.#session.command("Page.navigate", { url });
    // A route that never paints is a finding below, not a dead run: the app
    // boots, the theme check fires, and the report says what it saw.
    await this.#waitFor(renderReady.toString());
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

  async check(matrix: Matrix): Promise<ComboResult> {
    const { route, theme, mode } = matrix;
    const findings: Finding[] = [];
    this.#log.reset();
    await this.#load(`${this.#options.url}#${route.hash}`);
    await this.neutralPointer();
    const state = await this.#call<FrameState>(pageState.toString());

    // A theme or mode that did not take means everything below measures some
    // other rendering, so the run stops instead of reporting a lie.
    if (state.theme !== theme || state.mode !== mode) {
      throw new Error(
        `${route.hash} · ${theme}/${mode}: rendered as ${state.theme}/${state.mode}`,
      );
    }
    findings.push(...renderDefects(route, state, theme, mode));

    const rested = await this.audit(null);
    for (const finding of rested.findings) {
      findings.push(toFinding(finding, matrix, false));
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
          findings.push(toFinding(finding, matrix, true));
        }
      }
      await this.neutralPointer();
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
        hovered: false,
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
        hovered: false,
      });
    }

    return {
      matrix,
      measured: rested.measured,
      unresolved: rested.unresolved,
      hovered,
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
    await this.#session.command("Input.dispatchMouseEvent", {
      type: "mouseMoved",
      x: point.x,
      y: point.y,
    });
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

  async screenshot(name: string): Promise<string> {
    // A frozen frame. An animation captured mid-sweep is a different image
    // every run, and a capture that cannot be compared is not evidence.
    await this.#session
      .command("Animation.setPlaybackRate", { playbackRate: 0 })
      .catch(() => {});
    const capture = await this.#session.command<{ data: string }>(
      "Page.captureScreenshot",
      { format: "png" },
    );
    await Deno.mkdir(this.#options.outDir, { recursive: true });
    const path = `${this.#options.outDir}/${name}.png`;
    await Deno.writeFile(path, Uint8Array.fromBase64(capture.data));
    return path;
  }
}

function renderDefects(
  route: Route,
  state: FrameState,
  theme: string,
  mode: string,
): readonly Finding[] {
  const defects: Finding[] = [];
  const finding = (subject: string, detail: string): Finding => ({
    route: route.hash,
    theme,
    mode,
    check: "render-defect",
    subject,
    detail,
    hovered: false,
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
  if (
    state.text.includes("No such section") || state.text.includes("Not found")
  ) {
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
  hovered: boolean,
): Finding {
  const { route, theme, mode } = matrix;
  const base = { route: route.hash, theme, mode, hovered };
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
 * same hover. A matrix repeats each of them once per theme/mode pair, which is
 * the point of the matrix and not worth printing one line per pair for.
 */
function groupBy(findings: readonly Finding[]): readonly Group[] {
  const groups = new Map<string, Finding[]>();
  for (const finding of findings) {
    const key = [finding.route, finding.subject, finding.hovered].join("|");
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

  console.log(
    `\nspin visual oracle — ${results.length} combos over ` +
      `${options.routes.length} routes × ${options.matrix.length} theme/mode pairs`,
  );
  console.log(
    `url ${options.url} · viewport ${viewport.width}×${viewport.height} · ` +
      `${(elapsedMs / 1000).toFixed(1)}s`,
  );
  console.log(
    `${measured} text nodes measured · ${unresolved} skipped over a gradient · ` +
      `${probes} hover probes · screenshots in ${options.outDir}`,
  );
  console.log("");
  console.log("CHECK                   FINDINGS  COMBOS  RESULT");
  for (const check of CHECKS) {
    const entry = combos.get(check) ?? { count: 0, combos: new Set<string>() };
    console.log(
      `${check.padEnd(22)}  ${String(entry.count).padStart(8)}  ` +
        `${String(entry.combos.size).padStart(6)}  ${
          entry.count === 0 ? "ok" : "FAIL"
        }`,
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
      `\nFAIL ${check} — ${
        groups.reduce((sum, g) => sum + g.findings.length, 0)
      } findings in ${groups.length} places`,
    );
    for (const group of groups) {
      const first = group.findings[0];
      if (first === undefined) continue;
      console.log(
        `  ${first.route}${
          first.hovered ? " (hovered)" : ""
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
  console.log(
    `\nbaseline ${options.baseline}: ${baseline.findings.length} findings known`,
  );
  console.log(
    `  +${diff.added} new since the baseline  -${diff.removed} no longer found`,
  );
  for (const finding of diff.addedFindings) {
    console.log(
      `  + ${finding.route} · ${finding.theme}/${finding.mode} — ${finding.subject}`,
    );
  }
  return diff;
}

// ── the entry point ─────────────────────────────────────────────────────────

const USAGE = `usage: check.ts [options]

  --url URL              app under test (default http://localhost:5199)
  --route SUBSTRING      only routes whose hash contains this (repeatable)
  --themes a,b,c         themes to render (default: the starters)
  --modes a,b,c          modes to render (default: base plus the theme's own)
  --hover SELECTOR       elements to hover while measuring (default: nav chrome)
  --no-hover             measure the resting page only
  --out DIR              where screenshots go (default oracles/visual/out)
  --baseline PATH        compare against this baseline (default oracles/visual/baseline.json)
  --no-baseline          run without a baseline comparison
  --write-baseline PATH  write a baseline report to this path
  --allow-baseline       exit 0 when nothing new appears beyond the baseline
  --chrome PATH          Chromium executable to drive
  --viewport WxH         viewport for every capture (default 1280x800)
  --help                 this message
`;

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

function selectRoutes(filters: readonly string[]): readonly Route[] {
  const routes = defaultRoutes();
  if (filters.length === 0) return routes;
  return routes.filter((route) =>
    filters.some((filter) => route.hash.includes(filter))
  );
}

function resolveMatrix(
  themes: readonly string[],
  modes: readonly string[],
): readonly { theme: string; mode: string }[] {
  const chosen = themes.length === 0 ? DEFAULT_THEMES : themes;
  const matrix: { theme: string; mode: string }[] = [];
  for (const theme of chosen) {
    if (THEMES[theme] === undefined) {
      throw new Error(
        `no theme named "${theme}". The starters are ${
          DEFAULT_THEMES.join(", ")
        }.`,
      );
    }
    // A theme's own modes, because a theme without a dark group renders one
    // way and checking it twice would measure the same frame twice.
    const declared = modes.length === 0
      ? ["base", ...themeModes(THEMES[theme])]
      : modes;
    for (const mode of declared) matrix.push({ theme, mode });
  }
  return matrix;
}

function repoPath(relative: string): string {
  return relative.startsWith("/") ? relative : `${REPO_ROOT}${relative}`;
}

export async function main(argv: readonly string[]): Promise<number> {
  const args = parseArgs(argv);
  if (args.present.has("help")) {
    console.log(USAGE.trimEnd());
    return 0;
  }
  const viewport = last(args.values.get("viewport")) === undefined
    ? VIEWPORT
    : parseViewport(last(args.values.get("viewport")) ?? "");
  const options: Options = {
    url: last(args.values.get("url")) ?? DEFAULT_URL,
    routes: selectRoutes(args.values.get("route") ?? []),
    matrix: resolveMatrix(
      args.values.get("themes") ?? [],
      args.values.get("modes") ?? [],
    ),
    hover: args.present.has("no-hover")
      ? null
      : (last(args.values.get("hover")) ?? HOVER_SELECTOR),
    outDir: repoPath(last(args.values.get("out")) ?? DEFAULT_OUT),
    baseline: args.present.has("no-baseline")
      ? null
      : repoPath(last(args.values.get("baseline")) ?? DEFAULT_BASELINE),
    writeBaseline: args.present.has("write-baseline")
      ? repoPath(last(args.values.get("write-baseline")) ?? DEFAULT_BASELINE)
      : null,
    allowBaseline: args.present.has("allow-baseline"),
    chrome: last(args.values.get("chrome")),
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

  const launched = await launchChromium({
    executable: options.chrome,
    viewport,
  });
  try {
    const target = await launched.socket.command<{ targetId: string }>(
      "Target.createTarget",
      { url: "about:blank" },
    );
    const session = await launched.socket.attach(target.targetId);
    for (const domain of ["Page", "Runtime", "Log", "Network", "Animation"]) {
      await session.command(`${domain}.enable`);
    }
    // The audit lives in the document, not in the call: each combo loads a
    // fresh one, and every evaluation after this is a symbol lookup.
    await session.command("Page.addScriptToEvaluateOnNewDocument", {
      source: auditInstallScript(),
    });
    await session.command("Emulation.setDeviceMetricsOverride", {
      width: viewport.width,
      height: viewport.height,
      deviceScaleFactor: 1,
      mobile: false,
    });
    const log = new PageLog();
    log.install(session);
    const driver = new Driver(session, log, options);

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
    if (results.flatMap((result) => result.findings).length === 0) return 0;
    return options.allowBaseline && diff.added === 0 ? 0 : 1;
  } finally {
    launched.close();
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

if (import.meta.main) {
  main(Deno.args)
    .then((code) => Deno.exit(code))
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error));
      Deno.exit(2);
    });
}

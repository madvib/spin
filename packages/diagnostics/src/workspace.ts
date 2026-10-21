/**
 * The workspace's harness, as the service's port.
 *
 * The harness lives in the workspace's own tree: the browser probes and
 * the runner every app's configuration feeds. It is internal tooling —
 * nothing of it is published — and the service does not own it, so it
 * calls it. The checks stay in one place: the harness measures, and this
 * binding only carries what it measured back to the service.
 *
 * The harness answers with an exit code and a report it writes; the
 * binding reads the findings back out of that report, so what the service
 * returns is data rather than console output.
 */

import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type {
  CheckConfig,
  RenderedFinding,
  RenderedHarness,
  RenderedRun,
} from "./check.ts";

/** The harness module, as the service's port calls it. */
interface HarnessModule {
  runCheck(config: CheckConfig, argv: readonly string[]): Promise<number>;
}

/** Where the harness is, when the caller does not say. */
const HARNESS_PATH = join("internal", "check", "harness.ts");

/** How the binding reaches the harness. */
export interface WorkspaceHarnessOptions {
  /** The harness module to call. */
  readonly harness?: string;
  /**
   * The options the harness's own runner takes.
   *
   * They are the harness's: the routes to walk, the themes to render, the
   * screenshots to take. The URL is the service's, and is added to them.
   */
  readonly argv?: readonly string[];
}

/**
 * The harness in the nearest ancestor that holds one.
 *
 * The workspace is the thing that holds the harness, so the harness is
 * found the way a project is found: by walking up from where the command
 * was run.
 */
export function findHarness(from: string = process.cwd()): string | undefined {
  let directory = resolve(from);
  for (;;) {
    const candidate = join(directory, HARNESS_PATH);
    if (existsSync(candidate)) return candidate;
    const parent = dirname(directory);
    if (parent === directory) return undefined;
    directory = parent;
  }
}

/**
 * The harness, as the service's port.
 *
 * The config is the app's own: the routes, the themes, how the app says
 * it has rendered. The harness cannot guess any of it, and the service
 * cannot know it either — so the app hands it over.
 */
export function workspaceHarness(
  config: CheckConfig,
  options: WorkspaceHarnessOptions = {},
): RenderedHarness {
  return {
    async run(url: string): Promise<RenderedRun> {
      const module = await load(options.harness ?? findHarness());
      const report = join(tmpdir(), `spin-check-${randomUUID()}.json`);
      try {
        const code = await quietly(() =>
          module.runCheck(config, [
            ...(options.argv ?? []),
            "--url",
            url,
            // The baseline is the harness's own bookkeeping: the service
            // reads the report this run writes, not the one it is held to.
            "--no-baseline",
            "--write-baseline",
            report,
          ])
        );
        return { findings: readReport(report), code };
      } finally {
        rmSync(report, { force: true });
      }
    },
  };
}

/** The harness module, loaded. */
async function load(path: string | undefined): Promise<HarnessModule> {
  if (path === undefined) {
    throw new Error(
      "The rendered checks need the harness, and none was found: name it " +
        "with --harness <module>.",
    );
  }
  if (!existsSync(path)) {
    throw new Error(`The harness is not there: ${path}`);
  }
  return await import(pathToFileURL(path).href) as HarnessModule;
}

/** The findings the harness reported. */
function readReport(path: string): RenderedFinding[] {
  // A run that could not be made writes no report: the app was not there,
  // or the browser would not start. The verdict says so, and there are no
  // findings to report.
  if (!existsSync(path)) return [];
  const parsed = JSON.parse(readFileSync(path, "utf8")) as {
    findings?: unknown;
  };
  if (!Array.isArray(parsed.findings)) return [];
  return parsed.findings as RenderedFinding[];
}

/**
 * Runs something with the console's own output held back.
 *
 * The harness prints its report; the service's answer is data, and the
 * caller decides what a report looks like.
 */
async function quietly<T>(run: () => Promise<T>): Promise<T> {
  const log = console.log;
  console.log = () => {};
  try {
    return await run();
  } finally {
    console.log = log;
  }
}

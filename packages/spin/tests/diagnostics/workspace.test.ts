import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { test } from "bun:test";
import { deepStrictEqual } from "node:assert/strict";
import { join } from "node:path";
import type { CheckConfig as HarnessConfig } from "../../../../internal/check/harness.ts";
import type { CheckConfig } from "../../src/diagnostics/check.ts";
import { findHarness, workspaceHarness } from "../../src/diagnostics/workspace.ts";

/**
 * The harness, as the service calls it.
 *
 * The harness is the app's: it holds the routes, the themes and the page
 * conventions, and it is what drives the browser. The service does not own
 * it, so it calls it — and the binding is what carries the findings back.
 */

/** The app's facts, as the app hands them over. */
const CONFIG: HarnessConfig = {
  baseDir: ".",
  defaultUrl: "http://localhost:5173",
  routes: () => [{ hash: "/", expectHeading: null }],
  themes: ["default"],
  modesFor: () => ["base"],
  hoverSelector: null,
  stateScope: null,
  outDir: "out",
  baseline: "baseline.json",
  errorText: [],
  page: {
    renderReady: () => true,
    pageState: () => ({ heading: null, text: "", theme: null, mode: null }),
    seedTheme: () => {},
    geometryClaimsFor: () => [],
    geometryAudit: () => [],
  },
};

test("the app's facts are the config the harness is given", () => {
  // The config the harness declares and the config the service declares are
  // the same shape: the app writes one, and the harness reads it.
  const config: CheckConfig = CONFIG;
  deepStrictEqual(config.routes()[0]?.hash, "/");
});

test("the harness is found in the nearest ancestor that holds one", async () => {
  const directory = await mkdtemp(join(tmpdir(), "spin-"));
  try {
    const nested = join(directory, "apps", "reference");
    await mkdir(nested, { recursive: true });
    const harness = join(directory, "internal", "check", "harness.ts");
    await mkdir(join(directory, "internal", "check"), { recursive: true });
    await writeFile(harness, "export const runCheck = () => 0;\n");
    deepStrictEqual(findHarness(nested), harness);
    deepStrictEqual(findHarness(join(directory, "internal", "check")), harness);
  } finally {
    await rm(directory, { recursive: true });
  }
});

test("the binding calls the harness and reads its report back", async () => {
  // The harness answers with an exit code and a report it writes; the
  // binding reads the findings out of that report, so what the service
  // returns is data and not console output.
  const directory = await mkdtemp(join(tmpdir(), "spin-"));
  try {
    const module = join(directory, "harness.ts");
    await writeFile(
      module,
      `import { writeFile } from "node:fs/promises";
      export async function runCheck(
        config: unknown,
        argv: readonly string[],
      ): Promise<number> {
        const at = argv.indexOf("--write-baseline");
        const report = argv[at + 1];
        await writeFile(
          report!,
          JSON.stringify({
            findings: [{
              route: "/",
              theme: "default",
              mode: "base",
              check: "contrast",
              subject: 'button "Save"',
              detail: "3.90:1 — #333 on #fff",
              state: "rest",
            }],
          }),
        );
        return 0;
      }
`,
    );
    const harness = workspaceHarness(CONFIG, { harness: module });
    const run = await harness.run("http://localhost:5173");
    deepStrictEqual(run.findings.map((finding) => finding.check), ["contrast"]);
    deepStrictEqual(run.findings[0]?.subject, 'button "Save"');
    deepStrictEqual(run.code, 0);
  } finally {
    await rm(directory, { recursive: true });
  }
});

test("a run that could not be made reports no findings", async () => {
  // The app was not there, or the browser would not start: the harness
  // writes no report, and the verdict says the run did not happen.
  const directory = await mkdtemp(join(tmpdir(), "spin-"));
  try {
    const module = join(directory, "harness.ts");
    await writeFile(
      module,
      `export async function runCheck(): Promise<number> {
        return 2;
      }
`,
    );
    const harness = workspaceHarness(CONFIG, { harness: module });
    const run = await harness.run("http://localhost:5173");
    deepStrictEqual(run.findings, []);
    deepStrictEqual(run.code, 2);
  } finally {
    await rm(directory, { recursive: true });
  }
});

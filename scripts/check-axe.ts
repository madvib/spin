/**
 * Every component package ships an axe test, and the suite actually runs it.
 *
 * Why this exists, borrowed from ark, where every component carries a
 * `tests/*.test.ts` that mounts the component and runs axe over the result.
 * Accessibility is the one property of a component that cannot be reviewed by
 * reading the component: the markup looks right, the roles are right by eye,
 * and a screen reader still finds nothing focusable. It shows up in a manual
 * audit, which is to say it does not show up.
 *
 * **What is checked, and why it is only that.**
 *
 * 1. Every component package has a `tests/` directory containing at least one
 *    `*.test.ts` file.
 * 2. At least one of those files imports an axe runner (`axe-core`, or a
 *    wrapper such as `vitest-axe`) *and* calls it. An import alone is a test
 *    that asserts nothing, which AGENTS.md calls a tombstone.
 * 3. The package's own `deno.json` `test` task includes `tests/`, so the a11y
 *    file is not a test that exists and never runs.
 *
 * **What is deliberately not checked:** whether the axe result is clean. Spin
 * forbids negative assertions outright — a test asserting "no violations" is
 * exactly the shape that passes when the check itself is broken and encodes
 * nothing a consumer observes. So this gate checks *presence and wiring*. The
 * a11y assertion itself belongs to the component's own test, written by whoever
 * wrote the component, and it must assert something positive about the DOM.
 *
 *     deno task check:axe
 */

import {
  elementRegistrations,
  relative,
  report,
  workspacePackages,
} from "./lib/packages.ts";

/** Import specifiers that provide an axe runner. */
const AXE_IMPORTS = ["axe-core", "vitest-axe", "@axe-core/", "axe-runner"];

const AXE_CALL = /\baxe\s*(?:\.run\s*)?\(/;
const AXE_IMPORT = /from\s+["'`]([^"'`]+)["'`]/g;

function isAxeImport(specifier: string): boolean {
  return AXE_IMPORTS.some((candidate) => specifier.includes(candidate));
}

async function main(): Promise<void> {
  const findings: string[] = [];
  let components = 0;
  let covered = 0;

  for (const pkg of await workspacePackages()) {
    if ((await elementRegistrations(pkg)).length === 0) continue;
    components++;

    const testsDir = new URL("tests/", pkg.dir);
    const tests: URL[] = [];
    try {
      for await (const entry of Deno.readDir(testsDir)) {
        if (!entry.isFile || !entry.name.endsWith(".test.ts")) continue;
        tests.push(new URL(entry.name, testsDir));
      }
    } catch (error) {
      if (!(error instanceof Deno.errors.NotFound)) throw error;
    }
    tests.sort((a, b) => a.pathname.localeCompare(b.pathname));

    if (tests.length === 0) {
      findings.push(
        `packages/${pkg.stem} defines an element but has no tests/*.test.ts under ` +
          `${relative(testsDir)}.\n` +
          `      Add the axe test ark's pattern uses: mount the element, run axe over the ` +
          `container, assert something positive about the DOM axe reports.`,
      );
      continue;
    }

    let runsAxe = false;
    const axeFiles: string[] = [];
    for (const test of tests) {
      const source = await Deno.readTextFile(test);
      const imports = [...source.matchAll(AXE_IMPORT)].map((match) => match[1]);
      const importsAxe = imports.some(isAxeImport);
      if (!importsAxe) continue;
      if (!AXE_CALL.test(source)) {
        findings.push(
          `${relative(test)} imports ${imports.find(isAxeImport)}, but never calls axe(). ` +
            `An imported runner that is never invoked is a test that asserts nothing.`,
        );
        continue;
      }
      runsAxe = true;
      axeFiles.push(relative(test));
    }

    if (!runsAxe) {
      findings.push(
        `packages/${pkg.stem} has ${tests.length} test file${tests.length === 1 ? "" : "s"} ` +
          `under ${relative(testsDir)}, none of which run axe. Accessibility is not readable ` +
          `from the component's own source — it needs a runner over the rendered DOM.`,
      );
      continue;
    }

    // Wiring: a test task that skips `tests/` leaves the a11y file unrun.
    const task = pkg.manifest.tasks?.test;
    if (task === undefined || !/\btests\//.test(task)) {
      findings.push(
        `packages/${pkg.stem} runs axe in ${axeFiles.join(", ")}, but its deno.json ` +
          `\`test\` task is ${task === undefined ? "absent" : `"${task}"`} and does not ` +
          `include tests/.\n` +
          `      The a11y test exists and never runs. Set it to ` +
          `\`deno test --allow-read src/ tests/\`.`,
      );
      continue;
    }

    covered++;
  }

  // With no components at all the pass is vacuous, and saying so is the whole
  // value: a green tick that means "nothing to check" reads exactly like one
  // that means "everything is covered".
  report(
    "axe coverage",
    findings,
    components === 0
      ? `No component packages yet: nothing under packages/ calls define(), so there is no ` +
        `rendered DOM to run axe over. This gate passes trivially and starts biting when the ` +
        `first @spin/<component> lands.`
      : `${covered} of ${components} component package${components === 1 ? "" : "s"} ` +
        `${covered === 1 ? "carries" : "carry"} an axe test under tests/ that the ` +
        `package's \`test\` task actually runs.`,
  );
}

if (import.meta.main) await main();
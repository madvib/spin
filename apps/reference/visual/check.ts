/**
 * The reference's visual check: the harness config, and nothing else.
 *
 * The reference lends the harness the app facts — its routes from the
 * primitive registry, the starter themes, the nav chrome to hover, the
 * geometry claims, the page conventions it boots with. Everything mechanical
 * lives in `internal/check`:
 *
 *   bun run visual                                     # the whole matrix
 *   bun run visual -- --route components/button        # one route
 *   bun run visual -- --write-baseline                 # refresh the baseline
 */

import { readdir, readFile } from "node:fs/promises";
import {
  type CheckConfig,
  type Route,
  runCheck,
} from "../../../internal/check/harness.ts";
import { SECTIONS } from "../../../packages/spin/src/preset/organization.ts";
import {
  starterThemes,
  themeModes,
} from "../../../packages/spin/src/theme/themes/index.ts";
import { PRIMITIVES } from "../src/primitives.ts";
import { APP_ROUTES } from "../src/routes.ts";
import { geometryAudit, geometryClaimsFor } from "./geometry.ts";
import { pageState, renderReady, seedTheme } from "./pages.ts";

const BASE = new URL(".", import.meta.url).pathname;

/**
 * Routes come from the app rather than from a list kept beside it: a primitive
 * added to the registry is a route the next run checks, and one removed stops
 * being checked.
 */
function routes(): readonly Route[] {
  return [
    // The app's own routes — the section indexes and the montage — so a page
    // the app publishes is a page the check measures.
    ...APP_ROUTES.map((route) => ({
      hash: route.hash,
      expectHeading: route.expectHeading,
    })),
    ...PRIMITIVES.map((primitive) => ({
      hash: `/components/${primitive.id}`,
      expectHeading: primitive.title,
    })),
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

/**
 * The project's own themes: the files in `spin/`, read from disk.
 *
 * The build serves the same set — the plugin reads `spin/*.json` from the
 * same directory — so the matrix has to carry the same themes the app
 * renders, or a theme the app can show is a theme nobody checked. A file
 * that does not parse is skipped rather than thrown on: a half-written theme
 * in an editor must not cost the run the rest of the matrix.
 */
async function projectThemes(): Promise<
  Record<string, Parameters<typeof themeModes>[0]>
> {
  const out: Record<string, Parameters<typeof themeModes>[0]> = {};
  // The project's themes directory is beside this one, not inside it: the
  // harness lives in `visual/`, the project lives in the app's root.
  const directory = `${BASE}../spin`;
  try {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
      try {
        out[entry.name.replace(/\.json$/, "")] = JSON.parse(
          await readFile(`${directory}/${entry.name}`, "utf8"),
        ) as Parameters<typeof themeModes>[0];
      } catch {
        // Skipped: see above.
      }
    }
  } catch {
    // No project directory: the app serves the starters alone.
  }
  return out;
}

/** Every theme the app renders: the starters, and the project's own. */
const SERVED: Record<string, Parameters<typeof themeModes>[0]> = {
  ...THEMES,
  ...(await projectThemes()),
};

/**
 * The reference's check configuration.
 *
 * It is exported so the diagnostics' CLI can check this app: the checks
 * need the app's own facts, and the app is the only one that has them.
 */
export const config: CheckConfig = {
  baseDir: BASE,
  defaultUrl: "http://localhost:5173",
  routes,
  themes: Object.keys(SERVED),
  modesFor: (theme) => {
    // The modes the theme serves are the renderings it has: a light face and
    // a dark one, or the one it has. A theme that declares none is measured
    // in its base, which is the only rendering it has.
    const served = themeModes(SERVED[theme]!).filter((mode) =>
      mode === "light" || mode === "dark"
    );
    return served.length > 0 ? served : ["base"];
  },
  hoverSelector: "nav button, nav a",
  // The specimen, not the chrome: the rail is the app's navigation, and its
  // rows are the app's business. The state-contrast pass drives the controls
  // the specimens are made of.
  stateScope: "main",
  outDir: `${BASE}out`,
  baseline: `${BASE}baseline.json`,
  errorText: ["No such section", "Not found"],
  page: {
    renderReady,
    pageState,
    seedTheme,
    geometryClaimsFor,
    geometryAudit,
  },
};

if (import.meta.main) {
  runCheck(config, process.argv.slice(2))
    .then((code) => process.exit(code))
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(2);
    });
}

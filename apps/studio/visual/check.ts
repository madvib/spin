/**
 * The studio's visual check: the harness config, and nothing else.
 *
 * The studio lends the harness the app facts — its path-routed pages, the
 * starter themes, the rail chrome to hover, the page conventions it boots
 * with. Everything mechanical lives in `internal/check`:
 *
 *   bun run visual                                     # both layouts
 *   bun run visual -- --route /themes/colors          # one route
 *   bun run visual -- --write-baseline                 # refresh both baselines
 */

import { readdir, readFile } from "node:fs/promises";
import {
  type CheckConfig,
  type Route,
  runCheck,
} from "@spin/check";
import {
  starterThemes,
  themeModes,
} from "@spinjs/spin/theme/themes";
import {
  geometryAudit,
  geometryClaimsFor,
  pageState,
  renderReady,
  seedTheme,
} from "./pages.ts";
const BASE = new URL(".", import.meta.url).pathname;

/**
 * The studio's routes, as paths. `hash` equals the path so finding keys,
 * screenshot names, and `--route` filters behave the way hash-routed apps
 * expect; `path` is what the harness loads.
 *
 * The child representative is the always-present `button` specimen rather
 * than a name resolved from RPC: the config has to stay synchronous and
 * dependency-free.
 */
function routes(query?: string): readonly Route[] {
  const entries: ReadonlyArray<readonly [string, string]> = [
    ["/", "Themes"],
    ["/themes/colors", "Colors"],
    ["/themes/type", "Type"],
    ["/themes/icons", "Icons"],
    ["/themes/motion", "Motion"],
    ["/themes/spacing", "Spacing"],
    ["/themes/style", "Style"],
    ["/components", "Components"],
    // The detail capitalizes by CSS, not by text: the check reads text.
    ["/components/button", "button"],
    ["/findings", "Findings"],
    ["/preferences", "Preferences"],
  ];
  return entries.map(([path, expectHeading]) => ({
    hash: path,
    path,
    ...(query === undefined ? {} : { query }),
    expectHeading,
  }));
}

const THEMES: Record<string, Parameters<typeof themeModes>[0]> = starterThemes;

/**
 * The mounted project's own themes: the files in the reference's `spin/`,
 * read from disk.
 *
 * The studio edits the app it mounts — `../reference` in dev — so the matrix
 * has to carry the same themes the preview can seat. A file that does not
 * parse is skipped rather than thrown on: a half-written theme in an editor
 * must not cost the run the rest of the matrix.
 */
async function projectThemes(): Promise<
  Record<string, Parameters<typeof themeModes>[0]>
> {
  const out: Record<string, Parameters<typeof themeModes>[0]> = {};
  const directory = `${BASE}../../reference/spin`;
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
    // No project directory: the matrix carries the named starters alone.
  }
  return out;
}

/** Every theme the preview renders: the named starters, and the project's own. */
const SERVED: Record<string, Parameters<typeof themeModes>[0]> = {
  ...THEMES,
  ...(await projectThemes()),
};

const THEME_NAMES = ["industrial", "material", "neobrut", "silk", "spin"];

function modesFor(theme: string): readonly string[] {
  const served = themeModes(SERVED[theme]!).filter((mode) =>
    mode === "light" || mode === "dark"
  );
  return served.length > 0 ? served : ["light"];
}

function makeConfig(options: {
  readonly routes: readonly Route[];
  readonly outDir: string;
  readonly baseline: string;
}): CheckConfig {
  return {
    baseDir: BASE,
    defaultUrl: "http://localhost:5173",
    routes: () => options.routes,
    themes: THEME_NAMES,
    modesFor,
    hoverSelector: "#app nav a[href]",
    stateScope: "main",
    outDir: options.outDir,
    baseline: options.baseline,
    errorText: [
      "The studio hit an error",
      "There is no project here",
      "No component named",
    ],
    page: {
      renderReady,
      pageState,
      seedTheme,
      geometryClaimsFor,
      geometryAudit,
    },
  };
}

export const modalConfig: CheckConfig = makeConfig({
  routes: routes(),
  outDir: `${BASE}out`,
  baseline: `${BASE}baseline.json`,
});

export const drawerConfig: CheckConfig = makeConfig({
  routes: routes("?mode=drawer"),
  outDir: `${BASE}out-drawer`,
  baseline: `${BASE}baseline-drawer.json`,
});

const argv = process.argv.slice(2);

// `--write-baseline` refreshes both baselines in one command: the flag is
// stripped here and re-appended per layout with its own path, last-wins,
// because the harness resolves one write path per run.
const refreshing = argv.includes("--write-baseline");
const forwarded = argv.filter((arg) => arg !== "--write-baseline");
if (refreshing) {
  const at = argv.indexOf("--write-baseline");
  const next = argv[at + 1];
  if (next !== undefined && !next.startsWith("--")) {
    console.error(
      "--write-baseline takes no value here: both baselines refresh in one command",
    );
    process.exit(2);
  }
}

const modalArgv = [
  ...forwarded,
  "--viewport",
  "1280x800",
  "--out",
  "out",
  "--baseline",
  "baseline.json",
  ...(refreshing ? ["--write-baseline", "baseline.json"] : []),
];
const drawerArgv = [
  ...forwarded,
  "--viewport",
  "480x900",
  "--out",
  "out-drawer",
  "--baseline",
  "baseline-drawer.json",
  ...(refreshing ? ["--write-baseline", "baseline-drawer.json"] : []),
];

const modalCode = await runCheck(modalConfig, modalArgv);
if (modalCode !== 0) process.exit(modalCode);
process.exit(await runCheck(drawerConfig, drawerArgv));

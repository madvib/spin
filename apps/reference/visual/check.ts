#!/usr/bin/env -S deno run --allow-read --allow-write --allow-net --allow-run --allow-env --allow-sys
/**
 * The reference's visual check: the harness config, and nothing else.
 *
 * The reference lends the harness the app facts — its routes from the
 * primitive registry, the starter themes, the nav chrome to hover, the
 * geometry claims, the page conventions it boots with. Everything mechanical
 * lives in `internal/check`:
 *
 *   deno task visual                                   # the whole matrix
 *   deno task visual -- --route components/button      # one route
 *   deno task visual -- --write-baseline               # refresh the baseline
 */

import {
  type CheckConfig,
  type Route,
  runCheck,
} from "../../../internal/check/harness.ts";
import { SECTIONS } from "../../../packages/preset/src/organization.ts";
import {
  starterThemes,
  themeModes,
} from "../../../packages/theme/src/themes/index.ts";
import { PRIMITIVES } from "../src/primitives.ts";
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

const config: CheckConfig = {
  baseDir: BASE,
  defaultUrl: "http://localhost:5173",
  routes,
  themes: Object.keys(THEMES),
  modesFor: (theme) => [
    "base",
    ...themeModes(THEMES[theme]!).filter((mode) => mode === "dark"),
  ],
  hoverSelector: "nav button, nav a",
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
  runCheck(config, Deno.args)
    .then((code) => Deno.exit(code))
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error));
      Deno.exit(2);
    });
}

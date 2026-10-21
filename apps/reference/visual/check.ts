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
  runCheck(config, Deno.args)
    .then((code) => Deno.exit(code))
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error));
      Deno.exit(2);
    });
}

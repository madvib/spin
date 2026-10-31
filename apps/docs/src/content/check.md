<!-- USER COPY SLOT: check-intro — your own verification story, or the default below. -->

# Browser Checks

Static lints read the source. They cannot see computed contrast over layered
backgrounds, state contrast on hover and focus, clipped or zero-area controls,
or layout geometry drifting from what the theme named. The visual harness closes
that gap with a real browser: Playwright loads your app, drives it through every
state, measures what a person would measure, and reports what fails.

The harness lives in `internal/check/` and each app feeds it a config: the
reference app's is `apps/reference/visual/check.ts`, the studio's is
`apps/studio/visual/check.ts`. They run with:

```bash
bun run visual                                     # reference: the whole matrix
bun run visual -- --route components/button        # reference: one route
bun run visual -- --write-baseline                 # reference: refresh the baseline
bun run visual:studio                              # studio: modal + drawer layouts
bun run visual:studio -- --route /colors           # studio: one route
bun run visual:studio -- --write-baseline          # studio: refresh both baselines
```

## The eight probes

| Probe                   | What it measures                                                                                             |
| ----------------------- | ------------------------------------------------------------------------------------------------------------ |
| `contrast`              | WCAG AA resting text contrast in the live DOM — the color actually painted, behind the text actually painted |
| `state-contrast`        | Every interactive control probed across `rest`, `hover`, `focus`, `focus-visible`, `active`, and `disabled`  |
| `zero-area-interactive` | Buttons, links, and inputs with `0px` width or height — present in the DOM, absent on screen                 |
| `strobe-animation`      | Animations cycling faster than `250ms` — motion that reads as a fault                                        |
| `geometry`              | Your own `GeometryClaim` assertions: alignment, containment, non-overlap, equal control heights              |
| `console-error`         | Errors the page logs to the console while the probes run                                                     |
| `failed-request`        | Network requests that fail while the probes run                                                              |
| `render-defect`         | Pixels that never settle: layout thrash and paint that keeps moving                                          |

## The config

An app's check config names what the harness cannot know — its routes, the
themes to visit them in, how the app boots, when it is ready, and the layout
assertions only that app can state:

```ts
// apps/reference/visual/check.ts (excerpt)
import { type CheckConfig, runCheck } from "@spin/check";

const config: CheckConfig = {
  baseDir: BASE,
  defaultUrl: "http://localhost:5174",
  routes, // from the app's own registry — a new route is checked on the next run
  themes: Object.keys(SERVED), // every theme the app renders
  modesFor, // the modes each theme serves
  hoverSelector: "nav button, nav a",
  stateScope: "main",
  outDir: `${BASE}out`,
  baseline: `${BASE}baseline.json`,
  errorText: ["No such section", "Not found"],
  page: { renderReady, pageState, seedTheme, geometryClaimsFor, geometryAudit },
};
await runCheck(config);
```

Routes are what the harness visits; themes are what it visits them in; the
page adapter teaches the harness how your app boots and when it is ready;
`geometryClaimsFor` hands each route the layout assertions only your app can
state. Results compare against the committed baseline, so a theme change that
moves what the page measures shows up as a diff.

Studio runs the harness twice: the modal layout at 1280x800, then the drawer
layout at 480x900 with `?mode=drawer` on every route. Each layout keeps its
own baseline (`baseline.json`, `baseline-drawer.json`), both committed, while
the captures beside them (`out/`, `out-drawer/`) are gitignored regenerations.

<!-- USER COPY SLOT: check-close — CI wiring (which routes, which gates block merge). -->

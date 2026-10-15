/**
 * The studio shell.
 *
 * The studio is a tool pointed at a project, not the project. That distinction
 * is structural here: the chrome renders under its own static theme
 * (`data-theme="studio"`), and only the preview follows the picker. Editing a
 * theme therefore cannot restyle the tool you are editing it with, which is
 * what makes a broken theme recoverable.
 */

import { MetaProvider, Title } from "@solidjs/meta";
import { A, Route, Router } from "@solidjs/router";
import ColorsPage from "./routes/colors.tsx";
import TypePage from "./routes/type.tsx";
import ComponentsLayout from "./routes/components.tsx";
import ComponentPage from "./routes/components/[name].tsx";
import IconsPage from "./routes/icons.tsx";
import OverviewPage from "./routes/index.tsx";
import MotionPage from "./routes/motion.tsx";
import SpacingPage from "./routes/spacing.tsx";
import SurfacesPage from "./routes/surfaces.tsx";
import UtilitiesPage from "./routes/utilities.tsx";
import { createResource, For, Suspense } from "solid-js";
import "uno.css";
import PreviewStyles from "./components/PreviewStyles.tsx";

import { listProjectThemes, saveTheme } from "./lib/themes.ts";
import {
  activeMode,
  activeName,
  canRedo,
  canUndo,
  isDirty,
  markSaved,
  redo,
  themeText,
  undo,
} from "./lib/store.ts";

/**
 * The chrome's own theme. A constant rather than a lookup, so the shell does
 * not depend on discovery having succeeded before it can render.
 */
const STUDIO_THEME = "studio";

/**
 * Whether the studio runs in the host's drawer.
 *
 * The overlay names `mode=` in the iframe URL, so the studio lays itself
 * out for the edge it occupies rather than guessing from its own width: a
 * drawer is narrow because the host made it narrow, and the pages get a
 * different layout there rather than a squeezed one.
 */
function hostMode(): "drawer" | "modal" {
  return new URLSearchParams(location.search).get("mode") === "drawer"
    ? "drawer"
    : "modal";
}

/** Whether the studio runs in the host's drawer. Pages lay out for it. */
export function inDrawer(): boolean {
  return hostMode() === "drawer";
}

// Each concern's glyph is a whole utility class rather than an icon name
// joined at runtime: the scanner reads source text, so the literal has to
// appear in the file to be emitted. `i-lucide-${icon}` styles nothing.
const CONCERNS = [
  ["colors", "Color", "i-lucide-palette"],
  ["type", "Type", "i-lucide-type"],
  ["surfaces", "Surfaces", "i-lucide-layers"],
  ["spacing", "Spacing", "i-lucide-ruler"],
  ["motion", "Motion", "i-lucide-zap"],
  ["components", "Components", "i-lucide-blocks"],
  ["utilities", "Utilities", "i-lucide-wrench"],
  ["icons", "Icons", "i-lucide-shapes"],
] as const;

export default function App() {
  // The path is the daemon's answer, project-relative: it states the layout
  // of a project rather than of the machine the studio happens to run on.
  const [themes] = createResource(listProjectThemes);
  const activePath = () =>
    themes()?.find((theme) => theme.name === activeName())?.file;

  return (
    <Router
      // The bundle is served under `/__spin/studio/`; dev serves at `/`.
      // Vite injects the build's base here, so one line covers both.
      base={import.meta.env.BASE_URL.replace(/\/$/, "")}
      root={(props) => (
        <MetaProvider>
          <Title>spin theme studio</Title>
          {
            /* The chrome is themed by the studio, never by the project, so a
              broken project theme cannot break the tool. */
          }
          <div
            data-theme={STUDIO_THEME}
            data-mode={activeMode()}
            // A row, not a stack: the rail takes the left edge and the
            // preview takes the rest, which is the whole change.
            class="flex h-screen bg-surface"
          >
            {
              /*
              The rail is an icon strip: concerns above, editing below. No
              labels, no pickers, no header bar — the strip is a margin, and
              a button with a name on it is a panel competing with the page.
              Save, undo and redo are glyphs like everything else here; the
              theme picker and the mode control live on the home page, where
              choosing what to edit is the job.
            */
            }
            <nav
              aria-label="Studio"
              class="flex min-h-0 w-12 shrink-0 flex-col items-center gap-1 overflow-y-auto border-r border-border bg-surface-raised py-2"
            >
              <A
                href="/"
                class="row-sm mb-2 shrink-0 justify-center font-semibold"
                title="Overview"
              >
                <span
                  class="inline-block icon-lg shrink-0 i-lucide-loader-pinwheel text-text"
                  aria-hidden="true"
                />
              </A>
              <ul class="flow-list stack-sm shrink-0 items-center">
                <For each={CONCERNS}>
                  {([href, label, icon]) => (
                    <li>
                      <A
                        href={`/${href}`}
                        activeClass="text-text font-semibold underline"
                        inactiveClass="text-text-muted"
                        class="row-sm justify-center"
                        title={label}
                      >
                        <span
                          class={`inline-block shrink-0 icon-md ${icon}`}
                          aria-hidden="true"
                        />
                      </A>
                    </li>
                  )}
                </For>
              </ul>
              <div class="stack-sm mt-auto shrink-0 items-center">
                <button
                  type="button"
                  class="bare shrink-0"
                  onClick={() => undo()}
                  disabled={!canUndo()}
                  aria-label="Undo"
                  title="Undo"
                >
                  <span
                    class="inline-block icon-md i-lucide-undo-2"
                    aria-hidden="true"
                  />
                </button>
                <button
                  type="button"
                  class="bare shrink-0"
                  onClick={() => redo()}
                  disabled={!canRedo()}
                  aria-label="Redo"
                  title="Redo"
                >
                  <span
                    class="inline-block icon-md i-lucide-redo-2"
                    aria-hidden="true"
                  />
                </button>
                <button
                  type="button"
                  class="bare shrink-0"
                  onClick={async () => {
                    const name = activeName();
                    const written = await saveTheme(name, themeText());
                    if (written.error === null) markSaved(name);
                  }}
                  disabled={!isDirty(activeName())}
                  aria-label="Save to disk"
                  title={isDirty(activeName()) ? "Save to disk" : "Saved"}
                >
                  <span
                    class="inline-block icon-md i-lucide-save"
                    aria-hidden="true"
                  />
                </button>
                <A
                  href="/#settings"
                  activeClass="text-text font-semibold underline"
                  inactiveClass="text-text-muted"
                  class="row-sm justify-center"
                  title="Settings"
                >
                  <span
                    class="inline-block icon-md i-lucide-settings"
                    aria-hidden="true"
                  />
                </A>
              </div>
            </nav>
            {
              /* The preview carries the project's theme. Everything above is
                chrome and stays on the studio's own. */
            }
            <div
              data-theme={activeName()}
              data-mode={activeMode()}
              class="spin-preview flex min-h-0 min-w-0 flex-1 flex-col"
            >
              <PreviewStyles />
              <Suspense>{props.children}</Suspense>
            </div>
          </div>
        </MetaProvider>
      )}
    >
      <Route path="/" component={OverviewPage} />
      <Route path="/icons" component={IconsPage} />
      <Route path="/colors" component={ColorsPage} />
      <Route path="/type" component={TypePage} />
      <Route path="/surfaces" component={SurfacesPage} />
      <Route path="/spacing" component={SpacingPage} />
      <Route path="/motion" component={MotionPage} />
      <Route path="/components" component={ComponentsLayout}>
        <Route path="/:name" component={ComponentPage} />
      </Route>
      <Route path="/utilities" component={UtilitiesPage} />
    </Router>
  );
}

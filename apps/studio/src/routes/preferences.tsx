import { DrawerEdge } from "../components/Settings.tsx";

/**
 * Studio preferences. How the tool behaves — never what the project
 * contains.
 *
 * The theme under edit and the mode it is shown in are NOT here: they are
 * facts about the whole studio rather than about this page, so they live in
 * the bar along the bottom where they are on every route.
 */
import Page from "../components/Page";

export default function PreferencesPage() {
  return (
    <Page
      title="Preferences"
      note="How the studio behaves. Nothing here ships with the theme: the bar along the bottom names the project under edit and the mode it is shown in, and switching either swaps every page."
    >
      <section class="stack-sm mb-6">
        <h2 class="text-xl">Drawer edge</h2>
        <p class="text-sm text-text-muted">
          The host's drawer takes one edge or the other. The studio asks the
          host rather than guessing, and the choice is remembered.
        </p>
        <DrawerEdge />
      </section>
    </Page>
  );
}

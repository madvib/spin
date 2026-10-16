import { ModePicker, ThemePicker } from "../components/Settings.tsx";

/**
 * Studio preferences. How the tool behaves — never what the project
 * contains. The theme picker lives here rather than on the overview because
 * switching themes swaps the whole studio; it is a decision with a name on
 * it, and it gets a page with room to name it.
 */
import Page from "../components/Page";

export default function PreferencesPage() {
  return (
    <Page
      title="Preferences"
      note="How the studio behaves. Nothing here ships with the theme: the theme picker names the project under edit, and switching it swaps every page."
    >
      <section class="stack-sm mb-6">
        <h2 class="text-xl">Theme</h2>
        <ThemePicker full />
      </section>
      <section class="stack-sm">
        <h2 class="text-xl">Preview mode</h2>
        <ModePicker />
      </section>
    </Page>
  );
}

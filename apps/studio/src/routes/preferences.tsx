import { ModePicker, ThemePicker } from "../components/Settings.tsx";

/**
 * Studio preferences. How the tool behaves — never what the project
 * contains. The theme picker lives here rather than on the overview because
 * switching themes swaps the whole studio; it is a decision with a name on
 * it, and it gets a page with room to name it.
 */
export default function PreferencesPage() {
  return (
    <div class="drawer-scroll flex-1 overflow-y-auto p-4 min-h-0 min-w-0">
      <h1 class="text-3xl">Preferences</h1>
      <p>
        How the studio behaves. Nothing here ships with the theme — the theme
        picker names the project under edit, and switching it swaps every
        page.
      </p>
      <section class="stack-sm mb-6 max-w-screen-md">
        <h2 class="text-xl">Theme</h2>
        <ThemePicker full />
      </section>
      <section class="stack-sm max-w-screen-md">
        <h2 class="text-xl">Preview mode</h2>
        <ModePicker />
      </section>
    </div>
  );
}

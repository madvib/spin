import { createSignal, For, Show } from "solid-js";
import { ModePicker } from "../components/Settings.tsx";
import { activeName, registry, setActiveName } from "../lib/store.ts";
import { copyTheme, removeTheme } from "../lib/themes.ts";

export default function OverviewPage() {
  const [open, setOpen] = createSignal(false);
  const [name, setName] = createSignal("");
  const [source, setSource] = createSignal<string>("starter");
  const [confirming, setConfirming] = createSignal<string | null>(null);

  async function create(): Promise<void> {
    const next = name().trim();
    if (!next) return;
    const { error } = await copyTheme(source(), next);
    if (error === null) {
      setOpen(false);
      setName("");
      setActiveName(next);
    }
  }

  async function remove(theme: string): Promise<void> {
    if (confirming() !== theme) {
      setConfirming(theme);
      return;
    }
    const { error } = await removeTheme(theme);
    if (error === null) setConfirming(null);
  }

  return (
    <div class="drawer-scroll flex-1 overflow-y-auto p-4 min-h-0 min-w-0">
      <header class="mb-6 flex max-w-screen-md min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
        <h1 class="text-3xl">Themes</h1>
        <span class="flex-1" />
        <ModePicker />
        <button type="button" onClick={() => setOpen(true)}>
          New theme
        </button>
      </header>

      <section class="stack-sm mb-6 max-w-screen-md" aria-label="Themes">
        <For each={registry() ?? []}>
          {(theme) => (
            <div
              class="row-sm rounded-lg border border-border p-3"
              classList={{
                "bg-surface-raised": theme.name !== activeName(),
                "border-primary": theme.name === activeName(),
              }}
            >
              <button
                type="button"
                class="bare min-w-0 flex-1 text-left font-medium"
                onClick={() => setActiveName(theme.name)}
                aria-current={theme.name === activeName()}
                title="Switch to this theme"
              >
                {theme.name}
              </button>
              <Show when={theme.name !== activeName()}>
                <button
                  type="button"
                  class="bare shrink-0 text-sm"
                  title="Delete this theme"
                  onClick={() => remove(theme.name)}
                >
                  {confirming() === theme.name ? "Confirm?" : "Delete"}
                </button>
              </Show>
            </div>
          )}
        </For>
      </section>

      <Show when={open()}>
        <dialog
          aria-label="New theme"
          ref={(el) => {
            requestAnimationFrame(() => {
              if (el.isConnected && !el.open) el.showModal();
            });
          }}
          onClose={() => setOpen(false)}
        >
          <input
            type="text"
            placeholder="Name"
            value={name()}
            onInput={(event) => setName(event.currentTarget.value)}
          />
          <select
            value={source()}
            onChange={(event) => setSource(event.currentTarget.value)}
            title="Source theme"
          >
            <For each={registry() ?? []}>
              {(theme) => <option value={theme.name}>{theme.name}</option>}
            </For>
          </select>
          <footer>
            <button type="button" onClick={create}>
              Create
            </button>
            <button type="button" onClick={() => setOpen(false)}>
              Cancel
            </button>
          </footer>
        </dialog>
      </Show>
    </div>
  );
}

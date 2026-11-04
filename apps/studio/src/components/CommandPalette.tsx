/**
 * The studio's command palette: one search over routes, themes, modes,
 * components, and tokens.
 *
 * A `studio-command-palette` element driven by the combobox machine. The
 * studio feeds it grouped rows; the pick it reports navigates, seats, or
 * switches — the machine owns open/highlight/select, the studio owns what
 * the rows mean.
 */

import { createEffect, createMemo, createSignal, onCleanup, Show } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { createSpinComponent } from "@spinjs/components/solid";
import { combobox } from "@spinjs/components/combobox";
import {
  activeModes,
  activeTree,
  registry,
  setActiveMode,
  setActiveName,
} from "../lib/store.ts";
import type { ModeChoice } from "../lib/store.ts";
import { ROUTES } from "../lib/routes.ts";
import { editorRouteFor } from "../lib/tokens.ts";
import { indexTree } from "@spinjs/spin/theme";
import { COMPONENT_GROUPS } from "@spinjs/components";


interface PaletteRow {
  readonly value: string;
  readonly label: string;
  readonly group: string;
  readonly run: () => void;
}

const MODES: readonly { mode: ModeChoice; label: string }[] = [
  { mode: "light", label: "Light mode" },
  { mode: "dark", label: "Dark mode" },
  { mode: "system", label: "System mode" },
];

/** Whether the palette answers to the keypress. */
function paletteSignal(open: () => boolean, setOpen: (open: boolean) => void): void {
  const onKey = (event: KeyboardEvent): void => {
    if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "k") return;
    event.preventDefault();
    setOpen(!open());
  };
  globalThis.addEventListener("keydown", onKey);
  onCleanup(() => globalThis.removeEventListener("keydown", onKey));
}

export default function CommandPalette() {
  const navigate = useNavigate();
  const [element, setElement] = createSignal<HTMLElement>();
  const ctl = createSpinComponent(element, combobox);
  const [open, setOpen] = createSignal(false);
  paletteSignal(open, setOpen);

  const rows = createMemo((): readonly PaletteRow[] => {
    const out: PaletteRow[] = [];
    for (const route of ROUTES) {
      out.push({
        value: `route:${route.path}`,
        label: route.label,
        group: "Routes",
        run: () => navigate(route.path),
      });
    }
    for (const theme of registry() ?? []) {
      out.push({
        value: `theme:${theme.name}`,
        label: `Theme: ${theme.name}`,
        group: "Themes",
        run: () => setActiveName(theme.name),
      });
    }
    for (const entry of MODES) {
      if (entry.mode !== "system" && !activeModes().includes(entry.mode)) continue;
      out.push({
        value: `mode:${entry.mode}`,
        label: entry.label,
        group: "Modes",
        run: () => setActiveMode(entry.mode),
      });
    }
    for (const group of COMPONENT_GROUPS) {
      for (const name of group.members) {
        out.push({
          value: `component:${name}`,
          label: name,
          group: "Components",
          run: () => navigate(`/components/${name}`),
        });
      }
    }
    const tree = (() => {
      try {
        return activeTree();
      } catch {
        return undefined;
      }
    })();
    if (tree !== undefined) {
      for (const leaf of Object.values(indexTree(tree).leaves)) {
        const path = leaf.path.join(".");
        out.push({
          value: `token:${path}`,
          label: path,
          group: "Tokens",
          run: () => navigate(editorRouteFor(path)),
        });
      }
    }
    return out;
  });

  const [filter, setFilter] = createSignal("");
  const visible = createMemo(() => {
    const query = filter().trim().toLowerCase();
    if (query === "") return rows();
    return rows().filter((row) =>
      row.label.toLowerCase().includes(query) ||
      row.group.toLowerCase().includes(query)
    );
  });

  createEffect(() => {
    if (!open()) {
      setFilter("");
      return;
    }
    // The list renders inside the open dialog: open the machine and focus
    // the input so typing filters immediately.
    ctl.commands.setOpen(true);
    ctl.commands.focus();
  });
  createEffect(() =>
    ctl.bind(
      {
        items: visible().map((row) => ({
          value: row.value,
          label: row.label,
          group: row.group,
        })),
      },
      {
        "input-value-change": (event: CustomEvent<{ inputValue: string }>) => {
          setFilter(event.detail.inputValue);
        },
        "value-change": (event: CustomEvent<{ value: readonly string[] }>) => {
          const picked = event.detail.value[0];
          const row = rows().find((entry) => entry.value === picked);
          setOpen(false);
          row?.run();
        },
      },
    )
  );

  return (
    <>
      <button
        type="button"
        data-testid="command-palette-trigger"
        class="bare inline-flex h-8 w-8 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface"
        aria-label="Command palette"
        title="Command palette (Cmd+K)"
        onClick={() => setOpen(true)}
      >
        <span class="i-lucide-search h-4 w-4" aria-hidden="true" />
      </button>
      <Show when={open()}>
        <dialog
          open
          data-testid="command-palette"
          aria-label="Command palette"
          onClose={() => setOpen(false)}
          onKeyDown={(event: KeyboardEvent) => {
            if (event.key === "Escape") setOpen(false);
          }}
        >
          <studio-command-palette ref={(el: HTMLElement) => setElement(el)} prop:items={rows().map((row) => ({ value: row.value, label: row.label, group: row.group }))} />
        </dialog>
      </Show>
    </>
  );
}

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
  library,
  registry,
  setActiveMode,
  setActiveName,
} from "../lib/store.ts";
import type { ModeChoice } from "../lib/store.ts";
import { ROUTES } from "../lib/routes.ts";
import { GROUPS } from "../routes/themes.tsx";
import { editorRouteFor } from "../lib/tokens.ts";
import { indexTree } from "@spinjs/theme";
import { starterThemes } from "@spinjs/theme/themes";
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
        label: `${route.label} — ${route.description}`,
        group: "Areas",
        run: () => navigate(route.path),
      });
    }
    for (const [path, label, , desc] of GROUPS) {
      out.push({
        value: `token-group:${path}`,
        label: `${label} — ${desc}`,
        group: "Token Groups",
        run: () => navigate(path),
      });
    }
    out.push(
      {
        value: "token-group:/tokens/type/styles",
        label: "Type: Styles — 13 named typography tuples & HTML element map",
        group: "Token Groups",
        run: () => navigate("/tokens/type/styles"),
      },
      {
        value: "token-group:/tokens/type/faces",
        label: "Type: Faces — Font families and curated pairings",
        group: "Token Groups",
        run: () => navigate("/tokens/type/faces"),
      },
      {
        value: "token-group:/tokens/type/ramps",
        label: "Type: Ramps — Size, weight, tracking, and leading scales",
        group: "Token Groups",
        run: () => navigate("/tokens/type/ramps"),
      },
    );
    const allThemes = registry() ?? [];
    const localThemes = allThemes.filter(
      (t) => t.file !== null || !(t.name in starterThemes),
    );
    const shownThemes = localThemes.length > 0 ? localThemes : allThemes;
    for (const theme of shownThemes) {
      out.push({
        value: `theme:${theme.name}`,
        label: `Switch brand: ${theme.name}`,
        group: "Brand & Mode",
        run: () => setActiveName(theme.name),
      });
    }
    for (const entry of MODES) {
      if (entry.mode !== "system" && !activeModes().includes(entry.mode)) continue;
      out.push({
        value: `mode:${entry.mode}`,
        label: entry.label,
        group: "Brand & Mode",
        run: () => setActiveMode(entry.mode),
      });
    }
    const libEntries = library() ?? [];
    if (libEntries.length > 0) {
      for (const comp of libEntries) {
        const slug = comp.name.replace(/^(primitive|component)-/, "");
        const title = slug
          .split("-")
          .map((w) => (w[0] ? w[0].toUpperCase() + w.slice(1) : w))
          .join(" ");
        out.push({
          value: `component:${comp.name}`,
          label: `${title} (${comp.kind ?? "primitive"})`,
          group: "Components",
          run: () => navigate(`/components/${comp.name}`),
        });
      }
    } else {
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
        const val = typeof leaf.value === "string" || typeof leaf.value === "number"
          ? ` · ${leaf.value}`
          : "";
        out.push({
          value: `token:${path}`,
          label: `${path}${val}`,
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
    if (query === "") {
      return rows().filter((row) =>
        row.group === "Areas" ||
        row.group === "Token Groups" ||
        row.group === "Brand & Mode"
      );
    }
    return rows()
      .filter((row) =>
        row.label.toLowerCase().includes(query) ||
        row.group.toLowerCase().includes(query) ||
        row.value.toLowerCase().includes(query)
      )
      .slice(0, 48);
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
      <span class="inline-flex items-center rounded-full border bg-surface">
        <button
          type="button"
          data-testid="command-palette-trigger"
          class="bare inline-flex h-8 w-8 items-center justify-center gap-2 rounded-full border-0 px-3 text-muted transition-colors hover:bg-surface-sunken md:w-56 md:justify-start lg:w-64"
          aria-label="Command palette"
          title="Search Brand, Tokens, Components, Diagnostics (Cmd+K)"
          onClick={() => setOpen(true)}
        >
          <span class="i-lucide-search h-4 w-4 shrink-0" aria-hidden="true" />
          <span class="hidden flex-1 truncate text-left type-caption md:inline">
            Search…
          </span>
          <kbd class="hidden md:inline">⌘K</kbd>
        </button>
      </span>
      <Show when={open()}>
        <div
          class="fixed inset-0 z-modal flex items-start justify-center bg-surface/60 pt-16"
          onClick={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
          onKeyDown={(event: KeyboardEvent) => {
            if (event.key === "Escape") setOpen(false);
          }}
        >
          <dialog
            open
            data-testid="command-palette"
            aria-label="Command palette"
            class="panel w-[32rem] max-w-[calc(100vw-2rem)] overflow-hidden"
            onClose={() => setOpen(false)}
          >
            <studio-command-palette ref={(el: HTMLElement) => setElement(el)} prop:items={visible().map((row) => ({ value: row.value, label: row.label, group: row.group }))} />
          </dialog>
        </div>
      </Show>
    </>
  );
}

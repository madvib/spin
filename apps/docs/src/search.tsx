/**
 * The docs' search: every page, component, utility family, and token role
 * in one Mod+K dialog.
 *
 * The index is built once at module load from the same sources the pages
 * read — the nav groups, the preset's manifest and examples, the
 * organization sections and shortcuts, and the theme's role declarations —
 * so a result cannot name a page, component, or token the site does not
 * have.
 */
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  onCleanup,
  Show,
} from "solid-js";
import type { JSX } from "solid-js";
import {
  examplesFor,
  primitiveContracts,
  SECTIONS,
  spinShortcuts,
} from "@spinjs/preset";
import { BASE_ROLES } from "@spinjs/spin/theme";
import { COMPONENT_GROUPS, DOCS_GROUPS } from "./nav.ts";

export interface SearchEntry {
  readonly title: string;
  readonly subtitle?: string;
  readonly href: string;
  readonly category: "Guide" | "Component" | "Utility" | "Token";
}

const SEARCH_NOTES: Readonly<Record<string, string>> = {
  "/docs/getting-started/paths": "plugin, preset only, standalone Studio, CLI, MCP",
};

function buildIndex(): readonly SearchEntry[] {
  const out: SearchEntry[] = [
    {
      title: "Studio",
      subtitle: "Edit the theme against a live page",
      href: "/studio",
      category: "Guide",
    },
    {
      title: "Playground",
      subtitle: "Live-editable HTML, utilities, and custom elements sandbox",
      href: "/playground",
      category: "Guide",
    },
  ];
  for (const group of DOCS_GROUPS) {
    for (const item of group.items) {
      out.push({
        title: item.title,
        subtitle: item.summary ?? SEARCH_NOTES[item.href],
        href: item.href,
        category: "Guide",
      });
    }
  }
  for (const group of COMPONENT_GROUPS) {
    for (const item of group.items) {
      const contract = primitiveContracts[item.name];
      const examples = examplesFor(item.name);
      const detail = [
        ...(contract?.tags ?? []),
        ...(contract?.variants.slice(0, 4) ?? []),
      ].join(" · ");
      // The note and the vocabulary both narrow a query: searching "textarea"
      // must find the field component that owns the tag.
      const subtitle = [examples?.note, detail === "" ? undefined : detail]
        .filter((part): part is string => part !== undefined && part !== "")
        .join(" · ");
      out.push({
        title: item.name,
        subtitle: subtitle === "" ? undefined : subtitle,
        href: item.href,
        category: "Component",
      });
    }
  }
  for (const section of SECTIONS) {
    out.push({
      title: section.title,
      subtitle: section.blurb,
      href: "/docs/styling/catalog",
      category: "Utility",
    });
  }
  for (const name of Object.keys(spinShortcuts)) {
    out.push({ title: name, href: "/docs/styling/catalog", category: "Utility" });
  }
  for (const role of BASE_ROLES) {
    out.push({
      title: role.path,
      subtitle: role.doc,
      href: "/docs/themes/schema",
      category: "Token",
    });
  }
  return out;
}

const INDEX: readonly SearchEntry[] = buildIndex();

/** The entries matching the query, in index order. */
function search(query: string): readonly SearchEntry[] {
  const needle = query.trim().toLowerCase();
  if (needle === "") return INDEX.slice(0, 12);
  return INDEX.filter(
    (entry) =>
      entry.title.toLowerCase().includes(needle) ||
      (entry.subtitle?.toLowerCase().includes(needle) ?? false),
  ).slice(0, 12);
}

export interface SearchDialogProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onNavigate: (href: string) => void;
}

/**
 * The Mod+K dialog: a filter input over the index, with arrow-key travel,
 * Enter to go, and Escape or backdrop click to leave.
 */
export function SearchDialog(props: SearchDialogProps): JSX.Element {
  const [query, setQuery] = createSignal("");
  const [active, setActive] = createSignal(0);
  let dialogEl: HTMLDialogElement | undefined;
  let inputEl: HTMLInputElement | undefined;
  let trigger: HTMLElement | null = null;
  const hits = createMemo(() => search(query()));
  const clampedActive = createMemo(() =>
    Math.min(active(), Math.max(0, hits().length - 1)),
  );
  const grouped = createMemo(() => {
    const groups: { label: string; items: { entry: SearchEntry; idx: number }[] }[] = [
      { label: "Docs", items: [] },
      { label: "Components", items: [] },
      { label: "Utilities", items: [] },
      { label: "Tokens", items: [] },
    ];
    hits().forEach((entry, idx) => {
      const label =
        entry.category === "Guide"
          ? "Docs"
          : entry.category === "Component"
            ? "Components"
            : entry.category === "Utility"
              ? "Utilities"
              : "Tokens";
      groups.find((g) => g.label === label)?.items.push({ entry, idx });
    });
    return groups.filter((g) => g.items.length > 0);
  });

  createEffect(() => {
    if (!dialogEl) return;
    if (props.open) {
      if (!dialogEl.open) {
        trigger = document.activeElement as HTMLElement | null;
        dialogEl.showModal();
        setQuery("");
        setActive(0);
        inputEl?.focus();
      }
    } else {
      if (dialogEl.open) {
        dialogEl.close();
        if (trigger && trigger.isConnected) trigger.focus();
        trigger = null;
      }
    }
  });

  createEffect(() => {
    const idx = clampedActive();
    if (hits().length === 0) return;
    document
      .getElementById(`docs-search-option-${idx}`)
      ?.scrollIntoView({ block: "nearest" });
  });

  return (
    <dialog
      ref={(el: HTMLDialogElement) => (dialogEl = el)}
      class="w-full max-w-screen-md"
      aria-label="Search documentation"
      onClose={() => props.onClose()}
      onCancel={(e: Event) => {
        e.preventDefault();
        props.onClose();
      }}
      onClick={(e: MouseEvent) => {
        if (e.target === e.currentTarget) props.onClose();
      }}
    >
      <input
        ref={(el) => (inputEl = el)}
        type="search"
        role="combobox"
        aria-expanded="true"
        aria-controls="docs-search-listbox"
        aria-activedescendant={
          hits().length > 0 ? `docs-search-option-${clampedActive()}` : undefined
        }
        aria-autocomplete="list"
        aria-label="Search documentation"
        placeholder="Search pages, components, utilities, tokens..."
        class="w-full"
        value={query()}
        onInput={(e) => {
          setQuery(e.currentTarget.value);
          setActive(0);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((cur) => Math.min(cur + 1, Math.max(hits().length - 1, 0)));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((cur) => Math.max(cur - 1, 0));
          } else if (e.key === "Home") {
            e.preventDefault();
            setActive(0);
          } else if (e.key === "End") {
            e.preventDefault();
            setActive(Math.max(0, hits().length - 1));
          } else if (e.key === "Enter") {
            e.preventDefault();
            const hit = hits()[clampedActive()];
            if (hit) props.onNavigate(hit.href);
          } else if (e.key === "Escape") {
            e.preventDefault();
            props.onClose();
          }
        }}
      />
      <ul
        id="docs-search-listbox"
        role="listbox"
        aria-label="Search results"
        class="flow-list max-h-64 overflow-y-auto"
      >
        <Show when={hits().length === 0}>
          <li
            role="presentation"
            class="px-3 py-6 text-center text-sm text-text-muted"
          >
            No matches for “{query()}”.
          </li>
        </Show>
        <For each={grouped()}>
          {(group) => (
            <>
              <li
                role="presentation"
                class="px-2 pt-2 pb-1 text-xs font-semibold text-text-muted"
              >
                {group.label}
              </li>
              <For each={group.items}>
                {(item) => (
                  <li
                    id={`docs-search-option-${item.idx}`}
                    role="option"
                    aria-selected={item.idx === clampedActive()}
                    onMouseMove={() => setActive(item.idx)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => props.onNavigate(item.entry.href)}
                    class={`flex cursor-pointer items-baseline justify-between gap-3 rounded-sm px-3 py-2 text-sm ${
                      item.idx === clampedActive()
                        ? "bg-surface-raised text-text"
                        : "text-text-muted hover:text-text"
                    }`}
                  >
                    <span class="min-w-0">
                      <span class="block truncate font-mono text-sm">
                        {item.entry.title}
                      </span>
                      <Show when={item.entry.subtitle}>
                        <span class="block truncate text-xs">
                          {item.entry.subtitle}
                        </span>
                      </Show>
                    </span>
                    <span class="shrink-0 font-mono text-xs uppercase tracking-wide text-text-muted">
                      {item.entry.category}
                    </span>
                  </li>
                )}
              </For>
            </>
          )}
        </For>
      </ul>
    </dialog>
  );
}

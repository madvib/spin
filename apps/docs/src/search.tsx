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
import { BASE_ROLES } from "@spinjs/theme";
import { COMPONENT_GROUPS, DOCS_GROUPS } from "./nav.ts";

export interface SearchEntry {
  readonly title: string;
  readonly subtitle?: string;
  readonly href: string;
  readonly category: "Guide" | "Component" | "Utility" | "Token";
}

function buildIndex(): readonly SearchEntry[] {
  const out: SearchEntry[] = [];
  for (const group of DOCS_GROUPS) {
    for (const item of group.items) {
      out.push({ title: item.title, href: item.href, category: "Guide" });
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
      href: "/tokens",
      category: "Utility",
    });
  }
  for (const name of Object.keys(spinShortcuts)) {
    out.push({ title: name, href: "/tokens", category: "Utility" });
  }
  for (const role of BASE_ROLES) {
    out.push({
      title: role.path,
      subtitle: role.doc,
      href: "/themes/schema",
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
  const [highlight, setHighlight] = createSignal(0);
  let input: HTMLInputElement | undefined;
  const results = createMemo(() => search(query()));

  createEffect(() => {
    if (props.open) {
      setQuery("");
      setHighlight(0);
      input?.focus();
    }
  });

  const onGlobalKey = (event: KeyboardEvent) => {
    if (props.open && event.key === "Escape") {
      event.preventDefault();
      props.onClose();
      return;
    }
    if (!props.open) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlight((current) =>
        Math.min(current + 1, Math.max(results().length - 1, 0))
      );
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlight((current) => Math.max(current - 1, 0));
    } else if (event.key === "Enter") {
      const hit = results()[highlight()];
      if (hit !== undefined) {
        event.preventDefault();
        props.onNavigate(hit.href);
      }
    }
  };

  // The dialog listens on the document so arrows and Enter work whichever
  // element inside it holds focus: the input, or a result the reader tabbed
  // to. It is the dialog's own listener on its own open state, removed with
  // it, so the landing's shortcuts are unaffected when it is closed.
  createEffect(() => {
    document.addEventListener("keydown", onGlobalKey);
    onCleanup(() => document.removeEventListener("keydown", onGlobalKey));
  });

  let dialog: HTMLDialogElement | undefined;
  createEffect(() => {
    if (props.open) {
      requestAnimationFrame(() => {
        if (dialog?.isConnected && !dialog.open) dialog.showModal();
      });
    } else {
      dialog?.close();
    }
  });

  return (
    <dialog
      ref={dialog}
      aria-label="search"
      class="w-full max-w-screen-sm overflow-hidden rounded-md border border-border bg-surface-raised p-4"
      onClose={props.onClose}
      onClick={(event) => {
        if (event.target === dialog) props.onClose();
      }}
    >
      <div class="stack-sm p-4" role="document">
          <input
            ref={input}
            type="search"
            placeholder="Search guides, components, utilities, tokens..."
            value={query()}
            onInput={(event) => {
              setQuery(event.currentTarget.value);
              setHighlight(0);
            }}
            class="w-full rounded-sm border border-border bg-surface px-3 py-2 placeholder:text-text-muted focus:outline-none"
            aria-label="search"
          />
          <ul role="listbox">
            <For
              each={results()}
              fallback={
                <li class="px-3 py-6 text-center text-sm text-text-muted">
                  Nothing matches — try a component name, a utility, or a token
                  path.
                </li>
              }
            >
              {(entry, index) => (
                <li role="option" aria-selected={index() === highlight()}>
                  <button
                    type="button"
                    onMouseEnter={() =>
                      setHighlight(index())}
                    onClick={() =>
                      props.onNavigate(entry.href)}
                    class={`bare flex w-full items-center justify-between gap-3 rounded-sm px-3 py-2 text-left transition-colors duration-fast ${
                      index() === highlight()
                        ? "bg-surface-raised text-text"
                        : "text-text-muted"
                    }`}
                  >
                    <span class="min-w-0">
                      <span class="block truncate font-mono text-sm">
                        {entry.title}
                      </span>
                      <Show when={entry.subtitle}>
                        <span class="block truncate text-xs">
                          {entry.subtitle}
                        </span>
                      </Show>
                    </span>
                    <span class="shrink-0 font-mono text-xs uppercase tracking-wide text-text-muted">
                      {entry.category}
                    </span>
                  </button>
                </li>
              )}
            </For>
          </ul>
          <p class="px-3 pt-1 text-xs text-text-muted">
            {results().length} shown — keep typing to narrow.
          </p>
      </div>
    </dialog>
  );
}

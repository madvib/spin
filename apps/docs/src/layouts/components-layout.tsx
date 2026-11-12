/**
 * The `/components/*` world layout: the unified taxonomy rail on the left,
 * the gallery or detail page beside it.
 */
import { A, useLocation, useNavigate } from "@solidjs/router";
import type { RouteSectionProps } from "@solidjs/router";
import { createEffect, createMemo, createSignal, For, Show } from "solid-js";
import type { JSX } from "solid-js";
import { COMPONENT_GROUPS } from "../shell/nav.ts";

export type ComponentKindFilter = "all" | "primitive" | "machine";

function kindOfHref(href: string): "primitive" | "machine" {
  return href.includes("/machine-") ? "machine" : "primitive";
}

export function ComponentsRail(props: {
  filter: string;
  kind: ComponentKindFilter;
  onKind: (kind: ComponentKindFilter) => void;
  onSelect?: () => void;
}): JSX.Element {
  const groups = createMemo(() => {
    const query = props.filter.trim().toLowerCase();
    return COMPONENT_GROUPS.map((group) => ({
      ...group,
      items: group.items.filter(
        (item) =>
          (props.kind === "all" || kindOfHref(item.href) === props.kind) &&
          (query === "" || item.name.toLowerCase().includes(query)),
      ),
    })).filter((group) => group.items.length > 0);
  });
  return (
    <div class="grid gap-1">
      <div
        role="group"
        aria-label="Component kind"
        class="flex items-center gap-1 rounded-md border bg-surface-raised p-1"
      >
        <For
          each={
            [
              { id: "all", label: "All" },
              { id: "primitive", label: "Elements" },
              { id: "machine", label: "Interactive" },
            ] as const
          }
        >
          {(entry) => {
            const active = () => props.kind === entry.id;
            return (
              <button
                type="button"
                aria-pressed={active()}
                onClick={() => props.onKind(entry.id)}
                class={`bare inline-flex h-6 flex-1 items-center justify-center rounded-sm px-2 type-caption-emphasized transition-colors ${
                  active()
                    ? "bg-primary text-on-primary"
                    : "text-muted hover:bg-surface"
                }`}
              >
                {entry.label}
              </button>
            );
          }}
        </For>
      </div>
      <Show when={props.kind !== "all"}>
        <span class="px-1 type-caption text-muted">
          {props.kind === "primitive"
            ? "Native HTML tags · CSS only"
            : "Stateful UI · @spinjs/components"}
        </span>
      </Show>
      <A
        href="/components"
        end
        onClick={() => props.onSelect?.()}
        class="block rounded-sm px-2 py-1 type-label no-underline transition-colors duration-fast"
        activeClass="bg-surface-raised text-primary"
        inactiveClass="text-muted"
      >
        Overview
      </A>
      <For each={groups()}>
        {(group) => (
          <>
            <span class="pt-2 type-overline uppercase text-muted">
              {group.label}
            </span>
            <For each={group.items}>
              {(item) => {
                const itemKind = kindOfHref(item.href);
                return (
                  <A
                    href={item.href}
                    onClick={() => props.onSelect?.()}
                    class="flex items-center justify-between gap-2 rounded-sm px-2 py-1 type-label no-underline transition-colors duration-fast"
                    activeClass="bg-surface-raised text-primary"
                    inactiveClass="text-muted"
                  >
                    <span class="flex min-w-0 items-center gap-2">
                      <span
                        class={`${item.icon} icon-sm shrink-0`}
                        aria-hidden="true"
                      />
                      <span class="min-w-0 truncate">{item.name}</span>
                    </span>
                    <span class="shrink-0 type-caption text-muted opacity-60">
                      {itemKind === "primitive" ? "html" : "ui"}
                    </span>
                  </A>
                );
              }}
            </For>
          </>
        )}
      </For>
    </div>
  );
}

export function ComponentsLayout(props: RouteSectionProps): JSX.Element {
  const location = useLocation();
  const navigate = useNavigate();
  let scrollEl: HTMLDivElement | undefined;
  const [query, setQuery] = createSignal("");
  const [kind, setKind] = createSignal<ComponentKindFilter>("all");

  createEffect(() => {
    void location.pathname;
    if (scrollEl !== undefined) {
      scrollEl.scrollTop = 0;
    }
  });

  createEffect(() => {
    if (location.pathname !== "/components") return;
    const search = new URLSearchParams(location.search);
    const param = search.get("kind");
    if (param === "primitives") setKind("primitive");
    else if (param === "machines") setKind("machine");
    else setKind("all");
  });

  const handleKind = (next: ComponentKindFilter) => {
    setKind(next);
    if (location.pathname === "/components") {
      const suffix =
        next === "primitive"
          ? "?kind=primitives"
          : next === "machine"
            ? "?kind=machines"
            : "";
      navigate(`/components${suffix}`, { replace: true });
    }
  };

  return (
    <div
      ref={scrollEl}
      class="flex h-full min-h-0 items-start overflow-y-auto bg-surface"
    >
      <nav
        class="sticky top-0 hidden h-full w-64 shrink-0 flex-col gap-4 overflow-y-auto border-e px-4 py-6 md:flex"
        aria-label="components"
      >
        <input
          type="search"
          placeholder="Filter components..."
          value={query()}
          onInput={(event) => setQuery(event.currentTarget.value)}
          aria-label="filter components"
          class="s-sm w-full"
        />
        <ComponentsRail filter={query()} kind={kind()} onKind={handleKind} />
      </nav>
      <div class="min-w-0 flex-1">{props.children}</div>
    </div>
  );
}

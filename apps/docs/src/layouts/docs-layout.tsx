/**
 * The 3-column `/docs/*` layout:
 * - Left rail: topic subgroups (`Getting Started`, `Themes & Tokens`, `Styling & Markup`, `Components & Runtime`, `Tooling & Agents`)
 * - Center column: page content + automatic Prev / Next page footer
 * - Right rail: `<docs-toc>` Spin component tracking `h2`/`h3` headings in the scroll container
 */
import { A, useLocation } from "@solidjs/router";
import type { RouteSectionProps } from "@solidjs/router";
import {
  createEffect,
  createSignal,
  For,
  onCleanup,
  Show,
} from "solid-js";
import type { JSX } from "solid-js";
import { createSpinComponent } from "@spinjs/components/solid";
import { toc, type TocRow } from "@spinjs/components/toc";
import { DOCS_GROUPS, docsPageContext } from "../nav.ts";

export function DocsRail(props: { onSelect?: () => void }): JSX.Element {
  const location = useLocation();
  const isGroupActive = (items: readonly { href: string }[]): boolean =>
    items.some((item) => location.pathname === item.href);

  return (
    <div class="flex flex-col gap-6">
      <For each={DOCS_GROUPS}>
        {(group) => (
          <div class="flex flex-col gap-1">
            <span
              class={`px-2 pb-1 type-caption-strong uppercase ${
                isGroupActive(group.items) ? "text-primary" : "text-muted"
              }`}
            >
              {group.label}
            </span>
            <div class="flex flex-col border-s ms-2 ps-2">
              <For each={group.items}>
                {(item) => (
                  <A
                    href={item.href}
                    end
                    onClick={() => props.onSelect?.()}
                    class="block rounded-sm px-2 py-1 no-underline transition-colors duration-fast"
                    activeClass="bg-surface-raised type-body-strong"
                    inactiveClass="text-muted"
                  >
                    {item.title}
                  </A>
                )}
              </For>
            </div>
          </div>
        )}
      </For>
    </div>
  );
}

export function DocsLayout(props: RouteSectionProps): JSX.Element {
  const location = useLocation();
  let scrollEl: HTMLDivElement | undefined;
  const [tocEl, setTocEl] = createSignal<HTMLElement>();
  const tocCtl = createSpinComponent(tocEl, toc);
  const [headings, setHeadings] = createSignal<readonly TocRow[]>([]);
  const [activeIds, setActiveIds] = createSignal<readonly string[]>([]);

  createEffect(() => {
    tocCtl.bind({
      items: headings(),
      activeIds: activeIds(),
    });
  });

  createEffect(() => {
    const pathname = location.pathname;
    void pathname;
    if (scrollEl) {
      scrollEl.scrollTop = 0;
    }

    let io: IntersectionObserver | undefined;
    const visible = new Set<string>();

    const collectHeadings = () => {
      if (!scrollEl) return;
      const rawNodes = Array.from(
        scrollEl.querySelectorAll<HTMLElement>(
          "main h2[id], main h3[id], main section[id] > div > h2, main section[id] > h2",
        ),
      );
      const seenIds = new Set<string>();
      const trackedTargets: HTMLElement[] = [];
      const nextItems: TocRow[] = [];
      for (const node of rawNodes) {
        const sec = node.id ? node : node.closest<HTMLElement>("section[id]");
        const id = node.id || sec?.id || "";
        const label = (node.textContent ?? "").replace(/#$/, "").trim();
        if (!id || !label || seenIds.has(id)) continue;
        seenIds.add(id);
        trackedTargets.push(sec ?? node);
        nextItems.push({
          value: id,
          label,
          depth: node.tagName === "H3" ? 3 : 2,
        });
      }

      setHeadings((prev) => {
        if (
          prev.length === nextItems.length &&
          prev.every(
            (item, idx) =>
              item.value === nextItems[idx]?.value &&
              item.label === nextItems[idx]?.label &&
              item.depth === nextItems[idx]?.depth,
          )
        ) {
          return prev;
        }
        return nextItems;
      });

      io?.disconnect();
      visible.clear();
      if (trackedTargets.length === 0 || !("IntersectionObserver" in globalThis)) {
        setActiveIds([]);
        return;
      }

      setActiveIds([trackedTargets[0]!.id]);
      io = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            const id = (entry.target as HTMLElement).id;
            if (!id) continue;
            if (entry.isIntersecting) visible.add(id);
            else visible.delete(id);
          }
          const firstVisible = trackedTargets.find((n) => visible.has(n.id));
          if (firstVisible) {
            setActiveIds([firstVisible.id]);
          }
        },
        {
          root: scrollEl,
          rootMargin: "-16px 0px -65% 0px",
          threshold: 0,
        },
      );
      for (const target of trackedTargets) io.observe(target);
    };

    const timer = setTimeout(collectHeadings, 30);
    const mo =
      scrollEl && "MutationObserver" in globalThis
        ? new MutationObserver(() => collectHeadings())
        : undefined;
    if (mo && scrollEl) {
      mo.observe(scrollEl, { childList: true, subtree: true });
    }

    onCleanup(() => {
      clearTimeout(timer);
      mo?.disconnect();
      io?.disconnect();
    });
  });

  const navContext = () => docsPageContext(location.pathname);

  return (
    <div
      ref={scrollEl}
      class="flex h-full min-h-0 w-full items-start overflow-y-auto bg-surface"
    >
      <nav
        class="sticky top-0 hidden h-full w-60 shrink-0 flex-col overflow-y-auto border-e px-4 py-8 md:flex"
        aria-label="Documentation"
      >
        <DocsRail />
      </nav>

      <div class="flex min-w-0 flex-1 items-start justify-center">
        <div class="min-w-0 flex-1 max-w-screen-md px-6 py-10 md:px-10 md:py-12">
          {props.children}

          <Show when={navContext().prev || navContext().next}>
            <nav
              aria-label="Pagination"
              class="mt-14 grid gap-4 border-t pt-8 sm:grid-cols-2"
            >
              <Show when={navContext().prev} fallback={<div />}>
                {(prev) => (
                  <A
                    href={prev().href}
                    class="flex flex-col gap-1 rounded-lg border bg-surface p-4 no-underline transition-colors duration-fast hover:border-strong hover:bg-surface-raised"
                  >
                    <span class="type-caption uppercase text-muted">
                      ← {prev().groupLabel}
                    </span>
                    <span class="type-body-strong">{prev().title}</span>
                  </A>
                )}
              </Show>
              <Show when={navContext().next} fallback={<div />}>
                {(next) => (
                  <A
                    href={next().href}
                    class="flex flex-col items-end gap-1 rounded-lg border bg-surface p-4 text-right no-underline transition-colors duration-fast hover:border-strong hover:bg-surface-raised"
                  >
                    <span class="type-caption uppercase text-muted">
                      {next().groupLabel} →
                    </span>
                    <span class="type-body-strong">{next().title}</span>
                  </A>
                )}
              </Show>
            </nav>
          </Show>
        </div>

        <aside
          aria-label="On this page"
          onClick={(event) => {
            const anchor = (event.target as HTMLElement | null)?.closest<HTMLAnchorElement>(
              "a[data-value]",
            );
            const targetId = anchor?.getAttribute("data-value");
            if (!targetId || !scrollEl) return;
            event.preventDefault();
            setActiveIds([targetId]);
            const target = scrollEl.querySelector<HTMLElement>(
              `#${CSS.escape(targetId)}`,
            );
            target?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
          class="sticky top-0 hidden h-full w-56 shrink-0 overflow-y-auto py-10 pe-6 xl:block"
        >
          <Show when={headings().length > 0}>
            <docs-toc ref={setTocEl} />
          </Show>
        </aside>
      </div>
    </div>
  );
}

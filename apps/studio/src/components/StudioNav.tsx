/**
 * The studio's navigation: the page title is the menu.
 *
 * No hamburger: the title in the bar is the trigger, and the card it opens
 * names every route. Click works everywhere; where the pointer hovers,
 * resting on the title opens the card and leaving the surface closes it —
 * touch never opens, and the keyboard path is untouched.
 *
 * The card is a grid of route cards plus the six token-group cards inline —
 * no flyout, no nesting. The menu machine owns the trigger, the position,
 * and the dismiss; the cards are the studio's own links, slotted into the
 * menu's content, so they carry descriptions and icons no menu row can.
 */
import { createEffect, createSignal, For, onCleanup, Show } from "solid-js";
import { A, useLocation } from "@solidjs/router";
import { createSpinComponent } from "@spinjs/components/solid";
import { menu } from "@spinjs/components/menu";
import { Web } from "@spinjs/kit";
import { CONCERNS, MARK, ROUTES } from "../lib/routes.ts";
import type { StudioRoute } from "../lib/routes.ts";
import { GROUPS } from "../routes/themes.tsx";
import { hostPath } from "../lib/client.ts";
import { studioBase } from "../lib/mount.ts";
const HOVER_OPEN_MS = 150;
const HOVER_CLOSE_MS = 100;

const CARD =
  "flex items-center gap-2 rounded-md px-2 py-1 text-muted no-underline transition-colors hover:bg-surface-sunken";

/** A card the route table does not own: a section anchor, a kind filter. */
interface OwnedCard {
  readonly href: string;
  readonly value: string;
  readonly label: string;
  readonly icon: string;
  readonly description: string;
}


const COMPONENT_CARDS: readonly OwnedCard[] = [
  {
    href: "/components",
    value: "/components",
    label: "All",
    icon: "i-lucide-layout-dashboard",
    description: "Every component, primitives beside machines",
  },
  {
    href: "/components?kind=primitive",
    value: "/components?kind=primitive",
    label: "Primitives",
    icon: "i-lucide-box",
    description: "Tags, variants, and token reads",
  },
  {
    href: "/components?kind=machine",
    value: "/components?kind=machine",
    label: "Machines",
    icon: "i-lucide-square-mouse-pointer",
    description: "Statechart-driven components with typed bridges",
  },
];

const TYPE_TABS: readonly { readonly path: string; readonly label: string }[] = [
  { path: "/tokens/type/styles", label: "Styles" },
  { path: "/tokens/type/faces", label: "Faces" },
  { path: "/tokens/type/ramps", label: "Ramps" },
];

function RouteCard(props: { route: StudioRoute; onFollow: () => void }) {
  return (
    <A
      href={hostPath(props.route.path)}
      role="menuitem"
      data-value={props.route.path}
      class={CARD}
      onClick={() => props.onFollow()}
    >
      <span
        class={`inline-block shrink-0 icon-sm text-muted ${props.route.icon}`}
        aria-hidden="true"
      />
      <span class="min-w-0 truncate type-label">{props.route.label}</span>
    </A>
  );
}

function OwnedRouteCard(props: { card: OwnedCard; onFollow: () => void }) {
  return (
    <A
      href={hostPath(props.card.href)}
      role="menuitem"
      data-value={props.card.value}
      class={CARD}
      onClick={() => props.onFollow()}
    >
      <span
        class={`inline-block shrink-0 icon-sm text-muted ${props.card.icon}`}
        aria-hidden="true"
      />
      <span class="min-w-0 truncate type-label">{props.card.label}</span>
    </A>
  );
}

export default function StudioNav() {
  const location = useLocation();
  const [el, setEl] = createSignal<HTMLElement>();
  const ctl = createSpinComponent(el, menu);
  const [openCrumb, setOpenCrumb] = createSignal<"area" | "section" | null>(null);
  createEffect(() => ctl.bind({}, {}));
  createEffect(() => {
    location.pathname;
    location.search;
    ctl.commands.close();
    setOpenCrumb(null);
  });
  const cleanPath = (): string => {
    const base = studioBase(location.pathname);
    return base !== "" && location.pathname.startsWith(base)
      ? location.pathname.slice(base.length) || "/"
      : location.pathname;
  };
  const inTokens = (): boolean => {
    const path = cleanPath();
    return (
      path === "/tokens" ||
      path.startsWith("/tokens/") ||
      path === "/themes" ||
      path.startsWith("/themes/")
    );
  };
  const inComponents = (): boolean => {
    const path = cleanPath();
    return path === "/components" || path.startsWith("/components/");
  };
  const areaLabel = (): string => {
    const path = cleanPath();
    if (inTokens()) return "Tokens";
    if (inComponents()) return "Components";
    const found = ROUTES.find(
      (route) => path === route.path || path === hostPath(route.path),
    );
    return found?.label ?? MARK.label;
  };
  const tokenGroup = (): (typeof GROUPS)[number] | undefined => {
    const path = cleanPath().replace(/^\/themes(\/|$)/, "/tokens$1");
    if (path === "/tokens") return GROUPS[0];
    for (const entry of GROUPS) {
      const [group] = entry;
      if (path === group || path === hostPath(group)) return entry;
      if (group === "/tokens/type" && path.startsWith(`${group}/`)) return entry;
    }
    return undefined;
  };
  const typeLeaf = (): { readonly path: string; readonly label: string } | undefined => {
    const path = cleanPath().replace(/^\/themes(\/|$)/, "/tokens$1");
    if (path === "/tokens/type" || path === "/tokens/type/styles") return TYPE_TABS[0];
    if (path === "/tokens/type/faces") return TYPE_TABS[1];
    if (path === "/tokens/type/ramps") return TYPE_TABS[2];
    return undefined;
  };
  const componentKind = (): OwnedCard | undefined => {
    if (!inComponents()) return undefined;
    const kind = new URLSearchParams(location.search).get("kind");
    if (kind === "primitive") return COMPONENT_CARDS[1];
    if (kind === "machine") return COMPONENT_CARDS[2];
    return COMPONENT_CARDS[0];
  };
  const componentLeaf = (): string | undefined => {
    const path = cleanPath();
    if (!path.startsWith("/components/")) return undefined;
    const raw = path.slice("/components/".length).split("/")[0];
    if (!raw || raw.length === 0) return undefined;
    const cleanSlug = raw.replace(/^(primitive|component)-/, "");
    return cleanSlug
      .split("-")
      .map((w) => (w[0] ? w[0].toUpperCase() + w.slice(1) : w))
      .join(" ");
  };
  let navEl: HTMLElement | undefined;
  let openTimer: ReturnType<typeof setTimeout> | undefined;
  let closeTimer: ReturnType<typeof setTimeout> | undefined;
  const onDocPointer = (event: PointerEvent): void => {
    if (openCrumb() === null) return;
    if (navEl !== undefined && event.target instanceof Node && navEl.contains(event.target)) return;
    setOpenCrumb(null);
  };
  const onDocKey = (event: KeyboardEvent): void => {
    if (event.key === "Escape") setOpenCrumb(null);
  };
  globalThis.addEventListener("pointerdown", onDocPointer);
  globalThis.addEventListener("keydown", onDocKey);
  onCleanup(() => {
    clearTimeout(openTimer);
    clearTimeout(closeTimer);
    globalThis.removeEventListener("pointerdown", onDocPointer);
    globalThis.removeEventListener("keydown", onDocKey);
  });
  let crumbOpenTimer: ReturnType<typeof setTimeout> | undefined;
  let crumbCloseTimer: ReturnType<typeof setTimeout> | undefined;
  const cancelOpen = (): void => {
    clearTimeout(openTimer);
    openTimer = undefined;
  };
  const cancelClose = (): void => {
    clearTimeout(closeTimer);
    closeTimer = undefined;
  };
  const enterCrumb = (target: "area" | "section", event: PointerEvent): void => {
    if (event.pointerType === "touch") return;
    clearTimeout(crumbCloseTimer);
    crumbCloseTimer = undefined;
    cancelOpen();
    ctl.commands.close();
    if (openCrumb() === target) return;
    clearTimeout(crumbOpenTimer);
    crumbOpenTimer = setTimeout(() => {
      crumbOpenTimer = undefined;
      setOpenCrumb(target);
    }, HOVER_OPEN_MS);
  };
  const leaveCrumb = (target: "area" | "section"): void => {
    clearTimeout(crumbOpenTimer);
    crumbOpenTimer = undefined;
    clearTimeout(crumbCloseTimer);
    crumbCloseTimer = setTimeout(() => {
      crumbCloseTimer = undefined;
      setOpenCrumb((c) => (c === target ? null : c));
    }, HOVER_CLOSE_MS);
  };
  const close = (): void => {
    cancelOpen();
    cancelClose();
    clearTimeout(crumbOpenTimer);
    clearTimeout(crumbCloseTimer);
    ctl.commands.close();
    setOpenCrumb(null);
  };
  return (
    <nav ref={(node) => { navEl = node; }} aria-label="Breadcrumb" class="inline-flex min-w-0 max-w-full items-center gap-1">
      <A
        href={hostPath("/")}
        data-testid="studio-home"
        title="Overview"
        aria-label="Overview"
        class="bare inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-primary transition-colors hover:bg-surface"
        onClick={close}
      >
        <Web size={16} class="h-4 w-4 shrink-0 text-primary" />
      </A>

      <span class="select-none text-muted type-caption" aria-hidden="true">/</span>

      <span
        class="relative inline-flex min-w-0 shrink items-center"
        onPointerEnter={(event) => {
          if (event.pointerType === "touch") return;
          cancelClose();
          setOpenCrumb(null);
          if (openTimer !== undefined) return;
          openTimer = setTimeout(() => {
            openTimer = undefined;
            ctl.commands.open();
          }, HOVER_OPEN_MS);
        }}
        onPointerLeave={() => {
          cancelOpen();
          if (closeTimer !== undefined) return;
          closeTimer = setTimeout(() => {
            closeTimer = undefined;
            ctl.commands.close();
          }, HOVER_CLOSE_MS);
        }}
      >
        <studio-nav ref={setEl} class="min-w-0 max-w-full">
          <span slot="title" class="inline-flex min-w-0 flex-1 items-center gap-1 truncate text-center type-label">
            <span>{areaLabel()}</span>
          </span>
          <div slot="cards">
            <div class="flex flex-col gap-1" role="menu" aria-label="Navigate">
              <For each={CONCERNS}>
                {(route) => <RouteCard route={route} onFollow={close} />}
              </For>
            </div>
          </div>
        </studio-nav>
      </span>

      <Show when={tokenGroup()}>
        {(group) => (
          <>
            <span class="select-none text-muted type-caption" aria-hidden="true">/</span>
            <span
              class="relative inline-flex shrink-0 items-center"
              onPointerEnter={(e) => enterCrumb("area", e)}
              onPointerLeave={() => leaveCrumb("area")}
            >
              <button
                type="button"
                data-testid="crumb-themes"
                class="bare inline-flex h-8 items-center gap-1 rounded-md px-2 type-label text-muted transition-colors hover:bg-surface"
                aria-expanded={openCrumb() === "area"}
                onClick={() => setOpenCrumb((c) => (c === "area" ? null : "area"))}
              >
                <span>{group()[1]}</span>
                <span class="inline-block icon-sm i-lucide-chevron-down text-muted" aria-hidden="true" />
              </button>
              <Show when={openCrumb() === "area"}>
                <div class="absolute left-0 top-full z-dropdown pt-1">
                  <div class="flex w-40 flex-col gap-1 rounded-lg border bg-surface-raised p-2 shadow-lg" role="menu" aria-label="Tokens">
                    <For each={GROUPS}>
                      {([path, label, icon]) => (
                        <A
                          href={hostPath(path)}
                          role="menuitem"
                          data-value={path}
                          class={CARD}
                          onClick={close}
                        >
                          <span class={`inline-block shrink-0 icon-sm text-muted ${icon}`} aria-hidden="true" />
                          <span class="min-w-0 truncate type-label">{label}</span>
                        </A>
                      )}
                    </For>
                  </div>
                </div>
              </Show>
            </span>
          </>
        )}
      </Show>

      <Show when={typeLeaf()}>
        {(leaf) => (
          <>
            <span class="select-none text-muted type-caption" aria-hidden="true">/</span>
            <span
              class="relative inline-flex shrink-0 items-center"
              onPointerEnter={(e) => enterCrumb("section", e)}
              onPointerLeave={() => leaveCrumb("section")}
            >
              <button
                type="button"
                data-testid="crumb-type"
                class="bare inline-flex h-8 items-center gap-1 rounded-md px-2 type-label text-muted transition-colors hover:bg-surface"
                aria-expanded={openCrumb() === "section"}
                onClick={() => setOpenCrumb((c) => (c === "section" ? null : "section"))}
              >
                <span>{leaf().label}</span>
                <span class="inline-block icon-sm i-lucide-chevron-down text-muted" aria-hidden="true" />
              </button>
              <Show when={openCrumb() === "section"}>
                <div class="absolute left-0 top-full z-dropdown pt-1">
                  <div class="flex w-36 flex-col gap-1 rounded-lg border bg-surface-raised p-2 shadow-lg" role="menu" aria-label="Type">
                    <For each={TYPE_TABS}>
                      {(tab) => (
                        <A
                          href={hostPath(tab.path)}
                          role="menuitem"
                          data-value={tab.path}
                          class={CARD}
                          onClick={close}
                        >
                          <span class="min-w-0 truncate type-label">{tab.label}</span>
                        </A>
                      )}
                    </For>
                  </div>
                </div>
              </Show>
            </span>
          </>
        )}
      </Show>

      <Show when={inComponents()}>
        <span class="select-none text-muted type-caption" aria-hidden="true">/</span>
        <Show
          when={componentLeaf()}
          fallback={
            <span
              class="relative inline-flex shrink-0 items-center"
              onPointerEnter={(e) => enterCrumb("area", e)}
              onPointerLeave={() => leaveCrumb("area")}
            >
              <button
                type="button"
                data-testid="crumb-components"
                class="bare inline-flex h-8 items-center gap-1 rounded-md px-2 type-label text-muted transition-colors hover:bg-surface"
                aria-expanded={openCrumb() === "area"}
                onClick={() => setOpenCrumb((c) => (c === "area" ? null : "area"))}
              >
                <span>{componentKind()?.label ?? "All"}</span>
                <span class="inline-block icon-sm i-lucide-chevron-down text-muted" aria-hidden="true" />
              </button>
              <Show when={openCrumb() === "area"}>
                <div class="absolute left-0 top-full z-dropdown pt-1">
                  <div class="flex w-40 flex-col gap-1 rounded-lg border bg-surface-raised p-2 shadow-lg" role="menu" aria-label="Components">
                    <For each={COMPONENT_CARDS}>
                      {(card) => <OwnedRouteCard card={card} onFollow={close} />}
                    </For>
                  </div>
                </div>
              </Show>
            </span>
          }
        >
          {(title) => (
            <span class="truncate px-2 type-label text-muted">{title()}</span>
          )}
        </Show>
      </Show>
    </nav>
  );
}

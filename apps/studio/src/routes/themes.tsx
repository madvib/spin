import { For, Show } from "solid-js";
import { A, useLocation } from "@solidjs/router";
import type { JSX } from "solid-js";
import { inDrawer } from "../lib/host.ts";

/**
 * The token-group side list: six static rows, no grouping, no search.
 *
 * The same split shape the components gallery lays out — a rail beside the
 * page, a strip above it in the drawer or on a narrow window — but six rows
 * need neither the gallery's grouping nor its filter. The links spell their
 * own paths: the groups are children of this route, and a child path is the
 * one thing a table cannot name without becoming the router.
 */
const GROUPS: ReadonlyArray<
  readonly [path: string, label: string, icon: string]
> = [
  ["/themes/colors", "Color", "i-lucide-palette"],
  ["/themes/type", "Type", "i-lucide-type"],
  ["/themes/icons", "Icons", "i-lucide-layers"],
  ["/themes/motion", "Motion", "i-lucide-square-play"],
  ["/themes/spacing", "Spacing", "i-lucide-ruler"],
  ["/themes/style", "Style", "i-lucide-contrast"],
];

const RAIL_LINK =
  "flex w-full items-center gap-2 justify-start rounded-md border border-solid border-transparent bg-transparent p-2 text-left type-body normal-case text-muted no-underline cursor-pointer hover:border-primary hover:bg-surface-raised data-[current]:border-primary data-[current]:bg-surface-sunken";

const DRAWER_LINK =
  "inline-flex items-center gap-1 rounded-md border border-solid border-transparent px-2 py-1 type-body no-underline text-muted hover:border-primary hover:bg-surface-raised data-[current]:border-primary data-[current]:bg-surface-sunken";

function NavBody(props: {
  listClass: () => string;
  linkClass: string;
  path: () => string;
}) {
  return (
    <ul class={props.listClass()} aria-label="Token groups">
      <For each={GROUPS}>
        {([path, label, icon]) => (
          <li>
            <A
              href={path}
              class={props.linkClass}
              data-current={props.path() === path || undefined}
            >
              <span class={icon} aria-hidden="true" />
              {label}
            </A>
          </li>
        )}
      </For>
    </ul>
  );
}

export default function ThemesLayout(props: { children?: JSX.Element }) {
  const location = useLocation();
  const drawer = () => inDrawer();
  const navClass = () =>
    drawer()
      ? "flex shrink-0 flex-col gap-2 border-b bg-surface-raised p-3"
      : "flex w-full shrink-0 flex-col gap-3 border-b bg-surface-raised p-4 lg:w-[13rem] lg:border-b-0 lg:border-r lg:overflow-y-auto";
  const listClass = () =>
    drawer()
      ? "flex flex-wrap gap-x-2 gap-y-1"
      : "flex flex-wrap gap-x-2 gap-y-1 lg:flex-col lg:flex-nowrap lg:gap-1";

  return (
    <Show
      when={!inDrawer()}
      fallback={
        <div class="flex min-h-0 flex-col">
          <nav data-studio-chrome="" aria-label="Themes" class={navClass()}>
            <NavBody
              listClass={listClass}
              linkClass={DRAWER_LINK}
              path={() => location.pathname}
            />
          </nav>
          {props.children}
        </div>
      }
    >
      <div class="flex min-h-0 flex-1 flex-col lg:flex-row">
        <nav data-studio-chrome="" aria-label="Themes" class={navClass()}>
          <NavBody
            listClass={listClass}
            linkClass={RAIL_LINK}
            path={() => location.pathname}
          />
        </nav>
        <div class="flex min-h-0 min-w-0 flex-1 flex-col">
          {props.children}
        </div>
      </div>
    </Show>
  );
}

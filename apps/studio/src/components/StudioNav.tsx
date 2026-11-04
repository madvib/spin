/**
 * The studio's navigation: one menu in the bar, submenus for sublevels.
 *
 * The rail is gone: top-level routes live here, and a route with children
 * (the six token groups under Themes) opens as a submenu. The overflow
 * holds the chrome verbs — checks, preferences, drawer/modal, close — so
 * the bar stays one row at every width.
 */
import { createEffect, createSignal } from "solid-js";
import { useLocation, useNavigate } from "@solidjs/router";
import { createSpinComponent } from "@spinjs/components/solid";
import { menu } from "@spinjs/components/menu";
import { CONCERNS, FOOT, MARK } from "../lib/routes.ts";
import { hostPath } from "../lib/client.ts";

const THEME_GROUPS: ReadonlyArray<readonly [string, string]> = [
  ["/themes/colors", "Color"],
  ["/themes/type", "Type"],
  ["/themes/icons", "Icons"],
  ["/themes/motion", "Motion"],
  ["/themes/spacing", "Spacing"],
  ["/themes/style", "Style"],
];

export default function StudioNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const [el, setEl] = createSignal<HTMLElement>();
  const ctl = createSpinComponent(el, menu);
  createEffect(() =>
    ctl.bind(
      {
        items: [
          { value: MARK.path, label: MARK.label },
          ...CONCERNS.map((route) =>
            route.path === "/themes"
              ? {
                value: route.path,
                label: route.label,
                children: THEME_GROUPS.map(([path, label]) => ({
                  value: path,
                  label,
                })),
              }
              : { value: route.path, label: route.label },
          ),
          ...FOOT.map((route) => ({ value: route.path, label: route.label })),
        ],
      },
      {
        select: (event: CustomEvent<{ value: string }>) => {
          navigate(hostPath(event.detail.value));
        },
      },
    ),
  );
  const current = (): string => {
    const path = location.pathname;
    for (const [group] of THEME_GROUPS) {
      if (path === group || path === hostPath(group)) {
        return `Themes / ${group.slice("/themes/".length)}`;
      }
    }
    const found = [MARK, ...CONCERNS, ...FOOT].find(
      (route) => path === route.path || path === hostPath(route.path),
    );
    return found?.label ?? MARK.label;
  };
  return (
    <span class="inline-flex shrink-0 items-center gap-1">
      <studio-nav ref={setEl} />
      <span class="whitespace-nowrap text-sm font-medium">
        {current()}
      </span>
    </span>
  );
}

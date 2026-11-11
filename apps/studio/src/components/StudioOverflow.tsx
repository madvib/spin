/**
 * The bar's overflow: the chrome verbs, in one menu.
 *
 * Preferences, the drawer/modal edge, and close — the verbs that belong to
 * the tool rather than the document. Checks has its own bar button with a
 * live count and needs no second entry here; findings is a page, reached
 * through the title menu.
 */
import { createEffect, createSignal } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { createSpinComponent } from "@spinjs/components/solid";
import { menu } from "@spinjs/components/menu";
import { closeStudio, embedded, inDrawer, toggleHostMode } from "../lib/host.ts";
import { hostPath } from "../lib/client.ts";

export default function StudioOverflow() {
  const navigate = useNavigate();
  const [el, setEl] = createSignal<HTMLElement>();
  const ctl = createSpinComponent(el, menu);
  createEffect(() =>
    ctl.bind(
      {
        items: [
          { value: "preferences", label: "Preferences" },
          ...(embedded()
            ? [
              {
                value: "edge",
                label: inDrawer() ? "Show as window" : "Show as drawer",
              },
              { value: "close", label: "Close studio" },
            ]
            : []),
        ],
      },
      {
        select: (event: CustomEvent<{ value: string }>) => {
          const value = event.detail.value;
          if (value === "preferences") navigate(hostPath("/preferences"));
          else if (value === "edge") toggleHostMode();
          else if (value === "close") closeStudio();
        },
      },
    ),
  );
  return <studio-overflow ref={setEl} />;
}

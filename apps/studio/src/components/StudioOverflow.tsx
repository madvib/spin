/**
 * The bar's overflow: the chrome verbs, in one menu.
 *
 * Checks, preferences, the drawer/modal edge, and close — the verbs that
 * belong to the tool rather than the document. The checks open their panel;
 * preferences navigates; the host verbs answer only when embedded.
 */
import { createEffect, createSignal } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { createSpinComponent } from "@spinjs/components/solid";
import { menu } from "@spinjs/components/menu";
import { closeStudio, embedded, inDrawer, toggleHostMode } from "../lib/host.ts";
import { hostPath } from "../lib/client.ts";
import { openChecks } from "../lib/checks-bus.ts";

export default function StudioOverflow() {
  const navigate = useNavigate();
  const [el, setEl] = createSignal<HTMLElement>();
  const ctl = createSpinComponent(el, menu);
  createEffect(() =>
    ctl.bind(
      {
        items: [
          { value: "checks", label: "Checks" },
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
          if (value === "checks") openChecks();
          else if (value === "preferences") navigate(hostPath("/preferences"));
          else if (value === "edge") toggleHostMode();
          else if (value === "close") closeStudio();
        },
      },
    ),
  );
  return <studio-overflow ref={setEl} />;
}

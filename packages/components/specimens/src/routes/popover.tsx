import { createEffect, createSignal } from "solid-js";
import { createSpinComponent } from "@spin/hooks/solid";
import { DemoCard } from "../demo-card.tsx";
import { DemoControls } from "../demo-controls.tsx";
import { DEMO_BUTTON } from "../demo-button.ts";
import { DemoGrid } from "../demo-grid.tsx";
import { DemoReadout } from "../demo-readout.tsx";

import "./spin-popover.html";
interface PopoverCommands {
  show(): void;
  hide(): void;
  toggle(): void;
}

interface ToastCommands {
  create(item: { id: string; title: string; description: string; type: string; duration: number; priority: number; action: string }): void;
  dismissAll(): void;
}

/**
 * The proof: identical app-controller code against a machine-owned
 * component (toast) and a platform-owned one (popover). Both present
 * `{ commands, state, bind }` through `useSpinComponent`; the host
 * cannot tell which owns the state, and doesn't need to.
 *
 * Popover itself is the platform tier: native `<popover>`, light-dismiss
 * and Escape by the browser, surface and entrance from the `popover`
 * primitive. No machine, no bridge — `attach` wires the native behavior
 * to the declared commands and events.
 */
export default function Popover() {
  const [open, setOpen] = createSignal(false);
  const [toasts, setToasts] = createSignal(0);

  const [popoverEl, setPopoverEl] = createSignal<HTMLElement>();
  const popover = createSpinComponent<PopoverCommands>(popoverEl);
  createEffect(() => {
    const ctl = popover();
    if (ctl === undefined) return undefined;
    return ctl.bind({ label: "Open popover" }, {
      "open-change": (event: CustomEvent<{ open: boolean }>) => setOpen(event.detail.open),
    });
  });

  const [toastEl, setToastEl] = createSignal<HTMLElement>();
  const toast = createSpinComponent<ToastCommands>(toastEl);
  createEffect(() => {
    const ctl = toast();
    if (ctl === undefined) return undefined;
    return ctl.bind({}, {
      "status-change": () => setToasts(document.querySelectorAll("#demo-toast [role=\"status\"]").length),
    });
  });

  return (
    <DemoGrid>
      <DemoCard
        title="Platform-owned: native popover"
        width="sm"
        note="The browser owns open/closed. Light-dismiss and Escape need no code here."
      >
        <spin-popover
          id="demo-popover"
          ref={(node: HTMLElement) => {
            setPopoverEl(node);
            node.setAttribute("label", "Open popover");
          }}
        >
          <p class="m-0 text-sm text-text">A card that happens to float.</p>
        </spin-popover>
        <DemoControls>
          <button type="button" class={DEMO_BUTTON} onClick={() => popover()?.commands.show()}>
            el.show()
          </button>
          <button type="button" class={DEMO_BUTTON} onClick={() => popover()?.commands.hide()}>
            el.hide()
          </button>
          <button type="button" class={DEMO_BUTTON} onClick={() => popover()?.commands.toggle()}>
            el.toggle()
          </button>
        </DemoControls>
        <DemoReadout>
          open: <span id="popover-open">{open() ? "true" : "false"}</span>
        </DemoReadout>
      </DemoCard>

      <DemoCard
        title="Machine-owned: toast, same handle"
        width="sm"
        note="Same `{ commands, state, bind }` — the owner is invisible to the host."
      >
        <spin-toast id="demo-toast" ref={setToastEl} />
        <DemoControls>
          <button type="button" class={DEMO_BUTTON} onClick={() => toast()?.commands.create({ id: "proof-1", title: "Proof toast", description: "Created through the same handle.", type: "info", duration: 8000, priority: 1, action: "" })}>
            {"el.create({...})"}
          </button>
          <button type="button" class={DEMO_BUTTON} onClick={() => toast()?.commands.dismissAll()}>
            el.dismissAll()
          </button>
        </DemoControls>
        <DemoReadout>
          toasts: <span id="popover-toasts">{toasts()}</span>
        </DemoReadout>
      </DemoCard>
    </DemoGrid>
  );
}

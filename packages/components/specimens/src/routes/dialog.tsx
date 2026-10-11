import { createSignal } from "solid-js";
import { createSpin } from "@spin/hooks/solid";
import {
  DEMO_BUTTON,
  DemoCard,
  DemoControls,
  DemoGrid,
  DemoReadout,
} from "../demo.tsx";

/** The element's host surface, from its machine-def's commands. */
interface DialogCommands {
  show: () => void;
  hide: (reason?: "escape" | "outside" | "api") => void;
  toggle: () => void;
}

/**
 * Dialog on the forked FSM with reflexes as actions — the canonical proof
 * of the architecture split, driven through the Solid hook.
 *
 * Watch what is NOT here: no focus-trap wiring, no document listeners, no
 * scroll-lock effect in the component. The machine is open/closed;
 * `focus-trap`, `dismissable`, and `scroll-lock` are stdlib actions attached
 * through the content bag. The hook gives the host props down, events up,
 * and `dialog.commands()` for the imperative calls.
 */
export default function DialogFsm() {
  const [status, setStatus] = createSignal("closed");
  // The hook: props down, events up, commands reachable. No ref bookkeeping.
  const dialog = createSpin<{ role: string }, DialogCommands>(
    "spin-dialog",
    () => ({ role: "dialog" }),
    {
      "open-change": (e: CustomEvent<{ open: boolean }>) =>
        setStatus(e.detail.open ? "open" : "closed"),
    },
  );

  return (
    <DemoGrid>
      <DemoCard
        title="The host surface"
        width="sm"
        note="The machine is open/closed; focus-trap, dismissable and scroll-lock are stdlib actions in the content bag, not code in the host."
      >
        <spin-dialog ref={dialog.ref}>
          <div slot="title" class="text-lg font-semibold text-text">
            Slotted title
          </div>
        </spin-dialog>
        <DemoControls>
          <button
            type="button"
            class={DEMO_BUTTON}
            onClick={() => dialog.commands().show()}
          >
            el.show()
          </button>
          <button
            type="button"
            class={DEMO_BUTTON}
            onClick={() => dialog.commands().hide("api")}
          >
            el.hide("api")
          </button>
        </DemoControls>
        <DemoReadout>
          status: <span id="dialog-status">{status()}</span>
        </DemoReadout>
      </DemoCard>
    </DemoGrid>
  );
}

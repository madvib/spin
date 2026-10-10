import { createSignal } from "solid-js";
import { createSpin } from "@spin/hooks/solid";

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
    "spin-dialog-fsm",
    () => ({ role: "dialog" }),
    {
      "open-change": (e: CustomEvent<{ open: boolean }>) => setStatus(e.detail.open ? "open" : "closed"),
    },
  );

  return (
    <section>
      <h2 class="text-xl mb-1">Dialog — FSM machine + stdlib actions</h2>
      <p class="text-muted mb-4">
        Open, then: Tab cycles inside (focus-trap), Escape and outside clicks close (dismissable),
        body scroll is locked (scroll-lock). The machine holds two states; the reflexes are actions.
      </p>

      <div class="flex items-center gap-3 mb-4">
        <button
          type="button"
          class="rounded-lg border border-border bg-surface-raised px-4 py-2 text-sm font-medium text-text shadow-sm transition-colors hover:bg-surface"
          onClick={() => dialog.commands().show()}
        >
          el.show()
        </button>
        <button
          type="button"
          class="rounded-lg border border-border bg-surface-raised px-4 py-2 text-sm font-medium text-text shadow-sm transition-colors hover:bg-surface"
          onClick={() => dialog.commands().hide("api")}
        >
          el.hide("api")
        </button>
        <span class="text-sm text-muted">
          status: <span id="dialog-status">{status()}</span>
        </span>
      </div>

      <spin-dialog-fsm ref={dialog.ref}>
        <div slot="title" class="text-lg font-semibold text-text">Slotted title</div>
      </spin-dialog-fsm>
    </section>
  );
}

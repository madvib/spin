import { createEffect, createSignal, onCleanup } from "solid-js";
import { createSpinComponent } from "@spin/hooks/solid";
import { DEMO_BUTTON } from "../demo-button.ts";
import { DemoCard } from "../demo-card.tsx";
import { DemoControls } from "../demo-controls.tsx";
import { DemoGrid } from "../demo-grid.tsx";
import { DemoReadout } from "../demo-readout.tsx";
import type { ToastStatusChange } from "../../../src/toast/toast.presentation.ts";

import "./spin-toast.html";
interface ToastCommands {
  create: (item: {
    id: string;
    title: string;
    description: string;
    type: string;
    duration: number;
    priority: number;
    action: string;
  }) => void;
  update: (id: string, item: Record<string, unknown>) => void;
  dismiss: (id: string, src?: string) => void;
  remove: (id: string) => void;
  dismissAll: () => void;
  pause: (id: string) => void;
  resume: (id: string) => void;
}

/** The host's own data — the queue's write channel, as the host keeps it. */
interface HostToast {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly type: string;
  readonly duration: number;
  readonly priority: number;
  readonly action: string;
}

let counter = 0;

const make = (title: string, type: string, action = ""): HostToast => {
  counter += 1;
  return {
    id: `toast-${counter}`,
    title,
    description: `Toast number ${counter}.`,
    type,
    // Long-lived on purpose: the suite drives every dismissal by hand,
    // so no clock may fire mid-step and move the boxes under the mouse.
    duration: 60000,
    priority: 0,
    action,
  };
};

const PLACEMENTS = ["bottom", "bottom-end", "top", "top-start"] as const;

/**
 * Toast on the forked FSM: the queue is machine state and the host's list is
 * the write channel down, exactly as the legacy element wrote it.
 *
 * The claim under test: a machine whose state is mostly its own store
 * becomes one context here, the per-toast lifecycle becomes a status on each
 * entry, and every clock — the dismissal countdown, the remove delay, the
 * entry beat, the region's document reflexes — is an action rather than a
 * machine timer. Upward, the only callback the upstream toast declares is
 * the per-toast status; the host keeps its own list in step from `unmounted`.
 */
export default function ToastFsm() {
  const [items, setItems] = createSignal<HostToast[]>([]);
  const [last, setLast] = createSignal("nothing yet");
  /**
   * Every report the element made, in order. `#last-action` is a slot the
   * next report overwrites, and a report is often overwritten within a
   * frame — a row that starts dismissing takes its own pointer with it, so
   * the region is left and the rows behind it report themselves back to
   * `visible`. The history keeps them all, so a reader can name the report
   * it wants instead of catching whatever is current.
   */
  const [log, setLog] = createSignal<readonly string[]>([]);
  const [overlap, setOverlap] = createSignal(false);
  const [placement, setPlacement] = createSignal<string>("bottom");

  const [toastsEl, setToasts] = createSignal<HTMLElement>();
  const toasts = createSpinComponent<ToastCommands>(toastsEl);
  createEffect(() => {
    const ctl = toasts();
    if (ctl === undefined) return undefined;
    const unbind = ctl.bind({
      items: items(),
      overlap: overlap(),
      placement: placement(),
      removeDelay: 200,
      label: "Notifications",
    }, {
      "status-change": (event: CustomEvent<ToastStatusChange>) => {
        const detail = event.detail;
        const report = `${detail.id} → ${detail.status}${
          detail.src.length > 0 ? ` (${detail.src})` : ""
        }`;
        setLast(report);
        setLog((prev) => [...prev, report]);
        if (detail.status === "unmounted") {
          setItems((prev) => prev.filter((item) => item.id !== detail.id));
        }
      },
    });
    // The effect re-runs on every host write, and a cleanup is taken
    // through `onCleanup`, not through a returned function: without this
    // the previous subscription stays on the element, and every report
    // arrives once per bind.
    onCleanup(unbind);
    return undefined;
  });

  const show = (title: string, type: string, action = ""): void => {
    const item = make(title, type, action);
    setItems((prev) => [...prev, item]);
  };

  return (
    <DemoGrid>
      <DemoCard
        title="The queue as host list"
        width="sm"
        note="Every clock — the dismissal countdown, the remove delay, the entry beat — is an action; the only upward callback is the per-toast status."
      >
        <spin-toast
          id="region"
          ref={setToasts}
          prop:items={items()}
          prop:overlap={overlap()}
          prop:placement={placement()}
          prop:removeDelay={200}
        />
        <DemoControls>
          <button
            type="button"
            class={DEMO_BUTTON}
            onClick={() => show("Saved", "success")}
          >
            Success
          </button>
          <button
            type="button"
            class={DEMO_BUTTON}
            onClick={() => show("Something broke", "error")}
          >
            Error
          </button>
          <button
            type="button"
            class={DEMO_BUTTON}
            onClick={() => show("Heads up", "warning", "Undo")}
          >
            With an action
          </button>
          <button
            type="button"
            class={DEMO_BUTTON}
            onClick={() => toasts()?.commands.dismissAll()}
          >
            el.dismissAll()
          </button>
          <button
            type="button"
            class={DEMO_BUTTON}
            onClick={() => setOverlap((value) => !value)}
          >
            overlap: {overlap() ? "on" : "off"}
          </button>
          <button
            type="button"
            class={DEMO_BUTTON}
            onClick={() => {
              const at = PLACEMENTS.indexOf(
                placement() as (typeof PLACEMENTS)[number],
              );
              setPlacement(PLACEMENTS[(at + 1) % PLACEMENTS.length] as string);
            }}
          >
            placement: {placement()}
          </button>
        </DemoControls>
        <DemoReadout>
          <div>
            toasts: <span id="toast-count">{items().length}</span>
          </div>
          <div>
            last: <span id="last-action">{last()}</span>
          </div>
          {/* The report history, one entry per report, in the order they
              came. It is hidden on purpose: it is the machine-readable
              record, not a readout, and it must not take space from the
              demo around it. */}
          <div hidden id="action-log">
            {log().map((report) => <span data-report={report}>{report}</span>)}
          </div>
        </DemoReadout>
      </DemoCard>
    </DemoGrid>
  );
}

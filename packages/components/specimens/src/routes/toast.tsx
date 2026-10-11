import { createSignal } from "solid-js";
import { createSpin } from "@spin/hooks/solid";
import {
  DEMO_BUTTON,
  DemoCard,
  DemoControls,
  DemoGrid,
  DemoReadout,
} from "../demo.tsx";
import type { ToastStatusChange } from "../../../src/spin-toast/toast.bridge.ts";

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
 * The claim under test: a Zag machine whose state is mostly its own store
 * becomes one context here, the per-toast lifecycle becomes a status on each
 * entry, and every clock — the dismissal countdown, the remove delay, the
 * entry beat, the region's document reflexes — is an action rather than a
 * machine timer. Upward, the only callback Zag's toast declares is the
 * per-toast status; the host keeps its own list in step from `unmounted`.
 */
export default function ToastFsm() {
  const [items, setItems] = createSignal<HostToast[]>([]);
  const [last, setLast] = createSignal("nothing yet");
  const [overlap, setOverlap] = createSignal(false);
  const [placement, setPlacement] = createSignal<string>("bottom");

  const toasts = createSpin<
    {
      items: HostToast[];
      overlap: boolean;
      placement: string;
      removeDelay: number;
      label: string;
    },
    ToastCommands
  >(
    "spin-toast",
    () => ({
      items: items(),
      overlap: overlap(),
      placement: placement(),
      removeDelay: 200,
      label: "Notifications",
    }),
    {
      "status-change": (event: CustomEvent<ToastStatusChange>) => {
        const detail = event.detail;
        setLast(
          `${detail.id} → ${detail.status}${
            detail.src.length > 0 ? ` (${detail.src})` : ""
          }`,
        );
        if (detail.status === "unmounted") {
          setItems((prev) => prev.filter((item) => item.id !== detail.id));
        }
      },
    },
  );

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
          ref={toasts.ref}
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
            onClick={() => toasts.commands().dismissAll()}
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
        </DemoReadout>
      </DemoCard>
    </DemoGrid>
  );
}

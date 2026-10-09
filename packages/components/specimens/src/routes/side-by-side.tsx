import { createSignal } from "solid-js";
import type { AccordionItem, AccordionValueChange } from "../elements.ts";

type AccordionElement = HTMLElement & { items?: readonly AccordionItem[] };

const BASE_ITEMS: readonly AccordionItem[] = [
  {
    value: "controller",
    label: "Who owns the data?",
    content: "Solid. The route holds the item array in a signal and writes it onto the element as a property.",
  },
  {
    value: "events",
    label: "How does a toggle get back out?",
    content: "The element emits a value-change CustomEvent; the route listens with addEventListener like any framework would.",
  },
  {
    value: "state",
    label: "Who owns open/closed?",
    content: "The element. The machine keeps disclosure state; the controller only seeds data and observes the result.",
  },
];

/** Wires one element to the shared item signal and logs its value-change events. */
function useToggleLog(prefix: string, items: () => readonly AccordionItem[]) {
  const [last, setLast] = createSignal("nothing toggled yet");

  const attach = (node: HTMLElement): void => {
    (node as AccordionElement).items = items();
    node.addEventListener("value-change", handler);
  };

  const handler = (event: Event): void => {
    const change = (event as CustomEvent<AccordionValueChange>).detail;
    const labels = change.value.map(
      (value) => items().find((item) => item.value === value)?.label ?? value,
    );
    setLast(`${prefix}: ${labels.length > 0 ? `${labels.join(", ")} → open` : "all closed"}`);
  };

  return { attach, last };
}

/**
 * Three interpreters, one contract. All three elements share the markup
 * recipe, the machine-def contract (`createBridge`), the `value-change`
 * event, and — for robot and the fork — the literal same `connect` file.
 * Any divergence in toggling, selection, focus, or event payload is
 * visible on this page by construction.
 */
export default function SideBySide() {
  const [items] = createSignal<readonly AccordionItem[]>(BASE_ITEMS);
  const zag = useToggleLog("zag", items);
  const robot = useToggleLog("robot3", items);
  const fsm = useToggleLog("fork-fsm", items);

  return (
    <section>
      <h2 class="text-xl mb-1">Three interpreters, one component contract</h2>
      <p class="text-muted mb-4">
        The same markup, the same <code>value-change</code> event, the same connect: left runs Zag's accordion
        machine, middle a robot3 port, right a hand-forked <code>@xstate/fsm</code> core whose config is plain
        data. Click each side; state, focus, and events should agree.
      </p>

      <div class="grid grid-cols-3 gap-4 items-start">
        <div>
          <h3 class="text-sm font-semibold text-text mb-2">
            Zag <span class="text-muted font-normal">(@zag-js/accordion)</span>
          </h3>
          <spin-accordion ref={zag.attach}>
            <div slot="header" class="px-4 py-2 text-sm font-medium text-text">Zag machine</div>
          </spin-accordion>
          <p class="mt-2 text-sm text-muted">
            last: <span id="zag-last">{zag.last()}</span>
          </p>
        </div>
        <div>
          <h3 class="text-sm font-semibold text-text mb-2">
            robot3 <span class="text-muted font-normal">(ported)</span>
          </h3>
          <spin-accordion-robot ref={robot.attach}>
            <div slot="header" class="px-4 py-2 text-sm font-medium text-text">Robot machine</div>
          </spin-accordion-robot>
          <p class="mt-2 text-sm text-muted">
            last: <span id="robot-last">{robot.last()}</span>
          </p>
        </div>
        <div>
          <h3 class="text-sm font-semibold text-text mb-2">
            fork-fsm <span class="text-muted font-normal">(config-as-data)</span>
          </h3>
          <spin-accordion-fsm ref={fsm.attach}>
            <div slot="header" class="px-4 py-2 text-sm font-medium text-text">FSM config</div>
          </spin-accordion-fsm>
          <p class="mt-2 text-sm text-muted">
            last: <span id="fsm-last">{fsm.last()}</span>
          </p>
        </div>
      </div>
    </section>
  );
}

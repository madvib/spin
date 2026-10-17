import { assertEquals } from "@std/assert";
import { parseHTML } from "@spin/runtime/testing";
import { signal } from "@spin/runtime";
import { floatingPanel } from "./floating-panel.def.ts";
const createFloatingPanelBridge = floatingPanel.createBridge;
import type { FloatingPanelApi } from "./floating-panel.def.ts";
import type { FloatingPanelSize } from "./floating-panel.machine.ts";

const win = parseHTML("<!doctype html><html><body></body></html>") as unknown as Record<string, unknown>;
declare const globalThis: Record<string, unknown>;
globalThis.document = win.document;
globalThis.CustomEvent = win.CustomEvent;
globalThis.HTMLElement = win.HTMLElement;
globalThis.Element = win.Element;

/** A bag read for one handler, checked and typed in one place. */
function handler<H>(bag: Record<string, unknown>, key: string): H {
  const value: unknown = bag[key];
  if (typeof value !== "function") throw new Error(`no handler at ${key}`);
  return value as H;
}

type WriteSignal = { (): unknown; (value: unknown): void };

interface Harness {
  readonly api: FloatingPanelApi;
  readonly opens: boolean[];
  readonly stages: string[];
  readonly props: Record<string, WriteSignal>;
  dispose(): void;
}

function harness(initial: Record<string, unknown> = {}): Harness {
  const root = document.createElement("div");
  document.body.appendChild(root);
  const opens: boolean[] = [];
  const stages: string[] = [];
  const store = new Map<string, WriteSignal>();
  const props = (): Record<string, unknown> => {
    const bag: Record<string, unknown> = {};
    for (const [name, cell] of store) bag[name] = cell();
    bag["@@authored"] = (name: string): boolean => store.has(name);
    bag["onOpenChange"] = (d: { open: boolean }): void => {
      opens.push(d.open);
    };
    bag["onStageChange"] = (d: { stage: string }): void => {
      stages.push(d.stage);
    };
    return bag;
  };
  for (const [name, value] of Object.entries(initial)) {
    store.set(name, signal(value) as unknown as WriteSignal);
  }
  const bridge = createFloatingPanelBridge(props, () => root, "test");
  return {
    api: bridge.api,
    opens,
    stages,
    props: Object.fromEntries(store) as Record<string, WriteSignal>,
    dispose: () => bridge.dispose(),
  };
}

/** The drag param a handle's bag carries, with its three handlers. */
const dragParam = (bag: Record<string, unknown>): Record<string, unknown> => {
  const param: unknown = bag["use:drag"];
  if (typeof param !== "object" || param === null) throw new Error("no drag param");
  return param as Record<string, unknown>;
};

const move = (bag: Record<string, unknown>, dx: number, dy: number): void => {
  handler<(d: { dx: number; dy: number }) => void>(dragParam(bag), "onMove")({ dx, dy });
};

const press = (bag: Record<string, unknown>): void => {
  handler<(p: { altKey: boolean; shiftKey: boolean }) => void>(dragParam(bag), "onStart")({
    altKey: false,
    shiftKey: false,
  });
};

const release = (bag: Record<string, unknown>): void => {
  handler<(end: { cancelled: boolean }) => void>(dragParam(bag), "onEnd")({ cancelled: false });
};

/** A dismissable bag's escape hatch, read the same way. */
const escape = (bag: Record<string, unknown>): void => {
  const param: unknown = bag["use:dismissable"];
  if (typeof param !== "object" || param === null) throw new Error("no dismissable param");
  handler<() => void>(param as Record<string, unknown>, "onEscape")();
};

Deno.test("Given a closed panel / When the trigger clicks / Then it opens and reports", () => {
  const h = harness();
  assertEquals(h.api.isOpen, false);
  handler<() => void>(h.api.getTriggerProps(), "onClick")();
  assertEquals(h.api.isOpen, true, "the trigger opens the panel");
  assertEquals(h.opens, [true], "one open-change for the move");
  h.dispose();
});

Deno.test("Given an open panel / When the header drags / Then position moves and a gesture modes appear", () => {
  const h = harness({ defaultOpen: true });
  assertEquals(h.api.state, "open", "open rests in its own state");
  const drag = h.api.getDragTriggerProps();
  assertEquals(drag["tabIndex"], 0, "the handle is focusable while restored");
  press(drag);
  assertEquals(h.api.state, "dragging", "the press enters the gesture");
  move(drag, 40, 12);
  assertEquals(h.api.position, { x: 40, y: 12 }, "the delta moves the position");
  // Cumulative from the press: a smaller second delta is not an increment.
  move(drag, 10, 4);
  assertEquals(h.api.position, { x: 10, y: 4 }, "the delta is from the press point, not the last move");
  release(drag);
  assertEquals(h.api.state, "open", "the release returns to open");
  h.dispose();
});

Deno.test("Given a drag / When Escape arrives / Then position returns to the press point", () => {
  const h = harness({ defaultOpen: true });
  const drag = h.api.getDragTriggerProps();
  press(drag);
  move(drag, 80, 0);
  assertEquals(h.api.position.x, 80, "the drag moved");
  escape(h.api.getPositionerProps());
  assertEquals(h.api.position, { x: 0, y: 0 }, "escape cancels back to the press point");
  assertEquals(h.api.state, "open", "and the panel stays open");
  h.dispose();
});

Deno.test("Given an east resize / When the pointer moves / Then width grows by the delta", () => {
  const h = harness({ defaultOpen: true });
  const east = h.api.getResizeTriggerProps("e");
  press(east);
  assertEquals(h.api.state, "resizing");
  move(east, 60, 0);
  const size: FloatingPanelSize = h.api.size;
  assertEquals(size.w, 420, "the east edge grows the width by the delta");
  assertEquals(size.h, 240, "the height is untouched");
  h.dispose();
});

Deno.test("Given a west resize / When the pointer moves / Then width shrinks and the left edge follows", () => {
  const h = harness({ defaultOpen: true });
  const west = h.api.getResizeTriggerProps("w");
  press(west);
  move(west, 40, 0);
  assertEquals(h.api.size.w, 320, "the west edge grows the width the other way");
  assertEquals(h.api.position.x, 40, "the left edge moves with the pointer");
  h.dispose();
});

Deno.test("Given a west resize / When the pointer moves twice / Then only the origin delta applies", () => {
  const h = harness({ defaultOpen: true });
  const west = h.api.getResizeTriggerProps("w");
  press(west);
  move(west, 10, 0);
  move(west, 40, 0);
  assertEquals(h.api.size.w, 320, "the width follows the cumulative delta once");
  assertEquals(h.api.position.x, 40, "the left edge moved once");
  h.dispose();
});

Deno.test("Given a maximized panel / When a drag starts / Then the gesture is refused", () => {
  const h = harness({ defaultOpen: true });
  h.api.maximize();
  assertEquals(h.api.stage, "maximized");
  const drag = h.api.getDragTriggerProps();
  assertEquals(drag["tabIndex"], undefined, "the handle drops out of the tab order");
  press(drag);
  assertEquals(h.api.state, "open", "a maximized panel never drags");
  h.api.restore();
  assertEquals(h.api.stage, "restored", "restore returns the stage");
  h.dispose();
});

Deno.test("Given an open panel / When Escape arrives / Then it closes (closeOnEscape)", () => {
  const h = harness({ defaultOpen: true });
  escape(h.api.getPositionerProps());
  assertEquals(h.api.isOpen, false, "escape closes");
  // The seed is a direct service send (like every bridge's): it
  // never reports, so the escape close is the channel's only entry.
  assertEquals(h.opens, [false], "the escape close reports once");
  h.dispose();
});

Deno.test("Given closeOnEscape=false / When Escape arrives / Then the panel stays open", () => {
  const h = harness({ defaultOpen: true, closeOnEscape: false });
  escape(h.api.getPositionerProps());
  assertEquals(h.api.isOpen, true, "the panel does not close");
  h.dispose();
});

Deno.test("Given an authored stage / When it changes / Then the machine alternates", () => {
  const h = harness({ stage: "restored" });
  const cell = h.props["stage"];
  if (cell === undefined) throw new Error("no stage cell");
  cell("maximized");
  assertEquals(h.api.stage, "maximized", "the host's write alternates the stage");
  assertEquals(h.api.size.w, 1024, "a maximized panel fills the boundary width");
  h.dispose();
});

Deno.test("Given an authored size / When it changes / Then the machine alternates", () => {
  const h = harness({ defaultOpen: true, size: "{\"w\":400,\"h\":300}" });
  assertEquals(h.api.size, { w: 400, h: 300 }, "the authored size lands");
  const cell = h.props["size"];
  if (cell === undefined) throw new Error("no size cell");
  cell("{\"w\":500,\"h\":200}");
  assertEquals(h.api.size, { w: 500, h: 200 }, "the host's write alternates the size");
  h.dispose();
});

Deno.test("Given a boundary / When a drag pushes past it / Then the position clamps", () => {
  const h = harness({ defaultOpen: true });
  const drag = h.api.getDragTriggerProps();
  press(drag);
  move(drag, 5000, 5000);
  assertEquals(h.api.position.x < 1024, true, "x clamps inside the boundary");
  assertEquals(h.api.position.y < 768, true, "y clamps inside the boundary");
  h.dispose();
});

Deno.test("Given the stage triggers / When called / Then each sends its own event and hides itself", () => {
  const h = harness({ defaultOpen: true });
  const min = h.api.getStageTriggerProps({ stage: "minimized" });
  const max = h.api.getStageTriggerProps({ stage: "maximized" });
  const res = h.api.getStageTriggerProps({ stage: "default" });
  assertEquals(min["aria-label"], "Minimize", "minimize labels");
  assertEquals(max["aria-label"], "Maximize", "maximize labels");
  assertEquals(res["aria-label"], "Restore", "default labels restore");
  assertEquals(res["hidden"], true, "restore hides while restored");
  assertEquals(min["hidden"], false, "minimize shows while restored");
  (min["onClick"] as () => void)();
  assertEquals(h.api.stage, "minimized", "minimize minimizes");
  const min2 = h.api.getStageTriggerProps({ stage: "minimized" });
  assertEquals(min2["hidden"], true, "minimize hides while staged");
  (max["onClick"] as () => void)();
  assertEquals(h.api.stage, "maximized", "maximize maximizes");
  (res["onClick"] as () => void)();
  assertEquals(h.api.stage, "restored", "default restores");
  h.dispose();
});

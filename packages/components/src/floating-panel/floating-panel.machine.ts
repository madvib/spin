import { createMachine, type Machine } from "@spinjs/components/fsm";
import type {
  FloatingPanelArgs,
  FloatingPanelContext,
  FloatingPanelState,
} from "./floating-panel.state.ts";
import { initial } from "./floating-panel.state.ts";
import type { FloatingPanelEvents } from "./floating-panel.events.ts";
import {
  cancelDragToOpen,
  canDrag,
  canResize,
  clearDragFrom,
  clearResizeFrom,
  closeOnEscape,
  dragMove,
  dragStart,
  escapeCancel,
  maximize,
  minimize,
  resizeMove,
  resizeStart,
  restore,
  restoreResizeGeometry,
  setSize,
} from "./floating-panel.transitions.ts";

export type {
  FloatingPanelSize,
  FloatingPanelStage,
} from "./floating-panel.state.ts";
export type {
  FloatingPanelEvent,
  FloatingPanelEvents,
} from "./floating-panel.events.ts";

export function floatingPanel(
  args: FloatingPanelArgs = {},
  authored: (name: string) => boolean = () => false,
): Machine<FloatingPanelContext, FloatingPanelEvents, FloatingPanelState> {
  return createMachine<
    FloatingPanelContext,
    FloatingPanelEvents,
    FloatingPanelState
  >({
    id: "floating-panel",
    initial: "closed",
    context: initial(args, authored),
    fields: {
      size: { event: "SIZE.SET" },
      draggable: {},
      resizable: {},
      closeOnEscape: {},
      label: {},
      disabled: {},
    },
    on: {
      "SIZE.SET": { assign: setSize },
      "MINIMIZE": [{ assign: minimize }],
      "MAXIMIZE": [{ assign: maximize }],
      "RESTORE": [{ assign: restore }],
    },
    states: {
      closed: {
        on: {
          "OPEN": [{ target: "open" }],
        },
      },
      open: {
        on: {
          "CLOSE": [{ target: "closed" }],
          "ESCAPE": [
            { cond: closeOnEscape, target: "closed" },
            { assign: escapeCancel },
          ],
          "DRAG.START": [
            { cond: canDrag, target: "dragging", assign: dragStart },
          ],
          "RESIZE.START": [
            { cond: canResize, target: "resizing", assign: resizeStart },
          ],
        },
      },
      dragging: {
        on: {
          "DRAG.MOVE": [{ assign: dragMove }],
          "DRAG.END": [{ target: "open", assign: clearDragFrom }],
          "ESCAPE": [
            {
              target: "open",
              assign: [cancelDragToOpen, clearDragFrom],
            },
          ],
        },
      },
      resizing: {
        on: {
          "RESIZE.MOVE": [{ assign: resizeMove }],
          "RESIZE.END": [{ target: "open", assign: clearResizeFrom }],
          "ESCAPE": [
            {
              target: "open",
              assign: [restoreResizeGeometry, clearResizeFrom],
            },
          ],
        },
      },
    },
  });
}

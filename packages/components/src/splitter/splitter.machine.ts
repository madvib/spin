import { createMachine, type Machine } from "@spinjs/components/fsm";
import type {
  SplitterArgs,
  SplitterContext,
  SplitterState,
} from "./splitter.state.ts";
import { initial } from "./splitter.state.ts";
import type { SplitterEvents } from "./splitter.events.ts";
import {
  clearDrag,
  clearFocus,
  collapsePanel,
  expandPanel,
  isHandleFocused,
  keyboardMove,
  pointerMove,
  resetSize,
  resizePanel,
  setFocusedHandle,
  setPanels,
  setSize,
  startDrag,
  toggleCollapseOnEnter,
} from "./splitter.transitions.ts";

export type {
  SplitterArgs,
  SplitterContext,
  SplitterState,
} from "./splitter.state.ts";
export type { SplitterEvent, SplitterEvents } from "./splitter.events.ts";
export type { SplitterResizeDetails } from "./splitter.events.ts";
export type { SplitterDragState, SplitterPanel } from "./splitter.state.ts";

export function splitter(
  args: SplitterArgs = {},
  authored: (name: string) => boolean,
): Machine<SplitterContext, SplitterEvents, SplitterState> {
  return createMachine<SplitterContext, SplitterEvents, SplitterState>({
    id: "splitter",
    initial: "idle",
    context: initial(args, authored),
    fields: {
      panels: { event: "SET_PANELS" },
      size: { event: "SET_SIZE" },
      orientation: {},
      disabled: {},
    },
    on: {
      SET_SIZE: { assign: (ctx, e) => setSize(ctx, e) },
      RESET_SIZE: { assign: resetSize },
      COLLAPSE_PANEL: { assign: (ctx, e) => collapsePanel(ctx, e) },
      EXPAND_PANEL: { assign: (ctx, e) => expandPanel(ctx, e) },
      RESIZE_PANEL: { assign: (ctx, e) => resizePanel(ctx, e) },
      SET_PANELS: { assign: (ctx, e) => setPanels(ctx, e) },
    },
    states: {
      idle: {
        entry: [{ assign: clearDrag }, { assign: clearFocus }],
        on: {
          POINTER_OVER: { target: "hover", assign: setFocusedHandle },
          FOCUS: { target: "focused", assign: setFocusedHandle },
          POINTER_DOWN: { target: "dragging", assign: startDrag },
        },
      },
      hover: {
        on: {
          FOCUS: { target: "focused", assign: setFocusedHandle },
          POINTER_DOWN: { target: "dragging", assign: startDrag },
          POINTER_LEAVE: { target: "idle" },
        },
      },
      focused: {
        on: {
          BLUR: { target: "idle" },
          ENTER: { assign: (ctx, e) => toggleCollapseOnEnter(ctx, e) },
          POINTER_DOWN: { target: "dragging", assign: startDrag },
          KEYBOARD_MOVE: { assign: (ctx, e) => keyboardMove(ctx, e) },
        },
      },
      dragging: {
        on: {
          POINTER_MOVE: { assign: (ctx, e) => pointerMove(ctx, e) },
          POINTER_UP: [
            { cond: isHandleFocused, target: "focused", assign: clearDrag },
            { target: "idle", assign: clearDrag },
          ],
        },
      },
    },
  });
}

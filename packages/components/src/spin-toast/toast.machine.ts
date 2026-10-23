/** Toast machine: the queue, each toast's lifecycle, and the stacking mode. */

import { createMachine, type Machine, type Transitions } from "@spin/runtime/fsm";
import type { ToastArgs, ToastContext, ToastState } from "./toast.state.ts";
import { initial } from "./toast.state.ts";
import type { ToastEvents } from "./toast.events.ts";
import {
  createToast,
  updateToast,
  removeToast,
  dismissToast,
  pauseToasts,
  resumeToasts,
  enterPointer,
  leavePointer,
  enterFocus,
  leaveFocus,
  shouldCollapse,
  toastMounted,
  heightSet,
  dismissAll,
  toastPause,
  toastResume,
} from "./toast.transitions.ts";

export type { ToastStatus, ToastEntry, ToastContext, ToastArgs } from "./toast.state.ts";
export type { ToastEvents, ToastEvent } from "./toast.events.ts";
const QUEUE_EVENTS: Transitions<ToastContext, ToastEvents, ToastState> = {
  "TOAST.CREATE": [
    { target: "overlap", cond: shouldCollapse, assign: createToast },
    { assign: createToast },
  ],
  "TOAST.REMOVE": [
    { target: "overlap", cond: shouldCollapse, assign: removeToast },
    { assign: removeToast },
  ],
  "TIMER.REMOVED": [
    { target: "overlap", cond: shouldCollapse, assign: removeToast },
    { assign: removeToast },
  ],
  "TOAST.UPDATE": { assign: updateToast },
  "TOAST.DISMISS": { assign: dismissToast },
  "DISMISS.ALL": { assign: dismissAll },
  "TIMER.ELAPSED": { assign: dismissToast },
  "TOAST.MOUNTED": { assign: toastMounted },
  "HEIGHT.SET": { assign: heightSet },
} as const;

export function toast(
  args: ToastArgs = {},
  authored: (name: string) => boolean = () => false,
): Machine<ToastContext, ToastEvents, ToastState> {
  return createMachine<ToastContext, ToastEvents, ToastState>({
    id: "toast",
    initial: "stack",
    context: initial(args, authored),
    on: {
      "TOAST.PAUSE": { assign: toastPause },
      "TOAST.RESUME": { assign: toastResume },
      "PAGE.IDLE": { assign: [() => ({ pageIdle: true }), pauseToasts] },
      "PAGE.ACTIVE": { assign: [() => ({ pageIdle: false }), resumeToasts] },
      "REGION.BLUR": [
        { target: "overlap", cond: (ctx) => ctx.overlap && !ctx.pointerWithin, assign: [resumeToasts, leaveFocus] },
        { target: "stack", cond: (ctx) => !ctx.pointerWithin, assign: [resumeToasts, leaveFocus] },
        { assign: leaveFocus },
      ],
    },
    fields: {
      overlap: {},
      max: {},
      removeDelay: {},
      placement: {},
      gap: {},
      offsets: {},
      hotkey: {},
      label: {},
      pauseOnPageIdle: {},
      closable: {},
    },
    states: {
      stack: {
        on: {
          ...QUEUE_EVENTS,
          "REGION.POINTER_LEAVE": [
            { target: "overlap", cond: (ctx) => ctx.overlap, assign: [leavePointer, resumeToasts] },
            { assign: [leavePointer, resumeToasts] },
          ],
          "REGION.OVERLAP": { target: "overlap" },
          "REGION.FOCUS": { assign: [enterFocus, pauseToasts] },
          "REGION.POINTER_ENTER": { assign: [enterPointer, pauseToasts] },
        },
      },
      overlap: {
        on: {
          ...QUEUE_EVENTS,
          "REGION.STACK": { target: "stack", assign: resumeToasts },
          "REGION.POINTER_ENTER": {
            target: "stack",
            assign: [enterPointer, pauseToasts],
          },
          "REGION.FOCUS": {
            target: "stack",
            assign: [enterFocus, pauseToasts],
          },
        },
      },
    },
  });
}
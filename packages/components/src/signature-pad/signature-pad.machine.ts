/** Signature-pad machine: idle/drawing over two states. */

import { createMachine, type Machine } from "@spinjs/components/fsm";
import type {
  SignaturePadArgs,
  SignaturePadContext,
  SignaturePadState,
} from "./signature-pad.state.ts";
import { initial } from "./signature-pad.state.ts";
import type { SignaturePadEvents } from "./signature-pad.events.ts";
import { isInteractive } from "./signature-pad.state.ts";
import {
  clear,
  pointerDown,
  pointerMove,
  pointerUp,
  setPaths,
  setTuning,
} from "./signature-pad.transitions.ts";

export function signaturePad(
  args: SignaturePadArgs = {},
  authored: (name: string) => boolean = () => false,
): Machine<SignaturePadContext, SignaturePadEvents, SignaturePadState> {
  return createMachine<
    SignaturePadContext,
    SignaturePadEvents,
    SignaturePadState
  >({
    id: "signature-pad",
    initial: "idle",
    context: initial(args, authored),
    fields: {
      paths: { event: "SET_PATHS" },
      disabled: {},
      readOnly: {},
      drawing: {},
    },
    on: {
      CLEAR: { target: "idle", assign: clear },
      SET_PATHS: { assign: setPaths },
      SET_TUNING: { assign: setTuning },
    },
    states: {
      idle: {
        on: {
          POINTER_DOWN: [
            {
              cond: (ctx) => isInteractive(ctx),
              target: "drawing",
              assign: pointerDown,
            },
          ],
        },
      },
      drawing: {
        on: {
          POINTER_MOVE: { assign: pointerMove },
          POINTER_UP: { target: "idle", assign: pointerUp },
        },
      },
    },
  });
}

// Re-export helpers for tests/import compatibility
export * from "./signature-pad.state.ts";
export type {
  SignaturePadDrawDetails,
  SignaturePadEvents,
} from "./signature-pad.events.ts";
export { defaultTwin } from "@spinjs/components/runtime";

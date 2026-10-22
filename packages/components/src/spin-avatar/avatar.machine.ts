/**
 * Avatar machine: loading/error/loaded over three states.
 *
 * Load and error signals arrive as events from the image node; the
 * machine owns which face shows.
 *
 * Context stays serializable for the scope channel: the src and nothing
 * else. There is no guard: the last signal wins.
 */

import { createMachine, type Machine, type EventUnion, type MachineSpec } from "@spin/runtime/fsm";
import type { AvatarArgs, AvatarContext } from "./avatar.state.ts";
import { initial } from "./avatar.state.ts";
import type { AvatarEvents } from "./avatar.events.ts";

const setSrc = (ctx: AvatarContext, event: EventUnion<AvatarEvents>) : Partial<AvatarContext> => {
      if (event.type !== "SRC.CHANGE" && event.type !== "SET_SRC") return {};
      void ctx;
      return { src: event.src };
    };

const config: Omit<MachineSpec<AvatarContext, AvatarEvents>, "context"> = {
  id: "avatar",
  initial: "loading",
  on: {
    "SRC.CHANGE": { target: "loading", assign: setSrc },
    "IMG.UNMOUNT": { target: "error" },
    "SET_SRC": { target: "loading", assign: setSrc },
  },
  states: {
    loading: {
      on: {
        "IMG.LOADED": { target: "loaded" },
        "IMG.ERROR": { target: "error" },
      },
    },
    error: {
      on: {
        "IMG.LOADED": { target: "loaded" },
      },
    },
    loaded: {
      on: {
        "IMG.ERROR": { target: "error" },
      },
    },
  },
};

const implementations = {};

export function avatar(
  args: AvatarArgs = {},
  authored: (name: string) => boolean,
): Machine<AvatarContext, AvatarEvents> {
  return createMachine<AvatarContext, AvatarEvents>({
    ...config,
    context: initial(args, authored),
    fields: {
      src: { event: "SRC.CHANGE" },
    },
  });
}

/**
 * Avatar machine: loading/error/loaded over three states.
 *
 * Load and error signals arrive as events from the image node; the
 * machine owns which face shows.
 *
 * Context stays serializable for the scope channel: the src and nothing
 * else. There is no guard: the last signal wins.
 */

import { createMachine, type Machine } from "@spinjs/components/fsm";
import type { AvatarArgs, AvatarContext, AvatarState } from "./avatar.state.ts";
import { initial } from "./avatar.state.ts";
import type { AvatarEvents } from "./avatar.events.ts";
import { setSrc } from "./avatar.transitions.ts";

export function avatar(
  args: AvatarArgs = {},
  authored: (name: string) => boolean = () => false,
): Machine<AvatarContext, AvatarEvents, AvatarState> {
  return createMachine<AvatarContext, AvatarEvents, AvatarState>({
    id: "avatar",
    initial: "loading",
    context: initial(args, authored),
    fields: {
      src: { event: "SRC.CHANGE" },
      label: {},
      fallback: {},
    },
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
  });
}

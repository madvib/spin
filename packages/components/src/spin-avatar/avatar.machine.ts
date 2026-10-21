/**
 * Avatar machine: loading/error/loaded over Zag's three states.
 *
 * Load and error signals arrive as events from the image node; the
 * machine owns which face shows.
 *
 * Context stays serializable for the scope channel: the src and nothing
 * else. There is no guard: the last signal wins.
 */

import { defaultTwin } from "@spin/runtime";
import { createMachine, type Machine, type EventUnion, type MachineSpec } from "@spin/runtime/fsm";
const setSrc = (ctx: AvatarContext, event: EventUnion<AvatarEvents>) : Partial<AvatarContext> => {
      if (event.type !== "SRC.CHANGE" && event.type !== "SET_SRC") return {};
      return { src: typeof event.src === "string" ? event.src : ctx.src };
    };



export interface AvatarContext {
  src: string;
}

/**
 * The avatar's arguments: the values the host may set.
 */
export interface AvatarArgs {
  src?: string;
  defaultSrc?: string;
}

const srcOf = (raw: unknown): string => typeof raw === "string" ? raw : "";

export function initial(args: AvatarArgs, authored: (name: string) => boolean): AvatarContext {
  // A host that wrote `defaultSrc` wrote the src channel too.
  const written = (field: string): boolean =>
    authored(field) ||
    authored(defaultTwin(field)) ||
    (args as Record<string, unknown>)[defaultTwin(field)] !== undefined;
  return {
    src: written("src") ? srcOf(args.src) : "",
  };
}

export interface AvatarEvents {
  "IMG.LOADED": {};
  "IMG.ERROR": {};
  "IMG.UNMOUNT": {};
  "SRC.CHANGE": { src: string };
  "SET_SRC": { src: string };
}

export type AvatarEvent = EventUnion<AvatarEvents>;


export type AvatarStatus = "loading" | "error" | "loaded";

export type AvatarStatusChange = {
  readonly status: AvatarStatus;
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

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
import { createMachine, type Machine } from "@spin/runtime/fsm";

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

export type AvatarEvent =
  | { type: "IMG.LOADED" }
  | { type: "IMG.ERROR" }
  | { type: "IMG.UNMOUNT" }
  | { type: "SRC.CHANGE"; src: string }
  | { type: "SET_SRC"; src: string };

export type AvatarStatus = "loading" | "error" | "loaded";

export type AvatarStatusChange = {
  readonly status: AvatarStatus;
};

const config = {
  id: "avatar",
  initial: "loading",
  on: {
    "SRC.CHANGE": { target: "loading", actions: [{ assign: "setSrc" }] },
    "IMG.UNMOUNT": { target: "error" },
    "SET_SRC": { target: "loading", actions: [{ assign: "setSrc" }] },
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

const implementations = {
  conds: {},
  assigns: {
    setSrc: (ctx: AvatarContext, event: AvatarEvent): Partial<AvatarContext> => {
      if (event.type !== "SRC.CHANGE" && event.type !== "SET_SRC") return {};
      return { src: typeof event.src === "string" ? event.src : ctx.src };
    },
  },
};

export function avatar(
  args: AvatarArgs = {},
  authored: (name: string) => boolean,
): Machine<AvatarContext, AvatarEvent> {
  return createMachine<AvatarContext, AvatarEvent>({
    ...config,
    context: initial(args, authored),
    ...implementations,
    fields: {
      src: { event: "SRC.CHANGE" },
    },
  });
}

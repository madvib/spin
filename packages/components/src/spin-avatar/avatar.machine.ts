/**
 * Avatar machine: loading/error/loaded over Zag's three states.
 *
 * An image with load/error/delay states and a fallback is a machine by
 * the corrected test: no platform machine holds "show the fallback while
 * the image loads, keep it on error", so JS manages those states. The
 * load and error signals arrive as events from the image node (the view
 * owns nodes); the machine owns which face shows.
 *
 * Context stays serializable for the scope channel: the src and nothing
 * else. There is no guard because every transition is unconditional —
 * the last signal wins, exactly as Zag's machine reads.
 */

import { defaultTwin } from "@spin/runtime";
import { createMachine, type Machine } from "@spin/runtime/fsm";

export interface AvatarContext {
  src: string;
}

/**
 * The avatar's arguments: the values the host may set.
 *
 * The names are the element's prop names — the machine is instantiated
 * with the element's prop bag and picks what it wants. The twin
 * (`defaultSrc`) is resolved by the framework before the factory is
 * called, so the machine only ever sees the live value.
 */
export interface AvatarArgs {
  /** The image source, as the host wrote it. */
  src?: string;
  defaultSrc?: string;
}

/** The source the host wrote: a string, or none. */
const srcOf = (raw: unknown): string => typeof raw === "string" ? raw : "";

/**
 * The machine's context: the source it holds, and nothing else.
 */
export function initial(args: AvatarArgs, authored: (name: string) => boolean): AvatarContext {
  // A channel: the host's write, or the machine's own default. The twin
  // is the framework's convention — a host that wrote `defaultSrc`
  // wrote the channel too — and the framework has already resolved it
  // into the argument.
  const written = (field: string): boolean =>
    authored(field) || authored(defaultTwin(field));
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
      // The source arrives the way the host wrote it; the machine shapes
      // it, wherever it came from.
      return { src: typeof event.src === "string" ? event.src : ctx.src };
    },
  },
};

/**
 * The avatar machine: state and nothing else. It is headless — it knows
 * its own arguments, and nothing about props, markup, or the DOM.
 */
export function avatar(
  args: AvatarArgs = {},
  authored: (name: string) => boolean,
): Machine<AvatarContext, AvatarEvent> {
  return createMachine<AvatarContext, AvatarEvent>({
    ...config,
    context: initial(args, authored),
    ...implementations,
    /**
     * The machine's contract with its hosts: the context fields a host
     * may write, and the event each write carries.
     *
     * A field with an event is REPORTED: the host's write is an event,
     * the machine decides, and the change reaches the host. A field
     * without one is SILENT: the host's write lands in the field, and
     * nothing reports.
     */
    fields: {
      src: { event: "SRC.CHANGE" },
    },
  });
}

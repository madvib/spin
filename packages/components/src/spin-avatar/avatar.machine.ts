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

export interface AvatarContext {
  src: string;
}

export interface AvatarInitial {
  readonly src?: unknown;
  readonly defaultSrc?: unknown;
}

/** Seed shaping: the src falls back to its default, then empty. Transport
 * guarantees the bag is object-shaped; the guard asserts that point. */
export function initial(raw: AvatarInitial): AvatarContext {
  const pick = (value: unknown): string | null => typeof value === "string" ? value : null;
  return { src: pick(raw.src) ?? pick(raw.defaultSrc) ?? "" };
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

export const config = {
  id: "avatar",
  initial: "loading",
  context: {
    src: "",
  },
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

export const implementations = {
  conds: {},
  assigns: {
    setSrc: (ctx: AvatarContext, event: AvatarEvent): Partial<AvatarContext> => {
      if (event.type !== "SRC.CHANGE" && event.type !== "SET_SRC") return {};
      void ctx;
      return { src: event.src };
    },
  },
};

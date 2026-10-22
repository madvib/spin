import {
  defineComponent,
  type ComponentDef,
  type PartScope,
} from "@spin/runtime";
import { avatar as avatarMachine } from "./avatar.machine.ts";
import type { AvatarArgs, AvatarContext } from "./avatar.state.ts";
import type {
  AvatarEvents,
  AvatarStatus,
  AvatarStatusChange,
} from "./avatar.events.ts";

export type { AvatarArgs };

/**
 * Avatar definition: the DOM contract as data.
 *
 * No logic over state lives here: every function reads.
 */

export interface AvatarApi {
  setSrc(src: string): void;
  setLoaded(): void;
  setError(): void;
  readonly loaded: boolean;
  readonly status: AvatarStatus;
  getRootProps(): Record<string, unknown>;
  getImageProps(): Record<string, unknown>;
  getFallbackProps(): Record<string, unknown>;
}

const textOf = (props: Record<string, unknown>, name: string): string => {
  const value: unknown = props[name];
  return typeof value === "string" ? value : "";
};

const fallbackOf = (props: Record<string, unknown>): string => {
  const fallback = textOf(props, "fallback");
  if (fallback.length > 0) return fallback;
  return textOf(props, "label");
};

/** A string the host set, or absent when it did not. The boundary between
 * the host's values and the machine's domain: one place, beside the map. */
const asString = (raw: unknown): string | undefined =>
  typeof raw === "string" ? raw : undefined;

interface ScopeLike extends PartScope<unknown, AvatarContext> {}

const def: ComponentDef<AvatarContext, AvatarEvents, Record<string, unknown>, AvatarArgs> = {
  name: "avatar",
  machine: (args: AvatarArgs, authored) => avatarMachine(args, authored),
  args: (props): AvatarArgs => {
    const mapped: AvatarArgs = {};
    const src = asString(props.src);
    if (src !== undefined) mapped.src = src;
    const defaultSrc = asString(props.defaultSrc);
    if (defaultSrc !== undefined) mapped.defaultSrc = defaultSrc;
    return mapped;
  },
  start: "loading",
  parts: {
    root: {
      attrs: (scope) => ({
        id: scope.id(""),
        dir: scope.props["dir"],
        "data-scope": "avatar",
        "data-part": "root",
        "data-state": scope.state,
      }),
    },
    image: {
      attrs: (scope: ScopeLike) => {
        const src = scope.context.src;
        const loaded = scope.state === "loaded";
        const imageId = scope.id("image");
        return {
          id: imageId,
          dir: scope.props["dir"],
          src: src.length > 0 ? src : undefined,
          alt: scope.props["label"],
          "data-scope": "avatar",
          "data-part": "image",
          "data-state": loaded ? "visible" : "hidden",
          "data-hidden": scope.attr(!loaded),
          onLoad: () => {
            scope.send({ type: "IMG.LOADED" });
          },
          onError: () => {
            scope.send({ type: "IMG.ERROR" });
          },
          // A src swap outside the machine still reloads: the observer
          // reports it and the machine returns to loading. The observer
          // lives on the node, so it attaches here.
          "use:observe": {
            attributes: ["src"],
            onAttributes: (): void => {
              scope.send({ type: "SRC.CHANGE", src });
            },
          },
        };
      },
    },
    fallback: {
      attrs: (scope: ScopeLike) => {
        const loaded = scope.state === "loaded";
        return {
          id: scope.id("fallback"),
          dir: scope.props["dir"],
          role: "img",
          "aria-label": fallbackOf(scope.props),
          "data-scope": "avatar",
          "data-part": "fallback",
          "data-state": loaded ? "hidden" : "visible",
          "data-hidden": scope.attr(loaded),
        };
      },
    },
  },
  commands: {
    setSrc: { event: (args) => ({ type: "SET_SRC", src: typeof args[0] === "string" ? args[0] : "" }) },
    setLoaded: { event: () => ({ type: "IMG.LOADED" }) },
    setError: { event: () => ({ type: "IMG.ERROR" }) },
  },
  readers: {
    loaded: { read: (_context, state) => state === "loaded" },
    status: { read: (_context, state): AvatarStatus => state === "loaded" || state === "error" ? state : "loading" },
  },
  events: {
    "status-change": {
      prop: "onStatusChange",
      watch: (_context, state) => [state],
      detail: (watched: readonly unknown[]) => {
        const status = watched[0];
        const known: AvatarStatus = status === "loading" || status === "error" || status === "loaded" ? status : "loading";
        return { status: known };
      },
    },
  },
};

export const avatar = defineComponent<AvatarContext, AvatarEvents, AvatarApi, AvatarArgs>(def);

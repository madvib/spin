import {
  defineComponent,
  type ApiOf,
  type ComponentDef,
  type ScopeFor,
} from "@spin/runtime";
import { avatar as avatarMachine } from "./avatar.machine.ts";
import type { AvatarArgs, AvatarContext, AvatarState } from "./avatar.state.ts";
import type {
  AvatarEvents,
  AvatarStatus,
} from "./avatar.events.ts";

export type { AvatarArgs, AvatarState };

/** Avatar definition: the DOM contract as data. */

type ScopeLike = ScopeFor<AvatarContext, AvatarEvents, AvatarState>;

export const def = {
  name: "avatar",
  machine: (args: AvatarArgs, authored) => avatarMachine(args, authored),
  start: "loading",
  parts: {
    root: {},
    image: {
      attrs: (scope: ScopeLike) => {
        const src = scope.context.src;
        const loaded = scope.state === "loaded";
        return {
          src: src.length > 0 ? src : undefined,
          alt: scope.context.label,
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
          role: "img",
          "aria-label": scope.context.fallback,
          "data-state": loaded ? "hidden" : "visible",
          "data-hidden": scope.attr(loaded),
        };
      },
    },
  },
  commands: {
    setSrc: { event: ([src]: [src: string]) => ({ type: "SET_SRC", src }) },
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
} satisfies ComponentDef<AvatarContext, AvatarEvents, Record<string, unknown>, AvatarArgs, AvatarState>;

export type AvatarApi = ApiOf<typeof def>;
export const avatar = defineComponent<AvatarContext, AvatarEvents, AvatarApi, AvatarArgs, AvatarState>(def);

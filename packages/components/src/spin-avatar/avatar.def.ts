import { defineComponent, textProp, type ComponentDef } from "@spin/runtime";
import {
  config,
  implementations,
  type AvatarContext,
  type AvatarEvent,
  type AvatarStatus,
  type AvatarStatusChange,
} from "./avatar.machine.ts";

/**
 * Avatar definition: the DOM contract as data. The machine owns the three
 * load states and the src; this file maps props to channels, parts to
 * attribute bags, commands to sends, and the status transition to its
 * event. No logic over state lives here — every function reads.
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

const def: ComponentDef<AvatarContext, AvatarEvent> = {
  name: "avatar",
  config,
  implementations,
  start: "loading",
  seed: (props) => ({
    src: textProp(typeof props["src"] === "string" ? props["src"] : props["defaultSrc"]),
  }),
  channels: {
    src: {
      controlled: true,
      parse: textProp,
      event: (value: string) => ({ type: "SRC.CHANGE", src: value }),
    },
    defaultSrc: { parse: textProp },
    dir: { parse: (raw) => (raw === "rtl" ? "rtl" : "ltr") },
    label: { parse: textProp },
    fallback: { parse: textProp },
  },
  parts: {
    root: {
      sig: (scope) => [scope.props["dir"], scope.state].join("|"),
      attrs: (scope) => ({
        id: scope.id("root"),
        dir: scope.props["dir"],
        "data-scope": "avatar",
        "data-part": "root",
        "data-state": scope.state,
      }),
    },
    image: {
      sig: (scope) => [scope.context["src"], scope.state].join("|"),
      attrs: (scope) => {
        const src = scope.context["src"] as string;
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
          // A src swap outside the machine (host sets the attribute) still
          // reloads: the stdlib observer reports it and the machine returns
          // to loading. The observer lives on the node, so it attaches here.
          "use:observe": {
            attributes: ["src"],
            onAttributes: (): void => {
              if (typeof document === "undefined") return;
              const current = document.getElementById(imageId)?.getAttribute("src") ?? "";
              scope.send({ type: "SRC.CHANGE", src: current });
            },
          },
        };
      },
    },
    fallback: {
      sig: (scope) => [scope.props["fallback"], scope.state].join("|"),
      attrs: (scope) => {
        const loaded = scope.state === "loaded";
        const label = scope.props["fallback"] as string;
        return {
          id: scope.id("fallback"),
          dir: scope.props["dir"],
          role: "img",
          "aria-label": label.length > 0 ? label : (scope.props["label"] as string),
          "data-scope": "avatar",
          "data-part": "fallback",
          "data-state": loaded ? "hidden" : "visible",
          "data-hidden": scope.attr(loaded),
        };
      },
    },
  },
  commands: {
    setSrc: { event: (args) => ({ type: "SET_SRC", src: args[0] as string }) },
    setLoaded: { event: () => ({ type: "IMG.LOADED" }) },
    setError: { event: () => ({ type: "IMG.ERROR" }) },
  },
  readers: {
    loaded: { read: (_context, state) => state === "loaded" },
    status: { read: (_context, state) => state },
  },
  events: {
    "status-change": {
      prop: "onStatusChange",
      watch: (_context, state) => [state],
      detail: (watched) => ({ status: watched[0] as AvatarStatusChange["status"] }),
    },
  },
};

export const avatar = defineComponent<AvatarContext, AvatarEvent, AvatarApi>(def);

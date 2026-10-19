import {
  defineComponent,
  type ComponentDef,
  type PartScope,
} from "@spin/runtime";
import {
  config,
  implementations,
  initial,
  type AvatarContext,
  type AvatarEvent,
  type AvatarInitial,
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

/** A text prop off the bag: parsed text arrives as a string, anything
 * else is absent. The two labels read through here. */
const textOf = (props: Record<string, unknown>, name: string): string => {
  const value: unknown = props[name];
  return typeof value === "string" ? value : "";
};

const fallbackOf = (props: Record<string, unknown>): string => {
  const fallback = textOf(props, "fallback");
  if (fallback.length > 0) return fallback;
  return textOf(props, "label");
};

interface ScopeLike extends PartScope<unknown, AvatarContext> {}

/** Transport guarantees the raw prop bag is an AvatarInitial-shaped object. */
const isAvatarInitial = (raw: unknown): raw is AvatarInitial =>
  raw !== null && typeof raw === "object";

const def: ComponentDef<AvatarContext, AvatarEvent> = {
  name: "avatar",
  config,
  implementations,
  start: "loading",
  seed: (raw, authored) => {
    const props: AvatarInitial = isAvatarInitial(raw) ? raw : {};
    const shaped = initial(props);
    // An authored channel starts at its value, not its default.
    const src = authored("src")
      ? (typeof props.src === "string" ? props.src : shaped.src)
      : shaped.src;
    return { src };
  },
  reconcile: ({ context, parsed, authored, send }) => {
    if (!authored("src")) return false;
    const src = typeof parsed["src"] === "string" ? parsed["src"] : null;
    if (src === null || context.src === src) return false;
    send({ type: "SRC.CHANGE", src });
    return true;
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
      sig: (scope: ScopeLike) => [scope.context.src, scope.state].join("|"),
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
          // A src swap outside the machine (host sets the attribute) still
          // reloads: the stdlib observer reports it and the machine returns
          // to loading. The observer lives on the node, so it attaches here.
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
      sig: (scope: ScopeLike) => [textOf(scope.props, "fallback"), scope.state].join("|"),
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

export const avatar = defineComponent<AvatarContext, AvatarEvent, AvatarApi>(def);

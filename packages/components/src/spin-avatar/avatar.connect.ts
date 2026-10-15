import { dataAttr } from "../spin-select/select.shared.ts";
import type { AvatarContext, AvatarStatus } from "./avatar.machine.ts";

/**
 * Avatar connect: the DOM contract and the reflexes the parts carry.
 *
 * What the machine owns stays there: the three load states and the src.
 * Everything that needs a node lives here — the image load/error signals
 * (reported in as events), the src-change observation (a MutationObserver
 * is a view reflex that sends SRC.CHANGE), and the unmount signal.
 */

export interface AvatarConnectProps {
  readonly dir: "ltr" | "rtl";
  readonly label: string;
  readonly fallbackLabel: string;
}

export interface AvatarCommands {
  setSrc(src: string): void;
  setLoaded(): void;
  setError(): void;
}

export interface AvatarApi extends AvatarCommands {
  readonly loaded: boolean;
  readonly status: AvatarStatus;
  getRootProps(): Record<string, unknown>;
  getImageProps(): Record<string, unknown>;
  getFallbackProps(): Record<string, unknown>;
}

/** The service the connect reads: the fork's, narrowed to what it needs. */
export interface AvatarService {
  readonly context: AvatarContext;
  /** The machine's state: loading, error, or loaded. */
  readonly state: string;
  send(event: { type: string } & Record<string, unknown>): void;
}

export interface BagMemo {
  sig: string;
  bag: Record<string, unknown>;
}

/** A bag cached until the signature of the fields it reads moves. One memo
 * holds the single bag of one part (there is one root, one image, one
 * fallback per element), so a single slot is the whole cache. */
function memo(): (
  sig: string,
  build: () => Record<string, unknown>,
) => Record<string, unknown> {
  let sig = "";
  let bag: Record<string, unknown> | undefined;
  return (next, build) => {
    if (bag !== undefined && sig === next) return bag;
    sig = next;
    bag = build();
    return bag;
  };
}

export function connectAvatar(
  service: AvatarService,
  readProps: () => AvatarConnectProps,
  id: string,
): AvatarApi {
  // Live accessor, never a snapshot: the fork replaces the context object
  // on every assign, so a destructured copy would freeze the first read.
  const ctx = (): AvatarContext => service.context;
  const send = service.send;
  const rootId = `avatar:${id}`;
  const imageId = `avatar:${id}:image`;
  const fallbackId = `avatar:${id}:fallback`;

  const rootBag = memo();
  const imageBag = memo();
  const fallbackBag = memo();

  return {
    get loaded() {
      return service.state === "loaded";
    },
    get status() {
      return service.state as AvatarStatus;
    },
    setSrc: (src: string) => {
      send({ type: "SET_SRC", src });
    },
    setLoaded: () => {
      send({ type: "IMG.LOADED" });
    },
    setError: () => {
      send({ type: "IMG.ERROR" });
    },
    getRootProps: () => {
      const props = readProps();
      return rootBag([props.dir, service.state].join("|"), () => ({
        id: rootId,
        dir: props.dir,
        "data-scope": "avatar",
        "data-part": "root",
        "data-state": service.state,
      }));
    },
    getImageProps: () => {
      const props = readProps();
      const loaded = service.state === "loaded";
      return imageBag([ctx().src, loaded].join("|"), () => ({
        id: imageId,
        dir: props.dir,
        src: ctx().src.length > 0 ? ctx().src : undefined,
        alt: props.label,
        "data-scope": "avatar",
        "data-part": "image",
        "data-state": loaded ? "visible" : "hidden",
        "data-hidden": dataAttr(!loaded),
        onLoad: () => {
          send({ type: "IMG.LOADED" });
        },
        onError: () => {
          send({ type: "IMG.ERROR" });
        },
        // A src swap outside the machine (host sets the attribute) still
        // reloads: the stdlib observer reports it and the machine returns
        // to loading. The observer lives on the node, so it attaches here.
        "use:observe": {
          attributes: ["src"],
          onAttributes: (): void => {
            if (typeof document === "undefined") return;
            const current = document.getElementById(imageId)?.getAttribute("src") ?? "";
            send({ type: "SRC.CHANGE", src: current });
          },
        },
      }));
    },
    getFallbackProps: () => {
      const props = readProps();
      const loaded = service.state === "loaded";
      return fallbackBag([props.fallbackLabel, loaded].join("|"), () => ({
        id: fallbackId,
        dir: props.dir,
        role: "img",
        "aria-label": props.fallbackLabel,
        "data-scope": "avatar",
        "data-part": "fallback",
        "data-state": loaded ? "hidden" : "visible",
        "data-hidden": dataAttr(loaded),
      }));
    },
  };
}

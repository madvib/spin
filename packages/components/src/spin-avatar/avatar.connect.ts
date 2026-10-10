/**
 * Avatar connect: the DOM contract for the image and its fallback.
 *
 * What the machine owns is left in the machine: loading, loaded, error.
 * Everything the page can see lives here — the part ids, the source
 * passthrough (src/srcset/sizes/crossOrigin/referrerPolicy/alt), the
 * name-initials the fallback shows, and the two reflexes that stand in for
 * Zag's effects:
 *
 * - An image whose source was already settled when the element mounted
 *   (SSR, or a warm cache) never fires load/error again. The connect reads
 *   `complete` when observation starts and after every source change, and
 *   reports the settled status — Zag's `checkImageStatus`.
 * - A source change and a removed image node are reported by the stdlib's
 *   `observe` action, attached through the root and image bags, so the
 *   machine hears about them as events (Zag's `trackSrcChange` and
 *  trackImageRemoval).
 *
 * Both parts carry `data-state="visible"|"hidden"` and a paired
 * `aria-hidden` instead of Zag's `hidden` attribute: the reveal is the
 * one state change this component has, and a `hidden` element cannot
 * transition. `aria-hidden` keeps the not-yet-visible part out of the
 * accessibility tree exactly as `hidden` did, and the markup's opacity
 * utilities do the animating: the arriving part fades in, the departing
 * one steps out in the same frame (`transition-none` on `hidden`). A
 * crossfade would leave both parts mid-transition together, so neither
 * is ever settled while the other still is.
 *
 * The api is read on every machine move, so the bags it hands out are
 * cached against the signature of the fields they read: a fresh bag per
 * read would detach and re-attach the load/error listeners on every move.
 */

import type { AvatarContext, AvatarEvent } from "./avatar.machine.ts";

/** The three part ids. Zag resolves them from an `ids` prop; the bridge
 * parses that prop and hands the resolved ids in. */
export interface AvatarIds {
  readonly root: string;
  readonly image: string;
  readonly fallback: string;
}

export interface AvatarConnectProps {
  readonly dir: "ltr" | "rtl";
  /** The name the fallback's initials come from. */
  readonly name: string;
  readonly src: string;
  readonly srcset: string;
  readonly sizes: string;
  readonly crossOrigin: string;
  readonly referrerPolicy: string;
  readonly alt: string;
}

export interface AvatarService {
  readonly state: { readonly value: string };
  readonly context: AvatarContext;
  send(event: AvatarEvent): void;
}

export interface AvatarFsmApi {
  readonly loaded: boolean;
  getRootProps(): Record<string, unknown>;
  getImageProps(): Record<string, unknown>;
  getFallbackProps(): Record<string, unknown>;
  /** The fallback's initials, from the `name` prop. */
  getFallbackText(): string;
  /** Zag's `setSrc`: write a new source and let the observer report it. */
  setSrc(src: string): void;
}

/** A bag cached until the signature of the fields it reads moves. */
interface BagMemo {
  sig: string;
  bag: Record<string, unknown>;
}

function cached(): (sig: string, build: () => Record<string, unknown>) => Record<string, unknown> {
  let sig = "";
  let bag: Record<string, unknown> | undefined;
  return (next: string, build: () => Record<string, unknown>): Record<string, unknown> => {
    if (bag !== undefined && sig === next) return bag;
    sig = next;
    bag = build();
    return bag;
  };
}

/** Up to two words, their first letters, uppercased — "Ada Lovelace" is
 * "AL", "Cher" is "C". */
function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter((word) => word.length > 0);
  if (words.length === 0) return "";
  return words
    .slice(0, 2)
    .map((word) => word.slice(0, 1))
    .join("")
    .toUpperCase();
}

export function connectRobotAvatar(
  service: AvatarService,
  readProps: () => AvatarConnectProps,
  ids: AvatarIds,
): AvatarFsmApi {
  const send = (event: AvatarEvent): void => service.send(event);

  const stateAttrs = (visible: boolean): Record<string, unknown> => ({
    "data-state": visible ? "visible" : "hidden",
    "aria-hidden": visible ? undefined : true,
  });

  /**
   * The settled-status read, for a source that finished loading before the
   * observer existed. Duck-typed rather than `instanceof HTMLImageElement`:
   * whatever sits at the image id is the image, and a node without the
   * image's state simply has not settled.
   */
  const checkStatus = (): void => {
    const image: unknown = document.getElementById(ids.image);
    if (typeof image !== "object" || image === null) return;
    const settled = Reflect.get(image, "complete");
    if (settled !== true) return;
    const width = Reflect.get(image, "naturalWidth");
    const height = Reflect.get(image, "naturalHeight");
    const readable = typeof width === "number" && typeof height === "number" && width > 0 && height > 0;
    send({ type: readable ? "IMG_LOADED" : "IMG_ERROR" });
  };

  /** A source change restarts the wait, and the new source may already be
   * settled — the same two events Zag's entry action sends, in its order. */
  const onAttributes = (): void => {
    send({ type: "SRC_CHANGE" });
    checkStatus();
  };

  const onImageRemoved = (removed: Element): void => {
    if (removed.id !== ids.image) return;
    send({ type: "IMG_UNMOUNT" });
  };

  const rootBag = cached();
  const imageBag = cached();
  const fallbackBag = cached();

  return {
    get loaded(): boolean {
      return service.state.value === "loaded";
    },
    getRootProps: () =>
      rootBag(`${service.state.value}\u0000${readProps().dir}`, () => ({
        id: ids.root,
        dir: readProps().dir,
        "data-state": service.state.value,
        // The child-list watch: the image leaving the root is the one thing
        // no attribute or event on the image itself can report.
        "use:observe": { onRemove: onImageRemoved },
      })),
    getImageProps: () => {
      const props = readProps();
      return imageBag(
        [
          service.state.value,
          props.src,
          props.srcset,
          props.sizes,
          props.crossOrigin,
          props.referrerPolicy,
          props.alt,
        ].join("\u0000"),
        () => ({
          id: ids.image,
          dir: props.dir,
          // Only an authored value: an empty string is a request for the
          // page itself, which would fail the image on purpose.
          ...(props.src.length > 0 ? { src: props.src } : {}),
          ...(props.srcset.length > 0 ? { srcset: props.srcset } : {}),
          ...(props.sizes.length > 0 ? { sizes: props.sizes } : {}),
          ...(props.crossOrigin.length > 0 ? { crossorigin: props.crossOrigin } : {}),
          ...(props.referrerPolicy.length > 0 ? { referrerpolicy: props.referrerPolicy } : {}),
          ...(props.alt.length > 0 ? { alt: props.alt } : {}),
          ...stateAttrs(service.state.value === "loaded"),
          onLoad: (): void => send({ type: "IMG_LOADED" }),
          onError: (): void => send({ type: "IMG_ERROR" }),
          "use:observe": {
            onAttach: checkStatus,
            attributes: ["src", "srcset"],
            onAttributes,
          },
        }),
      );
    },
    getFallbackProps: () =>
      fallbackBag(`${service.state.value}\u0000${readProps().dir}`, () => ({
        id: ids.fallback,
        dir: readProps().dir,
        ...stateAttrs(service.state.value !== "loaded"),
      })),
    getFallbackText: (): string => initialsOf(readProps().name),
    setSrc: (src: string): void => {
      const image = document.getElementById(ids.image);
      if (image !== null) image.setAttribute("src", src);
    },
  };
}

import type { FsmService } from "@spin/runtime/fsm";

/**
 * Avatar machine: the image's load status, and nothing else.
 *
 * Zag's chart is three flat states — `loading`, `loaded`, `error` — with a
 * root tier (`src.change` back to loading, `img.unmount` to error) that
 * holds in all of them. That is the whole port: there is no context, no
 * assign, and no cond, because the state value *is* the status the host
 * reads (`loaded`) and the status it is told about (`loaded`/`error`).
 *
 * The two effects Zag attaches to this machine are not state:
 * `trackImageRemoval` and `trackSrcChange` are a MutationObserver on the
 * root and on the image, and `checkImageStatus` reads the image element.
 * Observers and DOM reads are reflexes, so they live on the view (the root
 * and image bags carry the observer action; the connect owns the reads)
 * and this chart stays pure.
 *
 * Context is therefore empty on purpose. A field here would be state the
 * state value already encodes.
 */

export type LoadStatus = "loaded" | "error";

/** No context: see the file header. The fork's service still types one. */
export type AvatarContext = object;

export type AvatarEvent =
  /** The image settled successfully: the element's load event, the
   * already-settled read, or the host's `setLoaded()` command. */
  | { type: "IMG_LOADED" }
  /** The image failed: the element's error event, or `setError()`. */
  | { type: "IMG_ERROR" }
  /** The image node left the root — the fallback has to come back. */
  | { type: "IMG_UNMOUNT" }
  /** The source changed, so whatever settled before no longer counts. */
  | { type: "SRC_CHANGE" };

export const config = {
  id: "avatar",
  initial: "loading",
  // Root tier, exactly Zag's root `on`: a new source or a removed image is
  // meaningful from every state.
  on: {
    SRC_CHANGE: "loading",
    IMG_UNMOUNT: "error",
  },
  states: {
    loading: {
      on: {
        IMG_LOADED: "loaded",
        IMG_ERROR: "error",
      },
    },
    // A loaded image can still fail (a decode error after a partial paint),
    // and an error clears as soon as a source settles.
    loaded: {
      on: {
        IMG_ERROR: "error",
      },
    },
    error: {
      on: {
        IMG_LOADED: "loaded",
      },
    },
  },
};

export type AvatarService = FsmService<AvatarContext, AvatarEvent>;

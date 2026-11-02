/**
 * The overlay's procedures: writing the theme document the studio is
 * editing, and reading back what the app is currently showing.
 *
 * These exist so the studio and the built app agree on one source. The
 * procedure writes the same process-global cell `spinPreset` reads, so an
 * edit over HTTP re-themes the running app in the same process. Nothing
 * here touches disk — saving is a separate, explicit act.
 */

import { oc } from "@orpc/contract";
import * as v from "valibot";
import { implement } from "@orpc/server";
import {
  clearOverlay,
  hasOverlay,
  overlayDirty,
  overlayThemes,
  setOverlay,
} from "../plugin/session.ts";
import type { ThemeDocument } from "../theme/index.ts";

const ThemeDocuments = v.record(v.string(), v.unknown());

const OpenState = v.object({
  open: v.boolean(),
});

export const overlayContract = oc.tag("overlay").router({
  /**
   * Open or replace the live overlay. Returns the names it now holds, so
   * the caller can tell which theme it just made current.
   */
  overlay: {
    set: oc
      .input(v.object({ themes: ThemeDocuments }))
      .output(
        v.object({ names: v.array(v.string()), open: v.boolean() }),
      ),
    /** Close the overlay, putting disk back in charge. */
    clear: oc.output(OpenState),
    /**
     * What the overlay holds now, whether it is the live source, and which
     * of its themes differ from disk. The app badge and the studio's save
     * state both read this — one source, so they cannot disagree.
     */
    get: oc.output(
      v.object({
        open: v.boolean(),
        themes: ThemeDocuments,
        dirty: v.array(v.string()),
      }),
    ),
  },
});

const os = implement(overlayContract);

export const overlayRouter = os.router({
  overlay: {
    set: os.overlay.set.handler(({ input }) => {
      setOverlay(input.themes as Record<string, ThemeDocument>);
      return { names: Object.keys(overlayThemes()), open: true };
    }),
    clear: os.overlay.clear.handler(() => {
      clearOverlay();
      return { open: hasOverlay() };
    }),
    get: os.overlay.get.handler(() => ({
      open: hasOverlay(),
      themes: overlayThemes(),
      dirty: overlayDirty(),
    })),
  },
});

/**
 * The Solid side of the L4 controller loop for `<spin-dialog>`.
 *
 * The dialog has no owned data — the element owns open/closed state via the
 * Zag machine. The controller observes state changes by watching for clicks
 * on dialog parts and reading the resulting `data-state` attribute.
 */
import { createEffect } from "solid-js";
import type { DialogElement } from "../elements.ts";

export interface DialogOpenChange {
  readonly open: boolean;
}

export interface SpinDialogProps {
  readonly onOpenChange?: (change: DialogOpenChange) => void;
}

export function SpinDialog(props: SpinDialogProps) {
  let el: DialogElement | undefined;

  createEffect(() => {
    const handler = (event: MouseEvent) => {
      const target = event.target as Element;
      // Only handle clicks on dialog parts
      if (!target.closest("[data-part]")) return;

      // Wait for the machine to update the DOM
      requestAnimationFrame(() => {
        const content = document.querySelector("[data-part='content']");
        const isOpen = content?.getAttribute("data-state") === "open";
        props.onOpenChange?.({ open: isOpen });
      });
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  });

  return (
    <spin-dialog
      ref={(node) => {
        el = node as DialogElement;
      }}
    />
  );
}

import type { RefObject } from "react";
import { spinComponentCtl, type SpinComponentCtl } from "./controller.ts";

/**
 * React adapter: `useSpinComponent(el)` is the app controller's instrument.
 *
 * The element is a locator — a ref, or a RefObject whose `.current` the hook
 * reads. What this adds is the component's controller surface
 * (`{ commands, state, bind }`), reached through the same context markup
 * consumes. A machine-owned and a platform-owned component present the same
 * surface; the host cannot tell which it holds.
 *
 * The ctl is synchronous: React has no tracking scope, so `state` is read at
 * render time — the reads are live, and the host re-renders on the
 * component's events, which `bind` subscribes. No synthetic event system, no
 * portal, no wrapper. `bind` works from the first render, so a React host
 * that wants to seed a component writes the prop before it connects.
 *
 * ```tsx
 * const el = useRef<HTMLDialogElement>(null);
 * const dialog = useSpinComponent<DialogCommands>(el);
 * useEffect(() => dialog?.bind({ open }, { "open-change": (e) => setOpen(e.detail.open) }), [open]);
 * return <spin-dialog ref={el} />;
 * dialog?.commands.show();
 * ```
 */

export function useSpinComponent<TCommands extends object = object>(
  el: Element | RefObject<Element | null> | null | undefined,
): SpinComponentCtl<TCommands> | undefined {
  const node = (): Element | null | undefined => {
    if (el === null || el === undefined) return undefined;
    if (el instanceof Element) return el;
    return el.current;
  };
  const current = node();
  return current === null || current === undefined
    ? undefined
    : spinComponentCtl<TCommands>(current);
}

import type { RefObject } from "react";
import { type SpinComponentCtl, spinComponentCtl } from "../controller.ts";

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
 * const el = useRef<HTMLElement>(null);
 * const popover = useSpinComponent<PopoverCommands>(el);
 * useEffect(() => popover?.bind({ label: "Open" }, { "open-change": (e) => setOpen(e.detail.open) }), [open]);
 * return <spin-popover ref={el} />;
 * popover?.commands.show();
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

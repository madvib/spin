import type { RefObject } from "react";
import type { DefinedComponent } from "@spinjs/components/runtime";
import {
  type CtlFor,
  type ElementTarget,
  spinComponentCtl,
} from "../controller.ts";

/**
 * React adapter: `useSpinComponent(el)` is the app controller's instrument.
 *
 * The element is a locator — a ref, or a RefObject whose `.current` the hook
 * reads. What this adds is the component's controller surface
 * (`{ commands, state, bind }`), reached through the same context markup
 * consumes. A machine-owned and a platform-owned component present the same
 * surface; the host cannot tell which it holds.
 *
 * The ctl is never nullish and synchronous: React has no tracking scope, so
 * `state` is read at render time — the reads are live, and the host
 * re-renders on the component's events, which `bind` subscribes. `bind`
 * works from the first render, so a React host that wants to seed a
 * component writes the prop before it connects.
 *
 * ```tsx
 * const el = useRef<HTMLElement>(null);
 * const popover = useSpinComponent<PopoverCommands>(el);
 * useEffect(() => popover.bind({ label: "Open" }, { "open-change": (e) => setOpen(e.detail.open) }), [open]);
 * return <spin-popover ref={el} />;
 * popover.commands.show();
 * ```
 */

export function useSpinComponent<D extends DefinedComponent<any, any>>(
  def: D,
): CtlFor<D>;
export function useSpinComponent<D extends DefinedComponent<any, any>>(
  target: ElementTarget,
  def: D,
): CtlFor<D>;
export function useSpinComponent<
  TCommands extends object = object,
  TState extends object = Record<string, () => unknown>,
  TProps extends object = Record<string, unknown>,
>(
  el: ElementTarget,
  handle?: object,
): ReturnType<typeof spinComponentCtl<TCommands, TState, TProps>>;
export function useSpinComponent(
  target: ElementTarget | DefinedComponent<any, any>,
  handleOrDef?: object,
): unknown {
  return spinComponentCtl(
    target as unknown as RefObject<Element | null>,
    handleOrDef as object,
  );
}

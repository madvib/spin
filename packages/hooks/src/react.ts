import { useCallback, useEffect, useRef, type ElementType, type Ref } from "react";
import { bindSpinElement, type SpinHookOptions } from "./index.ts";

/**
 * React adapter: `useSpin(tag, { props, on })` returns a ref to spread.
 *
 * ```tsx
 * const dialog = useSpin("spin-dialog-fsm", {
 *   props: { role: "dialog" },
 *   on: { "open-change": (e) => setOpen(e.detail.open) },
 * })
 * return <spin-dialog-fsm ref={dialog.ref} />
 * // later: dialog.commands.show()
 * ```
 *
 * Props are re-written when the object's entries change (the hook depends
 * on a serialized form of them), events are bound for the element's
 * lifetime, and cleanup is automatic. No portal, no wrapper component, no
 * synthetic event system — the element is the component.
 */

export interface UseSpinResult<TCommands extends object = object> {
  readonly ref: Ref<ElementType>;
  /** The imperative commands the element declares, once attached. */
  readonly commands: TCommands;
}

export function useSpin<TProps extends object, TCommands extends object = object>(
  _tag: string,
  options: SpinHookOptions<TProps>,
): UseSpinResult<TCommands> {
  const elementRef = useRef<Element | null>(null);
  const commandsRef = useRef<TCommands | null>(null);
  // Serialized dependency so callers can pass fresh object literals.
  const propKey = JSON.stringify(options.props ?? {});
  const eventsKey = JSON.stringify(Object.keys(options.on ?? {}));

  const ref = useCallback((node: Element | null) => {
    elementRef.current = node;
    commandsRef.current = node as TCommands | null;
    if (node) {
      // bindSpinElement returns the unbind; storing it for the effect below.
      (node as { __unbind?: () => void }).__unbind = bindSpinElement(node, options);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-write props when they change; events are keyed by name set.
  useEffect(() => {
    const node = elementRef.current;
    if (!node) return;
    bindSpinElement(node, options);
    void propKey;
    void eventsKey;
  }, [propKey, eventsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => {
      const unbind = (elementRef.current as { __unbind?: () => void } | null)?.__unbind;
      unbind?.();
    };
  }, []);

  return {
    ref,
    commands: commandsRef.current as TCommands,
  };
}

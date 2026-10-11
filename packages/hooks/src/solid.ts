import { createEffect, createSignal, onCleanup, type Accessor } from "solid-js";
import { bindSpinElement } from "./index.ts";

/**
 * Solid adapter. Solid needs the least help — custom elements work natively
 * with `ref=` and `on:`-style listeners — so this is the thin typed version:
 * props written reactively, one listener binding per event, commands as a
 * stable accessor.
 *
 * ```tsx
 * const dialog = createSpin("spin-dialog", () => ({ role: "dialog" }), {
 *   "open-change": (e) => setOpen((e as CustomEvent).detail.open),
 * })
 * <spin-dialog ref={dialog.ref} />
 * dialog.commands().show()
 * ```
 */

export interface CreateSpinResult<TCommands extends object = object> {
  /** Spread onto the element's ref. */
  readonly ref: (node: Element) => void;
  readonly commands: Accessor<TCommands>;
}

export function createSpin<TProps extends object, TCommands extends object = object>(
  _tag: string,
  props: Accessor<TProps>,
  on?: Readonly<Record<string, (event: CustomEvent) => void>>,
): CreateSpinResult<TCommands> {
  const [commands, setCommands] = createSignal<TCommands>({} as TCommands);
  let unbind: (() => void) | undefined;

  const ref = (node: Element): void => {
    setCommands(() => node as TCommands);
    unbind = bindSpinElement(node, { props: props(), on });
  };

  createEffect(() => {
    // Re-write on every change of any prop read (the accessor's deps).
    const element = commands() as unknown;
    if (element instanceof Element) bindSpinElement(element, { props: props() });
  });

  onCleanup(() => unbind?.());

  return { ref, commands };
}

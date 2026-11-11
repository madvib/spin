import type { DefinedComponent } from "@spinjs/components/runtime";
import {
  type CtlFor,
  type ElementTarget,
  type SpinComponentCtl,
  spinComponentCtl,
} from "../controller.ts";

export { spinComponentCtl };

/**
 * Solid adapter: `createSpinComponent(el)` is the app controller's
 * instrument.
 *
 * The element is a locator, not a product — the host already owns it. What
 * this adds is the component's controller surface (`{ commands, state,
 * bind }`), reached through the same context markup consumes. Whether a
 * machine or the platform owns the component's state is invisible here: the
 * surface is the same.
 *
 * The ctl is never nullish: it resolves the element on every access, so the
 * host holds one handle and `bind` inside a `createEffect` subscribes to the
 * element signal and runs when the element mounts. It stays callable for
 * hosts that prefer `ctl()` reads.
 *
 * State reads are the component's own signals, so reading
 * `ctl.state.<field>()` inside a tracking scope subscribes to that
 * component's moves — no polling, no synthetic events.
 *
 * ```tsx
 * const [drawerEl, setDrawerEl] = createSignal<HTMLElement>();
 * const drawer = createSpinComponent(drawerEl);
 * // Props bind at ref time, so seeds land before the build reads them.
 * createEffect(() => drawer.bind({ open: open() }, { "open-change": (e) => setOpen(e.detail.open) }));
 * <spin-drawer ref={drawer.ref} />
 * drawer.commands.show();
 * ```
 */

export type SpinComponentCtlAccessor<
  TCommands extends object = object,
  TState extends object = Record<string, () => unknown>,
  TProps extends object = Record<string, unknown>,
> = (() => SpinComponentCtl<TCommands, TState, TProps>) &
  SpinComponentCtl<TCommands, TState, TProps>;

export function createSpinComponent<D extends DefinedComponent<any, any>>(
  def: D,
): (() => CtlFor<D>) & CtlFor<D>;
export function createSpinComponent<D extends DefinedComponent<any, any>>(
  target: ElementTarget,
  def: D,
): (() => CtlFor<D>) & CtlFor<D>;
export function createSpinComponent<
  TCommands extends object = object,
  TState extends object = Record<string, () => unknown>,
  TProps extends object = Record<string, unknown>,
>(
  el: ElementTarget,
  handle?: object,
): SpinComponentCtlAccessor<TCommands, TState, TProps>;
export function createSpinComponent(
  target: ElementTarget | DefinedComponent<any, any>,
  handleOrDef?: object,
): unknown {
  const ctl = spinComponentCtl(
    target as ElementTarget,
    handleOrDef as object,
  ) as SpinComponentCtl<object, Record<string, () => unknown>, Record<string, unknown>>;
  const accessor = (() => ctl) as (() => typeof ctl) & typeof ctl;
  return Object.assign(accessor, ctl);
}

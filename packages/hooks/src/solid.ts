import { createMemo, type Accessor } from "solid-js";
import { spinComponentCtl, type SpinComponentCtl } from "./controller.ts";

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
 * The ctl is available the moment the host holds the element — `bind` writes
 * props and subscribes events without waiting for anything, which is what
 * lets a seed land before the component's build reads it. `commands` and
 * `state` resolve through the component's registered controller once it has
 * connected; the accessor re-derives when the element changes.
 *
 * State reads are the component's own signals, so reading
 * `ctl.state().<field>()` inside a tracking scope subscribes to that
 * component's moves — no polling, no synthetic events.
 *
 * ```tsx
 * const [drawerEl, setDrawerEl] = createSignal<HTMLElement>();
 * const drawer = createSpinComponent(drawerEl);
 * // Props bind at ref time, so seeds land before the build reads them.
 * createEffect(() => drawer()?.bind({ open: open() }, { "open-change": (e) => setOpen(e.detail.open) }));
 * <spin-drawer ref={setDrawerEl} />
 * drawer()?.commands.show();
 * ```
 */

export type SpinComponentCtlAccessor<TCommands extends object = object> =
  Accessor<SpinComponentCtl<TCommands> | undefined>;

export function createSpinComponent<TCommands extends object = object>(
  el: () => Element | null | undefined,
): SpinComponentCtlAccessor<TCommands> {
  return createMemo(() => {
    const node = el();
    return node === null || node === undefined
      ? undefined
      : spinComponentCtl<TCommands>(node);
  });
}

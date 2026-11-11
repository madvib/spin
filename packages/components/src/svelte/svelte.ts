import type { DefinedComponent } from "@spinjs/components/runtime";
import { bindSpinElement, type SpinHookOptions } from "../spin-element.ts";
import {
  type CtlFor,
  type ElementTarget,
  type SpinComponentCtl,
  spinComponentCtl,
} from "../controller.ts";

/**
 * Svelte adapter: `createSpinComponent(handle)` is the app controller's
 * instrument.
 *
 * Zero Svelte runtime dependency: returns both the `use:action` contract
 * (`action(node, options)`) and the `Readable` store contract (`subscribe`),
 * so a host uses whichever shape fits — `use:ctl.action` with props, or
 * `$ctl` for the controller.
 *
 * The ctl is never nullish: it resolves the action node lazily, so
 * `$ctl.commands.show()` is safe to call and `subscribe` replays the same
 * live handle.
 *
 * ```svelte
 * <script lang="ts">
 *   import { createSpinComponent } from "@spinjs/components/svelte";
 *   const drawer = createSpinComponent();
 * </script>
 * <spin-drawer use:drawer.action={{ open }} />
 * <button onclick={() => $drawer.commands.show()}>Show</button>
 * ```
 */

export interface SvelteSpinComponent<
  TCommands extends object = object,
  TState extends object = Record<string, () => unknown>,
  TProps extends object = Record<string, unknown>,
> {
  readonly action: (
    node: Element,
    options?: SpinHookOptions<Record<string, unknown>>,
  ) => { destroy(): void };
  readonly ctl: SpinComponentCtl<TCommands, TState, TProps>;
  subscribe(
    run: (ctl: SpinComponentCtl<TCommands, TState, TProps>) => void,
  ): () => void;
}

export function createSpinComponent<D extends DefinedComponent<any, any>>(
  def: D,
): { readonly action: SvelteSpinComponent["action"]; readonly ctl: CtlFor<D>; subscribe(run: (ctl: CtlFor<D>) => void): () => void };
export function createSpinComponent<
  TCommands extends object = object,
  TState extends object = Record<string, () => unknown>,
  TProps extends object = Record<string, unknown>,
>(
  handle?: object,
): SvelteSpinComponent<TCommands, TState, TProps>;
export function createSpinComponent(
  targetOrHandle?: ElementTarget | DefinedComponent<any, any>,
  handleOrDef?: object,
): unknown {
  const isDef = (value: unknown): boolean =>
    typeof value === "function" &&
    "createBridge" in (value as unknown as Record<string, unknown>);
  const target: ElementTarget = isDef(targetOrHandle)
    ? undefined
    : (targetOrHandle as ElementTarget);
  const defOrHandle = isDef(targetOrHandle)
    ? targetOrHandle
    : handleOrDef;
  const ctl = spinComponentCtl(
    target as ElementTarget,
    defOrHandle as object,
  ) as SpinComponentCtl<object, Record<string, () => unknown>, Record<string, unknown>>;
  const subscribers = new Set<(ctl: unknown) => void>();
  const notify = (): void => {
    for (const run of subscribers) run(ctl);
  };
  return {
    action(actionNode: Element, options?: SpinHookOptions<Record<string, unknown>>) {
      ctl.ref(actionNode);
      const unbind = bindSpinElement(actionNode, {
        props: options?.props,
        on: options?.on,
      });
      notify();
      return {
        destroy(): void {
          unbind();
          ctl.ref(undefined);
          notify();
        },
      };
    },
    get ctl(): unknown {
      return ctl;
    },
    subscribe(run: (ctl: unknown) => void): () => void {
      subscribers.add(run);
      run(ctl);
      return () => {
        subscribers.delete(run);
      };
    },
  };
}

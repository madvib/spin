import type { DefinedComponent } from "@spinjs/runtime";
import {
  type CtlFor,
  type ElementTarget,
  type SpinComponentCtl,
  spinComponentCtl,
} from "../controller.ts";

/**
 * Vue adapter: `useSpinComponent(elRef)` is the app controller's instrument.
 *
 * Zero Vue runtime dependency: the host passes a Vue `Ref<Element | null>`
 * or a getter, and the composable holds one ctl that resolves on every
 * access — the same lazy resolution the Solid adapter documents.
 *
 * ```vue
 * <script setup lang="ts">
 * import { ref } from "vue";
 * import { useSpinComponent } from "@spinjs/components/vue";
 * const drawerEl = ref<HTMLElement | null>(null);
 * const drawer = useSpinComponent(drawerEl);
 * </script>
 * ```
 */

export type ElementSource =
  | { readonly value?: Element | null | undefined }
  | (() => Element | null | undefined);

export interface VueSpinComponent<
  TCommands extends object = object,
  TState extends object = Record<string, () => unknown>,
  TProps extends object = Record<string, unknown>,
> {
  readonly current: SpinComponentCtl<TCommands, TState, TProps>;
}

export function useSpinComponent<D extends DefinedComponent<any, any>>(
  def: D,
): { readonly current: CtlFor<D> };
export function useSpinComponent<D extends DefinedComponent<any, any>>(
  target: ElementTarget,
  def: D,
): { readonly current: CtlFor<D> };
export function useSpinComponent<
  TCommands extends object = object,
  TState extends object = Record<string, () => unknown>,
  TProps extends object = Record<string, unknown>,
>(
  elRef: ElementTarget,
  handle?: object,
): VueSpinComponent<TCommands, TState, TProps>;
export function useSpinComponent(
  target: ElementTarget | DefinedComponent<any, any>,
  handleOrDef?: object,
): unknown {
  const ctl = spinComponentCtl(
    target as ElementTarget,
    handleOrDef as object,
  ) as SpinComponentCtl<object, Record<string, () => unknown>, Record<string, unknown>>;
  return {
    get current(): unknown {
      return ctl;
    },
  };
}

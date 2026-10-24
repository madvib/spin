import { bindSpinElement, type SpinHookOptions } from "./index.ts";
import { controllerOf, type SpinController } from "@spin/runtime";

/**
 * The app-controller surface: `{ commands, state, bind }`, for whichever
 * component the host is holding.
 *
 * A component owns its state — a machine does, or the platform does behind a
 * thin adapter. This handle does not care which: it is the instrument the
 * host's app controller uses to reach it, through the same context markup
 * consumes. Nothing here owns state, and nothing here re-implements the
 * element — the host already has the element; this is what you can DO with
 * it.
 *
 * The members split by intent:
 *
 * - `commands` — imperative calls, typed per component.
 * - `state` — reactive reads, one per observable field the component
 *   provides. Reads go through the component's own signals, so a framework
 *   binding re-runs when the component moves, with no polling.
 * - `bind` — the controlled channel: props written down (as element
 *   properties, which is what makes a write *authored* — the component can
 *   tell it from a coerced default) and the component's events subscribed
 *   with cleanup.
 *
 * `bind` needs only the element, so it works before the component connects
 * — which matters, because a seed (`defaultValue`, `startMs`) is read during
 * the component's build and a write that arrives after it is too late.
 * `commands` and `state` resolve through the component's registered
 * controller, which exists once it has connected; before then they read
 * empty, and after they are the component's own surface.
 */

/** What a host holds when it holds a spin component. */
export interface SpinComponentCtl<TCommands extends object = object> {
  /** Imperative calls the component declares. */
  readonly commands: TCommands;
  /** Reactive reads of the component's observable state. */
  readonly state: Record<string, () => unknown>;
  /** The controlled channel: props down, events up. */
  bind<TProps extends object>(
    props: TProps,
    on?: Readonly<Record<string, (event: CustomEvent) => void>>,
  ): () => void;
}

/** The ctl for `el` — available the moment the host holds the element. */
export function spinComponentCtl<TCommands extends object = object>(
  el: Element,
): SpinComponentCtl<TCommands> {
  const controller = (): SpinController | undefined => controllerOf(el);
  return {
    get commands() {
      return (controller()?.commands ?? {}) as TCommands;
    },
    get state() {
      return controller()?.state ?? {};
    },
    bind<TProps extends object>(
      props: TProps,
      on?: Readonly<Record<string, (event: CustomEvent) => void>>,
    ): () => void {
      return bindSpinElement(
        el,
        {
          props,
          on,
        } satisfies SpinHookOptions<TProps>,
      );
    },
  };
}

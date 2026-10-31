import { bindSpinElement, type SpinHookOptions } from "./spin-element.ts";
import { controllerOf, type SpinController } from "@spinjs/runtime";
import { effect, scope, signal } from "@spinjs/runtime";
import type { DefinedComponent } from "@spinjs/runtime";

/**
 * The app-controller surface: `{ commands, state, bind, ref }`, for whichever
 * component the host is holding.
 *
 * A component owns its state — a machine does, or the platform does behind a
 * thin adapter. This handle does not care which: it is the instrument the
 * host's app controller uses to reach it, through the same context markup
 * consumes. Nothing here owns state, and nothing here re-implements the
 * element — the host already has the element; this is what you can DO with
 * it.
 *
 * `bind` needs only the element, so it works before the component connects
 * — which matters, because a seed (`defaultValue`, `startMs`) is read during
 * the component's build and a write that arrives after it is too late.
 * `commands` and `state` resolve through the component's registered
 * controller, which exists once it has connected; before then commands are
 * safe no-ops and unknown state keys read `undefined`, and after they are
 * the component's own surface.
 */

/** Any element locator: the element now, or a read of it on every access. */
export type ElementTarget =
  | Element
  | (() => Element | null | undefined)
  | { readonly current?: Element | null | undefined }
  | { readonly value?: Element | null | undefined }
  | null
  | undefined;

/** Prop-getter names never surface as commands. */
export type PropGetterName = `get${string}Props` | `get${string}Indexes`;

/** The callable members of an api, minus prop getters. */
export type CommandsOf<Api extends object> = {
  readonly [K in keyof Api as K extends PropGetterName ? never
    : Api[K] extends (...args: never[]) => unknown ? K : never]: Api[K];
};

/** The readable members of an api, as reactive thunks. */
export type StateOf<Api extends object> = {
  readonly [K in keyof Api as Api[K] extends (...args: never[]) => unknown ? never : K]: () => Api[K];
};

/** The inferred ctl for a `DefinedComponent`. */
export type CtlFor<D> = D extends DefinedComponent<infer Api, infer A>
  ? SpinComponentCtl<CommandsOf<Api>, StateOf<Api>, Partial<A>>
  : never;

/** What a host holds when it holds a spin component. */
export interface SpinComponentCtl<
  TCommands extends object = object,
  TState extends object = Record<string, () => unknown>,
  TProps extends object = Record<string, unknown>,
> {
  /** Imperative calls the component declares. */
  readonly commands: TCommands;
  /** Reactive reads of the component's observable state. */
  readonly state: TState;
  /** The element setter for JSX `ref={ctl.ref}`; feeds `bind` and resolution. */
  readonly ref: (el: Element | null | undefined) => void;
  /** The controlled channel: props down, events up. */
  bind(
    props?: TProps,
    on?: Readonly<Record<string, (event: CustomEvent) => void>>,
  ): () => void;
  /** Re-run `listener` on any state move; returns a disposer. */
  subscribe(listener: () => void): () => void;
}

function resolveTarget(target: ElementTarget): Element | undefined {
  if (target === null || target === undefined) return undefined;
  if (typeof target === "function") return target() ?? undefined;
  if (typeof target !== "object") return undefined;
  if ("current" in target) return target.current ?? undefined;
  if ("value" in target) return target.value ?? undefined;
  return target as Element;
}

/** The ctl for `target` — never nullish; resolution happens at call time. */
export function spinComponentCtl<D extends DefinedComponent<any, any>>(
  def: D,
): CtlFor<D>;
export function spinComponentCtl<D extends DefinedComponent<any, any>>(
  target: ElementTarget,
  def: D,
): CtlFor<D>;
export function spinComponentCtl<
  TCommands extends object = object,
  TState extends object = Record<string, () => unknown>,
  TProps extends object = Record<string, unknown>,
>(
  target: ElementTarget,
  handle?: object,
): SpinComponentCtl<TCommands, TState, TProps>;
export function spinComponentCtl(
  target: ElementTarget | DefinedComponent<any, any>,
  handleOrDef?: object,
): SpinComponentCtl<object, Record<string, () => unknown>, Record<string, unknown>> {
  const isDef = (value: unknown): value is DefinedComponent<any, any> =>
    typeof value === "function" &&
    "createBridge" in (value as unknown as Record<string, unknown>);
  const targetArg: ElementTarget = isDef(target)
    ? undefined
    : (target as ElementTarget);
  const node = signal<Element | undefined>(resolveTarget(targetArg));
  const handle = isDef(handleOrDef)
    ? (handleOrDef as unknown as object)
    : handleOrDef;
  const resolveController = (): SpinController | undefined => {
    const el = node() ?? resolveTarget(targetArg);
    return el === undefined ? undefined : controllerOf(el, handle);
  };
  const commands = new Proxy({} as Record<string, unknown>, {
    get: (_t, key: string) => {
      const found = resolveController()?.commands[key];
      if (typeof found === "function") return found;
      return (..._args: readonly unknown[]): void => {};
    },
    has: (_t, key: string) => key in (resolveController()?.commands ?? {}),
    ownKeys: () => Reflect.ownKeys(resolveController()?.commands ?? {}),
    getOwnPropertyDescriptor: (_t, key: string) => {
      const descriptor = Reflect.getOwnPropertyDescriptor(
        resolveController()?.commands ?? {},
        key,
      );
      if (descriptor === undefined) {
        return { configurable: true, enumerable: true };
      }
      return { ...descriptor, configurable: true };
    },
  });
  const state = new Proxy({} as Record<string, () => unknown>, {
    get: (_t, key: string) => {
      const found = resolveController()?.state[key];
      if (typeof found === "function") return found;
      return () => undefined;
    },
    has: (_t, key: string) => key in (resolveController()?.state ?? {}),
    ownKeys: () => Reflect.ownKeys(resolveController()?.state ?? {}),
    getOwnPropertyDescriptor: (_t, key: string) => {
      const descriptor = Reflect.getOwnPropertyDescriptor(
        resolveController()?.state ?? {},
        key,
      );
      if (descriptor === undefined) {
        return { configurable: true, enumerable: true };
      }
      return { ...descriptor, configurable: true };
    },
  });
  return {
    commands: commands as object as never,
    state: state as Record<string, () => unknown> as never,
    ref: (el: Element | null | undefined): void => {
      node(el ?? undefined);
    },
    bind<TProps extends object>(
      props?: TProps,
      on?: Readonly<Record<string, (event: CustomEvent) => void>>,
    ): () => void {
      const el = node() ?? resolveTarget(targetArg);
      if (el === undefined) return () => {};
      return bindSpinElement(el, {
        props,
        on,
      } satisfies SpinHookOptions<TProps>);
    },
    subscribe(listener: () => void): () => void {
      const owner = scope();
      let first = true;
      owner.run(() =>
        effect(() => {
          for (const read of Object.values(resolveController()?.state ?? {})) {
            read();
          }
          if (first) {
            first = false;
            return;
          }
          listener();
        })
      );
      return () => owner.dispose();
    },
  };
}

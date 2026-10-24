import { effect, own, untrack } from "../core/signal.ts";
export type Signal<T> = { (): T; (value: T): void };

export interface ActionResult<P = unknown> {
  update?(param: P): void;
  destroy?(): void;
}

export type ElementAction<P = unknown> = (
  node: Element,
  param: P,
) => ActionResult<P> | void;

export function createAction<P>(
  fn: ElementAction<P>,
): ElementAction<P> {
  return (node: Element, param: P) =>
    untrack(() => fn(node, param) ?? undefined);
}

export function runAction<P>(
  node: Element,
  action: ElementAction<P> | null | undefined,
  paramThunk?: () => P,
): void {
  if (typeof action !== "function") return;
  let result: ActionResult<P> | undefined;
  let started = false;
  effect(() => {
    const param = (paramThunk === undefined ? undefined : paramThunk()) as P;
    if (!started) {
      started = true;
      result = action(node, param) ?? undefined;
    } else {
      result?.update?.(param);
    }
  });
  own(() => {
    result?.destroy?.();
  });
}

export type SlotLookup = (name: string) => Node[];

export function on<E extends Event = Event>(
  el: EventTarget,
  event: string,
  handler: (e: E) => void,
): () => void {
  const wrapped = (e: Event): void => {
    handler(e as E);
  };
  el.addEventListener(event, wrapped);
  const stop = () => el.removeEventListener(event, wrapped);
  try {
    own(stop);
  } catch {
    // No scope is active. The caller owns the disposer.
  }
  return stop;
}

import { effect, own, untrack } from "../core/signal.ts";

/**
 * The action contract: Svelte's, deliberately.
 *
 * An action is a function that receives the element it is attached to and a
 * parameter, and may return `{ update, destroy }`. The runtime wires the
 * lifecycle: call on mount, `update(param)` when the parameter's reactive
 * reads change, `destroy()` when the element goes away.
 *
 * ```ts
 * function myAction(node, params) {
 *   const stop = listen(node, "click", params.onClick)
 *   return { destroy: stop }
 * }
 * <div use:myAction={{ onClick }} />
 * ```
 *
 * What an action may do — the whole gate, enforced by the shipped catalog
 * and the contract tests, not by convention:
 *
 * - Mutate only the node it is given: attributes, focus, scroll, class.
 * - Listen anywhere it must (document, observers) — observe, don't reach.
 * - Read layout freely. Write NO styles: not `style.*`, not `cssText`, not
 *   stylesheets. Visual state flows through attributes and utility classes;
 *   that is what keeps the styling engine the single source of truth.
 * - Cross element boundaries in one direction only: none. Coordination goes
 *   through `send` events.
 * - Hold no state that outlives the element. A timer, a drag offset, an
 *   observer handle — all released in `destroy`.
 *
 * `param` is the only inbound channel. A machine that needs context reads
 * it, resolves it, and passes the result as the param; actions never see
 * the scope chain.
 */

export interface ActionResult<P = unknown> {
  /** Called when the param's reactive dependencies change. */
  update?(param: P): void;
  /** Called once when the element unmounts. Release everything. */
  destroy?(): void;
}

export type ElementAction<P = unknown> = (
  node: Element,
  param: P,
) => ActionResult<P> | void;

/**
 * Wrap an action so its setup does not track reactive reads: whatever the
 * action reads at mount must not subscribe the surrounding effect. Params
 * still flow through `update`, re-run by `runAction`'s effect.
 */
export function createAction<P>(fn: ElementAction<P>): ElementAction<P> {
  return (node: Element, param: P) => untrack(() => fn(node, param) ?? undefined);
}

/**
 * Attach an action with full lifecycle. The compiler target for
 * `use:name={param}` and for bag-carried `use:` entries.
 *
 * The param is a thunk, not a value: an action that wanted it once would be
 * a reaction to a value, and reactive re-params are the whole point. A
 * missing thunk runs the action exactly once with `undefined`.
 *
 * The setup effect is owned by the surrounding scope, so it — and the
 * destroy cleanup — release when the component unmounts. An action that
 * outlived its element would be a leak nothing else can see; the scope is
 * what makes that impossible rather than unlikely.
 *
 * A non-function is inert rather than fatal: a directive that threw because
 * an action was not found would take the tree down, which tells an author
 * less than a behavior that simply did not happen.
 */
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

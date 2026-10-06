/**
 * The reactive primitives alien-signals does not ship: `batch`, `untrack`, and
 * a `scope` whose `dispose` reaches every effect created under its `run`.
 *
 * The cascade is the point: a binding that outlives its element writes into
 * detached DOM and throws nothing, so `dispose` has to be exhaustive.
 */

import {
  computed,
  effect,
  effectScope,
  endBatch,
  setActiveSub,
  signal,
  startBatch,
  trigger,
} from "alien-signals";

export { computed, effect, signal, trigger };

/**
 * Run `fn` with writes deferred, then flush once.
 *
 * Every write inside `fn` schedules the same flush, so an effect that reads
 * three of them still runs exactly once.
 */
export function batch<T>(fn: () => T): T {
  startBatch();
  try {
    return fn();
  } finally {
    endBatch();
  }
}

/**
 * Read without subscribing.
 *
 * Reads made inside `fn` are invisible to the surrounding effect, which is how
 * a binding renders a value it must not be woken by.
 */
export function untrack<T>(fn: () => T): T {
  const prevSub = setActiveSub(undefined);
  try {
    return fn();
  } finally {
    setActiveSub(prevSub);
  }
}

/** A unit of ownership: work created under `run` dies with `dispose`. */
export interface OwnerScope {
  /** Runs `fn` with this scope active, so what it creates is owned here. */
  run<T>(fn: () => T): T;
  /** Registers teardown to run at `dispose`. */
  own(dispose: () => void): void;
  /** Tears down everything created under `run`, plus everything `own`ed. */
  dispose(): void;
}

/** The scope whose `run` is currently executing, if any. */
let activeScope: OwnerScope | undefined;

/**
 * The object form of alien-signals' `effectScope`.
 *
 * `run` may be called any number of times; each call opens its own group and
 * the group's effects die with the scope. Teardown runs newest-first, so an
 * inner resource is released before the outer one it was built on, and effects
 * go before `own`ed teardown — a binding's last run should not be able to
 * write into a node the teardown has already removed.
 */
export function scope(): OwnerScope {
  const groups: Array<() => void> = [];
  const teardowns: Array<() => void> = [];
  let disposed = false;

  const self: OwnerScope = {
    run<T>(fn: () => T): T {
      if (disposed) {
        throw new Error("scope.run: the scope is disposed");
      }
      const prevScope = activeScope;
      activeScope = self;
      try {
        let value!: T;
        // `effectScope` links the group to the active sub, so an effect made
        // inside `fn` becomes its child and is disposed with the group.
        groups.push(effectScope(() => {
          value = fn();
        }));
        return value;
      } finally {
        activeScope = prevScope;
      }
    },
    own(dispose: () => void) {
      // Registering against a dead scope still releases the resource, now.
      if (disposed) {
        dispose();
        return;
      }
      teardowns.push(dispose);
    },
    dispose() {
      if (disposed) {
        return;
      }
      disposed = true;
      for (let i = groups.length - 1; i >= 0; i--) {
        groups[i]();
      }
      groups.length = 0;
      for (let i = teardowns.length - 1; i >= 0; i--) {
        teardowns[i]();
      }
      teardowns.length = 0;
    },
  };

  return self;
}

/**
 * Registers teardown with the scope currently running.
 *
 * The standalone spelling of `scope.own`, for code inside `run` that does not
 * hold the scope. Outside a scope there is nothing to defer the teardown to,
 * and silently dropping it would leak, so this throws instead.
 */
export function own(dispose: () => void): void {
  if (activeScope === undefined) {
    throw new Error("own: called outside of scope.run");
  }
  activeScope.own(dispose);
}

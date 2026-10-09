/**
 * Scope-local instance table with chain lookup and dispose-on-scope-death.
 *
 * Each element-connection scope owns a `Map<handle, instance>`. Lookup walks
 * the scope chain upward (element → ancestors → global root scope). First
 * `watch` instantiates via the registered factory; scope dispose destroys
 * instances created in it.
 *
 * Handle = imported object reference (machine-def module export), never a
 * string. No central registry; the module graph is the registry.
 */

import type { OwnerScope } from "../core/signal.ts";

/** A handle identifies a machine definition. It is the imported object reference, never a string. */
export type Handle = object;

/** Creates an instance from a handle. */
export type Factory<T> = () => T;

export interface ScopeTable {
  /** Look up a handle, walking up the scope chain. Does not instantiate. */
  resolve<T>(handle: Handle): T | undefined;
  /** Instantiate (on first call) and return the instance for a handle. */
  watch<T>(handle: Handle, factory: Factory<T>): T;
  /** Destroy all instances created in this scope. */
  dispose(): void;
}

/** Maps each owner scope to its instances map. */
const allInstances = new WeakMap<OwnerScope, Map<Handle, { value: unknown; dispose?: () => void }>>();

/**
 * Creates a scope table for the given owner scope.
 *
 * The table is registered with the scope via `own()`, so when the scope is
 * disposed, all instances created in it are destroyed. Chain lookup walks
 * up the `parent` chain to find instances in ancestor scopes.
 */
export function createScopeTable(owner: OwnerScope): ScopeTable {
  const instances = new Map<Handle, { value: unknown; dispose?: () => void }>();

  // Register teardown with the scope. When the scope is disposed, destroy
  // all instances created in it.
  owner.own(() => {
    for (const [, instance] of instances) {
      instance.dispose?.();
    }
    instances.clear();
  });

  function resolve<T>(handle: Handle): T | undefined {
    let current: OwnerScope | undefined = owner;
    while (current) {
      const instances = allInstances.get(current);
      if (instances) {
        const instance = instances.get(handle);
        if (instance) return instance.value as T;
      }
      current = current.parent;
    }
    return undefined;
  }

  function watch<T>(handle: Handle, factory: Factory<T>): T {
    const existing = instances.get(handle);
    if (existing) return existing.value as T;
    const value = factory();
    const dispose = getDispose(value);
    instances.set(handle, { value, dispose: dispose ?? (() => {}) });
    return value;
  }

  function dispose(): void {
    for (const [, instance] of instances) {
      instance.dispose?.();
    }
    instances.clear();
  }

/** Narrow unknown to a dispose function using type guards. */
function getDispose(value: unknown): (() => void) | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  if (!("dispose" in value)) return undefined;
  const dispose = value.dispose;
  if (typeof dispose !== "function") return undefined;
  return () => dispose();
}

  const table: ScopeTable = { resolve, watch, dispose };
  allInstances.set(owner, instances);
  return table;
}

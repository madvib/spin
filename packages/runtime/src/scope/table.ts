/**
 * Scope-local instance table with DOM-ancestor chain lookup and dispose-on-scope-death.
 *
 * Each element-connection scope owns a `Map<handle, instance>`. Lookup walks
 * the DOM ancestor chain (element → parentElement → …), so a nested element
 * consumes the nearest ancestor's instance. First `watch` instantiates via
 * the registered factory; scope dispose destroys instances created in it.
 *
 * Handle = imported object reference (machine-def module export), never a
 * string. No central registry; the module graph is the registry.
 */

import { scope, type OwnerScope } from "../core/signal.ts";

/** A handle identifies a machine definition. It is the imported object reference, never a string. */
export type Handle = object;

/** Creates an instance from a handle. */
export type Factory<T> = () => T;

/** What an app controller can do with a component. */
export interface SpinController {
  /** Imperative calls, keyed by the name the element installs them under. */
  readonly commands: Readonly<Record<string, (...args: never[]) => unknown>>;
  /** Reactive reads, one thunk per observable field. */
  readonly state: Readonly<Record<string, () => unknown>>;
}

export interface ScopeTable {
  /** Look up a handle, walking up the DOM ancestor chain. Does not instantiate. */
  resolve<T>(handle: Handle): T | undefined;
  /** Instantiate (on first call) and register a handle in this element's scope. */
  watch<T>(handle: Handle, factory: Factory<T>, commands?: readonly string[], name?: string): T;
  /** Consume a handle by walking up the DOM ancestor ScopeTable chain; throws when absent. */
  consume<T>(handle: Handle): T;
  /** Return the SpinController view for a handle (or the primary handle if omitted). */
  controller(handle?: Handle): SpinController | undefined;
  /** Destroy all instances created in this scope. */
  dispose(): void;
}

/** Maps each element to its connection ScopeTable. */
const elementTables = new WeakMap<Element, ScopeTable>();

interface Entry {
  value: unknown;
  api: unknown;
  commands: readonly string[] | undefined;
  primary: boolean;
  dispose?: () => void;
}

function apiOf(value: unknown): unknown {
  if (value !== null && typeof value === "object" && "api" in value) {
    return (value as { api: unknown }).api;
  }
  return value;
}

/** The controller view of a component's api: its non-function members as
 * reactive reads, and the declared commands as calls.
 *
 * The field list is a reflection of the api, not a declaration — a field the
 * api stops carrying stops being observable, with no list to keep in step. */
export function controllerView(
  api: object,
  commands?: readonly string[],
): SpinController {
  const record = api as Record<string, unknown>;
  const state: Record<string, () => unknown> = {};
  for (const key of Object.keys(record)) {
    if (typeof record[key] !== "function") state[key] = () => record[key];
  }
  const calls: Record<string, (...args: never[]) => unknown> = {};
  for (const name of commands ?? []) {
    const method = record[name];
    if (typeof method === "function") {
      calls[name] = method as (...args: never[]) => unknown;
    }
  }
  return { commands: calls, state };
}

/**
 * Creates a scope table for the given owner scope, optionally bound to an
 * element for DOM-ancestor chain lookup.
 *
 * The table is registered with the scope via `own()`, so when the scope is
 * disposed, all instances created in it are destroyed.
 */
export function createScopeTable(owner: OwnerScope, el?: Element): ScopeTable {
  const instances = new Map<Handle, Map<string, Entry>>();
  let primary: { handle: Handle; name: string } | undefined;

  function named(handle: Handle): Map<string, Entry> {
    let byName = instances.get(handle);
    if (byName === undefined) instances.set(handle, byName = new Map());
    return byName;
  }

  function firstEntry(byName: Map<string, Entry> | undefined): Entry | undefined {
    if (byName === undefined) return undefined;
    return byName.get("") ?? byName.values().next().value;
  }

  owner.own(() => {
    if (el !== undefined) elementTables.delete(el);
    for (const byName of instances.values()) {
      for (const [, instance] of byName) {
        instance.dispose?.();
      }
    }
    instances.clear();
    primary = undefined;
  });

  function findLocal(handle: Handle): Entry | undefined {
    return firstEntry(instances.get(handle));
  }

  function findAncestor(handle: Handle): Entry | undefined {
    for (
      let current: Element | null = el?.parentElement ?? null;
      current !== null;
      current = current.parentElement
    ) {
      const ancestor = elementTables.get(current) as
        | (ScopeTable & { entry(handle: Handle): Entry | undefined })
        | undefined;
      const found = ancestor?.entry(handle);
      if (found !== undefined) return found;
    }
    return undefined;
  }

  function resolve<T>(handle: Handle): T | undefined {
    return (findLocal(handle) ?? findAncestor(handle))?.api as T | undefined;
  }

  function consume<T>(handle: Handle): T {
    const found = resolve<T>(handle);
    if (found === undefined) {
      throw new Error(`[spin] consume: no provider found for ${(handle as { name?: string }).name ?? "machine"}`);
    }
    return found;
  }
  function watch<T>(
    handle: Handle,
    factory: Factory<T>,
    commands?: readonly string[],
    name?: string,
  ): T {
    const key = name ?? "";
    const byName = named(handle);
    const existing = byName.get(key);
    if (existing !== undefined) return existing.value as T;
    const value = factory();
    const entry: Entry = {
      value,
      api: apiOf(value),
      commands,
      primary: primary === undefined,
      dispose: getDispose(value),
    };
    byName.set(key, entry);
    primary ??= { handle, name: key };
    return value;
  }

  function entry(handle: Handle): Entry | undefined {
    return findLocal(handle);
  }

  function hasNamed(handle: Handle, name: string): boolean {
    return instances.get(handle)?.has(name) ?? false;
  }

  function namesOf(handle: Handle): readonly string[] {
    return [...(instances.get(handle)?.keys() ?? [])];
  }

  function controller(handle?: Handle): SpinController | undefined {
    const target = handle ?? primary?.handle;
    const found = target === undefined ? undefined : (findLocal(target) ?? (handle === undefined ? undefined : findAncestor(handle)));
    if (found === undefined) return undefined;
    const api = found.api as { commands?: unknown; state?: unknown };
    if (api !== null && typeof api === "object" && "commands" in api && "state" in api) {
      return api as unknown as SpinController;
    }
    return controllerView((found.api ?? {}) as object, found.commands);
  }

  function dispose(): void {
    if (el !== undefined) elementTables.delete(el);
    for (const byName of instances.values()) {
      for (const [, instance] of byName) {
        instance.dispose?.();
      }
    }
    instances.clear();
    primary = undefined;
  }

  function getDispose(value: unknown): (() => void) | undefined {
    if (typeof value !== "object" || value === null) return undefined;
    if (!("dispose" in value)) return undefined;
    const disposeFn = (value as { dispose: unknown }).dispose;
    if (typeof disposeFn !== "function") return undefined;
    return () => (disposeFn as () => void)();
  }

  const table: ScopeTable & { entry(handle: Handle): Entry | undefined; hasNamed(handle: Handle, name: string): boolean; namesOf(handle: Handle): readonly string[] } = {
    resolve,
    watch,
    consume,
    controller,
    dispose,
    entry,
    hasNamed,
    namesOf,
  };
  if (el !== undefined) elementTables.set(el, table);
  return table;
}

/** Consume a handle from `el`'s ScopeTable chain; throws when no provider is found. */
export function consume<T>(el: Element, handle: Handle): T {
  for (
    let current: Element | null = el;
    current !== null;
    current = current.parentElement
  ) {
    const table = elementTables.get(current);
    const found = table?.consume<T>(handle);
    if (found !== undefined) return found;
  }
  throw new Error(
    `[spin] consume: no provider found for ${(handle as { name?: string }).name ?? "machine"}`,
  );
}

/** The controller `el` provides, or the nearest ancestor's when `el` is not connected. */
export function controllerOf(
  el: Element,
  handle?: Handle,
): SpinController | undefined {
  for (
    let current: Element | null = el;
    current !== null;
    current = current.parentElement
  ) {
    const found = elementTables.get(current)?.controller(handle);
    if (found !== undefined) return found;
    if (handle === undefined) return undefined;
  }
  return undefined;
}

/** Register a controller on `el`'s ScopeTable, creating a table when `el` is a plain host element. */
export function provideController(
  el: Element,
  build: () => SpinController,
  handle?: Handle,
): void {
  let table = elementTables.get(el);
  if (table === undefined) {
    table = createScopeTable(scope(), el);
  }
  const key = handle ?? build;
  const existing = table.resolve<SpinController>(key);
  if (existing !== undefined) return;
  const built = build();
  table.watch(
    key,
    () => ({ api: built, dispose: undefined }),
    Object.keys(built.commands),
  );
}

/**
 * Custom elements: a scope per connection, and props that survive both sides.
 *
 * Props are properties, not attributes — an attribute is a string and a machine
 * needs objects. Attributes are supported for the primitives that are strings,
 * and land in the same live prop a property write would.
 */

import { scope, signal, type OwnerScope } from "../core/signal.ts";
import { createScopeTable, type Factory, type Handle, type ScopeTable } from "./table.ts";

/** Turns an attribute's string into the value the component reads. */
export type AttributeParser = (value: string | null) => unknown;

export interface ElementSpec {
  /** Property names. Each becomes a live read on `ctx.props`. */
  props?: readonly string[];
  /**
   * Attribute name to parser. Declaring one puts it in `observedAttributes`,
   * so writing the attribute updates the same prop a property write would.
   */
  attributes?: Readonly<Record<string, AttributeParser>>;
  /**
   * Builds the component. Runs inside the element's scope on every connection,
   * so an `effect` created here dies with the element.
   */
  build(context: BuildContext): void;
}

export interface BuildContext {
  /** The element itself. Zag's `getRootNode` wants exactly this. */
  readonly el: HTMLElement;
  /** The declared props. Every read is a live read of the current value. */
  readonly props: Readonly<Record<string, unknown>>;
  /** The scope for this connection. Pass it to `createMachine`. */
  readonly scope: OwnerScope;
  /** Resolve a handle to its instance, walking up the scope chain. */
  /** Resolve a handle to its instance, walking up the scope chain. */
  resolve<T>(handle: Handle): T | undefined;
  /** Instantiate (on first call) and register a handle in this scope. */
  watch<T>(handle: Handle, factory: Factory<T>): T;
}

/** A readable-and-writable value; `signal()` gives one without a name here. */
type Signal = {
  (): unknown;
  (next: unknown): void;
};

/** The declared props of one element instance, as live signals. */
type PropStore = Map<string, Signal>;

/** Per-tag counters for generated element ids. Page-load scoped: uniqueness
 * is what Zag's part-id scoping needs, stability across loads is not. */
const idCounters = new Map<string, number>();

/**
 * A unique id for a `tag` instance. Used when the author sets no `id`: Zag
 * scopes part ids (and aria references) by machine id, so two id-less
 * `<spin-accordion>` elements would otherwise share every part id.
 */
export function uniqueId(tag: string): string {
  const next = (idCounters.get(tag) ?? 0) + 1;
  idCounters.set(tag, next);
  return `${tag}-${next}`;
}

/**
 * Registers `tag` as a custom element built by `spec`.
 *
 * `build` runs inside the element's scope on every connection, so every effect
 * it creates dies with the element.
 */
export function define(tag: string, spec: ElementSpec): void {
  const propNames = spec.props ?? [];
  const parsers = spec.attributes ?? {};
  // A store per instance, created on first touch, so a property written before
  // upgrade is still the value `build` reads.
  const stores = new WeakMap<HTMLElement, PropStore>();

  function storeFor(el: HTMLElement): PropStore {
    let store = stores.get(el);
    if (!store) stores.set(el, store = new Map());
    return store;
  }

  function propFor(el: HTMLElement, name: string): Signal {
    const store = storeFor(el);
    let value = store.get(name);
    if (!value) store.set(name, value = signal<unknown>(undefined));
    return value;
  }

  function propsFor(el: HTMLElement): Readonly<Record<string, unknown>> {
    return new Proxy({} as Record<string, unknown>, {
      get: (_target, key) => typeof key === "string" ? propFor(el, key)() : undefined,
      has: (_target, key) => typeof key === "string" && storeFor(el).has(key),
      ownKeys: () => [...storeFor(el).keys()],
      getOwnPropertyDescriptor: () => ({ configurable: true, enumerable: true }),
    });
  }

  class Component extends HTMLElement {
    #scope: OwnerScope | undefined;
    #table: ScopeTable | undefined;

    connectedCallback(): void {
      // Custom elements are inline by default; content children sized in %
      // (slider tracks, carousel slides) would shrink-wrap. Block layout is
      // element semantics, not theme — set once here, not per component.
      if (this.style.display === "") this.style.display = "block";
      // A reconnect opens a fresh scope. The previous one is already disposed,
      // and `dispose` is idempotent, so ordering here is not load-bearing.
      const owner = scope();
      this.#scope = owner;
      const table = createScopeTable(owner);
      this.#table = table;
      owner.run(() => {
        spec.build({
          el: this,
          props: propsFor(this),
          scope: owner,
          resolve: (handle) => table.resolve(handle),
          watch: (handle, factory) => table.watch(handle, factory),
        });
      });
    }

    disconnectedCallback(): void {
      this.#scope?.dispose();
      this.#scope = undefined;
      this.#table = undefined;
    }

    attributeChangedCallback(
      name: string,
      _previous: string | null,
      next: string | null,
    ): void {
      propFor(this, name)(parsers[name](next));
    }
  }

  for (const name of propNames) {
    Object.defineProperty(Component.prototype, name, {
      get(this: HTMLElement) {
        return propFor(this, name)();
      },
      set(this: HTMLElement, next: unknown) {
        propFor(this, name)(next);
      },
      configurable: true,
      enumerable: true,
    });
  }

  Object.defineProperty(Component, "observedAttributes", {
    value: Object.keys(parsers),
    configurable: true,
  });

  customElements.define(tag, Component);
}
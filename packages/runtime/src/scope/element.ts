/**
 * Custom elements: a scope per connection, and props that survive both sides.
 *
 * Props are properties, not attributes — an attribute is a string and a machine
 * needs objects. Attributes are supported for the primitives that are strings,
 * and land in the same live prop a property write would.
 */

import { type OwnerScope, scope, signal } from "../core/signal.ts";
import {
  createScopeTable,
  type Factory,
  type Handle,
  type ScopeTable,
} from "./table.ts";
import {
  coerceBool,
  coerceInt,
  coerceJsonArray,
  coerceObjectArrayItems,
  coerceString,
} from "../props.ts";

/** Turns an attribute's string into the value the component reads. */
export type AttributeParser = (value: string | null) => unknown;

/**
 * The scope grammar's attribute parsers, one per declared prop type. The
 * plugin emits an `attributes` map from these so an attribute written at
 * any time — a framework's string prop, or a later setAttribute — lands in
 * the same live prop a property write reaches. Kept beside the element
 * definition that consumes them, not beside the grammar that mirrors them.
 */
export const attrParsers = {
  bool: (value: string | null): boolean | undefined => coerceBool(value, false),
  string: (value: string | null): string => coerceString(value),
  int: (value: string | null): number | undefined =>
    coerceInt(value, undefined),
  "string[]": (value: string | null): string[] =>
    coerceJsonArray(value, []) as string[],
  "object[]": (value: string | null): unknown[] => coerceJsonArray(value, []),
} as const satisfies Record<string, AttributeParser>;

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
  /** The element itself. The bridge's root accessor wants exactly this. */
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
  /**
   * Whether a prop was written by the host (property or attribute) as
   * opposed to left at its coerced default. Machines use it to tell a
   * controlled value from a seed.
   */
  authored(name: string): boolean;
}

/** A readable-and-writable value; `signal()` gives one without a name here. */
type Signal = {
  (): unknown;
  (next: unknown): void;
};

/** The declared props of one element instance, as live signals. */
type PropStore = Map<string, Signal>;

/**
 * Props the host actually WROTE — as a property set or an attribute — as
 * opposed to coerced defaults. This is the distinction controlled
 * components live on: a `defaultOpen` seeds, an authored `open` alternates.
 * Without it every declared prop reads as "set", because coercion
 * materializes a default for all of them, and a machine can never tell the
 * two apart. A controlled/uncontrolled pair does this at the prop layer
 * (`value` vs `defaultValue`); the element is where it lands here.
 */
const authoredProps = new WeakMap<HTMLElement, Set<string>>();

/** Each element's connection scope, so work that runs later — a binding
 * re-applying after the element left the build — still enters it. */
const elementScopes = new WeakMap<HTMLElement, OwnerScope>();

/** The scope of the element that owns `node`: a recipe's markup renders
 * inside its custom element, so a bag spread on an inner node belongs to that
 * element's scope. */
function scopeOf(node: Element): OwnerScope | undefined {
  for (
    let current: Element | null = node;
    current !== null;
    current = current.parentElement
  ) {
    const owner = elementScopes.get(current as HTMLElement);
    if (owner !== undefined) return owner;
  }
  return undefined;
}

/** Runs `fn` inside the owning element's scope, so what it creates is owned
 * and disposed with the element. Outside an element (a detached fragment)
 * there is no scope to enter, and `fn` runs as-is. */
export function runInElement<T>(el: Element, fn: () => T): T {
  const owner = scopeOf(el);
  return owner === undefined ? fn() : owner.run(fn);
}

function authoredFor(el: HTMLElement): Set<string> {
  let set = authoredProps.get(el);
  if (!set) authoredProps.set(el, set = new Set());
  return set;
}

/** Per-tag counters for generated element ids. Page-load scoped: uniqueness
 * is what part-id scoping needs, stability across loads is not. */
const idCounters = new Map<string, number>();

/**
 * A unique id for a `tag` instance. Used when the author sets no `id`: the
 * machine scopes part ids (and aria references) by its own id, so two
 * id-less `<spin-accordion>` elements would otherwise share every part id.
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
      get: (_target, key) =>
        typeof key === "string" ? propFor(el, key)() : undefined,
      has: (_target, key) => typeof key === "string" && storeFor(el).has(key),
      ownKeys: () => [...storeFor(el).keys()],
      getOwnPropertyDescriptor: () => ({
        configurable: true,
        enumerable: true,
      }),
    });
  }

  class Component extends HTMLElement {
    #scope: OwnerScope | undefined;
    #table: ScopeTable | undefined;

    constructor() {
      super();
      // A property written before the upgrade shadowed the accessor with
      // a plain own property: the store never saw it, and the build read
      // an empty prop. Move those values into the store and drop the
      // shadow, so `build` reads what the host wrote.
      for (const name of propNames) {
        const own = Object.getOwnPropertyDescriptor(this, name);
        if (
          own === undefined || own.get !== undefined || own.set !== undefined
        ) continue;
        const value = own.value;
        delete (this as unknown as Record<string, unknown>)[name];
        propFor(this, name)(value);
      }
    }

    connectedCallback(): void {
      // Custom elements are inline by default; content children sized in %
      // (slider tracks, carousel slides) would shrink-wrap. Block layout is
      // element semantics, not theme — set once here, not per component.
      if (this.style.display === "") this.style.display = "block";
      // A reconnect opens a fresh scope. The previous one is already disposed,
      // and `dispose` is idempotent, so ordering here is not load-bearing.
      const owner = scope();
      this.#scope = owner;
      elementScopes.set(this, owner);
      const table = createScopeTable(owner);
      this.#table = table;
      owner.run(() => {
        spec.build({
          el: this,
          props: propsFor(this),
          scope: owner,
          resolve: (handle) => table.resolve(handle),
          watch: (handle, factory) => table.watch(handle, factory),
          authored: (name) => authoredFor(this).has(name),
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
      authoredFor(this).add(name);
      propFor(this, name)(parsers[name]?.(next));
    }
  }

  /**
   * The property-write boundary. A host's write coerces through the runtime's
   * prop grammar, so the store holds grammar-shaped values whichever boundary
   * the host wrote through. String writes take the component's own parser (the
   * attribute path's grammar, verbatim); a host-written object or array takes
   * the object-array branch: plain objects survive, everything else is dropped.
   */
  function coerceWrite(name: string, next: unknown): unknown {
    const parser = parsers[name];
    if (parser === undefined) return next;
    if (typeof next === "string") return parser(next);
    if (parser !== attrParsers["object[]"]) return next;
    return coerceObjectArrayItems(next, []);
  }

  for (const name of propNames) {
    Object.defineProperty(Component.prototype, name, {
      get(this: HTMLElement) {
        return propFor(this, name)();
      },
      set(this: HTMLElement, next: unknown) {
        authoredFor(this).add(name);
        propFor(this, name)(coerceWrite(name, next));
      },
      configurable: true,
      enumerable: true,
    });
  }

  Object.defineProperty(Component, "observedAttributes", {
    value: Object.keys(parsers),
    configurable: true,
  });

  // HMR re-runs the module (cache-busted `?t=` query): the tag is already
  // live, and a second define throws. The first registration wins; a real
  // rename is a new tag, so nothing versioned is lost.
  if (customElements.get(tag) !== undefined) return;
  customElements.define(tag, Component);
}

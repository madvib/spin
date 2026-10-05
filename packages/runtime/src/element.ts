/**
 * Custom elements: a scope per connection, and a prop that survives both sides
 * of it.
 *
 * A component that outlives its element is the failure a runtime exists to
 * prevent. An effect that writes into a detached node throws nothing, so the
 * only defence is that `disconnectedCallback` reaches everything created during
 * `connectedCallback` — which is the cascade from `signal.ts`, and the reason
 * `build` runs inside `scope.run` rather than beside it.
 *
 * Props are properties, not attributes, because an attribute is a string and a
 * Zag component needs objects: an array of nodes, a function, a `Set` of ids. An
 * attribute would arrive as `"[object Object]"` and fail silently, which is the
 * worst way to fail. Attributes are still supported, for the primitives that
 * genuinely are strings — `disabled="true"` — and they land in the same live
 * prop a property write would, so a component reads one thing either way.
 */

import { scope, signal, type OwnerScope } from "./signal.ts";

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
}

/** A readable-and-writable value; `signal()` gives one without a name here. */
type Signal = {
  (): unknown;
  (next: unknown): void;
};

/** The declared props of one element instance, as live signals. */
type PropStore = Map<string, Signal>;

/**
 * Registers `tag` as a custom element built by `spec`.
 *
 * ```ts
 * define("spin-accordion", {
 *   attributes: { disabled: (value) => value === "true" },
 *   build({ el, scope }) {
 *     el.innerHTML = `<div data-part="root"><button data-part="item-trigger"></button></div>`;
 *     const accordion = createMachine(accordionMachine, {
 *       connect: accordionConnect,
 *       scope,                          // so disconnect disposes the machine
 *       getRootNode: () => el,          // zag looks parts up from here
 *       props: { collapsible: true },
 *     });
 *     const trigger = el.querySelector("button")!;
 *     const bag = accordion.api.getItemTriggerProps({ value: "one" });
 *     trigger.addEventListener("click", bag.onClick);
 *     effect(() => {
 *       trigger.setAttribute("data-expanded", String(accordion.api.value.includes("one")));
 *     });
 *   },
 * });
 * ```
 */
export function define(tag: string, spec: ElementSpec): void {
  const propNames = spec.props ?? [];
  const parsers = spec.attributes ?? {};
  // A store per instance, created on first touch. A property write before the
  // element is upgraded, or an attribute the parser already answered, is then
  // still the value `build` reads — the store does not care when it was made.
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

    connectedCallback(): void {
      // A reconnect opens a fresh scope. The previous one is already disposed,
      // and `dispose` is idempotent, so ordering here is not load-bearing.
      const owner = scope();
      this.#scope = owner;
      owner.run(() => {
        spec.build({ el: this, props: propsFor(this), scope: owner });
      });
    }

    disconnectedCallback(): void {
      this.#scope?.dispose();
      this.#scope = undefined;
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
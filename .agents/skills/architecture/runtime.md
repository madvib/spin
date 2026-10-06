# The component runtime

Sail's directive model, carried over. A component is markup with directives;
the runtime is the set of primitives those directives resolve to.

```
src/
  signal.ts      reactive core: signal, computed, effect, batch, untrack
  scope.ts       EffectScope, withScope, onCleanup, renderInScope
  action.ts      use:
  on.ts          on:, with the modifier pipeline
  bind.ts        bind:, interpolation
  for.ts         for: keyed reconciliation
  if.ts          if: branch swap
  element.ts     custom-element registration
  component.ts   props: schema, decoders, accessors
  zag.ts         the machine bridge
  internal.ts    the compiler ABI surface
  index.ts       the author surface
```

## Scope

Every component instance gets an `EffectScope`, parented into the DOM tree so a
child's lifetime nests inside its parent's. Disposal runs cleanups in reverse
insertion order.

```ts
interface EffectScope {
  run<T>(fn: () => T): T
  dispose(): void
}
function withScope<T>(scope: EffectScope, fn: () => T): T
function onCleanup(fn: () => void): void
function renderInScope<T>(scope: EffectScope, fn: () => T): T
```

`effect()` created inside a running computation enrolls its disposer on the
current scope. Setup-time effects are owned by the mount scope.

## `use:` — actions

The element→behaviour primitive. Replaces a ref plus a hand-written effect.

```ts
interface ActionResult<P> {
  update?(param: P): void
  destroy?(): void
}
type Action<P> = (node: Element, param: P) => ActionResult<P> | void
function runAction<P>(node: Element, action: Action<P>, paramThunk?: () => P): void
```

`runAction` creates one effect that reads `paramThunk`. First run calls
`action(node, param)`; a later run calls `result.update(param)`. `destroy` is
enrolled on the surrounding scope, so the action tears down with the component.

## `on:` — events

```ts
type Modifier =
  | { kind: "preventDefault" | "stopPropagation" | "stopImmediatePropagation"
      | "self" | "trusted" | "key" | "debounce" | "throttle"; arg?: string }
interface OnOptions {
  modifiers?: Modifier[]
  capture?: boolean
  passive?: boolean
  once?: boolean
}
function on(el: EventTarget, event: string, handler: (e: Event) => unknown, opts?: OnOptions): Disposer
```

`on()` attaches a real listener immediately and returns a `Disposer` that
removes it and cancels pending debounce/throttle timers. It does **not**
self-enroll — the caller pushes the disposer onto the scope. That asymmetry
with `runAction` is deliberate: an event handler is often registered and
removed by something that is not an effect.

## `bind:` — data

```ts
type Disposer = () => void
function bindText(node: Node, get: () => unknown): Disposer
function bindAttr(el: Element, name: string, get: () => unknown): Disposer
function bindProp<T extends Element>(el: T, prop: string, get: () => unknown): Disposer
function bindDynamic(el: Element, name: string, get: () => unknown): Disposer
function bindValue(el: Element, sig: Signal<string>, onWrite?: (v: string) => void): Disposer
function bindChecked(el: HTMLInputElement, sig: Signal<boolean>): Disposer
```

Each binder wraps its read in an effect and writes to the DOM on change, and
returns a `Disposer`.

`bindDynamic` decides the channel **once at bind time**: a custom element with a
declared prop, or a value that is not a string, goes to `bindProp`; otherwise
`bindAttr`. The author never chooses.

`bindAttr` has presence semantics: `null`, `undefined`, `false` and `""` remove
the attribute; `true` is presence-only; anything else is `String(value)`.

**`aria-*` is the exception, and it is not a detail.** `aria-expanded="false"`
is a real, required value. A binder that treats every boolean as presence tells
a screen reader nothing about a collapsed branch.

## `for` — keyed lists

```ts
interface RenderedItem {
  nodes: Node[]
  cleanup?: () => void
  update?: (item: unknown, index: number) => void
}
interface BindForOptions<T> {
  anchor: Comment
  items: () => readonly T[]
  key: (item: T, index: number) => unknown
  render: (item: T, index: number) => RenderedItem
}
function bindFor<T>(opts: BindForOptions<T>): Disposer
```

One effect reconciles. Each pass removes missing keys, reuses matched keys
(calling `update` when the item or position changed), renders new keys in fresh
scopes, then places nodes with a longest-increasing-subsequence pass so
surviving nodes are not moved.

**Each row renders in its own scope**, disposed when the row is removed. A
row's bindings must not tear down because the reconciler re-ran.

Keys must be stable and unique; a duplicate key warns once per render.

## `if` — branches

```ts
interface BranchRender {
  nodes: Node[]
  cleanup?: () => void
}
interface BindIfOptions {
  anchor: Comment
  test: () => number
  branches: Array<() => BranchRender>
}
function bindIf(opts: BindIfOptions): Disposer
```

One effect reads `test()`, returning the branch index or `-1` for nothing. On
change it tears down the active branch, renders the new one **in its own
scope**, and inserts before the anchor.

The multi-branch shape is the only shape. A two-branch `if` is a two-element
`branches` array, so there is no second code path to keep in step.

## Props

```ts
interface ComponentSchema {
  observedAttrs: string[]
  props: Record<string, { camel: string; decode: (raw: string | null) => unknown }>
}
type ComponentFactory = (
  host: HTMLElement,
  propSignals: Record<string, Signal<unknown>>,
) => Disposer
function defineComponent(tag: string, schema: ComponentSchema, factory: ComponentFactory): void
```

On connect: seed prop signals from attributes via the decoders, run the factory
inside the instance scope, flush any prop writes that landed before connect. On
disconnect: run the factory's cleanup and dispose the scope.

A property-typed prop is not observed as an attribute; it gets a signal and an
accessor on the element.

## Two surfaces

```ts
// internal.ts — the compiler ABI. Directives, binders, scopes, reconciliation.
// index.ts    — the author surface. signal, effect, scope, define, component.
```

The compiler imports `/internal`. Authors import the root. A symbol on both is
a symbol nobody decided the tier of.

## What is not built

The runtime today is `signal.ts`, `element.ts`, `zag.ts` and `index.ts`.
There is no `action.ts`, `on.ts`, `bind.ts`, `for.ts`, `if.ts`, `scope.ts` or
`component.ts`; `element.ts` takes a `build(context)` function that calls
`document.createElement` by hand. The directive layer above is the target, and
the rules in `SKILL.md` are what the target has to satisfy.

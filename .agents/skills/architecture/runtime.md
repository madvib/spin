# The component runtime

## What this is

The runtime is a **compilation target**, not a library with an API. Sail names
its emitted surface exactly that — *"THE COMPILER'S ABI. Not the language."*
— and the distinction is load-bearing:

- A **contract** is negotiated between two parties that both exist and can
  change. Nobody "negotiates" with a compiler target.
- An **ABI** is one-directional, curated and frozen. The emitter writes calls
  into generated code; the runtime never learns the emitter exists. Changing
  the ABI invalidates already-emitted artifacts, which is why it is curated
  rather than a total re-export of the author surface.

So the ABI's shape is decided by **what is convenient to emit**, not by what is
pleasant to call. Positional arguments over options objects. One shape where
there could be two. Closures the emitter can generate mechanically. No
overloads, no optional-callback magic, no types a framework would supply.

## Who emits

Two producers, one ABI:

| producer | emits | today |
|---|---|---|
| the template compiler | `bindText`, `bindFor`, `bindIf`, `on`, `runAction` | not built |
| the Zag bridge | the same, from a prop bag | `zag.ts` |

The second is the one to notice. `connect()` hands back a bag like
`{ role, id, tabIndex, "data-state", onFocus, onClick }` — attributes, a
property, and handlers. That is a binding program, written by Zag instead of by
our compiler. It should flow through the same bindings as compiled markup
rather than through an ad-hoc `apply()` beside them.

## Division of labour

**The emitter owns structure; the runtime owns lifetimes and the DOM.**

The emitter decides what elements exist, where the anchor comment goes, and
what a row's nodes are. It never calls `addEventListener`, never creates an
effect, never disposes anything. Every call it emits returns a `Disposer`, and
the runtime enrolls it on the enclosing scope.

That is why `bindFor` takes `render: (item, i) => RenderedItem` rather than a
template: the emitter knows the row's markup, the runtime knows when the row
dies.

## Modules

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
  internal.ts    the ABI
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
function on<E extends Event = Event>(
  el: EventTarget,
  event: string,
  handler: (e: E) => void,
): () => void
```

**No modifiers.** `on:click|preventDefault` was in an earlier draft of this
document, lifted from a different Sail. The runtime we are actually built
from removed modifiers on purpose:

> An author who needs to stop propagation writes `e.stopPropagation()`, which
> says what it means and composes with whatever else they do there. A modifier
> is the framework guessing, in a fixed vocabulary, what you would have
> written — and the vocabulary is always one short.

That reasoning holds here. A modifier list is a second language for things the
event object already expresses, and it is always missing the case somebody
needs.

The handler is attached directly and the returned function removes it. A
handler that throws is caught and reported to the boundary that was rendering
when it was attached — captured then, not at fire time, because by the time
the user clicks the component has finished rendering and the stack it
registered on is empty.

## A machine is an action

```ts
function useMachine<S, C>(
  create: (options: C) => MachineService<S>,
  connect: (service: MachineService<S>) => MachineApi<S>,
  options: () => C,
): (state: Signal<S>) => ElementAction<C>
```

A component writes `use:tree` and learns nothing else. Whether the thing
behind it is a Zag machine, a hand-written reducer, or nothing at all is the
action's business, and it can change without a component changing.

That is why the machine is **not** spread into the DOM by the component. A
component that calls `getPartProps()` and applies the result has made the
machine the centre of the component; the action boundary puts it back where
it belongs, as one thing an element uses.

The bridge is one line and it is the whole trick: **a machine's state is not
a signal, so the machine pushes into one.** Everything downstream — bindings,
control flow, the parts a template registered — then behaves exactly as it
does for any other state, and no part of the runtime needs to know a machine
exists.

Two constraints that are not obvious until they bite:

- **The API is built in the action's factory, not its body.** A template
  renders before any action runs, so an action that publishes on attach
  leaves the first render reading `undefined` and the component fails on load.
  The action still owns the machine's lifetime; the construction just moves.
- **Zag's `connect` reads the context once and closes over it**, so its
  top-level fields are snapshots. Zag's *methods* are already live, because
  they are `computed(...)` and re-evaluate. So the connect is re-made per
  read, a field becomes a reader, and a method is applied to a fresh connect
  rather than handed back from a captured one — which is the same defect one
  level down.

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

## The ABI boundary

```ts
// internal.ts — the ABI. Directives, binders, scopes, reconciliation.
// index.ts    — the author surface. signal, effect, scope, define, component.
```

The emitter imports `/internal`. Humans import the root. **No human types
`bindFor` or `runAction`** — they exist to be written into generated code.

`internal.ts` is a curated list, never `export * from "./index"` alone. A
missing ABI export must be a compile error in the emitter rather than a silent
re-export of whatever the root happens to carry. Adding a symbol means adding
it here **and keeping it off the root**.

This boundary is the one place a guard is worth its keep: it is a real seam
between two programs, and both sides can be pinned — every ABI symbol is
reachable from `/internal`, and none of them leaks onto the root. That is a
test over two lists the runtime already exports, not a script parsing files.

## What is not built

The runtime today is `signal.ts`, `element.ts`, `zag.ts` and `index.ts`.
There is no `action.ts`, `on.ts`, `bind.ts`, `for.ts`, `if.ts`, `scope.ts` or
`component.ts`; `element.ts` takes a `build(context)` function that calls
`document.createElement` by hand. The directive layer above is the target, and
the rules in `SKILL.md` are what the target has to satisfy.

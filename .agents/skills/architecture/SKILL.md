---
name: architecture
description: The shape of spin and the rules that hold it together. Use when adding or moving a concern, deciding where code belongs, adding a runtime directive, building a component, or reviewing a change against the architecture.
---

# Architecture

## What spin is

A verification layer and primitives for agent-authored UI. A closed token
vocabulary, a utility layer that consumes it, a component runtime that turns
state machines into styled DOM, and oracles that check the result.

Everything here exists because of that:

- **a token pipeline** — because a design decision that cannot be named cannot
  be verified
- **a utility layer** — because classes are the only styling surface a build
  tool can see
- **primitives** — because `<button>` should be a finished control without an
  author writing anything
- **a component runtime** — because a state machine needs somewhere to live
  that is not a framework
- **a lint** — because the rules have to be enforceable against authored code,
  not asserted after the fact

## The layers

```
@spin/theme       tokens: parse, validate, mutate, emit CSS variables
@spin/preset      utilities + primitives over the theme
@spin/runtime     the component runtime: signals, scopes, directives, props
@spin/components  state machines as components, using the runtime
@spin/lint        enforcement: authored code stays inside the system
```

Dependencies point one way: `theme` → `preset` → `runtime` → `components`.
`lint` reads `theme` and `preset`; nothing reads `lint`.

## The runtime

The runtime carries Sail's lineage. A component is not a `build()` function
that calls `document.createElement`; it is **markup with directives**, and the
runtime is what those directives compile to.

| directive | ABI call | owns |
|---|---|---|
| `use:action` | `runAction(node, action, paramThunk?)` | element → behaviour |
| `on:event={fn}` | `on(el, event, handler)` — no modifiers | event |
| `bind:name={expr}` | `bindValue` / `bindChecked` / `bindAttr` | two-way state |
| `{expr}` | `bindText(node, () => expr)` | interpolation |
| `<if cond={}>` | `bindIf({ anchor, test, branches })` | branch swap |
| `<for as of key={}>` | `bindFor({ anchor, items, key, render })` | keyed list |
| props | `define(tag, spec)` — a host sets properties | host boundary |

**A machine is an action.** `use:tree` — the element learns a name, and
whether a Zag machine is behind it is the action's business. The bridge is
that the machine pushes its state into a signal, so nothing downstream knows
a machine exists. A component that spreads a prop bag has made the machine
the centre of the component; the action boundary puts it back.

The runtime is a **compilation target**, so this table is an **ABI**: curated,
frozen, and shaped by what is convenient to emit rather than by what is
pleasant to call. Its two producers are the template compiler and the Zag
adapter, and both go through the same actions and bindings. See
[runtime.md](runtime.md).

## The components package

A component is an **anatomy map**: one entry per part of the machine's
anatomy, naming the element and the utilities the part needs beyond what its
primitive already gives it. Zag's anatomy is literal-typed, so a missing part
is a compile error.

See [components.md](components.md).

## Rules

1. **Directives never allocate per render.** A reconciler reuses its scratch
   structures across passes; a binder short-circuits on `Object.is`.

2. **Props are properties, not attributes.** An attribute is a string; a
   machine needs objects, arrays and functions. Attributes are supported for
   the primitives that genuinely are strings, and land in the same live prop a
   property write would.

3. **Effects enroll on the enclosing scope.** An effect created inside a
   component belongs to that component's scope and dies with it. A component
   that outlives its element is the failure the runtime exists to prevent.

4. **Each control-flow child owns its scope.** A `<for>` row and an `<if>`
   branch render in their own scope, disposed on removal. A row's bindings tear
   down when the row leaves, not when the reconciler re-runs.

5. **The DOM is built once and patched.** A state change updates props and
   attributes in place. Rebuilding destroys elements between the events acting
   on them — a `focus` that fires before a `click` is enough to swallow the
   click.

6. **`use:` is the element→behaviour primitive.** An action takes
   `(node, param)` and returns `{ update?, destroy? }`. It replaces a ref plus
   a hand-written effect for the element-behaviour category.

7. **Two surfaces, never one.** The compiler and the runtime import from
   `/internal`; authors import from the package root. A symbol reachable from
   both is a symbol nobody decided the tier of.

8. **One signal graph.** The runtime warns when it loads twice. A second copy
   means two graphs and effects that never fire.

9. **A component names no host concept.** A component does not know whether it
   runs in a page, a worker or a test. Anything it needs from the host arrives
   as a capability, never as an ambient import.

10. **Elements are the author's choice.** A component names the element for
    each part; it does not hide the choice behind a wrapper tag. The tag is
    what the preset styles, so the tag is the contract.

11. **Styling is the preset's, plus utilities for the delta.** A component
    reaches for a primitive first. Where the context genuinely differs it
    states utilities — themed — rather than adding a rule to the preset.

12. **Enforcement is lint and types, not scripts.** An invariant expressible in
    the type system or by construction is not checked by a program that runs
    after the fact. A rule about authored code belongs in `@spin/lint`.

## Comments

Terse and professional. A comment describes the thing it annotates: a
precondition, a consequence, a reason the code cannot state itself.

It does not narrate a decision, ask a question, record a change, or refer to
another module, a file, an application, or a conversation. It does not restate
the path of the file it sits in.

A file header says what the file is, in one line, and stops.

## Documentation

None. No README, no docs directory, no architecture documents. This skill is
the exception and the limit: it states rules, and every rule is checkable.

Reasoning that does not become a rule does not get written down. If a decision
needs a paragraph of justification it belongs in a commit message, which is
where history lives.

## Working concurrently on one tree

**Never `git stash`.** It mutates shared state; a `pop` whose `push` did
nothing consumes a bystander's entry and neither command reports it. To compare
against a baseline, read it: `git show HEAD:path > /tmp/baseline`.

**Never `git add -A`.** It sweeps in files another agent is mid-way through
writing. Stage the paths you own, by name.

**Verify a ref by resolving it.** `git tag <name>` with no target points at
HEAD and protects nothing. Resolve it and confirm the subject.

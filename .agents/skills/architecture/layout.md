# Deciding where code goes

Most mistakes here are placement mistakes: a runtime concern inside the preset,
a component's styling inside the preset, a demo at the repository root.

## Three questions, in order

**1. What is this about?** Name the concern. If the answer is "the preset and
the runtime", it is two things.

| it is about | it goes in |
|---|---|
| a token, a scale, a theme document | `@spin/theme` |
| a utility, a primitive, a claim on an element | `@spin/preset` |
| signals, scopes, directives, props, machines | `@spin/runtime` |
| one state machine's anatomy | `@spin/components` |
| whether authored code is allowed to say something | `@spin/lint` |

**2. Does it name a realm?** A `document`, a `window`, a `MutationObserver`, a
`fetch`. Runtime code that touches the DOM is fine — that is the runtime's job
— but it belongs in the runtime, not in the preset or the theme. A file that
would break in a worker is in the wrong package regardless of how it is
spelled.

**3. Is it shared?** Two concerns need it and neither owns it — the runtime's
signal core is the one such thing. Otherwise it belongs to one package and
reaches the other through that package's `index.ts`.

## Where things are

```
packages/
  theme/         tokens
  preset/        utilities + primitives
  runtime/       the component runtime
  components/    state machines as components
  lint/          enforcement
  api/           the contract surface a studio or MCP reads
apps/
  studio/        a program
  docs/          a program
```

A demo lives beside the package it demonstrates (`packages/components/demo/`)
or is an app. **Never at the repository root.** A root-level demo has no owner,
so it drifts, and it sits where a reader looks for structure.

## The arguments

**"It is used by three modules, so it must be shared."**
Fan-in is not ownership. The signal core is imported by everything and belongs
to exactly one place. Fan-in means the shape is widely assumed — a reason to be
careful with it, not a reason to promote it.

**"It is only a type, so it does not couple us."**
It couples harder. A shared function has a signature somebody can extend; a
shared type is a contract the owner can rewrite and every consumer moves.

**"It is small, so it can live anywhere."**
Small and shared is the worst combination: it will be depended on and it will
not be maintained, because nobody who owns it is looking at it.

**"The component needs a style, so the preset should get a rule."**
The preset styles elements, for everyone. A component's delta is the
component's, and it states it as utilities. A rule added for one component
lands on every document that uses the preset.

**"It is just a demo."**
A demo is the runnable proof of a claim. It belongs to the thing it proves, and
it is the first thing to rot when it does not.

## Extraction

A package earns its own directory when it has an owner, a public surface, and a
rule that a rename would break. `@spin/components` qualifies: its rules are
about machines and anatomy, which nothing else in the repo knows about.

The ordering follows the dependencies. The runtime's directive layer comes
first, because every component is written in it; the components package follows
and proves it.

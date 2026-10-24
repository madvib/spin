# The gate: what it found, and what it is

## The gate

`packages/components/src/twins.test.ts` — 19 tests, one per component that
declares a default.

**The claim it checks:** the `value`/`defaultValue` twin is the framework's
convention — the host writes `value` to OWN a value, `defaultValue` to SEED it
once. A scope's declared default (`props={ defaultValue: string = "[50]" }`) is
that seed, so it must land in the machine exactly as an authored `value` of the
same value lands.

**Why it is written the way it is:** the table is the corpus's own. The scope
decls are read from each component's `examples/`, the defaults are coerced by
the runtime's own `coerceProps`, and the two mounts are compared field by field.
No per-component table of expectations to keep in sync, and a new component is
covered the moment it declares a default.

**The comparison is the whole API.** The api's data readers are what a consumer
sees, so "the declared default reaches the machine" is exactly "the api reads
the same as it would with the authored twin". A per-field diff names the field
that diverged, so a failure says what broke.

## What it found

**A real bug, in the number-input.**

```
number-input: the declared defaultValue reaches the machine
  value: "" != "3"
  valueAsNumber: null != 3
  empty: true != false
```

The number-input's scope declares `defaultValue: string = "3"`. The machine read
`""` — the declared default never arrived. The host's _authored_ `value` worked;
the _declared_ default did not.

**Why.** The framework resolves the twins before the machine's factory is called
(`bridge.ts:308`), so the arguments a machine receives carry the twin — and the
machine's own gate
(`authored(field) || authored(defaultTwin(field)) || args[defaultTwin(field)] !== undefined`)
finds it there.

The number-input is the **last component on the legacy path**: it has a
hand-written bridge (`number-input.bridge.ts`) instead of the standard
`machine:` factory. Its `readArgs()` **narrows** the prop bag into
`NumberInputArgs`, and the narrowing dropped `defaultValue` — so the machine's
gate could not see the twin, and the value it had been handed was discarded.

**The fix**: the arguments carry the twin. `NumberInputArgs` declares
`defaultValue`, and the bridge passes it through. Two files, ten lines.

**Why the legacy path is the culprit.** Every component on the standard path
passes the whole (twins-resolved) bag to its factory, so the twin is always
there. The legacy path narrows the bag, and a narrowed bag can drop the very
field the machine's gate reads. The narrowing was the bug's home.

## The other gate hole: the reactivity one

The handoff claimed: "the unit harnesses flatten the signals, so the reactivity
is never exercised by a unit test."

**Measured: the premise is false.** The reactivity _is_ exercised —
`number-input.machine.test.ts:866` writes `value` after the mount and asserts
the machine follows it, and that test passes.

**What is true is narrower, and it is a real trap.** The bridge's effect
subscribes to the props the _element's_ store holds, and the element's store
creates a signal per prop **on first read**. A prop the harness creates _after_
the bridge connected is a new signal the effect never subscribed to, so the
write is invisible. The element does not have this problem because the plugin's
`seedProps` block reads every declared prop before the bridge connects.

**So the trap is:** a unit test that writes a prop the harness did not seed
cannot observe the machine move, and the failure looks like a machine bug rather
than a harness one.

**The measure of it:** 11 of the 31 harnesses write a prop after the mount. In
all 11 the prop was seeded before the bridge connected, so all 11 are fine — **0
harnesses have an undeclared post-mount write**. The trap is un-triggered today;
it is a trap, not a bug.

**The fix, when it is worth it:** the harness should create the prop's signal
before the bridge connects, the way the element does. That is a per-harness
change (31 files) for a trap nobody has hit — so it is worth doing _with_ the
harness consolidation, not before.

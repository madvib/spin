Two findings from the parent that will make or break the derived key.

**1. `String(value)` is the wrong comparison.** The current
`readsKey` does `String(ctx[field])`. An OBJECT-valued field is always
`"[object Object]"`, so the key cannot see it change. There are **66
distinct object-valued context fields** in the corpus (`value` 10×,
`highlightedValue` 5×, `items` 3×, `order`, `labels`, `toasts`, `queued`,
`expandedValue`, `selectedValue`, `steps`, …).

Compare a field by **identity** for objects and by **value** for
primitives — not by `String()` for both. The machine's `fold` replaces
the context object on every write (`{ ...context, ...assign(...) }`), and
the assigns produce NEW arrays/objects, so a field's identity is a fine
proxy for "it changed".

**2. The sigs read DERIVED values, not fields.** They are not
`scope.context.value` but `scope.context.value.length === 0`, and
`scope.context.expandedValue.includes(row.node.value)`, and
`scope.context.selectionMode`. A derived key that records the FIELD
(`context.value`) and compares its identity is at least as precise as
the sig — MORE precise, in fact: it rebuilds when the array is replaced
even if the length is unchanged. That is safe (a rebuild is never wrong),
and it is what you want.

**⇒ The requirement is: the derived key must be at least as PRECISE as
the sig it replaces.** Where the sig read a derived value, a field-level
key that compares identity is stricter, and stricter is safe. What is NOT
safe is the current `String()` comparison, which is LOOSER than the sig
(it cannot see an object field change at all) — that is a real bug in the
current derived key, and it is why the sig is still load-bearing for the
66 object-valued fields.

**3. The whole-object read (216 sites).** `const ctx = scope.context;`
then `ctx.foo` — the proxy is passed along, so the member read IS
recorded. That is fine. But `scope.context` read and then only
`ctx.someField` — recorded. Good.

**BUT**: the sigs ALSO read the whole context in a way the derived key
cannot see. Look at
`packages/components/src/spin-tags-input/tags.bindings.ts:522`:
`scope.context.value.length === 0` — the derived key would record
`context.value` and compare identity. Fine.

And `packages/components/src/spin-tree-view/tree-view.bindings.ts:540`:
`scope.context.expandedValue.includes(row.node.value)` — the derived key
records `context.expandedValue` and compares identity. Fine.

So: **a field-level key with identity comparison for objects is at least as
precise as every sig in the corpus.** The design should be: the scope
records the FIELDS it exposes (context, props, state, slot), and the key
compares those fields' values — by identity for objects.

**4. The state and the slot.** `scope.state` is the machine's STATE NAME
(a string) — the state is read 273 times. It must go into the key.
`scope.slot` is the host's row data (a plain object) — the SLOT IDENTITY
already distinguishes rows (the memo is a WeakMap keyed by the slot), so
the key needs the slot's FIELD VALUES. The slot's fields are read through
`scope.slot.X` — 40 such reads, on 11 distinct field names (`value`,
`type`, `id`, `beforeId`, `afterId`, `label`, `depth`, `shortcut`,
`separator`, `index`, `checked`).

**⇒ The scope must expose the slot through a recording proxy too**, the way
it exposes the context and the props — so `scope.slot.value` records
`slot:value` and the key compares that field's value.

**5. The tour's spotlight** (`viewOf(root).spotlight`) is a WeakMap
beside the machine — genuinely outside. It is the tour's own state (the
resolved target's geometry), so it belongs in the tour machine's context.

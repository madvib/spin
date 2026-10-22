# The `sig` removal — what works, and the wall

**Status: reverted. The tree is green at `07e881b` with the 284 `sig`s still
in place. Nothing from this work is committed.**

## The goal

Every part and slot wrote a `sig` — a hand-written list of "the things I
read":

```ts
sig: (scope) => [scope.state, scope.props["disabled"], scope.props["readOnly"]].join(" "),
```

**284 of them.** A manual dependency tracker in every part, in every
component. Miss one field and the DOM goes stale — a real bug class, not a
style preference.

The intent: **the bag's key is derived from what the build read**, so a part
cannot forget to name a field it depends on. And `sig` goes from the type
entirely — not optional, not a shim. Pre-release: no legacy.

## What works (proven, twice)

**The scope's context and props are already signals**, so the dependency can
be tracked by the read itself:

- the scope's context proxy records every field it reads (`record("context",
  key)`);
- the scope's props proxy records every prop;
- the scope's `state` getter records the state;
- the scope's `slot` getter records the slot.

**The key is composed from those records** — the context's fields by value
(or by version, for an object field, whose stringified value is
`"[object Object]"`), the props by value, the state, the slot, and the
part's argument.

**The unit suite: 959 green** with the sigs removed from all 31 components
(**−851 lines**).

## The wall: the scope does not expose everything a build can read

Four suites regressed: the **combobox**, the **menu**, the **toast**, the
**tour**.

| key | the failures | why |
|---|---|---|
| the fields the build read | combobox, menu, tour | a build reads a value the scope does not expose — a helper that takes the whole context, or the root |
| the whole context | toast | the toast's entries carry a countdown, so the context changes every tick and the bag re-stamps on every tick — and the click is lost |
| the fields the build read, **plus the slot's identity** (not its content) | toast ✓ | the slot's identity is already the memo's key (the WeakMap's key), so its content is not a dependency |

The best configuration found: **the fields the build read, plus the whole
context, plus the slot's identity instead of its content** — that fixed the
combobox, and broke the toast and the tour.

## What the fix actually is (in the components, not the runtime)

**The state a part depends on must be IN the machine's context, or IN the
scope's surface.** Concretely:

- **the tour**: the spotlight's geometry lives in a `WeakMap` beside the
  machine (`viewOf(root).spotlight`). **It is UI state, and the machine
  should own it** — then the derivation sees it and the `sig` goes.
- **the combobox / the menu**: the panel's open-ness and the submenu's
  open-ness are the same shape — a state the bindings own because the
  machine does not.
- **the toast**: the countdown belongs to the **timer**, not to the toast
  entry. With the countdown out of the entries, the entries stop changing
  every tick and the fine key stops churning.

**⇒ The `sig` is not the disease. The state that lives outside the machine
is.** The `sig` was the author's way of naming a dependency the framework
could not see.

## The recommendation

1. **Move the three states into their machines** (the tour's spotlight
   geometry, the combobox's and the menu's open-ness, the toast's
   countdown → the timer). Each is UI state the machine should hold.
2. **Then the derived key is complete**, and `sig` leaves the type
   entirely — not optional, not a shim.
3. The mechanism is proven; the runtime work is small (the key's
   composition, the recording).

**One thing to keep:** the finding that a *slot's identity* is the memo's
key and its *content* is not a dependency — a row whose content ticks (a
countdown) must not re-stamp on every tick, or the click is lost.

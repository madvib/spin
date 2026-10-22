# The machine architecture

The spec of record. It carries the *intent*; the code carries the *state*.

**Branch:** `migration/bindings-grammar`. **Baseline:** 36/36 e2e, 985 unit
tests, `deno check` clean.

| | base `a9b490e` | now | Δ |
|---|---|---|---|
| the library (`packages/components/src`) | 51 338 | 48 228 | **−3 110** |
| the runtime (`packages/runtime/src`) | 6 507 | 7 573 | +1 066 |
| **net** | | | **−2 044** |

The library's cuts: the transport (−2 162), the prose pass (−2 104), the
canonical elements moved to the playground (−1 156), the examples' shared
markup (−1 228), the `sig` removal (−868), the authoring API's event map
(−523).

---

## 1. The three layers

| layer | lives in | may know about |
|---|---|---|
| **machine** | `spin-x.machine.ts` | state, transitions, its own arguments. **Nothing else.** |
| **bindings** | `spin-x.bindings.ts` | the DOM contract: parts, slots, commands, readers. Reads the machine's state. |
| **markup** | `examples/*.html` | the brand: classes, layout, copy. Spreads the api's bags. |

### The machine is HEADLESS

A **logic unit**: not a DOM node, never in a layout tree, no awareness of
markup, web components, props, scopes, or the DOM. It is a **TS function,
instantiated with arguments**.

One machine's *code* serves N components; each consumption is an
*instance* with its own state. That is why it must be headless: a machine
that owned its element could only ever power one.

### One vocabulary: the arguments ARE the props

There is no second concept called "parameters". A machine is a function; its
arguments are its inputs; the element's props are how those inputs arrive.

```ts
export function treeView(args: TreeViewArgs = {}): Machine<TreeContext, TreeEvent> {
  return createMachine<TreeContext, TreeEvent>({
    context: {
      expandedValue: args.expandedValue ?? [],
      selectedValue: args.selectedValue ?? [],
      focusedValue: null,
    },
    initial: "idle",
    states: { ... },
  });
}
```

**Rejected:** a `parameters: { x: { type, default } }` descriptor beside the
context (the same fact twice, and the two can disagree); a `param()` helper
marking which context fields are settable (the same mistake in another
costume).

### What a machine may not contain

- prop parsing, prop names, attribute coercion
- a `defaultValue` / `value` twin convention (that is the *framework's*)
- any reference to a part, a slot, an id, or the DOM
- effects (stripped; Zag has them, we do not)

---

## 2. The machine's contract

**The machine declares the context fields a host may write, and the event
each write carries.** One map, on the machine:

```ts
fields: {
  value: { event: "SET_VALUE" },   // REPORTED: the write is an event
  count: { event: "SET_COUNT" },
  step: {},                        // SILENT: the write lands in the field
}
```

- A field **with** an event is *reported*: the host's write is an event, the
  machine decides, and the change reaches the host.
- A field **without** one is *silent*: the write lands in the field, and
  nothing reports.

**The framework applies the contract**, and owns:

| rule | what it does |
|---|---|
| the twin | `value` falls back to `defaultValue` when the host wrote neither |
| the reported field | a host write sends the field's event; the machine's assign shapes the payload |
| the silent field | a host write lands in the field, shaped by the machine's `parse` |
| the start | the factory receives the props with the twins resolved, so a channel the host did not write leaves the machine's own default standing |

**The element declares nothing** about the machine: it declares its own host
API and which of its props feed which of the machine's arguments.

---

## 3. The reactive core

**Values that cross into the DOM are signals. Values that cross as calls
are not.** A prop write is a signal write; `send()` is a call.

| | mechanism | why |
|---|---|---|
| the element's props | **signals** (the scope table) | a host write is a signal write |
| the machine's context | **signals** (a mirror of the machine's fields) | fine-grained: only the parts that read a field rebuild |
| the api | a **proxy** over the live state | always current; no snapshot to go stale |
| the machine's events | **plain calls** | a send is an invocation, not a value |
| the DOM | the **platform** (attributes, spreads) | the markup spreads the bags; the browser does the rest |

**The mirror is the single writer.** It writes the signals after every move,
after the contract's silent writes, after the reconcile, and at the start. A
read never writes, so a read cannot loop.

**The bag's key is derived from what the build read** — the context's fields
(by *version*, so an object field is tracked too), the props, the state, and
the slot. **So a part cannot forget to name a field it depends on: it never
names one.** The hand-written `sig` is gone (284 of them).

---

## 4. The scope

The scope is the element's markup block. Today it is a mini-DSL:

```html
<scope>props={ label: string = "Date", value: string = "" } consume={ dateInput }</scope>
```

**That mini-DSL is the untyped hole**: `string`, `bool`, `int` are *strings*,
so the value that arrives is a string, and every component re-derives the
real type by hand. The fix is not a grammar for the machine — it is a **real
type for the element's props**, read by the compiler, with the coercion
derived from the types. Then the props arrive typed at the element's
boundary, the element forwards what it wants (typed), and **the machine
parses nothing, ever**.

**The plan for it:** the scope becomes a `<script>` region whose body is
TypeScript, with a sanctioned API only:

```html
<script>
const tree = consume(treeView)
</script>
```

- `props({...})` — the element's own dependency list (the brand's extras
  beyond the machine's arguments).
- `consume(machineFactory)` — bind this markup to a machine.

**The restriction that makes it safe:** the region may not gain effects. The
compiler admits only the sanctioned calls and their results; anything else
is a **compile error**, not a lint warning. That is what makes it safe to
inline into a per-instance build and to compile ahead of time.

**The extension:** `.html` gives us HTML highlighting for free; the day the
markup carries TypeScript, that grammar is *wrong* for the file. `.spin`
becomes worth it when we have a `.spin` grammar and the TS is a real
fraction of the file. The rename is one glob + 8 files + 241 `git mv`s — an
afternoon, late, once.

---

## 5. The plan, wide

Each pass is a category of change across the corpus, gated by the 36 e2e
suites and the unit tests, with the delta reported per pass. **Depth-first is
what got us here: 30 of 31 components were on the legacy path for days.**

| pass | what | state |
|---|---|---|
| **1. The machine is a headless factory** | the args are the props; the reference html and the shims die | **done** |
| **2. The contract is the machine's** | the per-component `scalars`/`reconcile` die; the framework owns the transport | **done** |
| **3. The CSS-var bus dies** | the geometry rides the bag's style object; the markup names no var | **done** |
| **4. The prose pass** | the comments that restate the code go | **done** |
| **5. The authoring API** | the events are a MAP; the transition's key narrows the event, so the guards and the hand-written unions go | **done** (−523) |
| **6. The twin gate** | a scope's declared default must reach the machine | **done** — and it found the number-input's dropped default |
| **7. The `sig` dies** | the bag's key is derived from the build's reads | **done** (−868) |
| **8. The ARIA primitives** | a menu trigger's ARIA belongs to the primitive, not to 35 components | **next** |
| **9. The scope is a `<script>`** | TS in the markup; the props' types are real types | **last** |

### The duplication this kills (measured)

| | count | lines |
|---|---|---|
| per-machine `initial()` | 29 | 542 |
| `*Initial` interfaces | 29 | — |
| `seed` / `scalars` / `scalarsOf` | 30 / 20 / 2 | — |
| `reconcile` (the host-writable half) | 27 | — |
| `machine-def.ts` shims | 32 | ~450 |
| the reference `.html` files | 34 | ~1 100 |
| hand-written `sig()` | 284 | ~570 |
| the event-type guards | 123 → **33** | ~370 → ~100 |
| the parsing helpers | ~30 × 25 | ~750 |
| the deep-equality helpers | ~10 | ~200 |
| the hand-written event unions | 30 → **0** | ~600 → 0 |

**≈ 2 500 lines of deletion available, against +826 already spent in the
runtime.**

---

## 6. The open questions

1. **The element's prop declaration** — the scope's mini-DSL is the untyped
   hole; the fix is a real TS type per element, read by the compiler. This
   is the biggest single decision left.
2. **The contract's state channels** — 14 `reconcile` blocks remain for props
   that drive the machine's *state* rather than a field (`open`, `stage`).
   The contract carries one event per *field*; it needs a state channel too.
3. **The machine-object shape** — the contract travelling with the machine,
   so the framework gates the args before the factory and the machine's
   `initial` loses its authored-gating. ~400 lines and one fewer concept.
4. **The three states outside their machines** — the tour's spotlight
   geometry, the combobox's and the menu's open-ness, and the toast's
   countdown. They are the blocker on the `sig` dying.

**Solved: the authoring API's shape.** The design is in
`authoring-api-codemod.md`: the events are a MAP, and the transition's
KEY narrows the event — so the narrowing needs no helper, no closure over
the spec's types, and no double-write of the event name. The blocker the
question described (a standalone `assign("X", fn)` cannot infer the
machine's event type) dissolves: the key IS the inference site.

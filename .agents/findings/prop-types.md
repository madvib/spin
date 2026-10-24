# The element's prop types: the measurement, and the shape of the fix

**This is the biggest single decision left.** The measurement below is mine, and
it CORRECTS the queue's premise ("kills the 37 parsing helpers" — it is not 37).

## What the stringly system costs today

| the measure                                          | the count                                                  |
| ---------------------------------------------------- | ---------------------------------------------------------- |
| the scope decl's prop declarations                   | **708** (562 `string`, 105 `bool`, 39 `int`, 2 `string[]`) |
| the prop reads in the bindings                       | **607**                                                    |
| the INLINE narrowings at a prop read                 | **326**                                                    |
| — of those, `=== true` / `=== false`                 | 299                                                        |
| — of those, `typeof … === "string"`                  | 27                                                         |
| the type-narrowing helpers                           | **32**                                                     |
| the VALUE-parsing helpers (a typed prop KEEPS these) | 19                                                         |

**⇒ The cost is the 326 INLINE narrowings, not the helper count.** The worst
components: the color-picker (45), the combobox (42), the editable (33), the
tags-input (31), the cascade-select (24).

The pattern, everywhere:

```ts
"aria-label": (typeof scope.props["label"] === "string" && scope.props["label"].length > 0)
  ? scope.props["label"] : undefined,
"data-disabled": scope.attr(scope.props["disabled"] === true),
const roving = scope.props["rovingFocus"] !== false;
const dir = typeof scope.props["dir"] === "string" ? scope.props["dir"] : "";
```

Each is a hand-written assertion of what the scope decl ALREADY says. The
component cannot see the decl, so it re-asserts the type at every use.

## Why the fix is not mechanical

**The types live in the MARKUP, and the component cannot see them.**

```html
<!-- packages/components/src/spin-toggle-group/examples/basic.html -->
<scope>props={ items: { value: string, label: string }[] = [...], defaultValue: string = '["left"]' } …>
```

```ts
// packages/components/src/spin-toggle-group/toggle-group.bindings.ts
const items = scope.props["items"]; // unknown
```

The plugin parses the decl at build time (`parseScope` in
`packages/runtime/src/plugin/elements.ts:77`) and generates the element with
`coerceProps(scopeDecls.props, attrs)` — the runtime COERCES the values
correctly. But the _TypeScript_ that reads them is hand-written and sees
`Record<string, unknown>` (`PartScope.props` in
`packages/runtime/src/component/define.ts:28`).

**⇒ The runtime already knows the types. The bindings do not.** The fix is to
let the component's own TypeScript know them.

## The three shapes the fix can take

**A. The component declares its props' types, and the markup is checked against
them.** The component's `*.bindings.ts` declares an interface; the scope decl in
the markup must agree. A gate checks it.

- The component's TS becomes the single source of truth — which matches the
  direction the rest of the migration took (the machine owns its contract).
- The markup's decl keeps the DEFAULT VALUES; the TYPE moves to the component.
- **The plugin can already see the component's TS**: it resolves
  `${defStem}.bindings.ts` and imports it
  (`packages/runtime/src/plugin/elements.ts:154`). So the runtime's coercion can
  read the type from the component.
- **Cost:** the scope decl's grammar changes — the type is no longer in the
  markup. The `string`/`bool`/`int` mini-DSL moves into the component, and the
  runtime's `coerceProps` must read it from there.

**B. The component declares a typed props accessor, and the coercion stays in
the runtime.** The component's bindings get a typed `props` — a generic
parameter on `ComponentDef` — and the narrowing helpers disappear. The scope
decl stays the source of the DEFAULT VALUES and the coercion types; the
component's TS declares the _interface_ it expects, and a gate checks the two
agree.

**C. Generate the types.** The plugin emits a `.d.ts` per component from the
scope decl, and the bindings import it.

- **Cost:** a generated file, a build-order dependency, and the component can no
  longer be written without the markup. It also splits the contract across two
  files — the opposite of the migration's direction.

**D. The component declares the props' types AND the coercion, as one
descriptor; the markup keeps only the defaults.**

```ts
// the component
export const toggleGroupProps = {
  dir: { type: "string", default: "ltr" },
  disabled: { type: "bool", default: false },
  items: { type: "string[]", default: [] },
} as const;
```

The plugin imports it (it already imports the bindings) and coerces with it; the
component's TS derives the prop types from it, so there is ONE declaration. The
markup's scope decl keeps the DEFAULT VALUES only.

- **The scope decl's grammar shrinks to `name = value`** — and the type stops
  being a string in the markup, which is where the stringly system began.
- The plugin must coerce from a descriptor it imported at build time — possible,
  since it already imports the bindings.
- **Cost:** the markup's decl and the component's descriptor could drift (the
  default in one, the type in the other). A gate compares them.

## What I would choose, and why

**D**, with the descriptor in the component and the DEFAULT VALUE in the markup.

- It puts the contract where the CODE is — the same move as the machine's
  contract moving into the machine.
- The component's TS then reads `scope.props["dir"]` as
  `"ltr" | "rtl" | undefined` and the 326 inline narrowings become unnecessary:
  the TYPE does the work the assertions do.
- The markup keeps what only the markup knows: the default values.
- **The plugin can already see the component's TS** — it resolves
  `${defStem}.bindings.ts` and imports it. So the coercion reads the descriptor
  from the component, and the scope decl's grammar shrinks to `name = value`.
  **The stringly type stops being a string in the markup, which is where the
  stringly system began.**

**A is the same shape with the descriptor in a plain interface** — but then the
coercion type and the TS type are two declarations of one fact, and they can
disagree. D has one.

**The open question D must answer:** the default lives in BOTH the descriptor
and the markup's decl. The markup's decl is the _instance's_ default (a page may
want a different one), and the descriptor's is the component's. **⇒ The gate
compares them**, and a divergence is a build error — which is the point: the
default was previously untyped and uncompared.

**⇒ The decision to make: does the prop's TYPE live in the markup or in the
component?** The measurement says the cost is 326 inline narrowings, and that
they exist because the component cannot see the markup's types. Every option
removes them; D removes the split too, and it is the only one where the
component and the runtime cannot disagree about a prop's type.

## The measurement to re-run after

- the inline narrowings: 326 → 0
- the type-narrowing helpers: 32 → ~0
- the value-parsing helpers: 19 → 19 (they stay)

# The class vocabulary: the measurement

**Status: designed (`class-vocabulary.md` holds the design); measured here.**
The design's premise is confirmed and its scope is now precise.

## What the markup keys on

The CSS hooks in the markup — the `data-[…]:` variants. These are what a typo
would silently kill:

| the variant           | the sites |
| --------------------- | --------- |
| `data-[disabled…]`    | 332       |
| `data-[state…]`       | 327       |
| `data-[focus…]`       | 143       |
| `data-[hidden…]`      | 91        |
| `data-[placement…]`   | 70        |
| `data-[current…]`     | 60        |
| `data-[type…]`        | 59        |
| `data-[invalid…]`     | 58        |
| `data-[orientation…]` | 56        |
| `data-[selected…]`    | 50        |
| `data-[completed…]`   | 48        |
| `data-[highlighted…]` | 45        |
| `data-[dragging…]`    | 45        |
| `data-[stage…]`       | 34        |
| `data-[position…]`    | 32        |
| `data-[empty…]`       | 27        |
| `data-[side…]`        | 24        |
| `data-[autoresize…]`  | 20        |
| `data-[view…]`        | 16        |

## What the bindings WRITE

853 `data-*` attribute sites, 83 distinct names:

| the kind                                        | the count | the note                                                     |
| ----------------------------------------------- | --------- | ------------------------------------------------------------ |
| the framework's own (`data-scope`, `data-part`) | 288       | not part of the vocabulary                                   |
| the machine's STATE name (`data-state`)         | 107       | the state, as the machine names it                           |
| **BOOLEAN states**                              | **233**   | `scope.attr(x === true)` → `""` when true, absent when false |
| ENUM values                                     | 43        | 38 from a prop, 5 from the context                           |
| unclassified by this measurement                | 182       |                                                              |

**⇒ The vocabulary is 233 boolean states and 43 enum values.** The rest is the
framework's own attributes and the machine's state name.

The enum values are few and legible: `orientation` (32 sites), `placement`,
`side`, `stage`, `view`, `type`, `position`, `align`.

## The finding that sharpens the problem: `data-state` carries TWO vocabularies

107 sites write `data-state`, and they do not agree on what it means:

| what it writes                                                                           | the sites |
| ---------------------------------------------------------------------------------------- | --------- |
| **the machine's state** (`scope.state`, `isOpenPhase(scope.state)`, `runningState(...)`) | **55**    |
| a **derived** value with a different vocabulary — `open ? "open" : "closed"`             | 17        |
| `state.selected ? "checked" : "unchecked"`                                               | 7         |
| `focused ? "edit" : "preview"`                                                           | 7         |
| `selected ? "checked" : "unchecked"`                                                     | 3         |
| `state.highlighted ? "highlighted" : "idle"`                                             | 2         |
| `state.current ? "open" : "closed"`                                                      | 2         |
| `state.checked ? "checked" : "unchecked"`                                                | 2         |
| `isSelected ? "active" : "inactive"`                                                     | 2         |
| the machine's state, verbatim                                                            | 2         |
| others                                                                                   | the rest  |

**⇒ One attribute name, two vocabularies.** `data-state="open"` can mean "the
machine's state is named open" (the menu) or "the panel is open" (the menu's
trigger, where the machine's states are `idle`/`open`/`closing`). And
`data-state="checked"` is not a state at all — it is a boolean.

**This is why the design's answer must be per-STATE, not per-attribute.** A
machine declares its public state by NAME (`dragging`, `selected`,
`orientation`), and the runtime writes `data-<name>`. Then:

- the machine's own state name is written by the runtime, from the machine's
  declaration — not by each binding;
- a derived boolean (`selected`, `focused`, `checked`) becomes
  `data-selected=""` / `data-focused=""` — a BOOLEAN state, and the markup's
  `data-[selected]:` variant already exists (50 sites);
- the derived ENUMS (`open`/`closed`) become the machine's own enum
  (`data-view="edit"`), so the vocabulary is the machine's.

**⇒ The migration is not "rename the attribute" — it is "the machine declares
its state, and each binding stops inventing a name".** The markup's
`data-[state=open]:` (327 sites) becomes the machine's declared name, which the
check then verifies.

## What the design therefore needs

A machine declares its public state, and the declaration must say **where the
value comes from** — a boolean (the context field's truthiness), an enum (a
context field or a prop), or the state name.

```ts
state: {
  dragging: "boolean",                                  // the context's `dragging`
  orientation: '"horizontal" | "vertical"',              // the context's `orientation`
}
```

**And the framework must write the attributes** — a boolean state as
`data-<name>=""` when true, an enum as `data-<name>="<value>"` — which is what
the bindings do today, by hand, 276 times.

**⇒ The win:** the 13-odd hand-written names become the machine's own declared
names, checked at compile time; and the 233 boolean states + 43 enum values stop
being spelled by hand.

**⇒ The cost:** the machine object needs a `state` field, the runtime needs to
write the attributes from the declaration, and the markup's variants must be
checked against the declaration.

## The check, and where it lives

The markup's `data-[…]:` variants are a CSS string, so a typo is a dead rule.
The check must read the markup and the machine's declaration and compare. That
is the same shape as the existing gates: `scripts/recipe-check.ts` already reads
the corpus's files. **⇒ the check belongs there**, reading the machine's
declared state and the markup's variants.

The UnoCSS side: the finding established that the arbitrary variant
(`data-[dragging]:bg-primary`) already works with no preset change — the runtime
writes the attribute, and the class string stays static. **So the landing does
not need a preset change.** (Attributify is not enabled, and does not need to
be.)

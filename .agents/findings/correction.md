# The correction: what a machine is, and what it is not

I got the data-grammar question wrong, and the reason I got it wrong is the
reason everything else got wrong: **I treated the machine as the place where the
framework's responsibilities land, instead of the place where the framework's
responsibilities stop.**

## What I proposed, and why it was wrong

I proposed a grammar — `items: list(item({ value: text, label: text }))` — and
asked "what shape does the author write?" and "is it a value-level grammar or a
type-level one?"

**Both of those questions are the wrong questions.** They are the questions
you'd ask if the _host's data_ had to cross into the machine as untyped bytes.
It doesn't. **The framework owns that crossing, and the framework decides it —
not each component, and not the author.**

So the "problems I enumerated" — what shapes exist, how a value crosses the
wire, how equality works — are **not the author's problems**. They are the
framework's, and the framework's answer is: _a machine's parameters are
TypeScript. The values arrive typed. There is nothing to parse._

## The corrected model

### A machine is a TypeScript function

```ts
export function ratingGroup(args: RatingGroupArgs = {}): Machine<...> {
  return createMachine<...>({
    context: {
      value: args.value ?? 0,
      count: args.count ?? 5,
      hoveredValue: null,
    },
    initial: "idle",
    on: { SET_VALUE: { assign: ({ event }) => ({ value: event.value }) } },
    states: { ... },
  });
}
```

- **The arguments are typed.** `RatingGroupArgs` is a TS interface.
- **There is no parsing.** `args.value` is a `number`. If the _host_ wrote a
  string, the framework coerced it — at the boundary, using the type the element
  declared.
- **The machine never sees a prop, a scope, a host, or a DOM.** It sees its
  arguments and its events.
- **The events are typed.** The event's payload is the machine's own
  declaration, not a union the author maintains by hand.

### The framework owns the boundary

```
host (react/svelte)  ──writes──▶  the web component's attribute/property
                                          │  the framework coerces it,
                                          │  using the type the element declared
                                          ▼
                                    the machine's argument
```

**One way, decided by the framework.** Not 30 components each deciding how to
parse their collection.

### The element declares its host API — and that declaration is the type

Today the scope's mini-DSL is the declaration:

```html
<scope>props={ label: string = "Date", value: string = "" }</scope>
```

**That mini-DSL is the untyped hole.** It is a _stringly_ type system —
`string`, `bool`, `int`, `string[]` — and it is why the props arrive "as a JSON
string, or an array, or an array of unknown": **the declaration is a string, so
the value is a string, and every component re-derives the real type by hand.**

**So the fix is not a grammar for the machine. It is a real type for the
element's props.** The element declares its props in TypeScript, the compiler
reads the types, and the coercion is derived from the types. Then:

- the props arrive typed at the element's boundary;
- the element forwards what it wants to the machine, typed;
- the machine parses nothing, ever.

**And the machine's own parameters are the element's decision** — the element
knows which of its props feed which of the machine's parameters, and it says so
once.

### "Each component decides" — wrong, and here's the correction

The point stands: **we are building a framework; frameworks decide.** So:

- **The framework** decides: how a prop is declared, how it is coerced, how it
  reaches a machine, how a machine's event reaches the host.
- **The machine** decides: its states, its transitions, its parameters' meaning,
  its events' payloads.
- **The element** decides: which of its props feed which of the machine's
  parameters, and what the DOM looks like.

**The edge to handle: a machine consumed in multiple places.** A machine is a
_function_, so each consumption is an instance — its own state. A "controlled"
parameter is then a per-instance question: the instance's value follows the
outside value when one is given, and the machine owns it otherwise. **That is a
framework rule, not a per-component one** — and it is the same shape as the
`value`/`defaultValue` twin we already have.

## What this kills

|                                                                                  | count           | why it goes                               |
| -------------------------------------------------------------------------------- | --------------- | ----------------------------------------- |
| the parsing helpers (`parseEntry`, `rowsOf`, `itemsOf`, `asCount`, `valuesProp`) | ~30 × ~25 lines | the values arrive typed                   |
| the deep-equality helpers (`sameEntries`, `sameTags`, …)                         | ~10             | the framework compares typed values, once |
| the `initial(raw, authored)` gates                                               | 30              | the framework resolves the parameters     |
| the hand-written event unions                                                    | 30              | derived from the machine's own event map  |
| the `*Initial` interfaces                                                        | 29              | the arguments are a TS interface already  |
| the `if (event.type !== …)` guards                                               | 123             | the bound assign narrows the event        |
| the hand-written `sig()`                                                         | 284             | the bag's key is derived from the reads   |

**≈ 3 000 lines, and the machine file becomes a statechart and nothing else.**

## What the machine file looks like after

```ts
// spin-rating-group.machine.ts — the statechart, and nothing else
export const ratingGroup = machine<RatingGroupContext, RatingGroupEvents>(
  ({ assign, guard }) => ({
    parameters: {
      value: { initial: 0, type: "number" },
      count: { initial: 5, type: "number" },
    },
    context: { value: 0, count: 5, hoveredValue: -1 },
    initial: "idle",
    on: {
      SET_VALUE: {
        assign: assign("SET_VALUE", ({ event }) => ({ value: event.value })),
      },
    },
    states: {
      idle: { on: { CLICK: { assign: assign("CLICK", ...) } } },
    },
  }),
);
```

**No parsing. No transport. No types to maintain by hand. The parameters are
declared once, and the framework binds them.**

## The open questions, restated honestly

1. **The element's prop declaration.** Today it is the scope's mini-DSL. If the
   props are to be _typed_, the declaration has to be TS — which means either
   the scope's `props={...}` becomes a TS expression, or the element's props
   move to a TS file next to the markup. **This is the real question, and it is
   bigger than the machine's shape.**
2. **The machine's parameters' types.** If the element's props are typed, the
   machine's parameters can be typed too — and the framework can check that the
   element forwards compatible values.
3. **The controlled edge.** A machine consumed in N places: each is an instance;
   a parameter can be controlled per instance. The framework owns the rule.

# The file separation: the measurement

**Status: designed (the bloc analogy); measured here.** The design's premise —
"the machine file must contain ONLY the statechart" — is confirmed, and the
scope is now precise.

## What is in a machine file today

32 machine files, **10 421 lines**:

| the content                                                             | the lines     |
| ----------------------------------------------------------------------- | ------------- |
| the statechart (the spec object)                                        | ~512          |
| the top-level declarations (the assigns, the parsers, the path helpers) | ~1 202        |
| the type declarations (the context, the events, the args)               | ~241          |
| comments, blanks, and the rest                                          | the remainder |

**⇒ The statechart is under 5% of a machine file.** The other 95% is the assigns
(now inline, after the authoring API), the value parsers, the component's own
helpers, and the types.

The biggest files:

| the file          | the lines | the statechart |
| ----------------- | --------- | -------------- |
| the combobox      | 587       | 292            |
| the splitter      | 572       | —              |
| the tags-input    | 565       | —              |
| the slider        | 491       | —              |
| the image-cropper | 480       | 220            |
| the date-picker   | 475       | —              |

## What the separation would move

Per the design: `<name>.machine.ts` (the statechart only), `<name>.events.ts`,
`<name>.bindings.ts`, `<name>.test.ts`.

**The three kinds of thing that are NOT the statechart:**

1. **the assigns** (~the 267 the authoring API inlined) — they are the machine's
   behaviour, so they belong IN the machine file. But they are verbose, and the
   ones that answer several events are the shared bodies.
2. **the value parsers** — `parsePath`, `parsePaths`, `coerceList`,
   `parseItems`, `parseKeys`. **These are the DOM/format boundary, not the
   statechart** — they parse the host's strings into the machine's shapes. They
   belong with the bindings (the DOM contract), not the machine.
3. **the types** — the context, the events, the args. The events are the
   machine's contract; the args are the transport's.

## The measurement to re-run after

- the statechart's share of a machine file: ~5% → the file IS the statechart
- the parsers' home: the machine file → the bindings file
- the machine files' total lines: 10 421 → ~4 000

## The caution

**The separation is a MOVE, not a rewrite.** The authoring API just inlined 233
assigns into the machine files, so they are now one place — and that place is
the right one (the machine's behaviour). Splitting them out again would undo
that.

**⇒ The separation is worth doing for the PARSERS and the ARGS, and NOT for the
assigns.** The machine file keeps: the statechart, the assigns, the context, the
events. It gives up: the value parsers (to the bindings) and the args type (to
the bindings, or to the events file).

**That is a much smaller claim than "the machine file becomes a statechart", and
it is the one the measurement supports.**

## THE IMPORT DIRECTION FORBIDS THE PLAN AS WRITTEN

**The bindings import the machine** (`cascade.bindings.ts` imports
`cascade.machine.ts` for the factory and the types). So **anything the machine
needs cannot move into the bindings** — that would be a cycle.

And the parsers ARE the machine's: `initial(args)` shapes the context from the
raw props, so it parses them. Measured over the corpus:

| the parser                              | who uses it                      |
| --------------------------------------- | -------------------------------- |
| `parseMs` (the timer)                   | the machine only                 |
| `parseDays` (the date-picker)           | the machine only                 |
| `parseValue` (the date-input)           | the machine only                 |
| `parsePanels` (the splitter)            | the machine **and** the bindings |
| `parseDay` (the date-picker)            | the machine **and** the bindings |
| `parsePath`, `parsePaths` (the cascade) | the machine **and** the bindings |

**⇒ The parsers cannot go INTO the bindings.** The four that both use need a
THIRD file — one the machine and the bindings both import. The three the machine
alone uses could stay with the machine, but then the two kinds sit in different
places for no reason.

**⇒ The shape the measurement supports: a THIRD file per component**, the value
shapes:

```
spin-<name>/
  <name>.machine.ts     the statechart, the assigns, the context, the events
  <name>.values.ts      the value shapes: the parsers, the coercions
  <name>.bindings.ts    the DOM contract
  <name>.machine.test.ts
```

**That is the bloc analogy's `<name>.events.ts` slot, holding the values rather
than the events** — and it is what the import direction allows. The alternative
— the parsers stay in the machine — is a smaller change and arguably right,
since a machine's `initial()` parsing its own arguments is the machine's
business.

**⇒ The decision is small: does the value-shape file exist, or do the parsers
stay with the machine?** It is worth 12 files' worth of tidiness and no
behaviour.

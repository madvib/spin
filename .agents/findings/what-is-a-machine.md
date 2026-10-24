# What is a machine, and why

**The question:** "step back and let's answer what IS a machine... compared to
other forms of state management we could be using, why machines?"

## The comparison

|                       | the state is     | the legal moves are     | an impossible state |
| --------------------- | ---------------- | ----------------------- | ------------------- |
| **useState**          | a value          | anything you write      | representable       |
| **Zustand / a store** | a value          | anything you write      | representable       |
| **Redux**             | a value (a tree) | anywhere in the reducer | representable       |
| **a machine**         | a **mode**       | **declared, per mode**  | **unrepresentable** |

**That is the whole difference.** A store can hold `open: boolean`. It cannot
hold "opening". So you add `isAnimating`, `animationDirection`, `pendingClose` —
**three fields encoding one state** — and the invariants between them live
_nowhere_: nothing stops `open === true` while `pendingClose === true`.

**UI state is overwhelmingly this shape.** A menu is closed/open and cannot be
half-open. A dialog is closed → opening → open → closing, and the transitions
carry _timing_. A field is idle → focusing → editing → validating → submitting →
error, and the legal next steps differ per step.

**So: why machines?** Because the mode and its legal transitions _are_ UI state,
and only a statechart holds them. The payoff is that a machine can answer
questions without running: "can this close right now?", "what can happen here?",
"is this in a state it should never be in?"

**And the reason it matters for agents:**
`{ closed: { on: { OPEN: { target: "open" } } } }` describes a whole machine;
300 lines of imperative handlers does not.

## Are our machines doing that job? Mostly no

The measurement (the corpus's machine code):

|                                     | lines | share |
| ----------------------------------- | ----- | ----- |
| the states/transitions and the rest | 5 753 | 63%   |
| the assigns/conds tables            | 2 344 | 25%   |
| the type declarations               | 1 031 | 11%   |

**And within the 63%, the state is often not a state.**
`openSubmenu: string
| null` in the menu is a _state_ written as a field, with
the _meaning_ owned by the bindings ("is this row's submenu open?"). **A machine
that cannot express its own state is not getting the benefit of being a
machine.**

So the honest answer: **the machines are a bucket for code to live.** The
statechart is in there, but so is the transport, the parsing, the equality, the
gating, and the type declarations.

## The verbosity, decomposed

Two things inflate it, and **both are duplicated** — which is the fixable part.

### (a) Defensive programming, duplicated 30 times

`parseEntry` (40 lines), `sameEntries` (25), `entriesOf` (18), the `written`
helper (8) — **per component**, hand-written, differently.

Defensiveness is not the problem. _Duplicated_ defensiveness is: a component
should not be deciding what "a valid menu item" means. That is the framework's
grammar's job, once.

### (b) Accessibility, duplicated 35 times

**279 `aria-*` attributes, 33 distinct names**, and the top ones repeat:

|                   | times |
| ----------------- | ----- |
| `aria-label`      | 63    |
| `aria-hidden`     | 32    |
| `aria-labelledby` | 21    |
| `aria-controls`   | 20    |
| `aria-disabled`   | 14    |
| `aria-expanded`   | 12    |

**A menu's trigger always has `role=button`, `aria-haspopup`, `aria-expanded`,
`aria-controls`.** That is the semantics of _a menu trigger_, not of _this
menu_. A framework-level primitive owns it; the component says "my trigger is a
menu trigger" and the ARIA follows.

**So the accessibility verbosity is not per-component uniqueness — it is the
same semantics written 35 times.** Also duplicated, also fixable once.

## The file separation (the bloc analogy)

Bloc splits `blocs/`, `events/`, and the bloc itself — because each has a
different reason to change. The spin equivalent:

| file                 | owns                                               | changes when                   |
| -------------------- | -------------------------------------------------- | ------------------------------ |
| `<name>.machine.ts`  | **the statechart only**                            | the behaviour changes          |
| `<name>.events.ts`   | the event payloads (the contract with the outside) | the outside's contract changes |
| `<name>.bindings.ts` | the DOM: parts, slots, commands                    | the DOM changes                |
| `<name>.test.ts`     | the behaviour                                      | the behaviour changes          |

**4 files, and the rule that makes it work: the machine file contains ONLY the
statechart.** Today it contains the statechart _plus_ the transport _plus_ the
types _plus_ the parsing — and the file count is 3, so the separation bought
nothing.

**The test of the separation:** can an author open `<name>.machine.ts` and see
the whole behaviour, with nothing else in the way? Today: no — there is
`parseEntry` at line 111 and `sameEntries` at line 217, and the 13-line
`MenuEvent` union at 93 has nothing to do with the statechart.

## What the machine file should look like

```ts
// menu.machine.ts — the statechart, and nothing else
export const menu = machine<MenuContext, MenuEvents>({
  context: { highlighted: null, openSubmenu: null, anchorPoint: null },
  initial: "closed",
  on: {
    OPEN: { target: "open" },
    CLOSE: { target: "closed" },
  },
  states: {
    open: {
      on: {
        HIGHLIGHT: { assign: ({ event }) => ({ highlighted: event.value }) },
        ITEM_CLICK: { target: "closed" },
      },
    },
  },
});
```

**60 lines, and every line is the behaviour.** The transport, the parsing, the
equality, the gating, the event union — all gone, because they are not the
statechart.

## The recommendation

**The corpus-wide wins and the authoring shape are the same work.** Every big
win is a change to the authoring surface:

| the win                                        | lines  | it changes            |
| ---------------------------------------------- | ------ | --------------------- |
| the parts' `sig` dies (derived from the reads) | ~570   | the DOM's surface     |
| the bound `assign`/`guard`                     | ~740   | the machine's surface |
| the data grammar (the host's props, shaped)    | ~2 500 | the machine's surface |
| the ARIA primitives                            | ~400   | the DOM's surface     |
| the file separation                            | 0      | the layout            |

**So there is no "big wins first, shape later" path — the wins ARE the shape.**
But the work is not uniform in how much _design_ it needs:

**Forced (one right answer, no design freedom):**

- the `sig` → derived. The read IS the dependency; there is nothing to decide.
  **(done)**
- the ARIA primitives. The semantics belong with the primitive.
- the bound `assign`/`guard`. The event's name is a fact, stated once.

**Has real design freedom — pair on it:**

- the data grammar's surface: how does an author express "a list of things, each
  with these fields"? And the deeper question: **where is the type declared?**
  The element's props must be typed (a TS declaration, not the scope's
  mini-DSL), or the machine has to parse.
- the file split's exact boundary: does the event map live in `events.ts` or
  beside the machine?

**And the one that changes the model:**

- **the state as a field** (`openSubmenu: string | null`). Either the submenu's
  open state is a _state_ of the parent machine, or the submenu is a _child
  machine_ and the parent holds a reference to it. Zag uses the second (a
  submenu is its own machine instance); we flattened it. That flattening is why
  the state became a field.

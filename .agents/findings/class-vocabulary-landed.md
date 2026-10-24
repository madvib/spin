# The class vocabulary: what landed

**Status: landed on `migration/bindings-grammar`.**

## The shape

A component declares its public state — the names the markup may key on — and
the runtime writes them:

```ts
// packages/runtime/src/component/facts.ts
export interface FactScope<C = unknown> {
  readonly props: Record<string, unknown>;
  readonly context: C;
  readonly state: string;
  readonly id: (part: string, slot?: unknown) => string;
}

export function factAttrs<
  S extends FactScope<unknown>,
  F extends Record<string, (scope: S) => unknown>,
>(scope: S, facts: F, ...names: (keyof F & string)[]): Record<string, unknown>;
```

A part names the facts it carries:

```ts
export const facts = {
  disabled: (scope: ScopeLike) => scope.props["disabled"] === true,
  orientation: (scope: ScopeLike) => scope.props["orientation"],
  dragging: (scope: ScopeLike) => scope.state === "dragging",
};

attrs: ((scope: ScopeLike) => ({
  ...factAttrs(scope, facts, "disabled", "orientation", "dragging"),
}));
```

**The names are the declaration's keys**, so a name the declaration does not
have does not compile — the vocabulary is typed at the call site.

**The value follows the spread's rule** (`true` → an empty attribute, a string →
itself, `false`/`null`/`undefined` → the attribute is off), so a fact and a
hand-written attribute reach the DOM the same way. The DOM did not change; the
units and the e2e say so.

## What the codemod lifted, and what it refused

`scripts/facts-codemod.ts` lifts a fact only when **every** part that writes it
writes the **same** expression, and that expression reads only the scope (or the
component's own scope-taking helpers). A part's own expression — a slot's value,
a computed local, a per-index focus — stays in the part: the fact would be a
different fact there.

24 of the 34 def files were migrated; 57 facts were declared. The 10 that were
not are the ones whose facts are genuinely per-part (the toast's entries, the
tree-view's rows) or conflated (below).

## The gate

`scripts/recipe-check.ts` reads each component's written attributes (the
declared facts **and** the attributes the parts spell, in either the bag form or
the `attrs["data-x"] =` form) and checks every `data-[…]` variant in that
component's recipes.

**⇒ It found 148 dead rules — class hooks no component ever writes. Every one of
them was invisible: the rule never applies and nothing says so.**

| the family                        | the sites | the truth                                                                  |
| --------------------------------- | --------- | -------------------------------------------------------------------------- |
| the carousel's `data-[focus]`     | 48        | the carousel tracks the _viewport's_ focus, never which button has it      |
| the carousel's `data-[slides-N]`  | 30        | the carousel knows the count and never published it                        |
| the select's `data-[focus]`       | 10        | the select's machine has a `focused` state; the trigger never published it |
| the combobox's `data-[selected]`  | 4         | the combobox's rows have `selected`; the option never published it         |
| the steps' `data-[completed]`     | 48        | the steps write `data-complete`; the recipes spelled it `completed`        |
| the carousel's `data-[snap-type]` | 6         | the carousel writes `data-snap`                                            |

The tree-view's `data-[selected]` was a **false positive** of the first gate: it
writes the attribute in the `attrs["data-selected"] = ""` form, which the gate's
first pattern did not see. The gate now reads both.

## The fixes

- The steps' recipes: `data-[completed]` → `data-[complete]` (the component's
  spelling is the contract).
- The carousel's recipes: `data-[snap-type=proximity]` →
  `data-[snap=proximity]`, and `data-[slides-N]` → `data-[slides=N]`.
- The carousel publishes `data-slides` (the slides per page).
- The select publishes `data-focus` (its machine's `focused` state).
- The combobox's option publishes `data-selected`.
- **The carousel's machine tracks the focused part** — `focusedId` in the
  context, `PART.FOCUS`/`PART.BLUR` events, the four focusable parts report
  themselves. This is the toggle-group's pattern exactly
  (`focusedId: string | null`, an event carrying the id), so the corpus has one
  way to say it.

⇒ The user chose this over the two alternatives: the runtime publishing the
focus (a runtime-core change, and a framework-wide migration), and dropping the
dead rules (the carousel's parts are native buttons, so the browser's focus ring
already marks them).

## The measurement that shaped it

- **853** `data-*` sites, **83** distinct names, of which the framework's own
  (`data-scope`, `data-part`) are 286.
- **118** facts are written on two or more parts; **94** on exactly one.
- The markup's hooks: **1276** variant sites over **38** names — 823 boolean,
  453 enum. `data-[state=…]` alone is 250 sites with **12** different
  vocabularies.

## What did NOT land

- **`data-state`'s two vocabularies.** Fourteen components write `data-state`
  with more than one meaning: the cascade's containers write `open|closed` while
  its items write `checked|unchecked`; the menu's trigger writes `open|closed`
  while its row writes `checked|unchecked`. The conflation is real and it is the
  next thing to fix — the derived booleans want their own names (`data-open`,
  `data-selected`), and the machine's own state keeps `data-state`.
- **The `data-part` names.** 26 of the 143 `data-part` values are not derivable
  from the part key (`editTrigger` → `edit-trigger`, `tags-input`'s
  `clearTrigger` → `clear-btn`). They are a hand-chosen DOM contract, and the
  runtime cannot compute them.

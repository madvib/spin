# The class vocabulary, part two: the selection is not a state

**Status: landed on `migration/bindings-grammar` (`af3e8af`).**

## What was wrong

`data-state` carried two vocabularies. Fourteen components wrote the machine's
state under it; **seven wrote a SELECTION under it** — `checked|unchecked` — so
`data-state="checked"` was not a state at all.

| the component    | the sites | the truth                                                                                                                                                         |
| ---------------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| the listbox      | 3         | it already published `data-selected` — the `data-state` duplicated it                                                                                             |
| the combobox     | 3         | the same                                                                                                                                                          |
| the cascade      | 3         | the same                                                                                                                                                          |
| the select       | 1         | the same                                                                                                                                                          |
| the tree-view    | 1         | it already published `data-checked` — and the comment above the site says the row's own state must not reach that element. **The code contradicted the comment.** |
| the color-picker | 3         | a swatch is CHECKED, not selected                                                                                                                                 |
| the menu         | 1         | a checkable item is CHECKED, not selected                                                                                                                         |

⇒ **Where a component already published the fact, the `data-state` was a
duplicate of the same fact and is gone.** Where it did not, the fact takes its
own name: `data-selected` for a selection, `data-checked` for a check.

The recipes follow: `data-[state=checked]` becomes `data-[selected]` or
`data-[checked]`. **The `unchecked` rules are gone** — a boolean's absence is
the unchecked case, and the corpus has no `not-data-[…]`.

## The tree-view's comment

```ts
// The checked fact only: the row's own state (expanded, selected)
// must not reach this element, or every expanded parent rendered
// as a checked box.
"data-checked": state.checked ? "" : undefined,
"data-state": state.checked ? "checked" : "unchecked",
```

The comment says the row's state must not reach that element — and the next line
wrote exactly that. The comment was right; the code was not. ⇒ **⇒ A comment
that contradicts the line under it is a bug report.**

## What did NOT land: the derived `open|closed`

The other half of the conflation is the eight overlay components (the cascade,
the combobox, the select, the menu, the date-picker, the navigation-menu, the
color-picker, the floating-panel) that write `data-state="open"|"closed"` — a
DERIVED value, not the machine's state. The recipes key on it in 137 places (100
of them "hide the panel").

**⇒ This is NOT a rename, and it is the one decision that is left.**

The corpus's convention is that `data-state` is the MACHINE's state (the timer,
the async-list, the editable, the toggle-group all do it that way). The eight
overlays break it — and their `data-state` is what the e2e suites assert (the
cascade's, the menu's, the date-picker's: ~30 assertions read
`data-state === "open"|"closed"`).

⇒ The two shapes:

- **(a) `data-state` becomes the machine's state, the open-ness becomes
  `data-open`** (a boolean). The DOM changes for the eight: the panel would
  report `idle|focused|open` instead of `open|closed`. The e2e's ~30 assertions
  change, and the recipes' 137 sites change (`data-[state=open]` →
  `data-[open]`, `data-[state=closed]` → `not-data-[open]` — a variant the
  corpus has never used).
- **(b) `data-state` keeps the derived open|closed, and the machine's state
  takes a new name.** The DOM does not change, and the e2e does not change. But
  then the corpus has two conventions for the machine's state: `data-state` in
  six components and something else in eight.

⇒ **⇒ (a) is the convention-consistent answer and (b) is the consumer-preserving
one.** The user decides; the measurement is here.

## The other vocabularies, measured

| the vocabulary            | the components        | the state                     |
| ------------------------- | --------------------- | ----------------------------- |
| `open\|closed`            | 8                     | the decision above            |
| `active\|inactive`        | the tabs (29 sites)   | the machine's states?         |
| `playing\|paused\|idle`   | the carousel (12)     | derived from `idle\|autoplay` |
| `on\|off`                 | the toggle-group (10) | the machine's states ✓ honest |
| `edit\|preview`           | the editable (9)      | the machine's states ✓ honest |
| `loading\|sorting\|error` | the async-list (4)    | the machine's states ✓ honest |
| `visible\|hidden`         | the avatar            | derived                       |
| `at-value\|under-value`   | the angle-slider (8)  | the machine's states?         |

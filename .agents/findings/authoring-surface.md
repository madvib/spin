# The authoring surface

**The complaint:** "it is not easy to understand what is going on in the
slightest, remember this is supposed to be an authoring surface, like authoring
a react component."

**True.** The measurement, on `spin-menu/menu.machine.ts` (278 lines):

|                                  | lines   | what it is                                           |
| -------------------------------- | ------- | ---------------------------------------------------- |
| the file                         | 278     |                                                      |
| blank                            | 23      |                                                      |
| comment                          | 35      | mostly _why_ (good)                                  |
| **code**                         | **220** |                                                      |
| — of which **type declarations** | **56**  | 25% of the code                                      |
| — of which parsing helpers       | ~60     | `isRecord`, `parseEntry`, `entriesOf`, `sameEntries` |
| — of which the machine itself    | ~100    | the config + the assigns                             |

**So the machine — the thing an author writes — is 100 lines, and the other 120
are types and parsing.**

`parseEntry` is **40 lines** of manual field-by-field validation. `sameEntries`
is **25 lines** of manual deep-equality. `entriesOf` is **18 lines** of manual
array walking. And the host's `items` prop must go through **five** hand-written
steps: declare the union → validate by hand → compare by hand → gate by hand →
thread it through the context with an `ENTRIES.SET` event and a `setEntries`
assign.

**None of that is UI logic. All of it is ceremony.**

## The four things that are wrong

### (a) The author writes the transport, not the machine

The host's `items` arrives as a string or an array of unknown. The author must:

1. **declare the shape** (`MenuItemData | MenuSeparatorData | MenuGroupData` —
   15 lines of union),
2. **validate it by hand** (`parseEntry` — 40 lines),
3. **compare it by hand** (`sameEntries` — 25 lines),
4. **gate it by hand** (`initial`'s `written` helper — 8 lines),
5. **thread it through the context** (`entries` in the context, plus an
   `ENTRIES.SET` event, plus a `setEntries` assign).

**Five steps to say "the host gave me a list of menu items".** Every component
does this, differently, 30 times. That is the 30-fold duplication and it is why
the LOC went **up**.

**The framework should own all five.** A host's prop is _data_, and the
framework's grammar already knows how to read data (the scope decl's types,
`coerceJsonArray`). What the author should write is a _shape_:

```ts
items: list(item({ value: text, label: text, children: list(lazy(() => item)) })),
```

**And the deeper correction** (see `correction.md`): the props are untyped
_because we declared them with a stringly mini-DSL_ — `string`, `bool`, `int`
are strings, so the value that arrives is a string, and every component
re-derives the real type by hand. **The fix is not a grammar for the machine; it
is a real TypeScript type for the element's props.** Then the machine parses
nothing, ever.

### (b) The event union is hand-written, and the guard is hand-written

123 `if (event.type !== "X") return {};` across the corpus. Every one says the
same thing: _this assign answers the event named X_. The author writes the
event's name **twice** (in the union, and in the guard) and the payload's type
**twice** (in the union, and by narrowing).

### (c) The state is two states and a map

`closed` / `open`, plus `openSubmenu: string | null` as a _map in the context_.
A submenu's open state is a field, not a state. So the machine has **no way to
say "the submenu is open"** — the bindings read `ctx.openSubmenu === row.value`.

**That is a state machine that cannot express its own state.**

### (d) The DOM half is 705 lines of the same shape

`menu.bindings.ts` is **705 lines** — 2.5× the machine — and it has the same
problems: every part writes its own `sig` by hand, and the `attrs` functions are
long imperative blobs.

**The `sig` was the clearest smell**: 284 of them, each a hand-written list of
"the things I read". Miss one → stale DOM. That is a _manual dependency tracker_
in every part, in every component. **It is the single most author-hostile thing
in the codebase**, and it is not a framework.

**(done)** The bag's key is now derived from what the build read — the context's
fields (by version, so an object field is tracked too), the props, the state,
and the argument (by content). **A part cannot forget to name a field it depends
on, because it never names one.**

## The target

```ts
// the menu's machine — the whole thing
export const menu = machine<MenuContext, MenuEvents>({
  // the host's data, shaped by the framework's grammar
  items: list(
    item({
      value: text,
      label: text,
      shortcut: text,
      disabled: bool,
      checked: bool,
      children: list(lazy(() => item)),
    }),
  ),

  // the machine's own state
  context: {
    highlighted: null as string | null,
    openSubmenu: null as string | null,
    anchorPoint: null as { x: number; y: number } | null,
  },

  initial: "closed",

  on: {
    OPEN: { target: "open" },
    CLOSE: { target: "closed" },
    HIGHLIGHT: { assign: ({ event }) => ({ highlighted: event.value }) },
  },

  states: {
    open: {
      on: {
        ITEM_CLICK: { target: "closed" },
        SUBMENU_OPEN: { assign: ({ event }) => ({ openSubmenu: event.value }) },
      },
    },
  },
});
```

**What the framework takes off the author's plate:**

| the author writes today            | the framework does                     |
| ---------------------------------- | -------------------------------------- |
| the payload's union                | the declared shape (the map) — derived |
| `parseEntry` (40 lines)            | the grammar's `list(item({…}))`        |
| `sameEntries` (25 lines)           | the framework's equality               |
| `initial`'s `written` helper       | the contract's gating                  |
| `if (event.type !== …)` (×123)     | the bound assign                       |
| `Partial<Context>` on every assign | inferred                               |
| the `ctx` parameter when unused    | omitted                                |
| the `sig` on every part (×284)     | derived from the reads                 |

**And the DOM half:**

```ts
// the menu's parts — the sig is gone
parts: {
  trigger: {
    attrs: (scope) => ({
      type: "button",
      id: scope.id("trigger"),
      "aria-expanded": scope.state === "open",
      "aria-controls": scope.id("content"),
      onClick: () => scope.send({ type: "TRIGGER_CLICK" }),
    }),
  },
},
```

## The work, in order

| #     | what                                                                        | why first                                                                                                               |
| ----- | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **1** | **the parts' `sig` dies** — the bag's key is derived from the reads         | 284 hand-written dependency trackers is the most author-hostile thing in the tree. **(done)**                           |
| **2** | **the ARIA primitives**                                                     | a menu trigger's ARIA is not a _type_, it's a _known set of semantics_; 279 attributes, 33 names, `aria-label` 63 times |
| **3** | **the authoring API**: `machine<Ctx, Events>(fn)` with the helpers in scope | the surface the user is judging; without it the guards and the unions stay                                              |
| **4** | **the data grammar**                                                        | 40 lines of `parseEntry` per component is the 30-fold duplication — but the real fix is the element's props being typed |
| **5** | the machine object (the contract travels with the machine)                  | the framework gates the args; the machine's `initial` loses its gate                                                    |

**1 and 2 are the framework; 3 and 4 are the authoring surface.** All three take
the _authoring_ burden off the author's plate.

## The name

The user is right that `define` is overused. The vocabulary should be:

| the thing        | the name                               | why                 |
| ---------------- | -------------------------------------- | ------------------- |
| the machine      | `machine()`                            | it makes a machine  |
| the DOM contract | `parts()`                              | it makes the parts  |
| the element      | `element()`                            | it makes an element |
| the data shape   | `list()`, `item()`, `text()`, `bool()` | they make data      |

**One verb per thing made.** No `define*`.

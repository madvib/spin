# The authoring API

The machine definition must be **declarative** and offer an **ergonomic API**.
This is the piece the vision rests on: "users and agents write machines of their
own, and often".

## What a machine author writes today

```ts
export interface RatingGroupContext {
  value: number;
  hoveredValue: number;
  count: number;
  allowHalf: boolean;
  disabled: boolean;
  readOnly: boolean;
}

export type RatingGroupEvent =
  | { type: "SET_VALUE"; value: string }
  | { type: "SET_COUNT"; count: number }
  | { type: "CLEAR_VALUE" }
  | { type: "CLICK"; index: number; value: number }
  | { type: "SPACE"; index: number; value: number }
  | { type: "POINTER_OVER"; index: number; isMidway: boolean }
  | { type: "GROUP_POINTER_LEAVE"; radioFocused: boolean }
  | { type: "FOCUS" }
  | { type: "BLUR" };

export const ratingGroup = createMachine<RatingGroupContext, RatingGroupEvent>({
  initial: "idle",
  context: { value: 0, hoveredValue: -1, count: 5, allowHalf: false, disabled: false, readOnly: false },
  on: {
    SET_VALUE: { actions: [{ assign: "setValueTo" }] },
    ...
  },
  states: { ... },
  assigns: {
    setValueTo: (ctx, event) => {
      if (event.type !== "SET_VALUE") return {};
      return { value: ratingValue(event.value) };
    },
    setCount: (ctx, event) => {
      if (event.type !== "SET_COUNT") return {};
      return { count: Math.max(1, Math.floor(event.count)) };
    },
    // … one per event
  },
});
```

**Six things to write, four of them boilerplate:**

1. the context interface,
2. the event union (**by hand**),
3. the config's `on`/`states`,
4. the assigns table — with **the event-type guard on every entry**,
5. the `Partial<Context>` return type on every entry,
6. the `ctx` parameter on every entry, even when unused.

**123 event-type guards** across the corpus. Every one of them is the same
statement: "this assign answers the event named `SET_VALUE`".

## The design

### The event map is the one thing the author writes

```ts
type RatingGroupEvents = {
  SET_VALUE: { value: string };
  SET_COUNT: { count: number };
  CLEAR_VALUE: {};
  CLICK: { index: number; value: number };
  SPACE: { index: number; value: number };
  POINTER_OVER: { index: number; isMidway: boolean };
  GROUP_POINTER_LEAVE: { radioFocused: boolean };
};
```

That is the **contract with the outside**, so it should be written by hand.
Everything else is derived from it.

### The assigns narrow the event, and the guard disappears

```ts
export const ratingGroup = machine<RatingGroupContext, RatingGroupEvents>(
  ({ assign, guard }) => ({
    context: { value: 0, hoveredValue: -1, count: 5, allowHalf: false, disabled: false, readOnly: false },
    initial: "idle",
    on: {
      SET_VALUE: {
        assign: assign("SET_VALUE", (ctx, event) => ({
          value: ratingValue(event.value),   // `event.value` is a string — narrowed
        })),
      },
    },
    states: { ... },
  }),
);
```

- **no guard** — the bound form names the event,
- **no cast** — the event is narrowed to the one the assign answers,
- **no `Partial<Context>`** — inferred,
- **no `ctx`** when unused.

### The shape of the API

```ts
machine<Context, Events>(({ assign, guard }) => ({
  parameters: { value: { initial: 0, type: "number" } },
  context: { ... },
  initial: "idle",
  on: { SET_VALUE: { assign: assign("SET_VALUE", ...) } },
  states: { ... },
}));
```

**Note the two forms of `assign`:**

- the **implementation** form (in the assigns table): the event is named, the fn
  is typed against it;
- the **reference** form (in the config): the table's key.

The reference form names the event too, so the config and the table cannot
drift.

## The blocker, and the way through it

A standalone `assign("SET_VALUE", fn)` **cannot infer the machine's event type**
— the string does not carry the type. The ways through:

**(a) The spec carries the helpers.** The assigns are written _inside_ the spec,
where `Events` is in scope. That means the spec is built by a **function** that
receives the typed helpers:

```ts
export const ratingGroup = machine<RatingGroupContext, RatingGroupEvents>(
  ({ assign, guard }) => ({ ... }),
);
```

**One function, the helpers in scope, the events narrowed, the guards gone.**
The machine's shape is unchanged; the authoring surface is not.

**(b) The explicit type argument.** `assign<Ctx, Events, "SET_VALUE">(…)` —
works, but every entry says the types out loud, and **an agent will write it
wrong**. ✗

**(c) The helper factory.** `const a = assigns<Ctx, Events>();` then
`a.assign("SET_VALUE", …)` — close to (a), but the helper is a separate binding
the author must remember. ✗

**(a) is the answer.** The machine is a function of its own helpers — which is
also the natural shape for a machine that wants to be _composed_ (a machine that
wraps another's events, or a shared machine with a family's variants).

## What it removes

|                                | count | lines                               |
| ------------------------------ | ----- | ----------------------------------- |
| the event-type guards          | 123   | ~370                                |
| the `Partial<Context>` returns | ~123  | ~370                                |
| the hand-written event unions  | 30    | ~600 (they become the map — a wash) |
| the unused `ctx` parameters    | ~90   | ~90                                 |

**≈ 830 lines, and the authoring surface becomes one function.**

## The work

1. the `machine<Ctx, Events>(fn)` helper in the runtime — the spec is built by a
   function, and the helpers close over its types;
2. `assign`/`guard` as members of the spec's helper set, typed with the spec's
   `Ctx`/`Events`;
3. the config's action names checked against the table's keys;
4. the codemod: 30 machines × (the union → the map, the guard → the bound form,
   the return type → inferred).

**The codemod is the easy half** (the shapes are uniform). The helper design is
the hard half — and it is worth doing **before** the machine-object pass,
because the machine-object pass and this one touch the same 30 files.

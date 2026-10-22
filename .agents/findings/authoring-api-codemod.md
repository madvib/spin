# The authoring API's codemod: what it does, and what it cannot

**Status: the corpus is converted. The codemod is `scripts/authoring-api-codemod.ts`
and it is the reference for what the conversion means.**

## What it does

| the shape | the transform |
|---|---|
| the event UNION | becomes an event MAP; the union type is derived (`EventUnion<XEvents>`) |
| a body used ONCE | moves to its transition, and its event-type guard goes — the key narrows the event |
| a body used SEVERAL times | stays a named const, above the spec, typed by the fields it reads |
| the `Partial<Context>` return annotation | goes (the transition infers it) |
| the `assigns`/`conds` tables | go |
| a chain of assigns | becomes a list: `assign: [a, b]` |
| the `config` const | is typed, so its transitions get the narrowing |
| the component's `ComponentDef`/`defineComponent`/test | name the MAP, not the union |

## The three things it could not do alone

**1. A body that reads a field of a union type.** The `Partial<Context>`
return annotation is load-bearing when the body names a field whose type is
narrower than a literal — the date-picker's `view: "day"`, whose type is
`DatePickerView`. Without the annotation the literal widens to `string` and
the assignment fails. A SHARED body keeps its annotation; an INLINED one
loses it, because the transition's type does the narrowing.

**2. A body that answers an event the transition does not name.** The
toast's `updateToast` answers BOTH `TOAST.CREATE` and `TOAST.UPDATE` — a
create for a known id is an update. The codemod inlined it under
`TOAST.UPDATE` with the union type, and the machine's own `written` gate
then rejected the create. The body must be a NAMED const, and the create
must call it.

**3. A body that calls another body.** The toast's `createToast` called
`implementations.assigns.updateToast(ctx, e)`. The codemod removed the
table, so the call became empty and the toast grew a second row instead of
updating in place. **A cross-reference between bodies survives only if the
callee is a named const.**

⇒ The rule: **a body that another body calls, or that answers more than
one event, is a named const.** The codemod inlines only the bodies that
answer exactly one event and call nothing.

## The three things only the type-checker could find

- The `config` const needs `Omit<MachineSpec<...>, "context">` when the
  call site supplies the context — and the full `MachineSpec` when it does
  not.
- A hoisted const used before its declaration: the consts go at the
  MODULE's top, after the last import, because a spec may live in its own
  const and a body used inside an object literal cannot be declared there.
- The steps' `STEP.SET` and `STEP.NEXT` carry validator functions the
  bridge attaches at run time. The map must declare them, or the body's
  `event["skippable"]` does not type.

## What it landed

| the gate | the result |
|---|---|
| the units | **977 passed**, 0 failed |
| the e2e | **36/36 suites** |
| the types | clean over `packages/components/src` and `packages/runtime/src` |
| the recipes | clear |
| the library | **51 338 → 49 044** lines: **−2 294** |
| the runtime | 6 507 → 7 333 lines: +826 |
| **net** | **−1 468** |

| the shape | before | after |
|---|---|---|
| the event-type guards | 123 | **33** (the shared bodies, which answer several events) |
| the hand-written event unions | 30 | **0** |
| the named implementations tables | 31 | **0** |
| the side-effect actions | 0 | **0** — the machine is pure |

## The runtime's shape, and why the dispatch narrows FIRST

The runtime keeps the author's map as its config — there is no second
shape and no widening helper. The lookup is exact because the event is
narrowed before the lookup:

```ts
function isEvent<M extends EventMap, N extends EventNames<M>>(
  event: EventUnion<M>,
  name: N,
): event is EventOf<M, N> {
  return event.type === name;
}

function candidatesFor<C extends object, M extends EventMap, N extends EventNames<M>>(
  on: Transitions<C, M> | undefined,
  event: EventUnion<M>,
  name: N,
): readonly Transition<C, EventOf<M, N>>[] {
  if (!isEvent(event, name)) return [];
  const found = on?.[event.type];
  if (found === undefined) return [];
  return isList(found) ? found : [found];
}
```

**A mapped type's indexed access does not distribute over a union of keys,
for a GENERIC map.** So `on[event.type]` alone would lose the correlation
between the name and the event, and the handler would receive the union
instead of its own event. After the guard, `event.type` is the ONE name, and
the lookup returns that name's transitions — narrowed.

**The map's keys are NAMES.** `EventMap` is `object`, not
`Record<string, object>`: an `interface` has no index signature, and the
author's event map is an interface. The names are `Extract<keyof M, string>`.

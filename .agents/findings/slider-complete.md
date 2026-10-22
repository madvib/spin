# Slider: the completed precedent

**Status: done, tuned to A-grade typing, zero casts, gated green.**
Fan-out pattern frozen pending approval.

## What it is

One component taken end to end through the target shape and second-opinion tuning pass:

```
spin-slider/
  slider.machine.ts      the chart only — states, transitions as names (104 lines / 2,893 chars; was 490 lines / 16,635 chars)
  slider.events.ts       the contract: map, union, payload/change types (34 lines / 936 chars)
  slider.state.ts        the shape: state union, context, args, initial(), value logic (182 lines / 5,695 chars)
  slider.transitions.ts  the writes: named bodies with AssignFor/GuardFor signatures (101 lines / 3,598 chars; was 181 lines)
  slider.bindings.ts     the consumer surface (375 lines / 14,017 chars; was 514 lines / 20,727 chars)
  examples/*.html        <script>const machine = slider({...})</script> + markup on machine.*
```

## What was proven (not asserted)

| claim | proof |
|---|---|
| the script AND template expressions typecheck | `script-check` extracts multi-line `<script>` blocks (via balanced `matchParen`/`scanStatementEnd`) AND walks `parse(markup)` AST to typecheck every `{...}` expression, spread, and `<template for={...} as={row}>` body against `SliderApi` |
| the api derives from the def with exact types | `ApiOf<typeof def>` + `slider.apiof.test.ts` (30 members + `AssertExact` proofs for state union, command tuples, method args, and slot parameter types); hand-written `SliderApi` deleted |
| state names are a checked union (`SliderState`) | `TState extends string` threaded through `createMachine`, `Machine`, `ComponentDef`, `PartScope`, `BridgeLive`, and `ApiOf["state"]` (`"idle" \| "focus" \| "dragging"`) |
| `EventOf` distributes over event-name unions | `AssignFor<SliderContext, SliderEvents, "INCREMENT" \| "ARROW_INC">` narrows per-event payloads without manual parameter/return annotations or `void ctx;` noise |
| `scope.send` is checked against `EventUnion<E>` | `ScopeFor<C, E, S>` and `SlotScopeFor<R, C, E, S>` check every `scope.send(...)` call in `bindings.ts`; caught real event-contract drift in `editable`, `signature-pad`, and `rating-group` |
| zero `as` casts in slider implementation | `grep '\bas\b' packages/components/src/spin-slider/*.ts` (excluding tests and import aliases) = 0; `written()` in `slider.state.ts` indexes `SliderArgs` by `keyof SliderArgs` |
| inline slot literals hit the bag cache | `keyed()` in `bags.ts` caches primitive and inline value-wrapper slots (`{ index: row }`, `{ value: row }`) by structural key instead of missing `WeakMap` on every tick; synchronous `scope.root()` reads key by `slotFieldKey(root(), WHOLE)` |
| parts and slots auto-stamp `id`, `data-scope`, `data-part` | `synthesize.ts` stamps `id`, `data-scope`, and `data-part` from `def.name` and the part/slot key; `root: {}`, `valueText: { id: "value-text" }`, `markerGroup: { id: "marker-group" }` need no boilerplate `attrs` |
| RTL geometry is logical across all parts | `thumb`, `range`, and `marker` all position with `insetInlineStart` instead of mixing `insetInlineStart` with physical `left` |

## Before → After (Base `0034eae` → First Pass `61bff33` → Tuned)

| scope | base (`0034eae`) | first pass (`61bff33`) | tuned | Δ vs base |
|---|---|---|---|---|
| slider package (chars, all files) | 54,916 | 45,975 | **40,063** (37,533 excl. `apiof.test.ts`) | **−14,853 (−27%)** / **−17,383 (−32%)** |
| slider package (lines, excl. `apiof.test.ts`) | 1,283 | 1,139 | **1,073** | **−210 lines (−16%)** |
| `slider.machine.ts` | 490 lines / 16,635 chars | 120 lines / 3,486 chars | **104 lines / 2,893 chars** | **−386 lines (−79%) / −13,742 chars (−83%)** |
| `slider.bindings.ts` | 514 lines / 20,727 chars | 448 lines / 17,489 chars | **375 lines / 14,017 chars** | **−139 lines (−27%) / −6,710 chars (−32%)** |
| `slider.transitions.ts` | (in machine) | 181 lines | **101 lines / 3,598 chars** | −80 lines vs first pass (−44%) |
| `slider.state.ts` | (in machine) | 210 lines | **182 lines / 5,695 chars** | −28 lines vs first pass |

### Dead weight deleted in the tuning pass

- Duplicate `round10` and `closestIndex` left in `slider.state.ts` (already in `@spin/runtime`).
- 5 dead scalar `SET_*` events (`SET_MIN`, `SET_MAX`, `SET_STEP`, `SET_DISABLED`, `SET_READ_ONLY`) and their 5 transition functions (`setMin`, `setMax`, `setStep`, `setDisabled`, `setReadOnly`) — superseded by silent `fields` sync.
- Write-only `dragOffset` and `dragStartValue` context fields, `setDragOffset`, `snapshotDragStart`, `clearDragRefs`, `THUMB_POINTER_DOWN.offset`, thumb midpoint rect math, and unused `{ values, index, swapped: false }` return wrappers on `resolveNone`/`handlePush`.
- Unused `markerRowsCache` and `markerRowsOf` in `slider.bindings.ts`.
- Runtime `typeof i === "number"` and `Array.isArray(v)` defensive narrowing inside `def.commands` and `def.methods` (replaced by typed tuple parameters `[value]: [value: readonly number[]]`, `[index]: [index: number]`).
- Manual `id`, `data-scope`, and `data-part` repetition across 9 parts and slots.

## Type Safety Grade: A

Every gap identified in the `B+` grade is now closed at the runtime level:

1. **State union (`SliderState`)**: `SliderApi["state"]` and `scope.state` are `"idle" | "focus" | "dragging"`, not `string`.
2. **Command call signatures**: inferred from `event([arg1, arg2]: [T1, T2])` via `CommandFn<T>` — `SliderApi["setValue"]` is `(value: readonly number[]) => void`; `setThumbValue` is `(index: number, value: number) => void`; `focus` is `() => void`.
3. **Method call signatures**: inferred from `call(ctx, state, [index]: [index: number])` via `MethodValue<T>` — `getThumbValue` is `(index: number) => number`; `getMarkers` is `() => number[]`.
4. **Slot `getXProps(slot)` parameter types**: inferred from `attrs(scope: SlotScope<R, ...>)` via `SlotPropsFn<T>` — `getThumbProps` is `(slot: { readonly index: number }) => Record<string, unknown>`.
5. **Template expressions**: `script-check.ts` checks all template expressions, spreads, and `<template for>` bindings against the callable component's `Api`.
6. **`scope.send` & `fields`**: checked against `EventUnion<E>` (`ScopeFor`/`SlotScopeFor`) and `FieldsContract<TContext, TEventMap>`.

## Remaining open items (corpus-level decisions)

1. **Commands don't report to the host.** `setValue([75])` moves the machine silently; whether imperative commands should fire change events is a design ruling.
2. **Flag day.** `<scope>` path, `coerceProps`, `attrParsers`, and `factAttrs` still live for the remaining components until fan-out completes.
3. **`.presentation.ts` rename.** Approved in principle; execute once across all components at fan-out completion.

## Fan-out pattern (frozen)

For each component, in order:
1. Split `<name>.events.ts` and `<name>.state.ts` (including `<Name>State` union); drop dead `SET_*` events for silent `fields` and any write-only context fields.
2. Extract `<name>.transitions.ts` using `AssignFor<Context, Events, K>` and `GuardFor<Context, Events, K>`.
3. Wire `<name>.bindings.ts` with `ScopeFor`/`SlotScopeFor`, typed tuple args on `commands`/`methods`, rely on auto-stamped `id`/`data-scope`/`data-part`, replace hand-written `<Name>Api` with `export type <Name>Api = ApiOf<typeof def>`, and add `<name>.apiof.test.ts`.
4. Enforce the firewall (zero `scope.props` reads, zero `as` casts, logical RTL styles, math from `@spin/runtime`).
5. Replace `data-[...]` hooks with class objects in `<script>` examples + embed in specimens + run full gates (`deno check`, `deno test`, `script-check`, `recipe-check`, e2e).

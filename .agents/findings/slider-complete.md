# Slider: the completed precedent

**Status: done, gated green on a clean worktree (`61bff33`).**
Fan-out pattern frozen pending approval. No new work starts until
the shape is signed off.

## What it is

One component taken end to end through the target shape:

```
spin-slider/
  slider.machine.ts      the chart only — states, transitions as names (120 lines, was 490)
  slider.events.ts       the contract: map, union, payload/change types
  slider.state.ts        the shape: context, args, initial(), value logic
  slider.transitions.ts  the writes: named bodies with per-event signatures
  slider.bindings.ts     the consumer surface (presentation rename pending)
  examples/*.html        <script>const machine = slider({...})</script> + markup on machine.*
```

## What was proven (not asserted)

| claim | proof |
|---|---|
| the script typechecks args | `script-check` gates 7 blocks; caught a real error during development (factory's `authored` param) |
| the api derives from the def | `ApiOf<typeof def>` one-directional proof + surface pin (29 members); hand-written `SliderApi` deleted |
| per-event signatures hold | 12 `if (event.type !== ...)` guards deleted; `deno check` + 13 unit tests green |
| no props reach the machine | `grep scope.props` = 0 in bindings; `written()` is presence-based, twin-compatible |
| the class object preserves per-thumb semantics | e2e asserts thumb 0 rings while thumb 1 does not (`slider-range`) |
| rendering matches state | e2e asserts `inset-inline-start: 50%/20%/80%` against declared values |
| gestures report platform truth | `use:drag` carries `direction`; slider reads it at event time |
| e2e asserts the right channel | machine state for machine moves (`aria-valuenow`), host readout only for the controlled channel |

## What it cost and what it saved

- Slider package: 54,916 → 45,975 chars (**−16%**); machine file 16,635 → 3,486 (**−79%**). Lines are neutral (+20); characters measure what authors read.
- Deleted outright: `numProp`, `valuesProp`, `orientationOf`, `dirOf`, `facts` + `factAttrs` + the 345-line codemod's slider surface, `slotIndex` leniency, 13 `as number` casts, the hand-written `SliderApi` (31 lines), the `node_modules` deep import, the specimen's duplicate markup (32-line html file), 10 `dir:` prop echoes.
- Runtime gained ~490 lines (`math/numbers.ts`, `script-block.ts`, `script-check.ts`, plugin script path, `ApiOf`, bridge threading). The facts codemod (−345) and per-component boilerplate die at fan-out/flag-day; net goes negative as the corpus migrates.

## Open items (explicitly not done)

1. **Commands don't report to the host.** `setValue([75])` moves the machine silently; the e2e asserts machine state because the host channel stays silent on machine moves. Whether commands should emit is a design ruling (recorded, not decided).
2. **Typed states.** `state: string` everywhere — typo'd comparisons compile. `S extends string` threading through `createMachine` fixes it; designed, unbuilt.
3. **Command call signatures.** Derived api exposes `(...args: unknown[])`; per-command typed calls (`setValue(value)`) exist nowhere now that the hand-written interface is gone. Needs declared signatures in `CommandDef` or accepted looseness.
4. **Flag day.** `<scope>` path, `coerceProps`, `attrParsers`, mini-DSL still live for 30 components.
5. **`.presentation.ts` rename.** Approved in principle; name pending.
6. **`ScopeLike`/`SlotLike` boilerplate.** Derivable (`ScopeOf<typeof def>`); not built.
7. **Specimen `slider.e2e` race.** Pre-existing bind-timing failure on clean tree; the script path has no such race (declarative seeding). Resolves when specimens embed examples everywhere — slider done, 30 to go.

## Fan-out pattern (frozen)

For each component, in order: (1) events/state split, (2) transitions out with per-event signatures, (3) `ApiOf` proof then interface deletion, (4) firewall (props→context, drag direction, logical geometry), (5) class objects replacing `data-[...]` hooks, (6) `<script>` examples + specimen embedding, (7) full gates on clean worktree. Subagents take (1)–(2) mechanically (max 2 at a time, named files, exact gates, report misfits); steps involving judgment (api mismatches, e2e contract fixes) stay in this thread.

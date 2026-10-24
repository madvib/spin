# The target shape, and the work in front of us

**This is the plan. Nothing in it is implemented beyond what the commit log
says.** The user asked for it to be written down so the shape stops being
repeated, and so the work ahead can be tracked.

Its sources: the user's own words in the session transcripts (`01a053b3`), the
10-21 bloc exchange, and the measurements in this directory.

---

## 1. The file layout: the bloc analogy, taken seriously

> _"Are you familiar with the bloc pattern? states, events, and the bloc itself
> all had a different file. I think we might reasonably be looking at ~4-6 files
> per machine. If that improves one's ability to grep what is going on I do not
> mind the file count."_ — 10-21

**"Bindings" is the wrong name** — it is not bindings, it is the presentation.
And `.def → .bindings` bought little: the count did not drop because **the
separation did not happen** — the content is still muddled.

**The rule that makes it work: the machine file contains ONLY the statechart.**
The test: can an author open `menu.machine.ts` and see the whole behaviour with
nothing in the way? Today, no — `parseEntry` is at line 111 and the 13-line
`MenuEvent` union at 93 has nothing to do with the statechart.

| the file                 | owns                                         | changes when            |
| ------------------------ | -------------------------------------------- | ----------------------- |
| `<name>.machine.ts`      | **the statechart only**                      | the behaviour changes   |
| `<name>.events.ts`       | the events — the contract with the outside   | that contract changes   |
| `<name>.states.ts`       | the state names and the context              | the state changes       |
| `<name>.presentation.ts` | the DOM: the parts, the slots, the commands  | the DOM changes         |
| `<name>.values.ts`       | the value shapes: the parsers, the coercions | a value's shape changes |
| `<name>.test.ts`         | the behaviour                                | the behaviour changes   |

⇒ **The `<name>.values.ts` slot answers the file-separation question** that was
measured as impossible: the bindings import the machine, so nothing the machine
needs can move _into_ the bindings (a cycle) — but a third file, imported by
both, can hold the value shapes. Measured: 3 parsers are the machine's alone, 4
are the machine's _and_ the presentation's.

⇒ **The target**: the menu's machine is ~60 lines, every one of them the
behaviour.

## 2. The props, the arguments, and the coercion: none

> _"there should be no coercion in the machines/bindings… meaning NO FUCKING
> COERCION AT ALL"_ — 10-22

> _"Props or ARGS? WHICH IS IT? why the fuck are you calling these 'bags' that
> is not right. no casts should be necessary either. typed end to end means
> typed end to end."_ — 10-22

**The component is the .html file.** It is registered as a web component and it
owns its props — the contract for host frameworks to add data. **The machines
know nothing from this whatsoever.** The machines are the UI logic holders,
exposed via the context API.

⇒ ⇒⇒ **⇒ THE END-TO-END TYPING CHAIN:**

| the hop                 | today                                                                                                                          | after                                                   |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------- |
| the props' types        | the scope decl's mini-DSL (`bool｜int｜string｜string[]｜object-array`) — a **string** the component's TS cannot see           | **real TypeScript**, declared by the .html              |
| the raw value           | the host's text (`min="5"`) → the runtime's `coerceByType` → the value                                                         | **no coercion** — the host sets a typed value           |
| the machine's arguments | the prop bag, cast (`props as SliderArgs`) ⇒ the machine's args are **strings** (`value?: string`) and the machine parses them | **the machine's own domain types** (`value?: number[]`) |
| the map between them    | none — the bag _is_ the args                                                                                                   | **the presentation holds it**, typed on both sides      |
| the machine's knowledge | it picks prop names by name                                                                                                    | **it knows nothing about props**                        |

⇒ ⇒⇒ **⇒ WHAT THAT KILLS, measured:**

|                                                                 | the count  |
| --------------------------------------------------------------- | ---------- |
| the mini-DSL + `coerceByType` (`packages/runtime/src/props.ts`) | ~250 lines |
| the `as SliderArgs`-style casts                                 | 31         |
| the inline prop narrowings                                      | **326**    |
| the type-narrowing helpers                                      | 32         |
| the value parsers that stay (JSON, CSV, domain values)          | 19         |

⇒ ⇒⇒ **⇒ AND THE `.html`'s SCRIPT** — the scope becomes a script whose only
sanctioned calls are `props()` and `consume()`, with everything else stripped by
the compiler, so **the markup cannot gain an effect**:

```html
<script>
  props({ items: Item[] = [], disabled: boolean = false });
  consume(slider);
</script>
```

⇒ **Spiked, not wired** (`eb8ac40`): the parser reads the block, reports the
props with real TypeScript types, the consumed machines, and errors on anything
else (_"a script may only call props() and consume()"_). ⇒ **The open part**:
the types must not be _strings we parse_ — the script is compiled and
**type-checked**, and only the compiled JS runs. ⇒ **⇒ ⇒ THE DECISION THE USER
HAS ALREADY RULED ON**: _"why the fuck would we use ts to author and then pass
it as a string?"_ ⇒ **⇒ THE PROPS' TYPES COME FROM THE TYPE CHECKER, NOT FROM
OUR PARSER.**

## 3. The class: the machine's data as variants

> _"what if we allowed the machine data to be used for variants inside the
> string ie class=\"bg-green machine.state:bg-red\""_ — 10-22

**`class=""` stays valid** — it is a plain string, uno's own extractor reads it,
nothing changes.

Is it possible? Yes — but there are two mechanisms, and they are not the same
thing, and the first version of this plan conflated them.

The constraint that decides it: CSS can only match the DOM. A live condition
must therefore be in the DOM somehow — or the class must be applied by the
runtime.

**(A) A CSS variant.** The condition is materialized in the DOM (an attribute or
a class on the element) and the CSS matches it.

- the flaw the first plan missed: **the machine's data is per-INSTANCE, not
  per-element.** One component instance has one state; the markup has many
  elements. So the publication is either per-element (the compiler must know
  which elements ⇒ DOM noise on every element) or per-instance (⇒ the CSS needs
  a descendant selector ⇒ and `[data-x] &` does not match the element that
  carries the attribute ⇒ the root's own state-dependent classes break).
- ⇒ **⇒ and it lands on the DOM ⇒ ⇒ it is `data-*` again, under a framework-wide
  name.** The "the preset can own the selector because the naming is fixed"
  trick is real but it is a dodge: it fixes the SELECTOR while the condition
  still has to be published.
- ⇒ ⇒⇒ **⇒ (A) is the mechanism the whole migration is trying to retire. ⇒ It
  should not be the answer.**

**(B) A runtime-applied class.** The class string names the condition and the
class; the runtime evaluates the condition (a typed read of the machine's data)
and adds or removes the class.

- ⇒ **no DOM publication, no attributes, no CSS variant.**
- ⇒ the utilities stay static tokens ⇒ the build sees them ⇒ the extractor needs
  no change.
- ⇒ **⇒ ⇒ ⇒ THIS IS ALMOST EXACTLY THE CLASS OBJECT THAT IS ALREADY BUILT**
  (`class={{ "text-primary": slider.state === "focus" }}`) ⇒ the only difference
  is that the condition would be **spelled as a path into the machine's data**
  rather than an arbitrary expression.
- ⇒ the typing: the path and the value are checked against the machine's
  declared data ⇒ a path that is not a field, or a value that is not one of its
  states, is a **build error**.

The honest position: the user's `machine.state:bg-red` is mechanism (B) — a
class the runtime applies — not a CSS variant. And mechanism (B) is already
built as the class object. The open question is the spelling and the condition's
shape, not the mechanism.

The spelling options:

- `machine.state:bg-red` — the path, then the class. The condition is the path's
  truthiness; useless for a state (a non-empty string), so it needs boolean
  projections of the machine's data.
- `machine.state=focus:bg-red` — the path, the value, then the class. The
  condition is a comparison, so the state works; it is tailwind's
  arbitrary-variant shape (`data-[state=open]:bg-primary`).
- `machine.state:focus:bg-red` — the path, then the value, then the class. Same
  condition, tailwind's prefix shape (`hover:bg-primary`).

And the companion: the class's static half. The class object
(`{{ "bg-primary": cond }}`) and the list
(`["mb-4 text-sm",
{ "text-primary": cond }]`) are both built and working
(`36e332e`), but the user asked for _"class=\"\" + a custom attribute maybe?"_
The shape is open: the variant form above may make the whole conditional-class
mechanism unnecessary, because `machine.state:focus:bg-red` is in the class
string.

## 4. What the class work retires

|                                                                 | the count  |
| --------------------------------------------------------------- | ---------- |
| the `data-[state=…]:` hooks in the recipes                      | **137**    |
| the `data-*` facts vocabulary (`factAttrs` + the codemod)       | ~441 lines |
| the `data-state` conflation (two vocabularies in 14 components) | —          |

⇒ ⇒⇒ **⇒ THE GATE STAYS** (it catches typos under any transport) ⇒ **⇒ THE
VOCABULARY GOES**, when the corpus has migrated off the hooks.

## 5. The work, in order, with the deltas

| # | the work                                                                                                                                                | the lines                    | blocked on                                |
| - | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- | ----------------------------------------- |
| 1 | **the api's derived type** — `ApiOf` reads the api off the def ⇒ the 28 hand-written interfaces go and the markup's expressions are typed               | **−643**                     | nothing                                   |
| 2 | **the props/args split, corpus-wide** — the machine's args become its own domain types; the presentation holds the map; the casts and the narrowings go | **−350ish** + 326 narrowings | the props' declaration shape (§2)         |
| 3 | **the `<script>` scope** — the props' types come from the type checker; the mini-DSL and `coerceByType` go                                              | **−250**                     | the compiler's TS integration             |
| 4 | **the class's variant form** — the machine's data in the class string ⇒ the `data-[…]:` hooks go ⇒ the facts vocabulary and its codemod go              | **−441**                     | the variant's spelling (§3)               |
| 5 | **the bloc file split** — `events`/`states`/`presentation`/`values` per component; the machine file becomes the statechart only                         | 0 lines, 4-6× the files      | 1-4 (the content must be separable first) |
| 6 | **the machine's helpers into the runtime** — the duplicated defensiveness (30×) and the duplicated ARIA (35×)                                           | ~400-500                     | —                                         |
| 7 | **the syntax into the runtime's plugin** — one compiler, not two packages                                                                               | the package count            | —                                         |

⇒ ⇒⇒ **⇒ THE ORDERING PRINCIPLE: 1-4 are the substance and they are sequential**
(each one's result is the next one's input) ⇒ **⇒ 5 is the payoff** (the machine
file becomes the statechart) ⇒ **⇒ 6-7 are the framework's size**.

⇒ ⇒⇒ **⇒ THE MERGE IS INDEPENDENT — and always was.** **Master has ZERO files in
`packages/components/`** (measured:
`git ls-tree -r master --
packages/components` → 0, and 0 at the merge base too)
⇒ **⇒ the components are THIS BRANCH's ⇒ ⇒ the merge never conflicted on them
and never will ⇒ ⇒ the corpus migration cannot gate the merge, and the merge
does not have to wait for it.** ⇒ ⇒⇒ The 51 conflicts are all in master's
territory (the preset 43, the theme's JSON 4, the app/api/lint 4) ⇒ and master's
113 commits MOVE the gates ⇒ ⇒ **⇒ the merge can happen at any point — and it
probably should, so the gates sit on master's footing before the corpus
migration starts.**

## 6. The execution: each step's scope, its gate, its risk

**The method** (and the two failures that produced it):

1. **One decision → one spike in one component → one corpus pass.** Never a
   corpus pass on an unsigned shape. The class object: the slider, in a browser,
   before 2180 sites.
2. **Every pass cuts lines or finds bugs, and reports both.** A pass that only
   adds is suspect — that is how the runtime grew +1 999.
3. **The gate runs on a clean worktree, every time.** Two "green" results this
   session were false (the twin gate read untracked files; the CSS that only a
   clean build caught).
4. **The brief lives in the repo** (`requirements.md`, `target-shape.md`) — the
   anchoring's root cause was that it didn't.
5. **Delegate the mechanical, decide the shaped.** A subagent gets a decided
   design and named files; the decision stays here.

⇒ **The gate set** (every step, every time):

```
deno test --allow-read --allow-import packages/components/src/ packages/runtime/src/
deno check packages/components/src/ packages/runtime/src/
bash /tmp/run-e2e.sh <worktree>        # 36 suites
deno run -A scripts/recipe-check.ts
deno run -A scripts/uno-class-check.ts
deno run -A npm:oxlint@1.85.0 --config .oxlintrc.json packages/ apps/
```

### Step 1 — the api's derived type

|           |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| the scope | **28 hand-written api interfaces, 671 lines**, in the presentation files; the 1301 `get*Props` call sites in the recipes become typed                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| the work  | `ApiOf<D>` (landed, `define.ts:341`) reads the api off the def's type. But 2026-10-22's slider spike proved the defs don't carry literal types through: over an annotated def, every conditional matches nothing (`keyof` gives the `Record` members); over the raw literal, `satisfies ComponentDef` fails on string widening (28 errors — `event` creators infer `{ type: string }`, not the literal). The last mile is the whole of step 1: pick one def, make its literal satisfy without annotation (const assertions? return-type annotations? a looser `EventDef`?), prove `ApiOf<typeof def>` equals the hand-written interface by a two-directional assignability test — only then change `defineComponent` and fan out. |
| the gate  | the type check + the units + the two-directional assignability proof; the recipes' expressions type-check ⇒ a typo in `get*Props` becomes an error                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| the risk  | the derived type must name the parts' getters the same way the hand-written ones do — **the derived names are the contract now**, so a wrong `Capitalize` breaks every recipe                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |

### Step 2 — the props/args split, corpus-wide

|           |                                                                                                                                                                      |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| the scope | **33 casts in 31 files**; **518 prop reads in 28 files**; the machine's args are strings today (`SliderArgs.value?: string`) and the machine parses them (`numProp`) |
| the work  | per component: the machine's args become its own domain types; the presentation holds the props → args map; the narrowing reads become typed reads                   |
| the gate  | the type check; the twin gate (the `defaultValue` twin must still reach the machine); the e2e                                                                        |
| the risk  | **the twin rule**: a host that wrote `defaultValue` wrote the channel too — the map must preserve that, and the twin gate is what proves it                          |
| the delta | **−350ish**, and 518 reads become typed (the 326 "narrowings" are the subset that narrows)                                                                           |

### Step 3 — the `<script>` scope

|           |                                                                                                                                                                                                              |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| the scope | **208 example files** carry a scope decl; `packages/runtime/src/props.ts` is ~250 lines of mini-DSL + coercion                                                                                               |
| the work  | the script block is compiled and **type-checked**; the props' types come from the checker, not from our parser; the compiler strips everything but `props()`/`consume()`; the mini-DSL and `coerceByType` go |
| the gate  | a build that **fails** on a wrong prop type — the gate is the type check itself, run over the markup                                                                                                         |
| the risk  | **the checker integration** — the plugin compiles the component's TS through unplugin's esbuild today; the markup's script needs the same, plus a type query for the props' type                             |

### Step 4 — the class's variant form

|           |                                                                                                                                                                                                                |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| the scope | **1276 `data-[…]` hooks in 155 files** (137 of them `data-[state=…]`); the facts vocabulary (`facts.ts`, the 345-line codemod) in **24 files**                                                                 |
| the work  | the machine's data as the class string's condition. The class object (mechanism B) is already built; the variant spelling may make it and the hooks unnecessary. Then the facts vocabulary and its codemod go. |
| the gate  | the class check (it must see the variant's utilities) + the e2e (the styles must actually apply)                                                                                                               |
| the risk  | the spelling and the condition's shape (§3). A CSS-variant mechanism would put the machine's data back on the DOM and reopen the data-* question.                                                              |
| the delta | **−441** (the vocabulary + the codemod) and the hooks go                                                                                                                                                       |

### Step 5 — the bloc file split

|           |                                                                                                                                                       |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| the scope | **32 machine files, 10 428 lines**; 14 hold a parser; the parsers that repeat: `parseKeys`×3, `parseValue`×2                                          |
| the work  | `events` / `states` / `presentation` / `values` per component; the machine file becomes the statechart only                                           |
| the gate  | the units (per component) + the e2e; the rule: _open `menu.machine.ts` and see the whole behaviour_                                                   |
| the risk  | **the file count** — 4-6 files × 31 components. The user accepted the count for grepability; the check is that each file has **one reason to change** |
| the delta | 0 lines, and the machine file becomes the statechart                                                                                                  |

### Step 6 — the machine's helpers into the runtime

|           |                                                                                                                                                                                                                                  |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| the scope | the helpers that repeat 3+: `initial`×31, `config`×23, `implementations`×23, `isInteractive`×6, `asCount`×4, `clearValue`×3, `parseKeys`×3, `startOpen`×3 — and the duplicated defensiveness (30×) and the duplicated ARIA (35×) |
| the work  | the runtime/preset own the _shapes_; a component owns its values                                                                                                                                                                 |
| the gate  | the units; the corpus's behaviour must not move                                                                                                                                                                                  |
| the risk  | the ARIA vocabulary is already 407 lines — it is the framework's own surface, so it stays, but it should shrink                                                                                                                  |

### Step 7 — the syntax into the runtime's plugin

|           |                                                                                                                                                      |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| the scope | `packages/syntax` (the IR, the parser, the scope grammar, the class tokens) is a separate package; the compiler is the runtime's `plugin/`           |
| the work  | one compiler, two halves (the pure one and the emitting one) in one place                                                                            |
| the gate  | the type check + the units                                                                                                                           |
| the risk  | the package boundary is the _dependency_ boundary: `@spin/syntax` has no dependencies today ⇒ folding it in must not make the runtime depend on more |

The ordering: steps 1 to 4 are sequential (each one's result is the next one's
input). Step 5 is the payoff. Steps 6 and 7 are the framework's size.

Step 1 needs no decision: the api's derived type is plumbing with one right
answer, and steps 2–4 all lean on it.

## 7. The standing work the migration queue was standing in for

- **the tark parity/quality pass** — every component's behaviour, pixel-close,
  screenshots of every state.
- **the actions integration** — `use:`/actions is designed but not integrated.
- **the controlled channel** — how a host's write reaches a machine.
- **the distribution story** — prebuilt web components, the API.
- **the benchmarks** — shipped bytes, js-bench.

## 8. The decisions — answered 2026-10-22

1. **the class's internals** — (B), settled long ago: the runtime applies the
   class; no CSS variant, nothing on the DOM. The open question was never A-vs-B
   — it is B's _internals_: how the runtime evaluates the condition (a typed
   read over the machine's data) and where the evaluation lives (the class
   binding path). Spec'd in step 4's spike.
2. **the spelling** — `machine.state:focus:bg-red` (path + value, prefix shape).
   Agreed.
3. **the class's static half** — the variant form is enough on its own; the
   conditional-class mechanism (`class={{…}}`, the list, `classOf`) goes with
   it.
4. **the props' declaration** — the .html's script owns the props, full stop.
   One machine is consumed by n components; the machine's spreadable attributes
   belong to the presentation and are registered onto the machine's args, typed
   on both sides. Instantiation is `const ctl = slider(args)` — the machine is a
   function, call it. No `useMachine`, no exports, no `machine=`/`consume=`
   attributes. The compiler provides nothing except the checker seeing the whole
   unit; the call's semantics are the factory's semantics (called here, fresh
   instance, caller owns lifecycle). Sharing is imports, not syntax. The
   component declares whatever props it wants; args-typing happens at the call,
   checked against the machine's `A`.
5. **the script surface** — decided: `const ctl = slider(args)` as above.
6. **the file names** — `.presentation.ts` is a working name only; the shape
   needs approval. Open: does `<name>.values.ts` earn its existence (redundant
   and misleading as a name?), and is `machine.ts` + `states.ts` one file too
   many?
7. **the merge** — off the table. Components and runtime only; neither
   conflicts.

## 9. Slider: completed precedent (tuned)

Full writeup: `slider-complete.md`. Summary:

- **Five files, firewall holds, zero `as` casts, script + template expressions
  typechecked, e2e green.**
- Size vs base (`0034eae`): package **−27% chars** (−32% excl. `apiof.test.ts`,
  **−210 lines**), `slider.machine.ts` **490 → 104 lines (−79% lines / −83%
  chars)**, `slider.bindings.ts` **514 → 375 lines (−27% lines / −32% chars)**,
  `slider.transitions.ts` **181 → 101 lines (−44%)**.
- Deleted: coercion helpers, facts vocabulary surface, all `as` casts,
  hand-written `SliderApi`, duplicate `round10`/`closestIndex`, 5 dead `SET_*`
  events/transitions, write-only `dragOffset`/`dragStartValue`,
  `markerRowsCache`, manual `id`/`data-scope`/`data-part` boilerplate, runtime
  `typeof` guards in commands/methods.
- Runtime upgrades: distributive `EventOf`, `AssignFor`/`GuardFor`,
  `ScopeFor`/`SlotScopeFor`, `TState` union threading (`StateOf<D>`), tuple arg
  inference in `CommandFn`/`MethodValue`, slot param inference in `SlotPropsFn`,
  callable `defineComponent`, auto-stamped part/slot
  `id`/`data-scope`/`data-part`, structural slot memoization for inline
  `{ index: row }` literals, multi-line `stripScript`, full template AST
  typechecking in `script-check.ts`.
- Type safety: **A** (proven by `AssertExact` checks in `slider.apiof.test.ts`
  and template typechecking in `script-check.ts`).

**Fan-out order per component:** events/state split (`<Name>State` union, drop
dead `SET_*`) → transitions with `AssignFor`/`GuardFor` → `ApiOf` + typed
command/method tuples + auto-stamped parts + interface deletion → firewall (zero
`scope.props`, zero casts, logical RTL) → class objects + `<script>` examples +
specimen embedding → full gates.

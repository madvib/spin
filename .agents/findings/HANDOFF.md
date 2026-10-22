# The handoff

**Read `requirements.md` FIRST, then this file.** The requirements are the
standing brief — the user's own words, distilled from the session
transcripts, which are **not in the repo**. The specs that used to hold
them were deleted at the user's instruction, and the findings in this
directory are *derivations*, not the brief. **An instance that works from
the repo alone anchors on whatever it derives** — that is how a four-item
queue came to stand in for a dozen standing concerns.

This file carries the *state*: where the branch is, what landed, and the
measurements behind the next step.

---

## 1. Where the branch is

**Branch** `migration/bindings-grammar`, at `af3e8af`. The tree is **green
and committed** — a clean place to compact.

| the gate | the command | the result |
|---|---|---|
| the units | `deno test --allow-read --allow-import packages/components/src/ packages/runtime/src/` | **1017 passed** |
| the types | `deno check packages/components/src/ packages/runtime/src/` | **0 errors** |
| the e2e | `bash /tmp/run-e2e.sh /home/madvib/dev/spin-runtime` | **36/36** |
| the recipes | `deno run -A scripts/recipe-check.ts` | **all clear** |
| the classes | `deno run -A scripts/uno-class-check.ts` | 23 warnings — **pre-existing**, identical on `a9b490e` |
| the lint | `deno run -A npm:oxlint@1.85.0 --config .oxlintrc.json packages/ apps/` | 1 467 (the baseline is 1 470) |

| | base `a9b490e` | now | Δ |
|---|---|---|---|
| the library (`packages/components/src`) | 51 338 | 48 643 | **−2 695** |
| the runtime (`packages/runtime/src`) | 6 507 | 8 488 | +1 981 |
| **net** | | | **−714** |

**The net is DOWN from −940, and the reason is the class vocabulary pass:
it bought a vocabulary and a gate for ~230 library lines.** The ARIA
pass did the same before it (−2 033 → −940). Both are architecture wins,
not line-count wins — say so if the line count is the metric that
matters.

**The `master` merge is NOT done**: `master` has ~115 commits our branch
lacks. Nothing has been pushed.

---

## 2. What landed (the commits, newest first)

| the commit | what |
|---|---|
| `af3e8af` | **a selection is a selection, not a state**: the `checked\|unchecked` vocabulary is gone from `data-state`; four components' duplicate sites are gone; the tree-view's code no longer contradicts the comment above it |
| `d17b052` | an attribute selector's value must be an identifier — the invalid CSS the *clean* build caught and the author's tree hid |
| `7a03cbe` | **the class vocabulary**: the component declares its public state, the runtime writes it, and the gate checks the recipes' hooks against the declaration. **It found 148 dead rules** (92 real) — class hooks no component ever writes. |
| `0641569` | **the ARIA primitives**: every `aria-*` attribute has a primitive; 158 invocations across 30 files, 102 sites. Plus two waits that could not fail. |
| `fbfe686`, `40ee96b` | the comments state the constraint, not the provenance (170 Zag mentions) |
| `dc15521` | the toast e2e reads a report history, not the newest report |
| `1d7f697` | the twin gate reads the canonical scope decl (it must run on a clean worktree) |
| `56adefe` | the e2e boilerplate is stated once (36 files, +15/−222) |
| `07deb2f` | **the `sig` dies**: all 286 hand-written dependency functions are gone |
| `cfb52bd` | the authoring API's codemod (`scripts/authoring-api-codemod.ts`, idempotent) |
| `19d1b6b` | **the authoring API** in the runtime: the events are a map, the key narrows the event |
| `cc4e8ed` | the runtime's legacy `config`/`implementations` path is gone (0 of 31 bindings used it) |
| `1d5a7bf` | **the twin gate** — and it found a real bug (below) |

### The bug the gate found

The number-input's scope declares `defaultValue: string = "3"`, and the
machine read `""`. Its **hand-written bridge narrowed** the prop bag into
`NumberInputArgs`, dropping the twin the machine's own `written()` gate
reads. The host's *authored* write worked; the *declared* default never
arrived. The e2e suite had 40 assertions and never caught it — every one
was about a gesture. The gate is `packages/components/src/twins.test.ts`
(19 tests, data-driven from the corpus's own scope decls).

### The authoring API, in one place

```ts
export interface XEvents {          // the MAP: the contract with the outside
  "SET_VALUE": { value: string };
  "PING": {};
}
export type XEvent = EventUnion<XEvents>;

createMachine<XContext, XEvents>({
  on: {
    // the KEY narrows the event: no union, no guard, no `Partial<Context>`
    "SET_VALUE": { assign: (_ctx, event) => ({ value: event.value }) },
  },
});
```

**The finding that cost the most**: a mapped type's indexed access does
**not** distribute over a union of keys, for a generic map. So
`on[event.type]` alone loses the key↔event correlation. The runtime
**narrows the event first** (`isEvent`), and the lookup is then exact. The
runtime keeps the author's map as its config: no second shape, no cast.

**The machine is PURE**: the corpus had zero side-effect actions, so the
named implementations table and the resolved-actions list are gone.

---

## 3. The `sig` pass: DONE (a subagent's work, verified)

**The goal was:** a bag's key is derived from what the build read, so no
component hand-writes its dependencies. There were **286** hand-written
`sig()`s (~570 lines) in `packages/components/src/*/*.bindings.ts`, and
`sig` was a required member of `PartDef`/`SlotDef`.

**It landed.** `sig` is gone from the type and from all 286 sites.

| | before | after |
|---|---|---|
| the hand-written `sig()`s | 286 | **0** |
| the library | 49 096 | **48 228** (−868) |
| the runtime | 7 333 | **7 486** (+153) |
| the units | 977 | **985** (+8) |
| the lint | 1 473 | **1 470** (3 better) |

**The derived key is now complete.** It covers the context fields, the
props, the **state name**, and the **slot's field values** — objects by
*identity*, primitives by *value* (`valueKey` in
`packages/runtime/src/component/bags.ts`).

**The three design decisions worth keeping:**

1. **`String(value)` was a live bug.** The old `readsKey` compared
   `String(ctx[field])`, so an **object-valued** field was always
   `"[object Object]"` — the key could not see it change. There are **66**
   such fields. `valueKey` now compares an object by identity (a replaced
   array is a changed field even when its length is the same).
2. **A recorder STACK, not a variable.** A build can run inside another
   one (a read that syncs a context field writes a signal, which re-runs
   an effect, which builds another bag). `recorders` is an array, and
   `record` writes to the top — so a nested build's reads go to the
   nested build, and the outer build keeps its own.
3. **The scope records EVERY read it exposes.** `scope.state` (273 corpus
   reads) and `scope.slot` (133 whole + 40 field) were invisible to the
   derived key, because the state is a plain getter and the slot a plain
   object. Both now go through recording proxies. A whole-slot read
   records `WHOLE` and the key compares **every own field** of the slot.

**The tour's spotlight** moved into the tour machine's context
(`spotlight: TourSpotlight` + a `SPOTLIGHT.SET` event the view sends);
the `viewOf(root)` WeakMap is deleted. It was the one thing genuinely
outside its machine.

**Part (B) was NOT needed.** I checked: the toast's countdown
(`current.remaining`) is read inside a *directive's* param, not in a
bag's `attrs` — so the bag never rebuilds on a tick, and no row is
re-stamped. The finding's worry (a ticking row losing its click) does not
arise, because the countdown is not a bag dependency.

**The previous handoff's diagnosis was wrong on two of three.** It blamed
the tour's spotlight, the combobox's/menu's open-ness, and the toast's
countdown. The combobox's and the menu's `open` are ALREADY context
fields. The real gaps were `scope.state` and `scope.slot`.

### How the whole-context read was resolved

**216 corpus sites read the WHOLE context** (`const ctx = scope.context`).
A whole-context read means "depends on SOME field" — the derived key
cannot know which. **The answer: it does not need to.** The proxy is passed
along, so the *member* reads that follow are recorded. `const ctx =
scope.context;` then `ctx.foo` records `context:foo`. The whole-object
read itself is not a dependency — the fields the build actually uses are.

**A coarse key churns, and was tried.** The reverted experiment (`07e881b`)
made a whole-context key and the **toast** failed — the countdown churned
the key and the click was lost. The fix was NOT to make the key coarse. It
was to notice that the countdown is read inside a *directive's* param, not
in a bag's `attrs` — so it was never a bag dependency at all.

**⇒ The lesson: the coarse key was the wrong answer to the right
question.** The question was "the bag missed a dependency", and the answer
was "the bag did not have that dependency". See `sig-removal.md` for the
reverted experiment and `sig-key-precision.md` for the two measurements
that decided the design.

**The distinction that matters:** a bag REBUILDING is fine; a row
**RE-STAMPING** is not. The finding says: *"a slot's identity is the memo's
key and its content is not a dependency — a row whose content ticks must not
re-stamp every tick, or the click is lost."* The subagent was told to treat
these as two independent steps — and **the second turned out to be
unnecessary**: the toast's countdown is read in a directive's param, not in
a bag's `attrs`, so no row re-stamps.

---

## 4. The queue after that

Each item is now **measured**, and two of the queue's premises were wrong.

| # | the item | the measurement, and the shape |
|---|---|---|
| 1 | **the ARIA primitives** | **DONE.** `packages/runtime/src/aria.ts` (407 lines) + its test (368 lines): every `aria-*` attribute has a primitive, and the composites (`disclosureTrigger`, `listSurface`, `comboboxInput`, `sliderThumb`, `optionRow`, `liveRegion`) state a pattern once. **158 invocations across 30 bindings files, 102 sites.** Only the 63 distinct-content `aria-label`s are still spelled by hand, plus 6 in `menu.bindings.ts` that copy a trigger's attributes onto a cloned trigger. The DOM is unchanged — the boolean spelling stays per site (the colour-picker says `"false"`, the select says `false`), because unit tests assert the bag's value. |
| 2 | **the element's prop types** | 708 prop declarations, 607 prop reads, **326 INLINE narrowings** (the queue's "37 parsing helpers" was wrong: only 32 helpers are type narrowings, and 19 are value parsers a typed prop KEEPS). The cost is the narrowings. **The blocker: the types live in the MARKUP and the component cannot see them** — the scope decl is in the `.html`, the bindings are hand-written TS. Full analysis in `prop-types.md`. **The biggest decision left.** |
| 3 | **the class vocabulary** | **DONE (`7a03cbe`).** The component declares its public state (`export const facts = {…}`) and the runtime writes it (`factAttrs(scope, facts, "disabled", …)`); the names are the declaration's keys, so a name that is not declared does not compile. 24 of the 34 def files migrated, 57 facts. **The gate found 148 dead rules** — a `data-[…]` variant naming an attribute no component writes. 92 were real (the carousel's focus, the carousel's slide count, the select's focus, the combobox's selection, the steps' `complete`, the carousel's `snap`) and all are fixed. The DOM did not change. Detail in `class-vocabulary-landed.md`. |
| 3b | **`data-state`'s two vocabularies** — the NEXT step of the class vocabulary | **HALF DONE (`af3e8af`): the SELECTION is out.** The `checked\|unchecked` vocabulary is gone: where a component already published the fact, the `data-state` was a duplicate and is gone; where it did not, the fact is `data-selected` (a selection) or `data-checked` (a check). The recipes follow. **The other half is a DECISION, not a rename: the eight overlay components write `data-state="open"\|"closed"`, a DERIVED value, while six components use `data-state` for the MACHINE's state.** The recipes key on it in 137 places and the e2e asserts it in ~30. **(a) `data-state` becomes the machine's state and the open-ness becomes `data-open`** (the convention; the DOM and the e2e change) **or (b) `data-state` keeps the derived open\|closed and the machine's state takes a new name** (nothing changes for the consumers; the corpus keeps two conventions). Measured in `class-vocabulary-part-two.md`. |
| 4 | **the file separation** | **ANSWERED: no change** (`merge-remeasured.md`). The bindings import the machine, so nothing the machine needs can move into the bindings — a cycle. The parsers ARE the machine's (`initial(args)` shapes the context from the raw props), and **the bindings already import the shared ones from the machine** (the date-picker's `parseDay`, the splitter's `parsePanels`, the cascade's `parsePath`/`parsePaths`). A third file is possible but adds a file, an import and a header to move seven functions in four components, and the line count is a goal. **⇒ The machine file keeps the statechart, the assigns, the context, the events, the parsers and the args type; the bindings import what they need, as they already do.** |
| 5 | **the names** | one verb per thing: `machine()`, `parts()`, `element()`, `list()`, `item()`, `text()`, `bool()`. No `define*`. |
| 6 | **the noise** | **measured:** 200 `zag` mentions — 186 in comments, 12 in code, and **2 of the 12 are REAL IMPORTS** (`@zag-js/utils`, `@zag-js/color-utils`) that must not change. The e2e boilerplate is **DONE** (the shared 11 lines moved to the harness; 36 files, +15/−222, comment-only). The zag comments are in flight. |
| 7 | **the merge** | **re-measured (`merge-remeasured.md`): 51 conflicted files, and our migrated packages merge CLEANLY.** 43 are in `packages/preset/` — master **rewrote the token access** (`token(ctx, "color.surface-raised")` where we still have `themeOf(ctx)?.colors?.[…]`) ⇒ take master's form, keep our variant groups. **Our side is not small: 71 files, +1 316/−510** (the variant groups, the class check, the button's chrome) ⇒ "take master" would lose it. 4 are the theme's JSON ⇒ **a design call** (our spacing scale spans the grid; master writes `6.0rem`). 6 are the app, the api, the lint, `deno.json` ⇒ master's new work. **And master's 113 commits move the GATES** (the studio app, the MCP tools, the visual check onto playwright, the harness into `internal`) ⇒ the merge is a project with its own gates. **⇒ Recommendation: merge BEFORE the next migration pass** — every pass on a 113-commit-old base makes the merge bigger. |

---

## 5. The traps (read before you touch anything)

1. **The repo is NOT `deno fmt`-clean** (11 of 12 sampled files differ). Running
   `deno fmt` over the tree reformats **186 HTML example files** and turns
   the authoring API's **−575** into **+11 062**. Format by hand, in each
   file's own style. This cost a real chunk of a session.
2. **A stale dev server on a suite's port** makes that suite fail with a
   `waitForSelector` timeout that looks like a regression. Clear with
   `ss -tlnp | grep -E ":52[0-9][0-9]"` then `fuser -k -n tcp <port>`.
3. **THE GATES MUST RUN ON A FRESH CLONE.** The twin gate read each
   component's `examples/` — and the **color-picker has no tracked
   examples** (only the 30 other components do). So the gate died with
   ENOENT on a clean worktree, and the e2e gate's specimens build depends
   on untracked files too. **Always check the gates in a clean worktree**:
   `git worktree add --detach /tmp/fresh <branch>` — the twin gate now
   reads the canonical element's scope decl (the specimens' `spin-<name>.html`,
   which every component has) and skips a component with no examples.
4. **`packages/components/tests/menu.e2e.ts` is a PROGRAM**, not a
   `Deno.test` — `deno test` reports "0 passed | 0 failed" for it. The
   sweep runs it correctly.
5. **The findings in this directory are NOT committed** (by the user's
   rule: no agent-authored `*.md` in the repo). `.agents/` is
   git-ignored. Do not commit them; do not delete them.
6. **The `sig` reversal is `07e881b`** — read it if you need to know what
   was tried. Its lesson: a coarse key churns.
7. **The toast e2e was FLAKY** — it failed 2-3 runs out of 3, at random.
   The root cause, with instrumented proof: the `status-change` event is
   emitted by DIFFING the toast list, and the dismissing report was
   overwritten **11 ms later** by the rows behind resuming (the pointer
   left the row that had just gone inert). `waitForFunction` polls on rAF
   (~16 ms), so an 11 ms window is **unservable** — and the old wait
   matched an EARLIER report, so it returned instantly and the assert read
   the wrong text. The fix was the OBSERVABILITY, not the timing: the
   fixture now keeps every report in a hidden `#action-log`.
8. **A FALSE PASS is worse than a flake.** The audit of the other suites
   found waits that **cannot fail**: `popover.e2e.ts:64-68` and the
   boolean-slot waits in `tooltip.e2e.ts` and `hover-card.e2e.ts` wait for
   `"false"` in a slot that is ALREADY false — so the wait returns
   instantly and nothing asserts after it. A test that cannot fail is a
   tombstone test. **⇒ When a wait is satisfied before the thing happens,
   the wait is not testing anything.**
9. **A listener leak in the specimens' toast fixture**: the effect re-bound
   on every host write, and Solid 1.9 takes cleanups through `onCleanup`,
   not a returned function — so each report arrived once per bind (4×).
   Fixed. **⇒ A fixture that re-binds is a fixture that multiplies.**
10. **A sweep that runs while you edit is not a sweep.** The e2e reads the
    files live, so a suite that starts after your edit tests the new code
    and the sweep's verdict is a mixture. **⇒ Commit, then sweep a clean
    worktree.** (The class vocabulary's sweep was killed twice for this.)
11. **A codemod that rewrites a whole file can rewrite its SHAPE.** The
    facts codemod re-joined the `@spin/runtime` import onto one line,
    collapsing 11 files' multi-line imports. The codemod now keeps the
    import's shape, and the imports were restored by hand. **⇒ A codemod
    that touches a line it did not mean to touch will.**
12. **`/tmp` IS A 9.8G tmpfs, AND IT FILLS UP.** A clean worktree's vite
    build writes there; with `/tmp/node-compile-cache` at 4.6G the build
    died with **ENOSPC**, and **31 of the 36 e2e suites failed** — the
    `examples` suite first (it builds the specimens), and every suite
    after it because the server never came up. **⇒ A wall of failures
    that starts with one suite is ONE failure. Read the first error.**
    `df -h /tmp` before a clean-worktree sweep; clear the caches
    (`/tmp/node-compile-cache`) if it is near the ceiling.
13. **THE E2E'S BUILD IS CACHED IN THE AUTHOR'S TREE.** A recipe's class
    string that breaks the CSS (an invalid attribute selector) passed in
    the working tree — the vite build reused its artifact — and **failed
    on the clean worktree**, where the build ran from scratch. The
    `examples` suite is the one that builds; every other suite reuses
    what it produced. **⇒ A CSS change is not verified until a clean
    build has run.**

---

## 6. How the delegation went (so the next one is better)

**What worked:** a decided, narrow change per agent, on disjoint files.
The e2e-boilerplate agent finished in **7 minutes** and its diff was
comment-only and verified in one command. The Zag-comments agent took 55
minutes for 170 comments — each one a judgment call — and its report
listed the constraints it KEPT, which is the useful part.

**What did not work:** giving an agent a *design* problem disguised as an
implementation task. The ARIA agent spent ~50 minutes exploring and
returned a plan, not code; a second agent inherited the design it had
written and did the migration.

**⇒ A subagent needs the design DECIDED and the scope narrow. "Where do
these primitives live and what is their shape" is a design task — that is
mine, not theirs.**

**The one that cost real work:** a sibling's `git stash push -u` swept
**untracked** files and destroyed the colour-picker's `examples/` (never
committed, so unrecoverable — I searched every reachable and unreachable
object). **⇒ No agent may run `git stash` in a shared tree.** Say it in
the brief, and make the briefs name the exact files.

**The gates must run on a CLEAN WORKTREE.** The twin gate read the
components' `examples/`, and the colour-picker has no tracked examples,
so it died with ENOENT on a fresh clone — the gate only worked in the
author's tree. Fixed (it reads the canonical scope decl now), and every
brief from here on says to verify in `git worktree add --detach /tmp/fresh`.

---

## 7. The findings index

| the file | what |
|---|---|
| `target-shape.md` | **THE TARGET SHAPE AND THE WORK — read second.** The bloc file layout, the props/args/coercion split, the class variant's feasibility, the seven-step order with the deltas, and the six open decisions. |
| `requirements.md` | **THE BRIEF — read first.** The user's own words, distilled from the session transcripts: the non-negotiables, the settled shape, the open decisions, and what the last two passes did that the brief does not ask for. |
| `machine-architecture.md` | **the spec of record** — the intent, the plan, the ledger |
| `authoring-api-codemod.md` | the authoring API's design, the codemod, and the three things only the compiler could find |
| `sig-key-precision.md` | **the two measurements that shape the derived key** (the `String()` bug; the derived-value reads) |
| `twin-gate.md` | the twin gate and the bug it found |
| `sig-removal.md` | the `sig` removal: what works and the wall (the coarse-key lesson) |
| `prop-types.md` | **the prop types** — the 326 inline narrowings, why the types live in the markup, and the four shapes the fix can take (D is the recommendation) |
| `class-vocabulary-measured.md` | the class vocabulary measured: 853 `data-*` sites, and `data-state` carrying TWO vocabularies |
| `class-vocabulary-landed.md` | **the class vocabulary, landed**: the facts vocabulary, the codemod's rules, the gate, and the 148 dead rules it found |
| `class-vocabulary-part-two.md` | **the selection is not a state**: the `checked\|unchecked` vocabulary is out; the derived `open\|closed` is the one decision left |
| `class-object.md` | **the class object — the markup's half of the agreed design, landed**: the class attribute takes an object (the keys are the utilities, the values are live reads); the merge, the emit, the preset's extractor, and the check |
| `file-separation-measured.md` | the file separation measured: the statechart is under 5% of a machine file, and the claim is too big |
| `merge.md` | **the merge, measured** — 47 conflicts, none in the packages we migrated |
| `merge-remeasured.md` | **the merge, re-measured** (51 conflicts, master's token-access rewrite, the theme's scale) **and the file separation answered: no change** |
| `conventions.md` | the gates, the fmt trap, the component's three files |
| `what-is-a-machine.md` | machines vs. other state management, and the measured decomposition |
| `class-vocabulary.md` | the `data-[…]` conventions → the machine's declared state names |
| `correction.md` | machines are TypeScript; the framework decides |

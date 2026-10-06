# `@spin/runtime` — a component runtime for Zag machines

**Status:** plan. **Location:** worktree `/home/madvib/dev/spin-runtime`, branch `component-runtime`. The main checkout is untouched.

---

## 1. What we are building, and what we are not

A **component runtime**: a ~2 kB reactive core, a Zag bridge, and custom-element registration. It turns Zag state machines into styled DOM, themed by Spin's Uno preset, and runs anywhere a custom element runs.

**Not** a framework. No router, no data layer, no application state, no `<script>` allowed in a component, no virtual DOM. Sail's compiler heritage stays in `/home/madvib/dev/sail` and is *borrowed*, not inherited.

The one thing Sail's heritage gives us eventually: a compiler that enforces the rules below at build time. **Phase 6, not phase 1.**

---

## 2. The signals decision — the benchmark overturned my recommendation

I went in expecting to keep Sail's signals. Measured head-to-head against alien-signals, one process per library, real V8:

| | sail | alien-signals |
|---|---|---|
| state core, minified | **2,543 B** | 5,344 B |
| state core, gzip | **1,159 B** | 1,951 B |

Sail is 41% smaller. But throughput:

| benchmark | sail | alien | ratio |
|---|---|---|---|
| write, 1 subscriber ×1e6 | 168.8 ms | **57.1 ms** | **2.95× slower** |
| 1000 signals × 1 effect, all written | 2.33 ms | **0.81 ms** | 2.86× slower |
| same, inside batch | 1.07 ms | **0.32 ms** | 3.34× slower |
| depth-5 chain, cached reads | **1.07 ms** | 1.47 ms | sail faster |
| untracked read ×1e6 | **11.4 ms** | 16.1 ms | sail faster |

**Sail wins on reads, loses by ~3× on anything with a subscriber.** Every DOM binding has a subscriber. The gap is the notify path: Sail copies its `Set` of dependents to an array on every write, plus allocates a fresh `Reader` per effect re-run.

That copy is **load-bearing**, not sloppy — patching a copy to iterate the `Set` directly hangs forever, because a re-running effect re-inserts itself into the set being iterated. alien-signals avoids it with a module-level queue and swap-to-front ordering, zero allocation per write.

### The behaviour difference that decides it

```
sail   bindings created: 2 before teardown, 3 after;
       a leaked binding still writes into torn-down DOM = true
```

**Sail's scopes do not cascade.** `scope.dispose()` left a child effect alive, and that leak writes into DOM that has been torn down. That is precisely the failure mode a component runtime exists to prevent, and it is the one bug that cost us a full day in the sail-js benchmark: every bound handler resolved to `undefined` because a plain-object member was wrapped wrongly and nothing threw.

alien-signals: `scope(fn)` returns a disposer that unlinks the whole group. **Cascade is correct there.**

### Decision

**Start from alien-signals. Take Sail's primitives that it lacks and that we actually need.**

| take from sail | why |
|---|---|
| `batch(fn)` | alien has `startBatch`/`endBatch`; a callable is better at every call site |
| `untrack(fn)` | alien exposes raw `getActiveSub`/`setActiveSub`, which is not a safe public API |
| the scope *object* shape (`run`/`own`/`dispose`) | alien's is a one-shot group disposer; an object composes and an action needs it |

Do **not** take: the `notify` implementation, the `Reader` allocation, or the dev inspector. The first two are the 3×; the third costs 10–20% on writes for 104 bytes gzip.

**Cost:** we write a ~40-line `batch` and a ~60-line `untrack` over alien's internals, and we own the correctness from then on. **Benefit:** 3× on the write path, correct cascade, and a runtime that is not our problem to maintain.

---

## 3. Weights — REVISED after Phase 2

**The original estimate was wrong by roughly 8×, and the reason is a fact about Zag that only surfaced by running it.**

`@zag-js/core` is **13 kB of helpers with no interpreter in it.** `createMachine` is a state indexer; `Service` is a type only. The actual interpreter — bindable, refs, track, `findTransition`, exit/entry effect bookkeeping — exists **only inside Zag's framework adapters** (React, Solid, Vue, Svelte). Every one of those is built for a framework we do not have.

So a vanilla runtime must **write the interpreter**. `packages/runtime/src/zag.ts` is 590 lines doing that, not the 0.8 kB connector this plan budgeted.

Measured, gzip, per module:

| | src | gzip |
|---|---|---|
| `signal.ts` — reactive core | 4.2 kB | 1,728 B |
| `element.ts` — custom elements | 5.5 kB | 2,283 B |
| `zag.ts` — machine interpreter + bridge | **20.7 kB** | **6,915 B** |

| | kB gzip |
|---|---|
| runtime, no machine (signal + element) | **~4.0** |
| **+ Zag machine interpreter** | **~10.9** |
| + the machine itself (tree-view) | ~19 |

**For scale:** the full Sail runtime measured 12.5 kB gzip with every layer on. Lit is 5.1 kB for all of theirs. A Zag-backed runtime here is roughly **3× Lit**, and the interpreter is two-thirds of it.

This does not kill the plan — but it inverts one assumption. The Zag adapter is no longer a thin bridge; it is the largest and hardest thing we own. That is a real maintenance surface for a library whose machines we do not control.

### What this changes

- **The interpreter is the product.** Everything else is plumbing around it. If we build only this, we have a Zag runtime; if we skip Zag, we have a 4 kB component runtime that is not Zag's.
- **The 1.44.0 floor is hard.** `createReplaceTracker` does not exist in 1.43.x.
- **Two known limits, documented rather than hidden:** a function destructured off `api` closes over the snapshot that produced it (call functions through `api` at point of use), and `send` defers to a microtask exactly as every Zag adapter does.

## 4. The Zag catalog — 23 measured, 2.1 MB unpacked

| | kB unpacked |
|---|---|
| lightest | toggle 25, avatar 29, progress 42, checkbox 43, accordion 47 |
| heaviest | splitter 203, combobox 162, menu 160, tree-view 150, select 130 |

**Every machine is optional and tree-shakeable.** A page with a select pays for the select. No component ships the catalog.

Spin styles **19 primitives over 80 tags**, classless — `button`, `dialog`, `table`, `card`, `field`, `tabs`, `switch`, `prose`, and the rest. That is why this works: **a Zag component renders plain semantic elements and Spin already knows how to style them.** No class names in a component file, ever.

---

## 5. Architecture

```
packages/
  runtime/          @spin/runtime
      src/signal.ts     reactive core (alien-signals + batch + untrack + scope)
      src/zag.ts        machine → DOM bridge
      src/element.ts    custom element registration
      src/index.ts
    lint/            extend: no-<script>-in-a-component, closed-machine-registry
  <zag components>   @spin/tree, @spin/select, … one package per component
```

**Rules, enforced by lint in phase 1 and by a compiler in phase 6:**

1. A component file contains **no `<script>`**. There is no door for arbitrary code.
2. A component **cannot fetch**. The runtime has no `fetch`, no `XMLHttpRequest`, no dynamic import.
3. A machine is named, not imported into markup. `use:tree` resolves against a registry; an unknown name is a build error.
4. No class attributes. Spin styles the tags; a class on a claimed element is the existing `no-utilities-on-semantic` rule.

Rules 1 and 2 are what make "side-effect free" structural rather than a convention — which is the property that makes this usable by an agent, because it is *checkable* instead of *reviewable*.

---

## 6. Phases, each with a gate

**Phase 1 — core.** `signal.ts` on alien-signals + the three borrowed primitives. Write the four benchmarks as repo tests so the choice is enforced forever.
*Gate:* the four benchmark shapes pass and no test may regress above 10%.

**Phase 2 — Zag bridge.** machine → DOM. The hard requirement is the one that cost us a day: **zag's `connect` closes over a snapshot of the context**, so a top-level field read once at connect time (`expandedValue`) is stale forever. Every field must be a live getter. Test it by reading the same field before and after a transition.
*Gate:* a `tree-view` in a browser expands **and collapses**, driven by a real keydown.

**Phase 3 — custom elements.** `define(tag, spec)` with property props, a scope per connection, cascade on disconnect.
*Gate:* connecting and disconnecting twenty times leaks nothing — assert binding count returns to zero.

**Phase 4 — Spin integration.** Serve a component in spin's own `serve.ts` so a primitive is styled with zero classes.
*Gate:* a screenshot of a Zag `dialog` with no class attributes anywhere in the source.

**Phase 5 — benchmark.** Add the entry to js-framework-benchmark and run the suite's driver.
*Gate:* all 13 benchmarks pass; publish the numbers with the comparison.

**Phase 6 — the compiler.** `*.spin` files compiled by Sail's emitter, with the four rules enforced at build time.
*Gate:* a file with a `<script>` fails to build. This is where Sail's heritage earns its keep.

---

## 7. Production architecture

- **Runtime is a dependency; the compiler is not.** Phase 1–5 ship with no build step at all. A component is a plain module.
- **Deno-first, as spin is.** The worktree is a spin workspace member.
- **No Zag in the core package.** `@spin/runtime/zag` is a subpath, so a component with no machine never pulls it.
- **Clean-package pattern from ark:** the monorepo consumes raw source; `prepack` swaps `exports` to `dist`. Keeps the repo testable without a build.
- **CI parity scripts borrowed from ark:** every registered element has a machine, every machine is exported, every component's DOM passes axe.

---

## 8. Performance: how the numbers get better

Today's honest baseline, same run, same driver:

| | vanilla | sail-component |
|---|---|---|
| 01_run1k | 78.7 | 88.8 |
| 03_update10th1k_x16 | 28.9 | 76.2 |
| 04_select1k | 8.1 | 32.8 |
| 07_create10k | 727.6 | 620.2 |

**Create and delete beat vanilla; update and select lose by 2–4×.** Both losses are the same bug: every write re-binds every row instead of patching the rows that changed. Ordered work:

1. **Profile first.** `benchmarksPlaywright.ts` already writes traces. Read one before touching anything.
2. **Skip the parts that did not change.** A row's binding should compare its dependency set, not its value identity.
3. **Batch at the boundary.** One write schedules one flush.
4. **alien-signals gives 3× on writes for free** from the no-allocation notify path. That alone takes `03` from 76 ms toward 30.
5. **Measure at `--count 10`,** not 3. Every number above is three samples.

---

## 9. What would make this fail

- **If Zag's machines are too heavy.** 2.1 MB unpacked for 23 components, `splitter` alone is 203 kB. If a single select costs 100 kB, the runtime argument is weak and the right answer is Zag + your own elements.
- **If `connect` cannot be made live cheaply.** Phase 2's gate exists precisely to find this out cheaply.
- **If Spin classes bare tags but the DOM Zag produces is not semantic.** Phase 4's screenshot gate. If Zag emits a `<div>` where Spin wants a `<button>`, the styling story breaks and we learn it in a day rather than a month.
- **If the runtime stays under Sail's gravity.** The instruction is "borrow, do not inherit." The measurable version of that: **the core package must not import from `@sail/*`.** Phase 1's gate.

---

## 10. Immediate next action

Phase 1, in the worktree: `packages/runtime/src/signal.ts` on alien-signals plus the three borrowed primitives, with the four benchmarks as repo tests.

Everything above is a decision I can be wrong about, and phases 1, 2 and 4 are each cheap enough to disprove the whole plan in a day.
---

## Appendix: what Phase 4 actually proved

`demo/tree/tree-view.ts` — a Zag tree machine as a custom element, built with
`define` + `createMachine`, rendered with `<section>`, `<ul>`, `<li>`, `<button>`,
`<span>`. **`grep -c 'class="'` returns 0.**

Verified in a browser against the served build:

| | |
|---|---|
| renders | 8 `li`, custom element defined, **zero page errors** |
| expand | `data-state` closed → open, `aria-expanded` false → true |
| collapse | open → closed, children hidden again, four clicks alternating |

Served at `http://localhost:8010` by `deno task demo:tree`.

### The three classes on the page

Three `[class]` nodes exist in the DOM and **none is in the component source**.
They are Spin's own: the primitive rules claim `<button>` by tag and emit a
class. That is the whole styling contract working — the component authors
nothing, the preset decides.

### One thing that cost more than it should have

`apply()` in the demo is not a three-line helper, because HTML boolean attributes
and ARIA attributes are incompatible conventions: `hidden="false"` leaves the
element hidden, while `aria-expanded="false"` is a required enumerated value. A
loop that treats them alike gets one of them wrong silently, and the wrong one
is the a11y-critical one. That is a real trap for every component we write.

---

## Appendix II: the demo was broken, and two bugs were behind it

Re-verified the Phase 4 gate in a browser rather than trusting the earlier
screenshot. It rendered and did not work. Two independent bugs, both of which
the earlier pass had mis-verified:

**1. The first click on any branch was swallowed.** Zag's
`getBranchControlProps` emits `onFocus` as well as `onClick`, and focus fires on
mousedown — before click. Our `render()` called `el.replaceChildren(root)` on
every state change, so the focus-driven re-render replaced the button between
those two events and the click landed on a detached node. The second click
worked, because by then the node was focused and `NODE.FOCUS` was a no-op —
which is exactly why a single-click test passed.

The fix is the rule ark follows and we did not: **build once, update props in
place, never rebuild.** `apply()` also had to become idempotent for listeners,
since re-painting an element must replace its handler rather than stack a new
one per state change.

**2. Collapsed branches were still visible.** `ul[data-part="branch-content"]`
computed to `display: inline-flex` with `hidden` set. Two causes:

- `role="group"` is generic ARIA. A tree's branch content carries it for a set
  of *items*; our `[role="group"]` rule claimed it for a *row of controls* and
  applied `inline-flex`. The tree's children laid out in a line — measured at
  x = 64, 304, 531 — not a column. Fixed by requiring the group to hold a
  control, which is what the primitive's own contract always said.
- An author `display` rule beats the UA `[hidden] { display: none }` rule
  regardless of specificity, so any of our primitives could resurrect a hidden
  element. The preset's reset now enforces `[hidden]` with `!important`, with
  the visually-hidden recipe and `hidden="until-found"` excluded.

Neither bug was a runtime bug. Both were integration bugs that only a real
browser driving a real machine could surface — which is the argument for the
demo existing at all.

Verified after both fixes: first click opens, children stack vertically,
collapse hides, **0 class attributes in the component**, no page errors.
Primitives 201 pass, runtime 38 pass. The group primitive still resolves a
segmented control and a search region to `inline-flex`.

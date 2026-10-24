# The requirements: the standing brief

**Where this comes from.** The repo's findings are _derivations_; the brief is
the user's own prompts in session `01a053b3` (2026-08-30 → 2026-10-21, ~500
prompts). The specs that used to hold it were deleted at the user's instruction
("STOP PUTTING EVERYTHING IN SPECS. add a findings dir or something"), and the
session transcripts are not in the repo — so an instance working from the repo
alone anchors on whatever it derives. This file is the distillation. **It is a
distillation, not the source: the quotes are the source, and the user should
correct it.**

---

## 1. The non-negotiables

| the rule                                                                                                                                | the words                                                                                                                                                                                           |
| --------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **No shims, no back-compat, no grandfathered lists.** Pre-release: a replaced mechanism is _deleted_.                                   | "no more grandfathered anything, no shims, no back-compat… it's pre-release so there should be no legacy"                                                                                           |
| **Uno is the only route to style.** Never raw CSS.                                                                                      | "styling is uno never raw css. never. there is not question about that because uno = themed"                                                                                                        |
| **The theme owns the values; uno owns the vocabulary; the preset's primitives own the look.**                                           | "uno owns the vocabulary… straight up"                                                                                                                                                              |
| **No effects in markup or in components.** The scope adds props, not logic.                                                             | "our principles for this as a framework are no effects in markup/components"                                                                                                                        |
| **The machine does not know about props.** The props belong to the web component.                                                       | "MACHINE DO NOT KNOW ABOUT PROPS. STRAIGHT UP. A consumer is the html component"                                                                                                                    |
| **The consumer is the view.** Consuming a machine in a scope _is_ the binding; the machine's props need not be enumerated in the scope. | "the consumer is the view… when we consume a machine in a component scope… THAT IS THE BINDING. There is not need to enumerate a machines props in scope"                                           |
| **The runtime does the heavy lifting; the authoring surface is thin.**                                                                  | "the general trend is that the runtime is not doing enough, and the component (machine) authoring surface is deeply flawed. It needs to be thinner, using the runtime, and with far fewer concerns" |
| **LOC must come down.**                                                                                                                 | "how the fuck has this not cut lines yet though? all you do is add add add" / "the entire fucking point was to cut loc"                                                                             |
| **Behaviour first, pixel-close second; every button, every state, screenshots.**                                                        | "behavior and functionality is the most important thing… I want 100% parity mate… along with tests. screenshots every step of the way"                                                              |
| **Sign off on a shape before fanning out.**                                                                                             | "I want to sign off on an actual shape you impatient motherfucker. I AM THE FUCKING BOSS"                                                                                                           |
| **Don't invent abstractions; use standard machinery.**                                                                                  | "STOP 'inventing'… we need to use standard machinery wherever possible and not handroll shit that reinvents existing tools"                                                                         |
| **No new machines for what the primitives own.**                                                                                        | "I don't want a state machine for a switch/checkbox"                                                                                                                                                |
| **The machine is portable; actions + markup are per-platform.**                                                                         | "the machines are portable, actions + markup might be per-platform"                                                                                                                                 |
| **A component's examples are the markup.** No single "reference" or built component.                                                    | "the examples are the markup. THE MACHINE IS FUCKING HEADLESS"                                                                                                                                      |

## 2. The shape, as settled

| the decision                                                                                                                                                                                    | the words                                                                                                                                                                                              |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **The scope becomes a `<script>`**, and the compiler allows only sanctioned calls — `props()` and `consume()` — stripping anything that could gain effects.                                     | "html does allow `<script>` blocks… but we need to make sure that these cannot gain effects etc… so our compiler will probably only allow blocks that use a sanctioned api like props() and consume()" |
| **`<scope>` stays a concept: props, not logic.**                                                                                                                                                | "I love `<scope>` as a concept. it adds props, but not logic to html. stateless and side effect free components"                                                                                       |
| **The context is reactive with signals, exposed as a typed state API.**                                                                                                                         | "why are we using ctxOf when we already consume the machine in the scope/script?… that context should be reactive with signals… like `slider.state`"                                                   |
| **The class string consumes the state, typed like `machine.prop`** — the "c" option, with Uno's variant-group transformer.                                                                      | "I'm willing to give c a try… but it should be typed like machine.prop not just undocumented magic"                                                                                                    |
| **The authoring API:** the events are a map; the transition's _key_ narrows the event; the machine is pure.                                                                                     | (the `authoring-api.md` derivation)                                                                                                                                                                    |
| **`data-*` is the transport, and it is NOT settled.**                                                                                                                                           | "data-* is undecided as the correct binding transport, but it is under consideration"                                                                                                                  |
| **The machines are published; users can author their own machines; the `.html` is vendored, the machines are not.**                                                                             | "machines are published AND users can author their own custom machines"                                                                                                                                |
| **The component library is the product** — distribution is prebuilt web components with a nice API.                                                                                             | "the distribution story is prebuilt web-components that run fucking anywhere and have a nice API"                                                                                                      |
| **tabs is a machine** (decided 2026-10-24): selection, roving focus with loop, and focus restoration are JS-owned — unlike tooltip/popover/details/dialog, where the platform owns open/closed. | —                                                                                                                                                                                                      |

## 3. Open decisions (as of 2026-10-22)

1. **The class expression's exact shape** — typed like `machine.prop`, but what
   does a class string _look_ like when it consumes a signal? (`class="…"`
   static + a dynamic form? a `cx`-like call? a variant whose value is a
   signal?)
2. **The `<script>` scope's grammar** — what does `props()` look like, what does
   `consume()` look like, and what does the compiler strip?
3. **Whether `data-*` survives** alongside the class expressions, or dies with
   them.
4. **The props' channel** — the web component's props vs. the machine's
   arguments; how a host's write reaches a machine.
5. **The theme's spacing scale** — ours (the grid-spanning one) vs. master's, at
   the merge.
6. **The actions integration** — `use:` is designed but not integrated ("so we
   did not integrate actions yet? I think that's the next thing to spike").

## 4. What the last two passes did that this brief does not ask for

| the pass                                                                 | the cost                                                                | why it is now suspect                                                                                                                                       |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **the ARIA vocabulary** (`packages/runtime/src/aria.ts` + its test)      | **≈ +777 runtime lines** — ~40% of the runtime's growth since `a9b490e` | it is a _vocabulary_; if the class string owns the state, the ARIA surface is the framework's own (correct) — but the size is the user's explicit complaint |
| **the `data-*` facts vocabulary** (`factAttrs` + the codemod + the gate) | +96 runtime, −6 components                                              | it hardens the transport the brief says is _undecided_. The **gate is worth keeping**; the vocabulary is not                                                |
| **the `data-state` split**                                               | —                                                                       | the same channel, further hardened                                                                                                                          |

⇒ **The line count is the judge.** The runtime grew +1 981 on a branch whose
brief says the authoring surface must get _thinner_.

### The finding that changes the transport question (2026-10-22)

**The typed state API already exists, and it already reaches the DOM.**

- The api carries a live `state` getter — _"The machine's state, live: a read of
  it subscribes, so the markup can bind a class to it"_ (`synthesize.ts:293`).
- The api's **readers are the typed reads**: _"The api's readers read the
  SIGNALS, like the scope's context does: a read in the markup's expression (a
  bound class, say) subscribes to the field it read, and the class re-applies
  when the field moves."_
- **The markup already uses one**: `{slider.valueText}` in the slider's example.

**And the two missing positions work today** (proved by the emitter, and by two
tests in `plugin/emit-spread.test.ts`):

| the markup                 | the emitted code                                                                             |
| -------------------------- | -------------------------------------------------------------------------------------------- |
| `data-mode={slider.state}` | `bindAttr(e0, "data-mode", () => (values.slider.state))`                                     |
| `class={expr}`             | `bindAttr(e0, "class", () => ("bg-surface" + (values.slider.dragging ? " scale-110" : "")))` |

⇒ **⇒ The runtime is NOT the blocker for the "c" option. Two things are:**

1. **Uno's extraction.** A dynamic class string hides its utilities from the
   build. The _compiler already owns the markup_ ⇒ the concrete path: the plugin
   collects the **string literals in a class expression** and hands them to
   uno's extractor (the class check already walks the class attributes).
2. **The api's type is hand-written per component.** `SliderApi` had **no
   `state` in it** ⇒ 34 components would need the same line ⇒ or the api's type
   is _derived_ from the def, which also retires the `get*Props` stringly
   surface (_"I really don't like the fucking stringly typed API being used at
   every layer"_).

⇒ **⇒ And the consequence: if the state can reach the DOM from the markup, typed
and reactive, in text/attribute/class positions, then the `data-*` vocabulary is
not needed as the transport.** The component publishes _state_; the markup
decides the attribute names and the classes.

## 5. The standing work a four-item queue does not have

- **the tark parity/quality pass** — every component's behaviour, pixel-close,
  screenshots of every state. (The user's "quality over speed", and the
  recurring "this does not fucking work".)
- **the actions integration** — `use:` / actions, gated hard ("we must gate what
  can be done in an action HARD").
- **the controlled/props channel** — how a host's write reaches a machine ("the
  controlled piece is important").
- **the distribution story** — prebuilt web components, the API, the demo's
  removal.
- **benchmarks and performance notes** — shipped bytes, js-bench.
- **master's 113 commits** — the studio app, the MCP tools over a daemon's RPC,
  the theme's starter forks, the visual check on playwright, the harness into
  `internal`.
- **the `.spin`/loader lineage** — "I want to keep the .spin idea working but
  for now was hoping to just try parsing from html".

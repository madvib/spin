# `@spin/components` — architecture, second draft

Revised after your direction. What changed and why is in §0; the rest is the
proposal. Open questions at the end, marked **← decision**.

## 0. What I had wrong

1. **"The artifact is an element choice."** Half right. The element choice is
   *where the design starts*, not where it ends. Primitives give the baseline —
   semantics, ARIA, focus, the tag contract — and the component layer is
   responsible for the delta. When the delta is real, it reaches for **utilities,
   themed**, not a new primitive rule. So the artifact is an element *and* a set
   of utilities.

2. **I proposed a preset rule for the tree row. That was the wrong instinct.**
   You're right that an unstyled button is wanted everywhere, not just in trees —
   a rule per component is a rule per component forever, and the tree was just
   the first place it hurt. Utilities, not rules.

3. **"Guard is scripts" — I defended it and shouldn't have.** Spin already has
   the right layer and I didn't look: `packages/lint` is an **oxlint JS plugin**
   whose rules import `claimedElements` and `primitiveVariants` from
   `@spin/preset`. Enforcement here is lint, and it already exists. See §4.

4. **The runtime has no actions, no control flow, and no parser.** You asked;
   the answer is no, and I'd built on that gap without naming it. See §6.

## 1. The layer map

| Concern | Ark / Park | Spin |
|---|---|---|
| Behaviour, ARIA, state | Zag machine | Zag machine *(identical)* |
| Machine → DOM | `@ark-ui/react` | `@spin/runtime` |
| Baseline style | Park: recipes over `ark.X` | `@spin/preset` **primitives** (tag/ARIA contract) |
| Delta style | Park: recipe variants | **utilities, themed** |
| Component surface | Park `ui/*` | **`@spin/components`** |

The useful reading of Park: a Park component is `styled(ark.button, button)` —
`ark.button` is the *element and behaviour*, the recipe is the *look*. Spin's
split is the same shape with different halves: the **primitive is the element
and behaviour**, the **utilities are the look**.

That is a better fit than my first draft, because it means a component is not
choosing between "primitive" and "nothing" — it is choosing a baseline and
stating a delta.

## 2. The unit of work: the anatomy map

Unchanged from the first draft, and still the thing I'd build first. Zag's
anatomy is literal-typed:

```ts
AnatomyInstance<"branch" | "branchContent" | "branchControl" | ...>   // 15 parts
```

so `keyof typeof treeViewAnatomy.parts` is a union and completeness is a **type**:

```ts
export const treeView: AnatomyMap<typeof treeViewAnatomy> = {
  root:          { element: "section" },
  tree:          { element: "ul" },
  branch:        { element: "li" },
  branchControl: { element: "button", utilities: ROW },
  branchTrigger: { element: "button", utilities: CHEVRON },
  branchContent: { element: "ul" },
  // ... 9 more; omitting one is a compile error
};
```

Zag adds a part upstream → this file fails to compile, at the author's desk.
That is ark's `check-anatomy` replaced by the compiler.

**Where `utilities` comes from.** A part that needs a delta names the utilities
inline; a part that the primitive already finishes names none. The tree row is
the worked case:

```ts
const ROW = "flex items-center gap-2 w-full text-start rounded-sm px-2 py-1";
const CHEVRON = "inline-block w-4 text-muted transition-transform";
```

Themed, because utilities resolve against the theme — this is not a class string
that escapes the design system, it is the same token pipeline the primitives use.

**← decision: are utilities in the map, or in a per-component recipe object?**
In the map is direct and greppable; a recipe object is closer to Park and
factors better when several parts share a look.

## 3. The clash policy

Three outcomes per part, and the map records which:

| | meaning |
|---|---|
| element only | a primitive claims it and finishes it — nothing more needed |
| element + utilities | a primitive claims it, the context differs — the delta is stated |
| element, `primitive: "none"` | a primitive claims it and is **wrong here**; needs `why` |

The `why` is required by the type when `primitive` is `"none"`, so a clash
cannot be worked around silently — the decision is in the data and reviewable in
one place.

**On the tree row specifically.** The element is right; only the look was wrong.
Worth keeping the element:

- Zag sets `tabIndex: focused ? 0 : -1`, so a `<button>` participates in roving
  tabindex correctly — the usual objection (a natively tabbable element fighting
  the roving index) does not apply.
- A real `<button>` gets keyboard activation and focus from the platform. Ark's
  `div role="button"` reimplements both.
- The demo used **one `<button>` for two anatomy parts**. Zag has both
  `branchControl` (the row) and `branchTrigger` (the chevron); ark keeps them
  separate. Merging them is most of why it looked like a page control.

**Zag-specific rules, if we ever need them, are a separate layer.** Agreed on
that: they would be named for the Zag contract, they would not be mixed into
primitives, and they would be opt-in. I'd want to exhaust utilities first.

## 4. Enforcement: lint and types, not scripts

`scripts/` is 1137 lines. The right home already exists.

```ts
// packages/lint/src/index.ts — already wired as jsPlugins in .oxlintrc.json
export default {
  rules: {
    "no-utilities-on-semantic": semanticOwnership,   // already imports claimedElements()
    "closed-vocabulary": closedVocabulary,
    "no-raw-colors": noRawColors,
    "no-handwritten-tokens": noHandwrittenTokens,
  },
};
```

| script | lines | where it belongs |
|---|---|---|
| `check-component-parity` | 261 | an oxlint rule — `claimedElements()` is already imported there. **This is a duplicate of a rule we already have the machinery for.** |
| `check-registries` | 316 | the registry should not exist: derive it from the components |
| `check-zag-versions` | 162 | declare Zag deps once; a dependency constraint, not a script |
| `check-axe` | 137 | **keep as a test** — real runtime behaviour, not a source fact |
| `lib/packages` | 261 | goes with the above |

Two invariants can be types, which is earlier than lint:

- **Anatomy completeness** — §2, free from Zag's literal anatomy.
- **Tag is claimed** — `primitiveContracts` is annotated `: Record<string,
  PrimitiveContract>` at `manifest.ts:70`, which **erases the tag literals**. With
  `satisfies`, `tags` stays literal and a `ClaimedTag` union becomes expressible.
  That said: the lint already does this check at runtime, so this is a
  *nicety* rather than the unlock I claimed last time.

The principle I'd hold to: **an invariant expressible in the type system or by
construction should not be a script, and one already expressible as a lint
should not be a script either.**

## 5. The runtime, honestly

You're right that it's poorly organized. Current shape:

```
packages/runtime/src/
  signal.ts    146   reactive core
  element.ts   157   custom elements: props, attributes, build
  zag.ts       591   the machine interpreter (zag ships no runner)
  index.ts      45   public surface
```

Problems, in the order I'd fix them:

1. **`ElementSpec` is `{ props, attributes, build }` and `build` is imperative
   DOM.** `document.createElement` by hand, per part, in every component. That is
   the boilerplate ark avoids with JSX and we should not reproduce 40 times.
   The anatomy map (§2) is the input that makes this mechanical — a runtime that
   takes `{ anatomy, parts, machine, connect, props }` and builds the DOM.
2. **No actions.** No `use:foo`. No way to attach behaviour to a part without
   writing it inline.
3. **No control flow.** No `if`/`each` in markup, because there is no markup.
4. **No parser.** Confirmed: nothing in spin or sail parses markup. What does
   exist is `crates/sail/spinnaker/src/parse.rs` — a Rust parser for the *Style
   value language* (`style({ pad(4).bg(surface) })`), with compiler, napi, lsp,
   lint and mcp crates around it. That parses styles, not templates. PLAN.md:129
   describes `use:tree` resolving against a registry as a lint-enforced build
   error — **none of that is built.**
5. **The build-once/patch-in-place discipline is per-component.** Today's
   swallowed-first-click bug was a component getting it wrong. It belongs in the
   runtime so no component can.

## 6. The Uno question — worth exploring, but not for the reason it looks

> could we create a deeper integration that allows uno to parse the tags and
> side-step custom elements?

**What UnoCSS can and cannot do.** Its core extracts *tokens from text* via
extractors and emits CSS. It builds no DOM tree and runs no JS. So it can make
markup **class-free** — `preset-tagify` (now a dependency of yours) reads
attributes as utilities — but it cannot *wire behaviour*. Side-stepping custom
elements is not a styling problem, so UnoCSS alone does not solve it.

**The half that is genuinely interesting: attribute-driven binding.**

```html
<section data-spin="tree-view">
  <ul data-part="tree">
    <li data-part="branch" data-value="packages"> … </li>
```

A small runtime scans for `[data-spin]` and attaches the machine. No custom
element. Why this may be *better* for Spin than custom elements:

- **The author keeps the element choice.** That is the whole thesis — the tag
  matters, and hiding it inside `<tree-view>` takes the decision away.
- **SSR and static HTML work**; the markup is the source of truth.
- **The anatomy map becomes the markup contract** rather than a runtime input,
  and can generate the markup as well as consume it.
- **Discovery replaces the registry.** Which machines are needed is visible in
  the markup, so the "registry" that `check-registries.ts` guards stops being a
  thing to verify.

**Where UnoCSS actually helps**: it is *already* scanning every source file. An
extractor that recognises `data-spin="tree-view"` can (a) pull the component's
rules into the preset and (b) tell a build plugin which machine to import. That
kills both the registry and the tree-shaking problem, and it needs no script.

**The caveat, and why I'd not make UnoCSS load-bearing**: its scanner is a
tokenizer with a cache, and it assumes its job is CSS. Using it as a module-graph
input couples us to an implementation detail. The same discovery in a Vite/Deno
plugin is more honest and equally capable.

**My recommendation**: explore it, in this order —

1. Prototype attribute-driven binding for tree-view, custom element still
   present as the fallback. ~a day. It answers "does the author want to own the
   markup" empirically.
2. If yes, move discovery into a build plugin, with the Uno extractor as an
   optional accelerator rather than the mechanism.

I'd time-box (1) and not start (2) until the component surface exists, because
discovery is only worth building once there is something to discover.

## 7. Order of work

1. **Rebase — done.** Now on `fbfe991`. The demo builds against the preset as it
   is, and both findings I reported against the old preset are resolved by your
   refactor: collapse hides, children stack vertically, and the group rule is
   utility-gated.
2. **Anatomy types + tree-view map** (§2), with utilities for the deltas.
3. **Runtime**: `defineMachine` taking the map; build-once/patch-in-place moved
   in (§5.1, §5.5). This is what makes 40 components mechanical.
4. **Port tree-view properly** — `branchControl` and `branchTrigger` separate.
5. **Move the invariants**: parity → an oxlint rule; delete the scripts that are
   now duplicates; keep `check-axe` as a test.
6. **Then scale out**, and only then revisit §6.2.

## 8. Open questions

1. **§2** — utilities in the anatomy map, or a recipe object per component?
2. **§3** — do we want `primitive: "none"` as a first-class escape, or should a
   part that fights its primitive always be utilities-over-the-element?
3. **§5.1** — should `defineMachine` generate the DOM from the map, or should the
   map only be a contract and components still write their parts?
4. **§6** — is attribute-driven binding worth the prototype, or do custom
   elements stay the delivery mechanism?
5. Where does `@spin/components` live — `packages/components`, or a subpath of
   the runtime (which already has the `zag` subpath pattern)?

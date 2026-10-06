# `@spin/components` — proposed architecture

A proposal, not a decision. Every claim below is from the source; the places
where I need a call from you are marked **← decision**.

## 0. The layer map

The comparison you named, with the third layer filled in:

| Concern | Ark / Park | Spin |
|---|---|---|
| Behaviour, ARIA, state | Zag machine | Zag machine *(identical)* |
| Machine → DOM adapter | `@ark-ui/react` | `@spin/runtime` |
| Style | Park: Panda recipes over `ark.X` | `@spin/preset`: primitives over semantic tags |
| Component surface | Park `ui/*` | **`@spin/components`** ← this proposal |

## 1. Why Spin's component layer cannot be Park's

Park's component is one line of substance:

```tsx
const BaseButton = styled(ark.button, button)   // park-ui button.tsx
```

It attaches a **recipe class** to an element that is otherwise anonymous. Ark
renders `ark.div` for almost every tree-view part — I checked all of them, and
only `itemText` is a `<span>`. The meaning lives in `data-scope`/`data-part`,
and the *user* writes the CSS that reads those attributes. Park's job is to
save the user that CSS.

Spin inverts the premise: the preset styles **semantic elements**, so a machine
rendered as the right tags is styled with **zero classes**. The demo proves it —
`document.querySelectorAll('tree-view [class]').length === 0` with the tree
expanded and collapsing.

So the component layer's artifact is not a style. **It is an element choice.**
For each Zag part, decide which element it is. That is the entire design
surface, and it is what `@spin/components` should hold.

## 2. The unit of work: the anatomy map

Zag's anatomy is literal-typed, which is the lever everything else hangs off:

```ts
// @zag-js/tree-view/dist/tree-view.anatomy.d.ts
declare const anatomy: AnatomyInstance<
  "branch" | "branchContent" | "branchControl" | "branchIndentGuide" |
  "branchIndicator" | "branchText" | "branchTrigger" | "item" |
  "itemIndicator" | "itemText" | "label" | "nodeCheckbox" |
  "nodeRenameInput" | "root" | "tree"
>
```

So `keyof typeof treeViewAnatomy.parts` is a 15-member union, and completeness
becomes a **type** rather than a test:

```ts
export const treeView: AnatomyMap<typeof treeViewAnatomy> = {
  root:          { element: "section" },
  label:         { element: "p" },
  tree:          { element: "ul" },
  branch:        { element: "li" },
  branchControl: { element: "button", primitive: "plain", why: "..." },
  branchTrigger:{ element: "button", primitive: "plain" },
  branchContent: { element: "ul" },
  item:          { element: "li" },
  itemText:      { element: "span" },
  // ... 6 more; omitting one is a compile error
};
```

Zag adds a part upstream → our file **fails to compile**. That is ark's
`check-anatomy` replaced by the compiler, and strictly earlier: at the author's
desk rather than in CI after the fact.

This is the answer to "guard is scripts". The invariant was always
expressible; it was expressed as a post-hoc assertion instead.

## 3. Clash policy

Every part resolves to one of three outcomes, and the map **records which**:

| | meaning |
|---|---|
| `primitive: "<name>"` | the element is claimed by a primitive and the primitive is right |
| `primitive: "none"`, with `why` | the element is claimed but the primitive is **wrong here** |
| no `primitive` key | nothing claims this element; it renders unstyled |

The `why` is required by the type when `primitive` is `"none"`, so a clash
cannot be worked around silently — the decision is in the data, greppable, and
reviewable in one place.

### Worked example: tree-view, and where the demo is currently wrong

| part | element | primitive | note |
|---|---|---|---|
| root | `section` | layout | |
| label | `p` | prose | |
| tree | `ul` | prose (list) | `role="tree"` |
| branch | `li` | prose (list) | `role="treeitem"` |
| **branchControl** | `button` | **none** ← | the row; must not be button chrome |
| **branchTrigger** | `button` | **none** ← | the chevron |
| branchIndicator | `span` | — | the glyph |
| branchText | `span` | prose | |
| **branchContent** | `ul` | — | `role="group"` ← the collision |
| item | `li` | prose (list) | |
| itemText | `span` | prose | |
| itemIndicator | `span` | — | |
| branchIndentGuide | `span` | — | |
| nodeCheckbox | `input` | control | |
| nodeRenameInput | `input` | control | |

**On "buttons are not the right choice".** I think the *element* is right and
the *styling* is wrong, and it's worth separating them:

- Zag sets `tabIndex: nodeState.focused ? 0 : -1` on the control, so a
  `<button>` participates in roving tabindex correctly — the usual objection
  (a natively tabbable element fighting the roving index) does not apply.
- A real `<button>` gets keyboard activation and focus from the platform. Ark's
  `div role="button"` has to reimplement both.
- The problem is that the button primitive gives a tree row **page-control
  chrome**: padding, border, hover, focus ring. A tree row is not a page control.

So the ask is a **chrome-less control**, and there are three ways to get one.
I'd like your call:

**← decision: how does a part opt out of a primitive's chrome?**

1. **Relational preset rule.** The preset already expresses relationships —
   `[role="group"] > button` flattens corners. A control *inside a
   `[role="treeitem"]`* is a row affordance, not a page control:
   `[role="treeitem"] :is(button, [role="button"]) { /* reset chrome */ }`.
   Keeps the component class-free and the rule semantic. My preference.
2. **A variant.** `button.plain` / `.bare`. Simple and explicit, but the
   component now writes a class, which weakens the zero-class claim.
3. **`div role="button"`** (ark's choice). Costs keyboard/focus reimplementation.

**`branchContent` is a second, separate finding** — see §6.

## 4. Enforcement: types and lint, not scripts

Current `scripts/` is 1137 lines. My view after reading them: you're right, and
most of it is replaceable.

| script | lines | what replaces it |
|---|---|---|
| `check-component-parity` | 261 | a `ClaimedTag` type (§4.1) |
| `check-registries` | 316 | derive the registry from the components — construction, not verification |
| `check-zag-versions` | 162 | declare Zag deps once in the workspace; a dependency lint. Prefer making the invariant structural over checking it |
| `check-axe` | 137 | **keep** — it asserts real runtime behaviour, not a source fact |
| `lib/packages` | 261 | mostly goes with the above |

### 4.1 The one-line ask that unlocks the type

`packages/preset/src/rules/primitives/manifest.ts:70` (in your working tree):

```ts
export const primitiveContracts: Record<string, PrimitiveContract> = { ... }
```

The annotation **erases the literals** — `tags` widens to `readonly string[]`,
so nothing can be checked against it. With `satisfies`:

```ts
export const primitiveContracts = { ... } satisfies Record<string, PrimitiveContract>
```

`tags` stays literal, and the component layer gets:

```ts
type ClaimedTag = (typeof primitiveContracts)[keyof typeof primitiveContracts]["tags"][number];
```

which makes `element: "ul"` checkable **at compile time**, and turns
`check-component-parity` — a whole script — into one type alias.

I have not touched this file. It is your active work and I'm not going near it.

## 5. What the runtime must grow

Ark is ~40 components × N parts of near-identical files. That boilerplate is
ark's main weakness and we should not reproduce it. The machine wiring is the
same every time; it belongs in the runtime, not in 40 directories.

```ts
// proposed: one call, and the anatomy map is the only per-component artifact
defineMachine("spin-tree-view", {
  anatomy: treeViewAnatomy,
  parts: treeView,
  machine, connect,
  props: { collection, expandOnClick: true },
});
```

Two runtime gaps this exposes, both from today's bugs:

- **`apply` must be idempotent for listeners** — done, and the reason is
  recorded in `demo/tree/tree-view.ts`.
- **Parts must not be rebuilt on a state change.** Rebuilding destroys elements
  between the events acting on them; Zag's `onFocus` fires on mousedown, before
  `onClick`, and the rebuild swallowed the first click on every branch. The
  runtime should own the build-once/patch-in-place discipline so no component
  can get it wrong. That is a *design* fix, and it is worth more than any check.

## 6. The two preset findings, for you to take or leave

Both are in your working tree, not mine. I reverted my attempts.

**a. `[hidden]` has no systemic guarantee.** An author `display` rule beats the
UA `[hidden] { display: none }` rule regardless of specificity, so any primitive
that states `display` on a tag a Zag part uses will resurrect a hidden element.
`dialog.ts:79` documents the principle —

> *No `display` is stated — the element hides itself when closed, and saying
> `display: block` would defeat exactly that.*

— but it is applied per-component, not guaranteed. Today `disclosure.ts:140`
and `control.ts:138` do state `display`. Zag sets `hidden` on branch content,
accordion content, collapsible content, popover, menu and tabs content, so this
is reachable from most of the Zag surface. A reset guard
(`[hidden]:where(:not([aria-hidden="false"])) { display: none !important }`,
excluding the `visually-hidden` opt-back-in and `hidden="until-found"`) makes it
unconditional.

**b. `role="group"` is still claimed bare.** `group.ts:55` yields rules on
`[role="group"]`. Your new version already scopes the *members* to controls
(`MEMBERS`) and no longer sets `display` — a real improvement on what was there
before — but the base rule still applies `border-radius` to any `[role="group"]`,
including a tree's branch content. Gating the base rule the way the members are
gated would close it.

## 7. Order of work

1. **Rebase the worktree onto your working tree.** The worktree is on
   `b650571`; `packages/primitives` is empty in your checkout and the primitives
   now live in `packages/preset/src/rules/primitives/`. Nothing below can be
   built against the old layout, and my demo is currently rendering against a
   preset you have already moved past.
2. `satisfies` in the manifest → `ClaimedTag` type (§4.1).
3. Runtime: build-once/patch-in-place + `defineMachine` (§5).
4. Port tree-view properly — separate `branchControl` from `branchTrigger`,
   resolve the chrome question (§3).
5. Delete each script as its invariant moves into a type; keep `check-axe`.
6. Scale out. With §2–§5 in place, a component is one anatomy map plus its
   props, so the ~40-component surface is mostly mechanical.

## 8. Open questions for you

1. **§3** — chrome-less control: relational rule, variant, or `div role="button"`?
2. **§4.1** — `satisfies` in the manifest, or a different way to keep tag
   literals?
3. Where should `@spin/components` live — new `packages/components`, or inside
   `packages/runtime` as a subpath (the runtime already has the `zag` subpath
   pattern)?
4. Machine composition: ark's `TreeViewBranch` wraps `Collapsible.Root`. Do we
   compose machines the same way, and does the runtime need to support it
   explicitly?

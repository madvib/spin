# `@spin/components`

Zag machines as spin components. One directory per machine.

```
packages/components/
  src/
    tree-view/
      parts.ts      the anatomy map: part -> element + utilities
      index.ts      the component: define, machine, props
      parts.test.ts
  demo/             the runnable proof, beside the package it proves
```

No demo at the repository root. A demo belongs to the package it demonstrates,
or to `apps/` if it is a program.

## The anatomy map is the unit of work

Zag's anatomy is literal-typed:

```ts
AnatomyInstance<"branch" | "branchContent" | "branchControl" | ...>
```

so `keyof typeof treeViewAnatomy.parts` is a union, and completeness is a type
rather than a test:

```ts
export const treeView: AnatomyMap<typeof treeViewAnatomy> = {
  root:          { element: "section" },
  label:         { element: "p" },
  tree:          { element: "ul" },
  branch:        { element: "li" },
  branchControl: { element: "button", utilities: ROW },
  branchTrigger: { element: "button", utilities: CHEVRON },
  branchContent: { element: "ul" },
  item:          { element: "li" },
  itemText:      { element: "span" },
  // ... every remaining part; omitting one is a compile error
};
```

Zag adds a part upstream and this file stops compiling. That is the whole
enforcement: it happens at the author's desk, not in a program that runs after
the fact.

## Every part resolves to one of three things

| | meaning |
|---|---|
| `{ element }` | a primitive claims the element and finishes it |
| `{ element, utilities }` | a primitive claims it, the context differs, the delta is stated |
| `{ element, primitive: "none", why }` | a primitive claims it and is **wrong here** |

`why` is required by the type when `primitive` is `"none"`, so a clash cannot
be worked around silently.

## The clash policy

A part and a primitive disagree. In order:

1. **Use the primitive.** Most parts need nothing else; that is the point of
   primitives.
2. **State utilities.** The element is right, the look is wrong. Utilities are
   themed, so this is still inside the design system — it is the delta, not an
   escape.
3. **Change the element.** The element itself is wrong for the role. Rare, and
   it needs the `why`.

**Never a preset rule for one component.** A rule for a tree row is a rule for
every unstyled control forever, and an unstyled control is wanted everywhere,
not just in trees. If a rule is genuinely needed it goes in a separate,
opt-in layer named for the contract it serves — never mixed into the
primitives.

### Worked case: the tree

Zag's tree has both `branchControl` (the row) and `branchTrigger` (the
chevron). They are different parts and they take different treatment. Rendering
one `<button>` for both is the mistake to avoid: the row is the tree item's
interactive area, the chevron is a small control inside it.

The element stays a `<button>`. Zag sets `tabIndex: focused ? 0 : -1`, so
roving tabindex works, and a real button gets keyboard activation and focus
from the platform — which a `div role="button"` has to reimplement. The
problem was never the element; it was the chrome.

## Styling

The preset styles elements. A component therefore styles by **choosing the
element**, and states utilities only for the delta.

The demo claim — zero `class` attributes in the component source — is a
consequence, not a rule. A part that needs a delta writes utilities, and that
is correct. What is not correct is writing a class that duplicates what a
primitive already does.

## What a component is

```ts
defineMachine("spin-tree-view", {
  anatomy: treeViewAnatomy,
  parts: treeView,
  machine, connect,
  props: { collection, expandOnClick: true },
});
```

The machine wiring is identical for every component, so it lives in the runtime
and the anatomy map is the only per-component artifact. Forty components should
be forty maps, not forty copies of the same sixty lines.

## Rules

1. **A component names the element for every part.** The tag is what the preset
   styles, so the tag is the contract; hiding it behind a wrapper element takes
   the decision away from the author.
2. **A part with no utility needs no utility.** The primitive finished it.
3. **A clash is recorded in the map**, never worked around in CSS.
4. **A component composes machines where the machine composes.** Zag's
   tree-view branch is a disclosure; the component says so rather than
   reimplementing expand/collapse.
5. **A component is testable through its own markup.** No private accessor, no
   reaching into the machine: drive it as a user would.

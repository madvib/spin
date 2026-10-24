# The class vocabulary

**Status:** designed, not landed.

## The problem

The markup's state-dependent styling goes through CSS hooks the bindings invent:

```
class="... data-[state=open]:bg-primary data-[align=start]:left-0 ..."
```

There are **13 such names** (`state`, `selected`, `disabled`, `orientation`,
`kind`, `mode`, `stage`, `snap`, `view`, `type`, `align`, `placement`,
`position`, `side`, `value`, `highlighted`) and they are **untyped**: a typo in
`data-[stae=open]` is a silently dead rule.

And the state is _in the class string_, where the brand has to reconstruct the
machine's vocabulary.

## What was asked for

- **(c)** the variant's value is an attribute of the same name, so the state is
  a live read and the class strings stay static;
- **typed** — "like `machine.prop`, not undocumented magic";
- and the UnoCSS mechanisms are ours: the **variant-group transformer** (already
  enabled) and **attributify** (not enabled).

## The design

### The machine declares its public state

```ts
export const slider: MachineObject<SliderContext, SliderEvent> = {
  // The machine's public state: the names the brand may key on. The
  // compiler checks the markup against this list, so a typo is a build
  // error.
  state: {
    dragging: "boolean",
    disabled: "boolean",
    orientation: '"horizontal" | "vertical"',
  },
  fields: { value: { event: "SET_VALUE" } },
  create: (args) => createMachine({ ... }),
};
```

The state's _types_ matter, because the markup's variant may be a **value**, not
just a boolean: `data-[orientation=vertical]:rotate-90`.

### The markup: the variant's name is the state's name

```html
<button
  class="bg-surface text-muted data-[dragging]:bg-primary data-[orientation=vertical]:rotate-90"
  {...slider.getThumbProps(row)}
/>
```

**The runtime writes the attribute** — reactively, from the machine's state.
Today the bindings write `data-state="open" | "closed"`; the change is that the
_name_ comes from the machine's declaration, and the _value_ is the machine's
field.

**And the variant's CSS has to exist.** Two ways:

1. **The runtime writes the attribute, and the markup uses uno's arbitrary
   variant** — `data-[dragging]:bg-primary` generates
   `[data-dragging].data-\[dragging\]\:bg-primary`, and the runtime writes
   `data-dragging=""`. **This works today, with no preset change** — the only
   change is the attribute's _name_ (the machine's state name, checked) instead
   of a hand-written one.

2. The preset generates the rules for the machine's declared state — more work,
   and it needs the machine's state at build time.

**(1) is the landing.**

### The shape, concretely

```html
<!-- the machine's state names, checked by the compiler -->
<button
  class="bg-surface text-muted data-[dragging]:bg-primary data-[orientation=vertical]:rotate-90"
  {...slider.getThumbProps(row)}
/>
```

```ts
// the machine declares its public state
export const slider: MachineObject<SliderContext, SliderEvent> = {
  state: { dragging: "boolean", orientation: '"horizontal" | "vertical"' },
  ...
}
```

The class strings stay static (uno extracts them), **the state is not in the
class string** (it is in the attribute), and **the names are the machine's**
(typed, checked).

## What this kills

- the **13 hand-written `data-[…]` conventions** → the machine's own state
  names, declared once;
- the **stringly** aspect: a typo is a build error;
- the **arbitrary per-machine CSS hooks** the bindings invented.

## What it does NOT kill

- the class string's _variant syntax_ — `data-[dragging]:` is still in the
  class. **This is the honest limit**: CSS is static, so a conditional class
  needs a static selector, so the condition needs an attribute. The improvement
  is that the attribute is the machine's declared state and the name is checked
  — not that the mechanism changes.

- **The `class={{…}}` object form is NOT needed** if the state rides an
  attribute: the class stays a plain string, uno's default extractor works, and
  there is no `cx` and no object form.

## The rest of the plan

1. **the machine declares its public state** (`state:` on the machine object) —
   and the compiler checks the markup's `data-[…]` variants against it;
2. **the runtime writes the attributes** from the machine's context, reactively;
3. the **bindings stop inventing** the `data-[…]` names — the state names come
   from the machine.

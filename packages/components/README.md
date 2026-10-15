# @spin/components

Elements and the machines that earn one.

## A machine is for modes

A component gets a machine when it has **distinct modes with different legal
events** — open/closed, edit/preview, loading/idle/sorting, a submenu open
inside a menu. The mode decides which events mean anything, and that decision
is what config-first authoring makes reviewable.

A component does **not** get a machine when its entire behavior is one mode of
derived values:

- scroll offsets, overflow flags, thumb sizes → measurement + custom properties
- image load status → an `observe` action
- a continuous value under pointer capture → signals + pointer actions
- a page index, a step index → pure derivation

Those are signals, actions, and DOM writes. Wrapping them in states adds a
layer that cannot make a decision the values do not already make.

## The primitives own the widgets

Form controls and display widgets — switch, checkbox, radio, field, badge,
kbd, stat, meter, progress, alert, table — belong to `@spin/preset`'s
primitives and the theme's component groups. A component here must not
re-implement a primitive's contract, and a primitive's wiring (hidden-input
sync, press tracking, focus-visible) is never machine material.

## What ships

| Component     | Modes the machine owns                                        |
| ------------- | ------------------------------------------------------------- |
| `combobox`    | closed.idle / closed.focused / open.interacting / open.suggesting |
| `cascade`     | open/closed with the level stack derived from the highlight    |
| `menu`        | idle/dragging-free navigation with submenus as context         |
| `editable`    | preview/edit; commit vs revert decided by the closing event    |
| `async-list`  | idle/loading/sorting; the fetch is a bridge-owned reflex       |
| `tags-input`  | four states around the input, paste splitting, overflow        |
| `pin-input`   | per-cell focus, paste distribution, the completion edge        |
| `number-input`| idle/focus/scrubbing/spinning                                  |
| `timer`       | running/paused/stopped; the clock is an action                 |
| `carousel`    | six states around paging, drag, autoplay                       |
| `tree-view`   | per-node expand/collapse, rename mode, keyboard nav            |
| `toast`       | the queue's lifecycle; every clock is an action                |

Adding a component means answering the mode question in the PR description.
A new port of a machine Zag ships is not by itself a reason to add it here.

## Layout

```
spin-<name>/
  spin-<name>.html        the recipe: markup, scope, consume
  <name>.machine-def.ts   the seam file codegen finds: bridge, commands, events
  <name>.bridge.ts        bridge implementation (scope props in, api out)
  <name>.connect.ts       the DOM contract: prop bags
  <name>.machine.ts       config + named conds/assigns as data
  <name>.machine.test.ts  unit suite beside the bridge
```

One import registers everything:

```ts
import "@spin/components/elements";
```

Each component is separately importable (`@spin/components/combobox`) and pulls
only its own machine.

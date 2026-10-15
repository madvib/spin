# @spin/components

Elements and the machines that earn one.

## A machine is for states JS manages

No JS and no states is pure CSS. The platform owns the machine and JS only
maps (native input value, details open, dialog showModal) is an enhanced
native. Anything else — JS managing states — is a machine, however simple.
Simple never means platform on its own.

That includes single-state guarded machines (steps validates forward
motion, pagination clamps pages) and continuous-value machines (a slider
thumb under pointer capture, a dial turning through degrees): the guards
and the gesture phases are states no one else holds.

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

# The merge, re-measured (and the file separation, answered)

## The file separation: the answer is "no change"

**The import direction forbids it, and the machine file already is the shared
module.**

- The bindings import the machine (`import { … } from "./<name>.machine.ts"`).
  So **nothing the machine needs can move into the bindings** — that is a cycle.
- The parsers **are** the machine's: `initial(args)` shapes the context from the
  raw props, so it parses them. 3 parsers are the machine's alone; 4 are the
  machine's **and** the bindings'.
- **And the bindings already import the shared parsers from the machine**: the
  date-picker imports `parseDay`, the splitter imports `parsePanels`, the
  cascade imports `parsePath`/`parsePaths` — all from `./<name>.machine.ts`.

⇒ **⇒ Nothing moves. The machine file keeps the statechart, the assigns, the
context, the events, the parsers and the args type; the bindings import what
they need from it, as they already do.**

A third file (`<name>.values.ts`) is _possible_ — the machine and the bindings
would both import it, no cycle — but it **adds** a file, an import and a header
to move seven functions in four components, and the line count is a goal. **⇒ No
third file.**

## The merge: 51 files, and it is a project

`git merge-tree --write-tree --name-only master migration/bindings-grammar` ⇒
**51 conflicted files** (47 when it was measured before the last three passes).

**Our migrated packages merge CLEANLY** — nothing in `packages/components/` or
`packages/runtime/` conflicts.

| the area                                          | the files | the shape                                                                                                                                                                 |
| ------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/preset/`                                | 43        | master **rewrote the token access** (`token(ctx, "color.surface-raised")` where we still have `themeOf(ctx)?.colors?.["surface-raised"]`) ⇒ take master's form, keep ours |
| the theme's JSON                                  | 4         | our spacing scale spans the grid (the `32`/`36` steps); master writes `6.0rem` ⇒ **a design call**                                                                        |
| the reference app, the api, the lint, `deno.json` | 6         | master's new work: the studio app, the harness moving into `internal`, the new gates ⇒ take master's, re-point our branches                                               |

**Our side is not small in the preset: 71 files, +1 316 / −510.** The variant
groups (`2192b3b`), the class check, the button's chrome, the icon glyphs' box,
the hidden attribute's fix — master has none of it. ⇒ **⇒ "take master" would
lose it. The preset's 43 files need a real merge: master's token access, our
variant groups.**

### What master's 113 commits bring that we lack

Not a merge of code — **113 commits of new work**: a studio app, MCP tools over
a daemon's RPC, the theme's starters forked (silk, neobrut, console, spin), the
visual check moved onto playwright, the e2e suite moved into the app, the
harness moved into `internal`.

⇒ **⇒ The merge also moves the GATES.** Our branch's gate commands and the
findings' paths point where the checks used to live. **⇒ The merge is not the
last step's mechanics; it is a project with its own gates.**

⇒ **⇒ Recommendation: merge BEFORE the next migration pass, not after.** Every
pass that lands on a 113-commit-old base makes the merge bigger, and the gate
moves mean our verification story has to be rewritten once anyway. The cost is
that our branch's green state has to survive a 51-file merge — which is exactly
what the gates are for.

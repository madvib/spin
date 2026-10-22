# The merge: measured, and it is NOT the risk we feared

**Status: measured with a dry-run merge (`git merge-tree`, which touches
nothing). The merge is READY to be done, and it is much cheaper than the
handoff's "115 commits we lack" suggested.**

## The divergence

| | the commits |
|---|---|
| `master` ahead of the merge base | **113** |
| our branch ahead of the merge base | **251** |

The merge base is `9d333c1`. The full diff is 640 files, +75 014 / −2 698.

## The conflicts: 47, and NONE of them are ours

| the area | the conflicts |
|---|---|
| `packages/preset/` | **38** |
| `apps/reference/` | 6 |
| `packages/theme/` | 3 |
| `packages/api/` | 2 |
| `packages/lint/` | 1 |
| **`packages/components/`** | **0** |
| **`packages/runtime/`** | **0** |

**⇒ The migration's own work merges cleanly.** Every conflict is in a
package the migration barely touched: the preset (the theme's tokens and
the catalog), the theme's JSON, the reference app, the api, the lint
package.

**That is the finding.** The handoff's framing — "the merge: master has 115
commits we lack" — reads like a large risk. It is not: 251 of our commits
rewrote the components' and the runtime's internals, and master did not
touch them, so git merges them without a conflict. The 47 conflicts are
master's preset work meeting OUR preset work — which is a normal
merge-of-two-branches, and it is separable.

## How to do it, when we do it

1. **The preset is the merge.** 38 of the 47 conflicts are there. It is
   ONE package's work — `packages/preset/src/` — and it is separable from
   the components' and the runtime's.
2. **The theme's JSON** (3) — `packages/theme/src/themes/*.json`. The
   `spin.json` conflict is a content conflict: master changed the theme's
   tokens and we changed them too. **The theme's tokens are the design
   system's vocabulary** — this is a DESIGN decision, not a merge: the
   question is which tokens the migration's new components need.
3. **The reference app and the api** (8) — the reference app is where the
   components are shown, so it may need the new props' types.
4. **The lint package** (1) — our `no-utilities-on-semantic` rule and
   master's.

**⇒ The merge is 4 separable pieces, and the largest — the preset — is a
package the migration did not change.** It is a day's work, not a
rewrite of the migration.

## The measurement to re-run

`git merge-tree --write-tree --name-only master <branch>` — it prints the
conflicts without touching the working tree. **Run it before starting the
merge, and again after each of the four pieces.**

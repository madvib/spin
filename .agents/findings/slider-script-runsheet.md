# Runsheet: slider end-to-end authoring shape

**Goal:** one component, fully migrated, as the frozen fan-out pattern.
No fan-out until approved. Principles over syntax; never thrash; surface
design questions instead of building past them.

## Decisions feeding this work

- 2026-10-22: the machine is a function, call it — `const machine = slider(args)`.
  No `useMachine`, no exports, no `machine=`/`consume=` attributes. Sharing is
  imports, not syntax. (target-shape.md §8.7)
- 2026-10-22: no parsing — types come from the checker, not from our parser.
  The `eb8ac40` text-parser spike is dead.
- 2026-10-22: flag day after the slider proves it. No dual `<scope>`/`<script>`
  support per component; the migration moves component by component.
- 2026-10-22: disposal is the framework's job — `own(() => dispose())` per
  script binding in generated code, same mechanism as consume today.
- 2026-10-22: toolchain — oxc for transform speed, `tsc` for correctness,
  unplugin for reach. `typescript` as a dev-only dependency for the check.

## Steps

1. [x] Script block: extraction + allowlist + virtual module + tsc gate.
   Precedent committed (`6247ea8`).
2. [x] Slider examples on `<script>`; template on `machine.*`.
3. [ ] Bindings firewall (this pass).
4. [ ] Class strings on the variant/class-object form.
5. [ ] Specimen route embeds examples (or documented why not).
6. [ ] Full gates green on clean worktree; approval of the shape.

## Learnings

- Pre-existing: `slider.e2e.ts` ("the declared default seeds the
  machine", `'0' !== '20'`) FAILS ON THE CLEAN TREE (`0034eae`, verified
  via `git stash`). Not caused by this work — likely `bind()` racing the
  build. The script path (declarative args at build time) has no such
  race, which is itself an argument for it.

## Lint rules (spec, not implementation — lint shape moved on master, wait for merge)

1. **No inline bodies in machine files.** Assigns and conds are always references, never literals. Walk the AST, fail on `assign:`/`cond:` with a function expression.
2. **Machine-file import allowlist.** Only `./<name>.{events,state,transitions}` and `@spin/runtime/fsm`. Kills `node_modules` deep imports at the gate.
3. **No `authored` plumbing in factories.** Framework supplies the default; the parameter disappears from the per-machine signature.
4. **States are the union; targets check against it.** `S extends string` threading so a typo'd target is a build error.

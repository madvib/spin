---
name: testing
description: Write tests worth keeping at every level. Unit co-located per source file, integration across modules, e2e as a stranger. Behavior through public interfaces, independent expected values, positive controls. Use when writing or reviewing any test.
---

# Testing

Tests are the highest-value signal we have: they tell us what our program does.
Good tests and good coverage are excellent. Brittle and dishonest tests subtract
value and add debt — a test that violates this skill is worse than a missing
test, because it silently rewrites the contract.

Green is not the goal. The suite is signal, never the objective: never alter a
test to make the suite green, never lower the standard, never skip or ignore a
failing test. Mistaking a green suite for a completed goal is the antipattern —
the suite reports; it does not finish.

## The three levels

- **Unit** — one function, co-located beside it. See [unit.md](unit.md).
- **Integration** — multiple modules across an internal boundary, living with
  the root or composition package. See [integration.md](integration.md).
- **E2E** — the end-user experience, as a stranger. See [e2e.md](e2e.md).

Each level has its own file; each file shows good tests beside the bad versions
of the same test. Where a test lives is part of the claim: see
[location.md](location.md).

## Rules (every level, no exceptions)

- **Behavior only.** Assert observable outputs — the CSS a build emits, the
  value a function returns, the DOM a component renders — never private state,
  call counts, ordering, or source text. If renaming or moving the code breaks
  the test, the test is wrong, not the code.
- **Independent expected values.** Hand-authored literals, worked examples, the
  theme contract. Never recomputed the way the code computes them — a test that
  passes by construction can never disagree.
- **Never mock what you own.** No mocks for our modules, our verbs, our
  transport, our environment. Mocks are for third-party boundaries only
  (network, vendor SDKs, clocks). Test our contract, never a dependency's
  behavior, never another module's internals.
- **No tautologies.** Existence-only (`defined`, non-empty, longer,
  exit-zero-and-stop), length-grew (`length > N`), and wording pins prove
  nothing. Assert the value.
- **No negative assertions.** Never test for the absence of a removed term. A
  test that passes when the check is broken encodes nothing a consumer can
  observe. Assert the positive output produced. This is the rule spin gets wrong
  most often — "no unknown class", "no inline style" — and it is already stated
  in `AGENTS.md`.
- **No hand-maintained lists.** Never assert a hardcoded roster of tokens,
  variants, tags, or rules. Derive from the live source (the manifest, the
  catalog, the preset) or the test rots beside the tree. `AGENTS.md` says the
  same thing about facts in general.
- **No structure tests.** File layout, export names, config shapes, and
  directory trees are not behavior. If the only way to break it is to move code
  without changing behavior, delete it.
- **Tests are not lints.** A rule about authored code (naming, imports,
  vocabulary, token use) belongs in `@spin/lint` with its own failing fixture —
  not in a test file. This is the load-bearing split in this repo: a test
  asserts the library behaves; a lint asserts that authored code stays inside
  the system.
- **Real environments.** Test in the environment the code runs in: a component
  in a real browser, the preset through a real UnoCSS generator. A simulated
  environment standing in for the real one is a defect — delete the test.
- **Use the testing library when a dependency provides one.** Hand-rolled
  doubles for something with a sanctioned harness are parallel systems.

## The loop

TDD is not ceremony: the point is to think about the behavior before the
implementation. Red names the behavior, green proves the smallest code exhibits
it, refactor keeps it clean. Prefer a different agent writing the test from the
one writing the implementation — the test should respond to the behavior, not
the author's plan. Full discipline, with the reasoning, in [tdd.md](tdd.md).

## Signal

A guard never seen to fail is not a guard. Every test names the bug it catches:
pair refusals with permissions (positive controls), keep the failing fixture
beside the passing one (deletion-is-refusal), fail loud instead of skipping
(fail-closed). Each level file shows the pattern in its own context.

## Reviewing generated tests

Treat generated tests as a first draft, never a finished product. Generate with
a specific prompt and real context (the source file, sibling tests, the seam
under test), run immediately, then check each test against this skill before
committing: does it assert a value (not existence)? Would it survive a refactor?
Does the expectation come from the behavior spec, not the implementation just
written? Iterate in conversation — "these mock too much, rewrite through the
real composition" — rather than re-prompting from scratch. The earlier tests set
the pattern for everything after, so getting the first ones right is the
highest-leverage review there is.

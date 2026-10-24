# TDD: red, green, refactor

Red → green → refactor is not ceremony. The entire point is to stop and think
about the behavior before the implementation. Writing the test first forces the
question — what should this do? — while the answer is still cheap. If the test
passes, it tells you something about the behavior; if the behavior was never
named, the code tells you nothing.

Prefer a different agent writing the test from the one writing the
implementation. The test should respond to the behavior specification, not the
author's plan — an author testing their own code tests the shape they imagined,
and the suite goes insensitive to real changes.

## Red

Start from the contract: what does this promise its callers? Name the inputs
(arguments, props, theme) and the outputs (return values, emitted CSS, rendered
DOM, errors) — those are what the test verifies, nothing else. Then write one
failing test in Given / When / Then and run it. Confirm it fails for the right
reason: a missing behavior is the right reason; a missing import, a typo, a bad
fixture is not. A red with the wrong cause is a test that will go green for the
wrong reason. The standing question, every cycle: if the internals changed but
the output stayed, should this test break? If yes, it tests the implementation,
not the behavior — rewrite before going green.

```ts
// Red: the part does not render yet. The failure names the behavior gap.
it("Given a tree machine / When a branch control is clicked / Then it opens", () => {
  const el = mount("<tree-view></tree-view>");
  const control = el.querySelector('[data-part="branch-control"]');
  control.click();
  assertEquals(control.getAttribute("data-state"), "open");
});
// fails: control is null — correct reason, render the part.
```

## Green

Write the minimum code to pass. Resist the second case until the first passes —
one slice at a time: one seam, one test, one implementation. Vertical slices,
never horizontal: not "all tests then all code", one test → one implementation →
repeat. Each test is a tracer bullet responding to what the last cycle taught
you.

## Refactor

At review, not mid-loop. Refactoring inside the loop mixes two questions — does
it behave, is it clean — and the second eats the first. The loop produces
behavior; review produces shape.

## Rules of the loop

- **Red before green.** No production code before a failing test. Bulk tests
  written before any implementation verify imagined behavior.
- **One When per test.** A test with two Whens is two tests sharing a name; when
  it fails, the name says nothing.
- **Independent expectations, every cycle.** The red test's expected value comes
  from the behavior specification — a literal, an example, the theme contract —
  never from reading the implementation you are about to write.
- **Refactoring is not part of the loop.** It belongs to review, after green,
  with the suite watching.
- **Red is a report, not a failure.** A test that stays red names work to do.
  Deleting it to unblock, loosening it to pass, or skipping it to stay green are
  all the same violation: mistaking the signal for the goal.

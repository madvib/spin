import { test } from "bun:test";
import assert from "node:assert/strict";
import { deepStrictEqual } from "node:assert/strict";
import {
  batch,
  computed,
  effect,
  own,
  scope,
  signal,
  trigger,
  untrack,
} from "./signal.ts";

/**
 * The core's tests are about ownership.
 *
 * The one that matters is the cascade: an effect created inside a scope must
 * stop running the moment that scope is disposed. A binding that outlives its
 * element writes into detached DOM and throws nothing, so the counter in the
 * first test is the only thing standing between a component and that bug.
 */

test("an effect created in a scope stops when the scope is disposed", () => {
  const count = signal(0);
  const owner = scope();
  let runs = 0;

  owner.run(() => {
    effect(() => {
      count();
      runs++;
    });
  });

  deepStrictEqual(runs, 1);

  count(1);
  deepStrictEqual(runs, 2);

  owner.dispose();
  count(2);
  deepStrictEqual(runs, 2);
});

test("disposing a scope reaches the scopes nested inside it", () => {
  const count = signal(0);
  const outer = scope();
  let outerRuns = 0;
  let innerRuns = 0;

  outer.run(() => {
    effect(() => {
      count();
      outerRuns++;
    });
    const inner = scope();
    inner.run(() => {
      effect(() => {
        count();
        innerRuns++;
      });
    });
  });

  count(1);
  deepStrictEqual(outerRuns, 2);
  deepStrictEqual(innerRuns, 2);

  outer.dispose();
  count(2);
  deepStrictEqual(outerRuns, 2);
  deepStrictEqual(innerRuns, 2);
});

test("each run gets its own effects and keeps them alive until dispose", () => {
  const count = signal(0);
  const owner = scope();
  let first = 0;
  let second = 0;

  owner.run(() => {
    effect(() => {
      count();
      first++;
    });
  });
  owner.run(() => {
    effect(() => {
      count();
      second++;
    });
  });

  deepStrictEqual([first, second], [1, 1]);

  count(1);
  deepStrictEqual([first, second], [2, 2]);

  owner.dispose();
  count(2);
  deepStrictEqual([first, second], [2, 2]);
});

test("run hands back what the callback returned", () => {
  const owner = scope();
  const doubled = owner.run(() => 21 * 2);
  deepStrictEqual(doubled, 42);
  owner.dispose();
});

test("owned teardown runs once when the scope is disposed", () => {
  const owner = scope();
  let tears = 0;
  owner.own(() => tears++);

  deepStrictEqual(tears, 0);

  owner.dispose();
  deepStrictEqual(tears, 1);
});

test("teardown runs newest first", () => {
  const owner = scope();
  const order: string[] = [];
  owner.own(() => order.push("outer"));
  owner.own(() => order.push("inner"));

  owner.dispose();
  deepStrictEqual(order, ["inner", "outer"]);
});

test("own outside a run reaches the scope that is running", () => {
  const owner = scope();
  let tears = 0;
  owner.run(() => {
    own(() => tears++);
  });

  deepStrictEqual(tears, 0);

  owner.dispose();
  deepStrictEqual(tears, 1);
});

test("teardown registered after dispose releases immediately", () => {
  const owner = scope();
  owner.dispose();

  let tears = 0;
  owner.own(() => tears++);
  deepStrictEqual(tears, 1);
});

test("a scope released twice tears down once", () => {
  const owner = scope();
  let tears = 0;
  owner.own(() => tears++);

  owner.dispose();
  owner.dispose();
  deepStrictEqual(tears, 1);
});

test("own outside a scope reports where it went wrong", () => {
  assert.throws(
    () => own(() => {}),
    Error,
    "own: called outside of scope.run",
  );
});

test("run on a disposed scope reports where it went wrong", () => {
  const owner = scope();
  owner.dispose();
  assert.throws(
    () => owner.run(() => 1),
    Error,
    "scope.run: the scope is disposed",
  );
});

test("batch collapses many writes into one effect run", () => {
  const first = signal(0);
  const second = signal(0);
  const owner = scope();
  let runs = 0;

  owner.run(() => {
    effect(() => {
      first();
      second();
      runs++;
    });
  });

  deepStrictEqual(runs, 1);

  batch(() => {
    first(1);
    second(1);
  });
  deepStrictEqual(runs, 2);

  first(2);
  deepStrictEqual(runs, 3);
  owner.dispose();
});

test("batch returns what the callback returned", () => {
  deepStrictEqual(batch(() => "value"), "value");
});

test("a nested batch flushes once, at the outer edge", () => {
  const count = signal(0);
  const owner = scope();
  let runs = 0;

  owner.run(() => {
    effect(() => {
      count();
      runs++;
    });
  });

  batch(() => {
    count(1);
    batch(() => {
      count(2);
    });
    deepStrictEqual(runs, 1);
  });
  deepStrictEqual(runs, 2);
  owner.dispose();
});

test("untrack reads a value without subscribing the effect", () => {
  const tracked = signal(0);
  const quiet = signal(0);
  const owner = scope();
  let runs = 0;
  let seen = 0;

  owner.run(() => {
    effect(() => {
      tracked();
      seen = untrack(() => quiet());
      runs++;
    });
  });

  deepStrictEqual([runs, seen], [1, 0]);

  tracked(1);
  deepStrictEqual([runs, seen], [2, 0]);

  // The effect did not re-run, so `seen` still holds the value it last read.
  // The signal moved on regardless, and an untracked read sees the new one.
  quiet(1);
  deepStrictEqual([runs, seen, untrack(() => quiet())], [2, 0, 1]);

  owner.dispose();
});

test("untrack restores the subscription of the effect around it", () => {
  const tracked = signal(0);
  const owner = scope();
  let runs = 0;

  owner.run(() => {
    effect(() => {
      tracked();
      untrack(() => {});
      tracked();
      runs++;
    });
  });

  tracked(1);
  deepStrictEqual(runs, 2);
  owner.dispose();
});

test("computed derives from the signals it reads", () => {
  const first = signal(1);
  const second = signal(2);
  const total = computed(() => first() * 10 + second());

  deepStrictEqual(total(), 12);

  first(3);
  deepStrictEqual(total(), 32);
});

test("a computed survives the scope that made it", () => {
  const source = signal(1);
  const owner = scope();
  const doubled = owner.run(() => computed(() => source() * 2));

  owner.dispose();
  source(5);
  deepStrictEqual(doubled(), 10);
});

test("trigger re-runs the effects that read what fn read", () => {
  const count = signal(0);
  const owner = scope();
  let runs = 0;

  owner.run(() => {
    effect(() => {
      count();
      runs++;
    });
  });

  deepStrictEqual(runs, 1);

  trigger(() => count());
  deepStrictEqual(runs, 2);

  owner.dispose();
});

test("an effect's cleanup runs again on the next run", () => {
  const count = signal(0);
  const owner = scope();
  let cleanups = 0;
  let runs = 0;

  owner.run(() => {
    effect(() => {
      count();
      runs++;
      return () => cleanups++;
    });
  });

  count(1);
  deepStrictEqual([runs, cleanups], [2, 1]);

  owner.dispose();
  deepStrictEqual([runs, cleanups], [2, 2]);
});

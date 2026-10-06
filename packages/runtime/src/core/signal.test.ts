import { assertEquals, assertThrows } from "@std/assert";
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

Deno.test("an effect created in a scope stops when the scope is disposed", () => {
  const count = signal(0);
  const owner = scope();
  let runs = 0;

  owner.run(() => {
    effect(() => {
      count();
      runs++;
    });
  });

  assertEquals(runs, 1);

  count(1);
  assertEquals(runs, 2);

  owner.dispose();
  count(2);
  assertEquals(runs, 2);
});

Deno.test("disposing a scope reaches the scopes nested inside it", () => {
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
  assertEquals(outerRuns, 2);
  assertEquals(innerRuns, 2);

  outer.dispose();
  count(2);
  assertEquals(outerRuns, 2);
  assertEquals(innerRuns, 2);
});

Deno.test("each run gets its own effects and keeps them alive until dispose", () => {
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

  assertEquals([first, second], [1, 1]);

  count(1);
  assertEquals([first, second], [2, 2]);

  owner.dispose();
  count(2);
  assertEquals([first, second], [2, 2]);
});

Deno.test("run hands back what the callback returned", () => {
  const owner = scope();
  const doubled = owner.run(() => 21 * 2);
  assertEquals(doubled, 42);
  owner.dispose();
});

Deno.test("owned teardown runs once when the scope is disposed", () => {
  const owner = scope();
  let tears = 0;
  owner.own(() => tears++);

  assertEquals(tears, 0);

  owner.dispose();
  assertEquals(tears, 1);
});

Deno.test("teardown runs newest first", () => {
  const owner = scope();
  const order: string[] = [];
  owner.own(() => order.push("outer"));
  owner.own(() => order.push("inner"));

  owner.dispose();
  assertEquals(order, ["inner", "outer"]);
});

Deno.test("own outside a run reaches the scope that is running", () => {
  const owner = scope();
  let tears = 0;
  owner.run(() => {
    own(() => tears++);
  });

  assertEquals(tears, 0);

  owner.dispose();
  assertEquals(tears, 1);
});

Deno.test("teardown registered after dispose releases immediately", () => {
  const owner = scope();
  owner.dispose();

  let tears = 0;
  owner.own(() => tears++);
  assertEquals(tears, 1);
});

Deno.test("a scope released twice tears down once", () => {
  const owner = scope();
  let tears = 0;
  owner.own(() => tears++);

  owner.dispose();
  owner.dispose();
  assertEquals(tears, 1);
});

Deno.test("own outside a scope reports where it went wrong", () => {
  assertThrows(
    () => own(() => {}),
    Error,
    "own: called outside of scope.run",
  );
});

Deno.test("run on a disposed scope reports where it went wrong", () => {
  const owner = scope();
  owner.dispose();
  assertThrows(
    () => owner.run(() => 1),
    Error,
    "scope.run: the scope is disposed",
  );
});

Deno.test("batch collapses many writes into one effect run", () => {
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

  assertEquals(runs, 1);

  batch(() => {
    first(1);
    second(1);
  });
  assertEquals(runs, 2);

  first(2);
  assertEquals(runs, 3);
  owner.dispose();
});

Deno.test("batch returns what the callback returned", () => {
  assertEquals(batch(() => "value"), "value");
});

Deno.test("a nested batch flushes once, at the outer edge", () => {
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
    assertEquals(runs, 1);
  });
  assertEquals(runs, 2);
  owner.dispose();
});

Deno.test("untrack reads a value without subscribing the effect", () => {
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

  assertEquals([runs, seen], [1, 0]);

  tracked(1);
  assertEquals([runs, seen], [2, 0]);

  // The effect did not re-run, so `seen` still holds the value it last read.
  // The signal moved on regardless, and an untracked read sees the new one.
  quiet(1);
  assertEquals([runs, seen, untrack(() => quiet())], [2, 0, 1]);

  owner.dispose();
});

Deno.test("untrack restores the subscription of the effect around it", () => {
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
  assertEquals(runs, 2);
  owner.dispose();
});

Deno.test("computed derives from the signals it reads", () => {
  const first = signal(1);
  const second = signal(2);
  const total = computed(() => first() * 10 + second());

  assertEquals(total(), 12);

  first(3);
  assertEquals(total(), 32);
});

Deno.test("a computed survives the scope that made it", () => {
  const source = signal(1);
  const owner = scope();
  const doubled = owner.run(() => computed(() => source() * 2));

  owner.dispose();
  source(5);
  assertEquals(doubled(), 10);
});

Deno.test("trigger re-runs the effects that read what fn read", () => {
  const count = signal(0);
  const owner = scope();
  let runs = 0;

  owner.run(() => {
    effect(() => {
      count();
      runs++;
    });
  });

  assertEquals(runs, 1);

  trigger(() => count());
  assertEquals(runs, 2);

  owner.dispose();
});

Deno.test("an effect's cleanup runs again on the next run", () => {
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
  assertEquals([runs, cleanups], [2, 1]);

  owner.dispose();
  assertEquals([runs, cleanups], [2, 2]);
});

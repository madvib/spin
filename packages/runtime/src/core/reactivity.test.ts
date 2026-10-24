import { test } from "bun:test";
import { deepStrictEqual } from "node:assert/strict";
import { createMachine, interpret } from "@spin/runtime/fsm";
import { computed, effect, signal } from "@spin/runtime";

test("a read of a signal inside a computed subscribes to it", () => {
  const s = signal(1);
  let runs = 0;
  const c = computed(() => {
    runs += 1;
    return s() * 2;
  });
  deepStrictEqual(c(), 2);
  deepStrictEqual(runs, 1);
  s(3);
  deepStrictEqual(c(), 6, "the computed recomputed");
  deepStrictEqual(runs, 2, "and only when the signal moved");
});

test("a read inside an effect subscribes to it", () => {
  const s = signal(1);
  const seen: number[] = [];
  effect(() => {
    seen.push(s());
  });
  deepStrictEqual(seen, [1]);
  s(2);
  deepStrictEqual(seen, [1, 2]);
});

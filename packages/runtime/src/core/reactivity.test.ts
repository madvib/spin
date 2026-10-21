import { assertEquals } from "@std/assert";
import { createMachine, interpret } from "@spin/runtime/fsm";
import { signal, effect, computed } from "@spin/runtime";

Deno.test("a read of a signal inside a computed subscribes to it", () => {
  const s = signal(1);
  let runs = 0;
  const c = computed(() => {
    runs += 1;
    return s() * 2;
  });
  assertEquals(c(), 2);
  assertEquals(runs, 1);
  s(3);
  assertEquals(c(), 6, "the computed recomputed");
  assertEquals(runs, 2, "and only when the signal moved");
});

Deno.test("a read inside an effect subscribes to it", () => {
  const s = signal(1);
  const seen: number[] = [];
  effect(() => {
    seen.push(s());
  });
  assertEquals(seen, [1]);
  s(2);
  assertEquals(seen, [1, 2]);
});

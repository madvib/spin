import { assert } from "@std/assert";
import { def, type SliderApi } from "./slider.bindings.ts";
import type { ApiOf } from "@spin/runtime";

type Derived = ApiOf<typeof def>;

// The derived api must COVER the hand-written one: every member the
// interface declares, the def provides with a compatible type. This
// direction is the migration gate — it fails while the def is missing
// members, and passes when the def is complete.
//
// The reverse (Derived assignable to SliderApi) is NOT asserted: the def
// legitimately carries more than the hand-written interface declares
// (focusedIndex, disabled were added to the def and never to the
// interface — exactly the drift this derivation exists to kill). When
// this direction passes, SliderApi deletes.
Deno.test("ApiOf<typeof def> covers SliderApi", () => {
  const _check: SliderApi = null as unknown as Derived;
  void _check;
  assert(true);
});

import { assertEquals } from "@std/assert";
import { unjustified } from "../inventory.ts";

/**
 * Every hand-written `var()` is justified, or the vocabulary is missing it.
 *
 * The rule: a primitive may name a custom property by hand only where no
 * utility could express the declaration — a composite, or a value that is
 * itself a composite. Everything else belongs in the preset, because a
 * utility there is one a consumer gets too.
 *
 * This is the guard that keeps the primitives honest as the vocabulary grows.
 * When it fails, the fix is a utility, not an exception: adding a property to
 * `JUSTIFIED` is how a smell becomes permanent.
 */
Deno.test("no hand-written token reference lacks a justification", async () => {
  const gaps = await unjustified();
  assertEquals(
    gaps,
    [],
    `these name a token by hand with no utility to read it: ${gaps.join(", ")}`,
  );
});

import { assertEquals } from "@std/assert";
import { memo, slotFieldKey, valueKey, type BagReads } from "./bags.ts";

Deno.test("Given a bag / When the key holds / Then the same bag comes back", () => {
  const bag = memo();
  const key = (): string => "v=1";
  const first = bag(key, () => ({ "data-count": "1" }));
  const second = bag(key, () => ({ "data-count": "2" }));
  assertEquals(second, first, "the build did not run again");
  assertEquals(first["data-count"], "1", "and the bag kept its values");
});

Deno.test("Given a bag / When the key moves / Then the bag is built again", () => {
  const bag = memo();
  let value = 1;
  const key = (): string => `v=${value}`;
  const first = bag(key, () => ({ "data-count": String(value) }));
  value = 2;
  const second = bag(key, () => ({ "data-count": String(value) }));
  assertEquals(second === first, false, "a new bag was built");
  assertEquals(second["data-count"], "2", "and it carries the new value");
});

Deno.test("Given a build that read fields / When the key is made / Then the reads are named", () => {
  const bag = memo();
  const seen: BagReads[] = [];
  bag(
    (reads) => {
      seen.push(reads);
      return "v=1";
    },
    (record) => {
      record("context", "value");
      record("props", "dir");
      record("slot", "label");
      record("state", "");
      return {};
    },
  );
  const reads = seen[seen.length - 1];
  assertEquals(reads?.context, ["value"], "the context field is named");
  assertEquals(reads?.props, ["dir"], "the prop is named");
  assertEquals(reads?.slot, ["label"], "the slot's field is named");
  assertEquals(reads?.state, true, "and the state is read");
});

Deno.test("Given a primitive field / When it changes / Then the key moves", () => {
  assertEquals(valueKey(1) === valueKey(1), true, "the same number keeps its key");
  assertEquals(valueKey(1) === valueKey(2), false, "another number moves the key");
  assertEquals(valueKey("1") === valueKey(1), false, "a number and its text differ");
  assertEquals(valueKey(true) === valueKey(false), false, "two booleans differ");
});

Deno.test("Given an object field / When the object is replaced / Then the key moves", () => {
  const first = { count: 1 };
  const second = { count: 1 };
  assertEquals(valueKey(first) === valueKey(first), true, "the same object keeps its key");
  assertEquals(valueKey(first) === valueKey(second), false, "a replaced object moves the key");
});

Deno.test("Given a slot / When one field is read / Then the key holds that field's value", () => {
  const slot = { label: "one", depth: 2 };
  assertEquals(
    slotFieldKey(slot, "label") === slotFieldKey({ label: "one", depth: 9 }, "label"),
    true,
    "another field does not move the key",
  );
  assertEquals(
    slotFieldKey(slot, "label") === slotFieldKey({ label: "two", depth: 2 }, "label"),
    false,
    "the field's own value moves the key",
  );
});

Deno.test("Given a slot read whole / When a field changes / Then the key moves", () => {
  const slot = { label: "one", depth: 2 };
  assertEquals(
    slotFieldKey(slot, "*") === slotFieldKey({ label: "one", depth: 2 }, "*"),
    true,
    "the same content is the same key",
  );
  assertEquals(
    slotFieldKey(slot, "*") === slotFieldKey({ label: "two", depth: 2 }, "*"),
    false,
    "a changed field moves the key",
  );
});

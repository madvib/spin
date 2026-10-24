import { test } from "bun:test";
import { deepStrictEqual } from "node:assert/strict";
import {
  type BagMemo,
  type BagReads,
  keyed,
  memo,
  slotFieldKey,
  valueKey,
} from "./bags.ts";

test("Given a bag / When the key holds / Then the same bag comes back", () => {
  const bag = memo();
  const key = (): string => "v=1";
  const first = bag(key, () => ({ "data-count": "1" }));
  const second = bag(key, () => ({ "data-count": "2" }));
  deepStrictEqual(second, first, "the build did not run again");
  deepStrictEqual(first["data-count"], "1", "and the bag kept its values");
});

test("Given a bag / When the key moves / Then the bag is built again", () => {
  const bag = memo();
  let value = 1;
  const key = (): string => `v=${value}`;
  const first = bag(key, () => ({ "data-count": String(value) }));
  value = 2;
  const second = bag(key, () => ({ "data-count": String(value) }));
  deepStrictEqual(second === first, false, "a new bag was built");
  deepStrictEqual(second["data-count"], "2", "and it carries the new value");
});

test("Given a build that read fields / When the key is made / Then the reads are named", () => {
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
  deepStrictEqual(reads?.context, ["value"], "the context field is named");
  deepStrictEqual(reads?.props, ["dir"], "the prop is named");
  deepStrictEqual(reads?.slot, ["label"], "the slot's field is named");
  deepStrictEqual(reads?.state, true, "and the state is read");
});

test("Given a primitive field / When it changes / Then the key moves", () => {
  deepStrictEqual(
    valueKey(1) === valueKey(1),
    true,
    "the same number keeps its key",
  );
  deepStrictEqual(
    valueKey(1) === valueKey(2),
    false,
    "another number moves the key",
  );
  deepStrictEqual(
    valueKey("1") === valueKey(1),
    false,
    "a number and its text differ",
  );
  deepStrictEqual(
    valueKey(true) === valueKey(false),
    false,
    "two booleans differ",
  );
});

test("Given an object field / When the object is replaced / Then the key moves", () => {
  const first = { count: 1 };
  const second = { count: 1 };
  deepStrictEqual(
    valueKey(first) === valueKey(first),
    true,
    "the same object keeps its key",
  );
  deepStrictEqual(
    valueKey(first) === valueKey(second),
    false,
    "a replaced object moves the key",
  );
});

test("Given a slot / When one field is read / Then the key holds that field's value", () => {
  const slot = { label: "one", depth: 2 };
  deepStrictEqual(
    slotFieldKey(slot, "label") ===
      slotFieldKey({ label: "one", depth: 9 }, "label"),
    true,
    "another field does not move the key",
  );
  deepStrictEqual(
    slotFieldKey(slot, "label") ===
      slotFieldKey({ label: "two", depth: 2 }, "label"),
    false,
    "the field's own value moves the key",
  );
});

test("Given a slot read whole / When a field changes / Then the key moves", () => {
  const slot = { label: "one", depth: 2 };
  deepStrictEqual(
    slotFieldKey(slot, "*") === slotFieldKey({ label: "one", depth: 2 }, "*"),
    true,
    "the same content is the same key",
  );
  deepStrictEqual(
    slotFieldKey(slot, "*") === slotFieldKey({ label: "two", depth: 2 }, "*"),
    false,
    "a changed field moves the key",
  );
});

test("Given an inline slot wrapper / When passed as fresh literals with the same index / Then keyed returns the cached bag", () => {
  const store = new WeakMap<object, BagMemo>();
  let builds = 0;
  const first = keyed(
    store,
    { index: 0 },
    (reads) => reads.slot.map((f) => slotFieldKey({ index: 0 }, f)).join(","),
    (record) => {
      builds += 1;
      record("slot", "index");
      return { "data-index": "0" };
    },
  );
  const second = keyed(
    store,
    { index: 0 },
    (reads) => reads.slot.map((f) => slotFieldKey({ index: 0 }, f)).join(","),
    (record) => {
      builds += 1;
      record("slot", "index");
      return { "data-index": "0" };
    },
  );
  deepStrictEqual(
    first === second,
    true,
    "fresh { index: 0 } literals hit the structural cache",
  );
  deepStrictEqual(builds, 1, "the bag built once");
});

import { test } from "bun:test";
import assert from "node:assert/strict";
import { scope } from "../core/signal.ts";
import { createScopeTable } from "./table.ts";

const tableOf = () => createScopeTable(scope());

test("two bindings of one handle hold distinct bridges", () => {
  const table = tableOf();
  const handle = {};
  const first = table.watch(handle, () => ({ n: 1 }), undefined, "outer");
  const second = table.watch(handle, () => ({ n: 2 }), undefined, "inner");
  assert.notStrictEqual(first, second);
  assert.deepStrictEqual([first.n, second.n], [1, 2]);
});

test("the same binding watched twice keeps its bridge", () => {
  const table = tableOf();
  const handle = {};
  const first = table.watch(handle, () => ({ n: 1 }), undefined, "outer");
  const second = table.watch(handle, () => ({ n: 2 }), undefined, "outer");
  assert.strictEqual(second, first);
  assert.strictEqual(second.n, 1);
});

test("the unnamed binding keeps its bridge across rewatches", () => {
  const table = tableOf();
  const handle = {};
  const first = table.watch(handle, () => ({ n: 1 }));
  const second = table.watch(handle, () => ({ n: 2 }));
  assert.strictEqual(second, first);
});

test("consume resolves the unnamed bridge when named ones exist", () => {
  const table = tableOf();
  const handle = {};
  table.watch(handle, () => ({ n: 1 }), undefined, "outer");
  const unnamed = table.watch(handle, () => ({ n: 9 }));
  assert.strictEqual(table.consume(handle), unnamed);
});

test("dispose tears every named bridge down", () => {
  const table = tableOf();
  const handle = {};
  let torn = 0;
  table.watch(handle, () => ({ dispose: () => void torn++ }), undefined, "outer");
  table.watch(handle, () => ({ dispose: () => void torn++ }), undefined, "inner");
  table.dispose();
  assert.strictEqual(torn, 2);
  const fresh = table.watch(handle, () => ({ n: 3 }), undefined, "outer");
  assert.strictEqual(fresh.n, 3);
});

import { test } from "bun:test";
import { deepStrictEqual } from "node:assert/strict";
import { studioBase, studioMount, studioRpc } from "./mount.ts";

test("the plugin mount supplies the api and router base", () => {
  deepStrictEqual(studioMount("/__spin/studio/"), "/__spin/");
  deepStrictEqual(studioRpc("/__spin/studio/"), "/__spin/rpc");
  deepStrictEqual(studioBase("/__spin/studio/"), "/__spin/studio");
  deepStrictEqual(studioBase("/__spin/studio/colors"), "/__spin/studio");
});

test("the standalone mount supplies the api and router base", () => {
  deepStrictEqual(studioMount("/studio/"), "/");
  deepStrictEqual(studioRpc("/studio/"), "/rpc");
  deepStrictEqual(studioBase("/studio/"), "/studio");
  deepStrictEqual(studioBase("/studio/colors"), "/studio");
});

test("the studio's own dev server keeps the host api path and routes from root", () => {
  deepStrictEqual(studioMount("/"), "/__spin/");
  deepStrictEqual(studioRpc("/"), "/__spin/rpc");
  deepStrictEqual(studioBase("/"), "");
  deepStrictEqual(studioBase("/colors"), "");
});

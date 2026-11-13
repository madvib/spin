import { test } from "bun:test";
import assert from "node:assert/strict";
import { spin } from "../../src/plugin/plugin.ts";

test("unplugin bundler adapters instantiate spin plugin stages cleanly", () => {
  const vitePlugins = spin.vite();
  assert.equal(Array.isArray(vitePlugins), true);
  assert.equal(vitePlugins.length, 2);

  const rolldownPlugins = spin.rolldown();
  assert.equal(Array.isArray(rolldownPlugins), true);
  assert.equal(rolldownPlugins.length, 2);

  const rollupPlugins = spin.rollup();
  assert.equal(Array.isArray(rollupPlugins), true);
  assert.equal(rollupPlugins.length, 2);

  const esbuildPlugin = spin.esbuild();
  assert.equal(typeof esbuildPlugin.setup, "function");

  const webpackPlugin = spin.webpack();
  assert.equal(typeof webpackPlugin.apply, "function");

  const rspackPlugin = spin.rspack();
  assert.equal(typeof rspackPlugin.apply, "function");
});

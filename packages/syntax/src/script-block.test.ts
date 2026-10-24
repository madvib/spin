import { test } from "bun:test";
import { deepStrictEqual } from "node:assert/strict";
import { extractScript, stripScript } from "./script-block.ts";

test("extractScript finds the block", () => {
  const src = `<script lang="ts">\nconst x = 1;\n</script>\n<div></div>`;
  deepStrictEqual(extractScript(src), "\nconst x = 1;\n");
});

test("extractScript returns undefined without a block", () => {
  deepStrictEqual(extractScript(`<div></div>`), undefined);
});

test("stripScript keeps imports, types, and machine calls", () => {
  const body = `import { slider } from "../slider.machine.ts";
import type { SliderArgs } from "../slider.state.ts";
type Props = { value: number[] };
interface Ctx { v: number }
const ctl = slider({ value: [50] });`;
  const out = stripScript(body);
  deepStrictEqual(out.bindings, ["ctl"]);
  deepStrictEqual(out.stripped, []);
});

test("stripScript strips effects", () => {
  const body = `const ctl = slider({ value: [50] });
await load();
el.addEventListener("x", f);`;
  const out = stripScript(body);
  deepStrictEqual(out.bindings, ["ctl"]);
  deepStrictEqual(out.stripped.length, 2);
});

test("stripScript keeps multi-line imports, types, and machine calls with nested parens", () => {
  const body = `import {
  slider,
} from "../slider.machine.ts";
type Item = {
  readonly id: string;
  readonly label: string;
};
const ctl = slider({
  value: [20, 80],
  markers: [0, 50, 100],
});`;
  const out = stripScript(body);
  deepStrictEqual(out.bindings, ["ctl"]);
  deepStrictEqual(out.calls.length, 1);
  deepStrictEqual(out.calls[0]?.name, "ctl");
  deepStrictEqual(out.calls[0]?.factory, "slider");
  deepStrictEqual(
    out.calls[0]?.args,
    "{\n  value: [20, 80],\n  markers: [0, 50, 100],\n}",
  );
  deepStrictEqual(out.stripped, []);
});

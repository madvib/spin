import { assertEquals } from "@std/assert";
import { extractScript, stripScript } from "./script-block.ts";

Deno.test("extractScript finds the block", () => {
  const src = `<script lang="ts">\nconst x = 1;\n</script>\n<div></div>`;
  assertEquals(extractScript(src), "\nconst x = 1;\n");
});

Deno.test("extractScript returns undefined without a block", () => {
  assertEquals(extractScript(`<div></div>`), undefined);
});

Deno.test("stripScript keeps imports, types, and machine calls", () => {
  const body = `import { slider } from "../slider.machine.ts";
import type { SliderArgs } from "../slider.state.ts";
type Props = { value: number[] };
interface Ctx { v: number }
const ctl = slider({ value: [50] });`;
  const out = stripScript(body);
  assertEquals(out.bindings, ["ctl"]);
  assertEquals(out.stripped, []);
});

Deno.test("stripScript strips effects", () => {
  const body = `const ctl = slider({ value: [50] });
await load();
el.addEventListener("x", f);`;
  const out = stripScript(body);
  assertEquals(out.bindings, ["ctl"]);
  assertEquals(out.stripped.length, 2);
});

Deno.test("stripScript keeps multi-line imports, types, and machine calls with nested parens", () => {
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
  assertEquals(out.bindings, ["ctl"]);
  assertEquals(out.calls.length, 1);
  assertEquals(out.calls[0]?.name, "ctl");
  assertEquals(out.calls[0]?.factory, "slider");
  assertEquals(
    out.calls[0]?.args,
    "{\n  value: [20, 80],\n  markers: [0, 50, 100],\n}",
  );
  assertEquals(out.stripped, []);
});

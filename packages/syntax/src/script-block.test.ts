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

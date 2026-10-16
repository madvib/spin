import { assertEquals } from "@std/assert";
import { scanRun } from "./scan.ts";

/** The shapes that broke the viewer twice: spreads, spaced expressions,
 * nested braces, quoted strings, and the unclosed runs half-written
 * markup leaves behind. */
Deno.test("scanRun reads a quoted value whole", () => {
  const html = `class="a b" next`;
  assertEquals(scanRun(html, 6), 11);
});

Deno.test("scanRun reads a spread with call parens whole", () => {
  const html = `{...slider.getRootProps()} rest`;
  assertEquals(html.slice(0, scanRun(html, 0)), `{...slider.getRootProps()}`);
});

Deno.test("scanRun keeps spaces inside an expression", () => {
  const html = `{ratingGroup.value - ratingGroup.value % 1 === 4}>`;
  assertEquals(
    html.slice(0, scanRun(html, 0)),
    `{ratingGroup.value - ratingGroup.value % 1 === 4}`,
  );
});

Deno.test("scanRun nests braces", () => {
  const html = `{...getItemProps({ index: row })} rest`;
  assertEquals(
    html.slice(0, scanRun(html, 0)),
    `{...getItemProps({ index: row })}`,
  );
});

Deno.test("scanRun runs an unclosed brace to the end", () => {
  const html = `{row.label`;
  assertEquals(scanRun(html, 0), html.length);
});

Deno.test("scanRun leaves a bare word alone", () => {
  assertEquals(scanRun(`disabled>`, 0), 0);
});

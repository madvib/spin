import { assertEquals } from "@std/assert";
import { type CodeToken, dedent, tokenizeHtml } from "./code.ts";

/**
 * The tokenizer splits what a reader can see; the gaps an attribute sits in
 * are character data with nothing to say, so the assertions below read the
 * runs with content. Round-tripping is checked against every run, gaps
 * included — a code view that drops a space is a code view that drops markup.
 */
const visible = (html: string): CodeToken[] =>
  tokenizeHtml(html).filter((token) => token.text.trim() !== "");

const texts = (html: string) => tokenizeHtml(html).map((t) => t.text).join("");

Deno.test("dedent strips the indentation a fixture template leaves behind", () => {
  const authored = `<div class="flex">
          <button>default</button>
        </div>`;
  assertEquals(
    dedent(authored),
    `<div class="flex">
  <button>default</button>
</div>`,
  );
});

Deno.test("dedent leaves a single-line fixture alone", () => {
  assertEquals(dedent(`<hr class="hr-dashed">`), `<hr class="hr-dashed">`);
});

Deno.test("dedent drops the blank lines a fixture wraps itself in", () => {
  assertEquals(dedent(`\n\n<hr>\n\n`), `<hr>`);
});

Deno.test("tokenizeHtml round-trips the markup it splits", () => {
  const html =
    `<nav class="breadcrumbs" aria-label="Breadcrumb">\n  <li><a href="#">Home</a></li>\n</nav>`;
  assertEquals(texts(html), html);
});

Deno.test("tokenizeHtml tells an element from the attribute it carries", () => {
  const tokens = visible(`<button class="danger">Delete</button>`);
  assertEquals(tokens.filter((t) => t.kind === "tag").map((t) => t.text), [
    "<",
    "button",
    ">",
    "</",
    "button",
    ">",
  ]);
  assertEquals(tokens.filter((t) => t.kind === "attr").map((t) => t.text), [
    "class",
  ]);
  assertEquals(tokens.filter((t) => t.kind === "value").map((t) => t.text), [
    `="danger"`,
  ]);
  assertEquals(tokens.filter((t) => t.kind === "text").map((t) => t.text), [
    "Delete",
  ]);
});

Deno.test("tokenizeHtml keeps a class list as one run", () => {
  const values = visible(
    `<i class="i-lucide-x button-icon" data-open="info">`,
  ).filter((t) => t.kind === "value").map((t) => t.text);
  assertEquals(values, [`="i-lucide-x button-icon"`, `="info"`]);
});

Deno.test("tokenizeHtml reads a void element with no closing tag", () => {
  const tokens = visible(`<input type="checkbox" checked>`);
  assertEquals(tokens.filter((t) => t.kind === "attr").map((t) => t.text), [
    "type",
    "checked",
  ]);
  assertEquals(tokens.filter((t) => t.kind === "tag").map((t) => t.text), [
    "<",
    "input",
    ">",
  ]);
});

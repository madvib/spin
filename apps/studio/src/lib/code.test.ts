import { assertEquals } from "@std/assert";
import { type CodeToken, formatExampleHtml, tokenizeHtml } from "./code.ts";

/**
 * The tokenizer splits what a reader can see; the gaps an attribute sits in
 * are character data with nothing to say, so the assertions below read the
 * runs with content. Round-tripping is checked against every run, gaps
 * included — a code view that drops a space is a code view that drops markup.
 */
const visible = (html: string): CodeToken[] =>
  tokenizeHtml(html).filter((token) => token.text.trim() !== "");

const texts = (html: string) => tokenizeHtml(html).map((t) => t.text).join("");

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

Deno.test("formatExampleHtml indents nested elements one step per depth", () => {
  assertEquals(
    formatExampleHtml(`<ul class="stack"><li><a href="#">Home</a></li></ul>`),
    [
      `<ul class="stack">`,
      `  <li>`,
      `    <a href="#">Home</a>`,
      `  </li>`,
      `</ul>`,
    ].join("\n"),
  );
});

Deno.test("formatExampleHtml keeps a sentence on its element's own line", () => {
  assertEquals(
    formatExampleHtml(`<p>Press <kbd>Enter</kbd> to submit.</p>`),
    `<p>Press <kbd>Enter</kbd> to submit.</p>`,
  );
});

Deno.test("formatExampleHtml reads the same formatting twice as once", () => {
  const once = formatExampleHtml(
    `<div class="card"><h2>Title</h2><p>Body text</p></div>`,
  );
  assertEquals(formatExampleHtml(once), once);
});

Deno.test("formatExampleHtml copies a verbatim element's own whitespace through", () => {
  assertEquals(
    formatExampleHtml(`<pre>col one\n  col two</pre>`),
    `<pre>col one\n  col two</pre>`,
  );
});

Deno.test("formatExampleHtml gives a third attribute a line of its own", () => {
  assertEquals(
    formatExampleHtml(
      `<button type="button" class="secondary" disabled>OK</button>`,
    ),
    `<button\n  type="button"\n  class="secondary"\n  disabled\n>OK</button>`,
  );
});

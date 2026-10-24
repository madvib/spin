import { test } from "bun:test";
import { deepStrictEqual } from "node:assert/strict";
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

test("tokenizeHtml round-trips the markup it splits", () => {
  const html =
    `<nav class="breadcrumbs" aria-label="Breadcrumb">\n  <li><a href="#">Home</a></li>\n</nav>`;
  deepStrictEqual(texts(html), html);
});

test("tokenizeHtml tells an element from the attribute it carries", () => {
  const tokens = visible(`<button class="danger">Delete</button>`);
  deepStrictEqual(tokens.filter((t) => t.kind === "tag").map((t) => t.text), [
    "<",
    "button",
    ">",
    "</",
    "button",
    ">",
  ]);
  deepStrictEqual(tokens.filter((t) => t.kind === "attr").map((t) => t.text), [
    "class",
  ]);
  deepStrictEqual(tokens.filter((t) => t.kind === "value").map((t) => t.text), [
    `="danger"`,
  ]);
  deepStrictEqual(tokens.filter((t) => t.kind === "text").map((t) => t.text), [
    "Delete",
  ]);
});

test("tokenizeHtml keeps a class list as one run", () => {
  const values = visible(
    `<i class="i-lucide-x button-icon" data-open="info">`,
  ).filter((t) => t.kind === "value").map((t) => t.text);
  deepStrictEqual(values, [`="i-lucide-x button-icon"`, `="info"`]);
});

test("tokenizeHtml reads a void element with no closing tag", () => {
  const tokens = visible(`<input type="checkbox" checked>`);
  deepStrictEqual(tokens.filter((t) => t.kind === "attr").map((t) => t.text), [
    "type",
    "checked",
  ]);
  deepStrictEqual(tokens.filter((t) => t.kind === "tag").map((t) => t.text), [
    "<",
    "input",
    ">",
  ]);
});

test("formatExampleHtml indents nested elements one step per depth", () => {
  deepStrictEqual(
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

test("formatExampleHtml keeps a sentence on its element's own line", () => {
  deepStrictEqual(
    formatExampleHtml(`<p>Press <kbd>Enter</kbd> to submit.</p>`),
    `<p>Press <kbd>Enter</kbd> to submit.</p>`,
  );
});

test("formatExampleHtml reads the same formatting twice as once", () => {
  const once = formatExampleHtml(
    `<div class="card"><h2>Title</h2><p>Body text</p></div>`,
  );
  deepStrictEqual(formatExampleHtml(once), once);
});

test("formatExampleHtml copies a verbatim element's own whitespace through", () => {
  deepStrictEqual(
    formatExampleHtml(`<pre>col one\n  col two</pre>`),
    `<pre>col one\n  col two</pre>`,
  );
});

test("formatExampleHtml gives a third attribute a line of its own", () => {
  deepStrictEqual(
    formatExampleHtml(
      `<button type="button" class="secondary" disabled>OK</button>`,
    ),
    `<button\n  type="button"\n  class="secondary"\n  disabled\n>OK</button>`,
  );
});

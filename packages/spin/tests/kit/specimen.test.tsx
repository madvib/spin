/** @jsxImportSource solid-js */
import { test } from "bun:test";
import assert, { deepStrictEqual } from "node:assert/strict";
import { renderToString } from "solid-js/web";
import {
  formatExampleHtml,
  Specimen,
  tokenizeCode,
  tokenizeHtml,
} from "../../src/kit/specimen.tsx";

/**
 * The specimen's two pure facts: the markup is formatted without being
 * rewritten, and the row renders both views with the copy control on the one
 * that copies.
 */

test("formatting strips the template literal's air and keeps the markup", () => {
  const source = `
        <card class="card-narrow">
          <card-title>Deploy</card-title>
        </card>
  `;
  deepStrictEqual(
    formatExampleHtml(source),
    '<card class="card-narrow">\n  <card-title>Deploy</card-title>\n</card>',
  );
});

test("formatting collapses runs of blank lines", () => {
  deepStrictEqual(
    formatExampleHtml("<div>\n\n\n\n  <p>One</p>\n\n\n</div>"),
    "<div>\n\n  <p>One</p>\n\n</div>",
  );
});

test("the tokenizer preserves every character of the markup", () => {
  const html =
    '<card class="card-narrow">\n  <card-title>Deploy</card-title>\n</card>';
  deepStrictEqual(tokenizeHtml(html).map((token) => token.value).join(""), html);
});

test("the code tokenizer preserves every character of TS and JSON", () => {
  const ts =
    `import { spin } from "../../src/preset/plugin.ts";\n// wire it\nspin.vite({ themes: {} });`;
  deepStrictEqual(
    tokenizeCode(ts, "ts").map((token) => token.value).join(""),
    ts,
  );
  const json = `{\n  "primary": { "$value": "#c8102e" },\n  "n": 4\n}`;
  deepStrictEqual(
    tokenizeCode(json, "json").map((token) => token.value).join(""),
    json,
  );
});

test("the code tokenizer names keywords, strings, and comments", () => {
  const tokens = tokenizeCode(`import x from "y"; // done`, "ts");
  const kinds = Object.fromEntries(
    tokens.map((token) => [token.value, token.type]),
  );
  deepStrictEqual(kinds["import"], "keyword");
  deepStrictEqual(kinds['"y"'], "code-string");
  deepStrictEqual(kinds["// done"], "comment");
  const json = tokenizeCode(`{ "a": 1 }`, "json");
  const jsonKinds = Object.fromEntries(
    json.map((token) => [token.value, token.type]),
  );
  deepStrictEqual(jsonKinds['"a"'], "attr");
  deepStrictEqual(jsonKinds["1"], "number");
});

test("the specimen renders the preview and the markup together", async () => {
  const html = await renderToString(() => (
    <Specimen name="deploy" html='<button type="button">Deploy</button>' />
  ));
  assert(html.includes("deploy"));
  assert(html.includes("component"));
  assert(html.includes("code"));
  // The preview is the markup as a browser runs it; the code is the same
  // markup as a reader copies it, tokenized into the inks the panel measured.
  assert(html.includes('<button type="button">Deploy</button>'));
  assert(html.includes("text-semantic-error"));
  assert(html.includes("text-link"));
});

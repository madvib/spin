import { test } from "bun:test";
import { deepStrictEqual } from "node:assert/strict";
import {
  formatExampleHtml,
  tokenizeCode,
  tokenizeHtml,
} from "../../src/kit/code.ts";

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

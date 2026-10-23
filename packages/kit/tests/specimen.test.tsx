import { assertEquals, assertStringIncludes } from "@std/assert";
import { renderToString } from "solid-js/web";
import {
  formatExampleHtml,
  Specimen,
  tokenizeCode,
  tokenizeHtml,
} from "../src/specimen.tsx";

/**
 * The specimen's two pure facts: the markup is formatted without being
 * rewritten, and the row renders both views with the copy control on the one
 * that copies.
 */

Deno.test("formatting strips the template literal's air and keeps the markup", () => {
  const source = `
        <card class="card-narrow">
          <card-title>Deploy</card-title>
        </card>
  `;
  assertEquals(
    formatExampleHtml(source),
    '<card class="card-narrow">\n  <card-title>Deploy</card-title>\n</card>',
  );
});

Deno.test("formatting collapses runs of blank lines", () => {
  assertEquals(
    formatExampleHtml("<div>\n\n\n\n  <p>One</p>\n\n\n</div>"),
    "<div>\n\n  <p>One</p>\n\n</div>",
  );
});

Deno.test("the tokenizer preserves every character of the markup", () => {
  const html =
    '<card class="card-narrow">\n  <card-title>Deploy</card-title>\n</card>';
  assertEquals(tokenizeHtml(html).map((token) => token.value).join(""), html);
});

Deno.test("the code tokenizer preserves every character of TS and JSON", () => {
  const ts =
    `import { spin } from "@spin/preset/plugin";\n// wire it\nspin.vite({ themes: {} });`;
  assertEquals(
    tokenizeCode(ts, "ts").map((token) => token.value).join(""),
    ts,
  );
  const json = `{\n  "primary": { "$value": "#c8102e" },\n  "n": 4\n}`;
  assertEquals(
    tokenizeCode(json, "json").map((token) => token.value).join(""),
    json,
  );
});

Deno.test("the code tokenizer names keywords, strings, and comments", () => {
  const tokens = tokenizeCode(`import x from "y"; // done`, "ts");
  const kinds = Object.fromEntries(
    tokens.map((token) => [token.value, token.type]),
  );
  assertEquals(kinds["import"], "keyword");
  assertEquals(kinds['"y"'], "code-string");
  assertEquals(kinds["// done"], "comment");
  const json = tokenizeCode(`{ "a": 1 }`, "json");
  const jsonKinds = Object.fromEntries(
    json.map((token) => [token.value, token.type]),
  );
  assertEquals(jsonKinds['"a"'], "attr");
  assertEquals(jsonKinds["1"], "number");
});

Deno.test("the specimen renders the preview and the markup together", async () => {
  const html = await renderToString(() => (
    <Specimen name="deploy" html='<button type="button">Deploy</button>' />
  ));
  assertStringIncludes(html, "deploy");
  assertStringIncludes(html, "component");
  assertStringIncludes(html, "code");
  // The preview is the markup as a browser runs it; the code is the same
  // markup as a reader copies it, tokenized into the inks the panel measured.
  assertStringIncludes(html, '<button type="button">Deploy</button>');
  assertStringIncludes(html, "text-semantic-error");
  assertStringIncludes(html, "text-link");
});

import { assert } from "@std/assert";
import { variantExtractor } from "../src/extractors.ts";

function extract(code: string): string[] {
  const result = variantExtractor.extract!({
    code,
    original: code,
    extracted: new Set<string>(),
  });
  if (result instanceof Set) return [...result];
  if (Array.isArray(result)) return result;
  return [];
}

Deno.test("variantExtractor emits bare and compound tokens for each variant value", () => {
  const tokens = extract('<badge variant="primary sm">');
  assert(tokens.includes("primary"), "bare value 'primary' must be emitted");
  assert(tokens.includes("sm"), "bare value 'sm' must be emitted");
  assert(tokens.includes("badge-primary"), "compound 'badge-primary' must be emitted");
  assert(tokens.includes("badge-sm"), "compound 'badge-sm' must be emitted");
});

Deno.test("variantExtractor handles a single variant value", () => {
  const tokens = extract('<button variant="s-sm">');
  assert(tokens.includes("s-sm"), "bare value 's-sm' must be emitted");
  assert(tokens.includes("button-s-sm"), "compound 'button-s-sm' must be emitted");
});

Deno.test("variantExtractor ignores markup without variant attributes", () => {
  const tokens = extract('<badge class="primary"><button type="submit">');
  assert(tokens.length === 0, "no tokens should be emitted when no variant attribute is present");
});

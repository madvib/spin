import { assert } from "@std/assert";
import { classObjectExtractor, variantExtractor } from "../src/extractors.ts";

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
  assert(
    tokens.includes("badge-primary"),
    "compound 'badge-primary' must be emitted",
  );
  assert(tokens.includes("badge-sm"), "compound 'badge-sm' must be emitted");
});

Deno.test("variantExtractor handles a single variant value", () => {
  const tokens = extract('<button variant="s-sm">');
  assert(tokens.includes("s-sm"), "bare value 's-sm' must be emitted");
  assert(
    tokens.includes("button-s-sm"),
    "compound 'button-s-sm' must be emitted",
  );
});

Deno.test("variantExtractor ignores markup without variant attributes", () => {
  const tokens = extract('<badge class="primary"><button type="submit">');
  assert(
    tokens.length === 0,
    "no tokens should be emitted when no variant attribute is present",
  );
});

function extractClasses(code: string): string[] {
  const result = classObjectExtractor.extract!({
    code,
    original: code,
    extracted: new Set<string>(),
  });
  if (result instanceof Set) return [...result];
  if (Array.isArray(result)) return result;
  return [];
}

Deno.test("classObjectExtractor emits the keys of a class object", () => {
  const tokens = extractClasses(
    `<div class={["bg-surface", { "bg-primary": slider.state === "open" }]}></div>`,
  );
  assert(tokens.includes("bg-primary"), "the object's key must be emitted");
});

Deno.test("classObjectExtractor leaves a value's string alone", () => {
  const tokens = extractClasses(
    `<div class={[{ "bg-primary": a ? "p-1" : "p-2" }]}></div>`,
  );
  assert(!tokens.includes("p-1"), "a ternary's arm is a value, not a class");
  assert(!tokens.includes("p-2"), "a ternary's arm is a value, not a class");
});

Deno.test("classObjectExtractor leaves a static class attribute alone", () => {
  const tokens = extractClasses(`<div class="bg-surface p-2"></div>`);
  assert(
    !tokens.includes("bg-surface"),
    "a static class is uno's own business",
  );
});

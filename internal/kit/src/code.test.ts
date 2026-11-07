import { describe, expect, test } from "bun:test";
import { CODE_INK, tokenizeCode } from "./code";

describe("tokenizeCode", () => {
  test("ts: keyword, type, number, comment", () => {
    const tokens = tokenizeCode("const answer: number = 42; // note", "ts");
    expect(tokens).toContainEqual({ type: "keyword", value: "const" });
    expect(tokens).toContainEqual({ type: "type", value: "number" });
    expect(tokens).toContainEqual({ type: "number", value: "42" });
    expect(tokens).toContainEqual({ type: "comment", value: "// note" });
  });

  test("ts: import keyword and code-string", () => {
    const tokens = tokenizeCode('import { spin } from "@spinjs/spin/vite";', "ts");
    expect(tokens).toContainEqual({ type: "keyword", value: "import" });
    expect(tokens).toContainEqual({ type: "code-string", value: '"@spinjs/spin/vite"' });
  });

  test("html: tag-name, attr, string, lossless roundtrip", () => {
    const source = '<button class="button">Save</button>';
    const tokens = tokenizeCode(source, "html");
    expect(tokens).toContainEqual({ type: "attr", value: "class" });
    expect(tokens).toContainEqual({ type: "string", value: '"button"' });
    expect(tokens.map((t) => t.value).join("")).toBe(source);
  });

  test("CODE_INK: three distinct inks", () => {
    expect(new Set([CODE_INK.keyword, CODE_INK.string, CODE_INK.function]).size).toBe(3);
  });
});
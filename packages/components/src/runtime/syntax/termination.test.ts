import { test } from "bun:test";
import assert from "node:assert/strict";
import { parse } from "./parse.ts";

/**
 * Malformed input terminates: every row returns or throws within budget.
 *
 * The parser reads customer files, and a loop that never advances is a
 * hang the linter cannot catch. The budget names hanging, not speed —
 * well-formed input parses in under a millisecond.
 */
const MALFORMED: readonly string[] = [
  `<input / disabled>`,
  `<input / data-x>`,
  `<div {...unclosed>`,
  `<div title="unclosed>`,
  `<div {unclosed>`,
  `<div><span></div>`,
  `<div>`,
  `</div>`,
  `<template>`,
  `text with {unclosed`,
  `<div class={unclosed>`,
];

for (const src of MALFORMED) {
  test(`parse-termination: ${JSON.stringify(src)} returns or throws within 1s`, () => {
    const start = Date.now();
    try {
      parse(src);
    } catch {
      // A diagnostic throw is termination too: the file is rejected, not hung.
    }
    const delta = Date.now() - start;
    assert(
      delta < 1000,
      `parsing ${JSON.stringify(src)} took ${delta}ms — the parser hung`,
    );
  });
}

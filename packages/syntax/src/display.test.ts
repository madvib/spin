import { test } from "bun:test";
import assert from "node:assert/strict";
import { formatExampleHtml, tokenizeHtml } from "./display.ts";

/** The viewer shows formatted source with each token wearing its kind.
 * These pin the displayed output for the shapes that broke it: spreads,
 * spaced show={...} expressions, and case kept as authored. Copy is
 * exact source and is not what is tested here. */

const kinds = (html: string): string[] =>
  tokenizeHtml(html).map((t) => `${t.type}:${t.value}`);

test("a spread is one expression token, not an attribute name", () => {
  const tokens = kinds(`<div {...slider.getRootProps()}>`);
  assert(tokens.includes(`expr:{...slider.getRootProps()}`), tokens.join(" "));
  assert(!tokens.some((t) => t.startsWith("attr:")), tokens.join(" "));
});

test("a spaced show expression survives formatting whole", () => {
  const shown = formatExampleHtml(
    `<div show={ratingGroup.value - ratingGroup.value % 1 === 4}>x</div>`,
  );
  assert(
    shown.includes(`show={ratingGroup.value - ratingGroup.value % 1 === 4}`),
    shown,
  );
});

test("attribute case survives display", () => {
  const shown = formatExampleHtml(`<div {...slider.getRootProps()}></div>`);
  assert(shown.includes("getRootProps"), shown);
  assert(!shown.includes("getrootprops"), shown);
});

test("an inline expression is code, not prose", () => {
  const tokens = kinds(`<div>{slider.valueText}</div>`);
  assert(tokens.includes(`expr:{slider.valueText}`), tokens.join(" "));
});

test("a bare brace value displays exactly as authored", () => {
  // No quotes added: the viewer formats whitespace, never spelling,
  // so `as={row}` displays `as={row}` and copy stays trivially exact.
  const shown = formatExampleHtml(
    `<template for={x.getItems()} as={row} key={row}></template>`,
  );
  assert(shown.includes(`as={row}`), shown);
});

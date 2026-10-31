/**
 * The spin syntax: source text in, IR or display text out.
 *
 * Everything here is pure — no signals, no DOM, no theme. The runtime
 * consumes the IR (codegen, bridges); tooling and the reference consume
 * the display side (format, highlight). One grammar, two readers, no
 * second parser anywhere.
 */
export { matchBrace, skipQuoted } from "./braces.ts";
export {
  type CodeToken,
  type CodeTokenType,
  formatExampleHtml,
  tokenizeHtml,
} from "./display.ts";
export { expandVariantGroups } from "./expand-groups.ts";
export { classAttrOf, classTokens, classTokensOf } from "./classes.ts";
export {
  extractScript,
  type ScriptCall,
  type ScriptConsume,
  type StrippedScript,
  stripScript,
} from "./script-block.ts";
export type {
  ActionUse,
  Attr,
  AttrValue,
  ComponentIr,
  Diagnostic,
  ElementNode,
  EventBinding,
  ForNode,
  Node,
  SpreadUse,
  TextNode,
} from "./ir.ts";
export { parse } from "./parse.ts";
export { ParseError } from "./ir.ts";

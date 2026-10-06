export { parse } from "./parse.ts";
export { emit, type EmitOutput } from "./emit.ts";
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
  TextNode,
} from "./ir.ts";
export { ParseError } from "./ir.ts";

import { emit } from "./emit.ts";
import { parse } from "./parse.ts";

export function compile(source: string): { js: string; bindings: number } {
  const ir = parse(source);
  return emit(ir);
}

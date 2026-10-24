export interface Span {
  readonly start: number;
  readonly end: number;
}

export interface Diagnostic {
  readonly code: string;
  readonly message: string;
  readonly span: Span;
}

export class ParseError extends Error {
  readonly diagnostics: readonly Diagnostic[];
  constructor(diagnostics: readonly Diagnostic[]) {
    super(diagnostics.map((d) => `${d.code}: ${d.message}`).join("\n"));
    this.diagnostics = diagnostics;
  }
}

export type AttrValue =
  | { readonly kind: "static"; readonly value: string }
  | { readonly kind: "expr"; readonly expr: string; readonly span: Span };

export interface Attr {
  readonly name: string;
  readonly value: AttrValue;
  readonly span: Span;
}

export interface EventBinding {
  readonly event: string;
  readonly handler: string;
  readonly span: Span;
}

export interface ActionUse {
  readonly name: string;
  readonly param: string | undefined;
  readonly span: Span;
}

export interface SpreadUse {
  readonly expr: string;
  readonly span: Span;
}

export interface ElementNode {
  readonly kind: "element";
  readonly tag: string;
  readonly attrs: readonly Attr[];
  readonly events: readonly EventBinding[];
  readonly actions: readonly ActionUse[];
  readonly spreads: readonly SpreadUse[];
  readonly children: readonly Node[];
  /** Conditional render: the `show={expr}` expression, evaluated per tick. */
  readonly show?: string;
  readonly span: Span;
}

export interface TextNode {
  readonly kind: "text";
  readonly parts:
    readonly ({ readonly kind: "static"; readonly value: string } | {
      readonly kind: "expr";
      readonly expr: string;
      readonly span: Span;
    })[];
  readonly span: Span;
}

export interface ForNode {
  readonly kind: "for";
  readonly source: string;
  readonly binding: string;
  readonly key: string | undefined;
  readonly body: readonly Node[];
  readonly span: Span;
}

export type Node = ElementNode | TextNode | ForNode;

export type ScopePropType =
  | "bool"
  | "string"
  | "string[]"
  | "int"
  | "object-array";

export interface ObjectField {
  readonly name: string;
  readonly type: "string" | "int" | "bool";
}

export interface PropDecl {
  readonly name: string;
  readonly type: ScopePropType;
  readonly default?: string;
  readonly fields?: readonly ObjectField[];
}

export interface ScopeBlock {
  readonly props: readonly PropDecl[];
  readonly consume: readonly string[];
}

export interface ComponentIr {
  readonly nodes: readonly Node[];
  readonly scope?: ScopeBlock;
}

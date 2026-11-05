/**
 * DTCG JSON -> `TokenTree`.
 *
 * Parsing is strict and total. Strict, because a design token is a build input:
 * a missing `$value`, an unknown `$type`, or a half-token object must fail the
 * build rather than emit a half-populated custom property. Total, because
 * `parseTokens` never throws — it returns `{ ok: false, error }` so a CLI can
 * print one clean message.
 */
import {
  type ParseResult,
  TOKEN_TYPES,
  type TokenGroup,
  type TokenLeaf,
  type TokenNode,
  type TokenTree,
  type TokenType,
} from "./types.ts";
import { expandExtends } from "../extends.ts";

const TYPE_SET: Record<TokenType, true> = Object.fromEntries(
  TOKEN_TYPES.map((type) => [type, true]),
) as Record<TokenType, true>;

/** True when `value` names a token type in the closed vocabulary. */
export function isTokenType(value: unknown): value is TokenType {
  return typeof value === "string" && Object.hasOwn(TYPE_SET, value);
}

/** Keys DTCG reserves; every other key at a level is a child token or group. */
const RESERVED: Record<string, true> = {
  $value: true,
  $type: true,
  $description: true,
  $extensions: true,
  $deprecated: true,
  // Per-mode values, keyed by mode name. Metadata, not a child group: a token
  // that varies by mode carries its variants beside its base value.
  $modes: true,
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** The non-reserved keys of a level: the names of its children. */
function childKeys(node: Record<string, unknown>): string[] {
  return Object.keys(node).filter((key) => !Object.hasOwn(RESERVED, key));
}

/** DTCG dotted path of a node, for error messages. */
function dotted(path: string[]): string {
  return path.join(".");
}
/**
 * The fields one composite `$type: "typography"` `$value` carries, and the
 * token type each expands to. A style entry states the tuple once; the parser
 * fans it out to the five leaves the rules spend, so the composite and the
 * five-child group normalize to the same leaves.
 */
const STYLE_FIELD_TYPES: Record<string, TokenType> = {
  family: "fontFamily",
  size: "dimension",
  weight: "fontWeight",
  tracking: "dimension",
  leading: "dimension",
};

/** The fields every composite typography tuple must carry, in order. */
const STYLE_FIELDS: readonly string[] = [
  "family",
  "size",
  "weight",
  "tracking",
  "leading",
];

/**
 * Expand one composite typography tuple to the style group the five-child
 * form states outright. Values pass through verbatim — aliases stay aliases —
 * so resolution downstream cannot tell which form authored them.
 */
function buildStyleTuple(
  raw: Record<string, unknown>,
  path: string[],
  description: string | undefined,
): Built {
  const here = dotted(path);
  const composite = raw["$value"] as Record<string, unknown>;
  const keys = Object.keys(composite);
  const complete = STYLE_FIELDS.every((field) =>
    Object.hasOwn(composite, field)
  ) && keys.every((key) => Object.hasOwn(STYLE_FIELD_TYPES, key));
  if (!complete) {
    return {
      ok: false,
      error:
        `token "${here}" declares $type "typography" with an object $value that must hold exactly family, size, weight, tracking and leading`,
    };
  }
  const group: TokenGroup = {
    kind: "group",
    name: path[path.length - 1] as string,
    path,
    children: [],
  };
  group.type = "typography";
  if (description !== undefined) group.description = description;
  // A composite tuple varies as one: a `$modes` beside it belongs to every
  // field, so each leaf carries it and the serializer keeps the group form.
  const modes = isPlainObject(raw["$modes"])
    ? raw["$modes"] as Record<string, unknown>
    : undefined;
  for (const field of STYLE_FIELDS) {
    const leaf: TokenLeaf = {
      kind: "token",
      name: field,
      path: [...path, field],
      type: STYLE_FIELD_TYPES[field] as TokenType,
      value: composite[field],
    };
    if (modes !== undefined) leaf.modes = modes;
    group.children.push(leaf);
  }
  return { ok: true, node: group, leaves: group.children.length };
}

type Built =
  | { ok: true; node: TokenNode; leaves: number }
  | { ok: false; error: string };

/**
 * Classify one object as a leaf (`$value`) or a group (children) and build it.
 *
 * `inherited` is the type contributed by the closest ancestor group that
 * declared one. It is the fallback for a token that declares no `$type` of its
 * own, and a group that does declare one replaces it for its whole subtree.
 */
function buildNode(
  raw: unknown,
  path: string[],
  inherited: TokenType | null,
): Built {
  if (!isPlainObject(raw)) {
    return {
      ok: false,
      error: `token "${dotted(path)}" must be an object`,
    };
  }

  const here = dotted(path);
  const hasValue = Object.hasOwn(raw, "$value");
  const names = childKeys(raw);

  if (hasValue && names.length > 0) {
    return {
      ok: false,
      error: `token "${here}" declares "$value" and also child tokens (${
        names.join(", ")
      })`,
    };
  }

  if (!hasValue && names.length === 0) {
    return { ok: false, error: `token "${here}" is missing "$value"` };
  }

  const declared = raw["$type"];
  if (declared !== undefined && !isTokenType(declared)) {
    return {
      ok: false,
      error: `token "${here}" has unknown $type ${
        JSON.stringify(declared)
      }; expected one of ${TOKEN_TYPES.join(", ")}`,
    };
  }

  const description = typeof raw["$description"] === "string"
    ? raw["$description"]
    : undefined;

  if (!hasValue) {
    const group: TokenGroup = {
      kind: "group",
      name: path[path.length - 1] as string,
      path,
      children: [],
    };
    if (declared !== undefined) group.type = declared;
    if (description !== undefined) group.description = description;

    // DTCG 2025.10 §6.7: the closest parent group holding a `$type` wins, and
    // it keeps applying to tokens nested further down.
    const below = declared ?? inherited;
    let leaves = 0;
    for (const name of names) {
      // `font.map` is a voice assignment table, not tokens: bare style names
      // the contract reads as references. The parser skips it the way it
      // skips document metadata — emitting it as tokens would mint
      // `--font-map-*` variables nothing spends and reject the bare names.
      if (here === "font" && name === "map") continue;
      const child = buildNode(raw[name] as unknown, [...path, name], below);
      if (!child.ok) return { ok: false, error: child.error };
      leaves += child.leaves;
      group.children.push(child.node);
    }
    return { ok: true, node: group, leaves };
  }

  // A composite tuple states the five fields in one `$value` object where the
  // group form states five child tokens. Both normalize to the same group,
  // so the leaf path a caller reads says nothing about the form authored.
  if (hasValue && declared === "typography" && isPlainObject(raw["$value"])) {
    return buildStyleTuple(raw, path, description);
  }

  const type = declared ?? inherited;
  if (type === null) {
    return {
      ok: false,
      error:
        `token "${here}" is missing "$type" and no parent group declares one`,
    };
  }

  const leaf: TokenLeaf = {
    kind: "token",
    name: path[path.length - 1] as string,
    path,
    type,
    value: raw["$value"],
  };
  if (description !== undefined) leaf.description = description;
  if (isPlainObject(raw["$modes"])) {
    leaf.modes = raw["$modes"] as Record<string, unknown>;
  }

  return { ok: true, node: leaf, leaves: 1 };
}

/**
 * Parse a DTCG document into a token forest.
 *
 * Accepts a JSON string or an already-decoded object. Returns `{ ok: false }`
 * for malformed JSON, a non-object root, a document with no token leaves, a
 * node that is neither a token nor a non-empty group, a node carrying both
 * `$value` and children, and any `$type` outside the closed vocabulary.
 *
 * A token that declares no `$type` inherits the `$type` of the closest
 * ancestor group that declares one (DTCG 2025.10 §6.7).
 */
export function parseTokens(input: string | unknown): ParseResult {
  let doc: unknown = input;

  if (typeof input === "string") {
    try {
      doc = JSON.parse(input);
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      return { ok: false, error: `invalid JSON: ${detail}` };
    }
  }

  if (!isPlainObject(doc)) {
    return {
      ok: false,
      error: `token document must be a JSON object, received ${
        Array.isArray(doc) ? "array" : typeof doc
      }`,
    };
  }

  // A sparse document layers over its starter before anything else reads it:
  // expansion is total, so every stage below sees the document it would
  // have read had the author vendored the starter. An unknown starter is a
  // parse failure, not a throw — the studio reports what is wrong.
  let document: Record<string, unknown> = doc;
  if (typeof document["$extends"] === "string") {
    try {
      document = expandExtends(document);
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  const names = childKeys(document).filter((key) => !DOCUMENT_KEYS[key]);
  if (names.length === 0) {
    return { ok: false, error: "token document contains no tokens" };
  }

  const tree: TokenTree = [];
  let leaves = 0;

  for (const name of names) {
    const built = buildNode(document[name] as unknown, [name], null);
    if (!built.ok) return { ok: false, error: built.error };
    leaves += built.leaves;
    tree.push(built.node);
  }

  if (leaves === 0) {
    return { ok: false, error: "token document contains no token leaves" };
  }

  return { ok: true, tree };
}

/** The modes a document declares, as authored. */
export type DocumentModes =
  | readonly ["light"]
  | readonly ["dark"]
  | readonly [
    "light",
    "dark",
  ];

/** A document's tokens and its extensions, both from one parse. */
export type DocumentResult =
  | {
    readonly ok: true;
    readonly tree: TokenTree;
    /** Whatever the document declared under `$extensions`. */
    readonly extensions: Record<string, unknown>;
    /**
     * The modes the document declares at its root. `undefined` means it
     * declares none — so `themeModes()` can tell "declares one mode" from
     * "declares nothing", which the `dark` group's presence alone could not.
     */
    readonly modes: DocumentModes | undefined;
  }
  | { readonly ok: false; readonly error: string };

/**
 * Parse a document into everything a caller needs from it: the token tree and
 * the extensions beside it.
 *
 * `parseTokens` deliberately returns only tokens — extensions are not tokens,
 * and a pipeline that carried them would blur its own contract. The cost was
 * that a caller needing a font declaration had to keep the raw JSON alive and
 * re-read `$extensions` by hand. This is the one place that is not optional.
 */
/** The root document keys that are metadata, not tokens. */
const DOCUMENT_KEYS: Record<string, true> = { modes: true, $extends: true };

export function parseDocument(input: string | unknown): DocumentResult {
  const parsed = parseTokens(input);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  const doc = typeof input === "string" ? safeParse(input) : input;
  const extensions = isPlainObject(doc)
    ? (doc as Record<string, unknown>)["$extensions"]
    : undefined;
  return {
    ok: true,
    tree: parsed.tree,
    modes: readModes(doc),
    extensions: isPlainObject(extensions)
      ? extensions as Record<string, unknown>
      : {},
  };
}

/**
 * The modes a document declares at its root, when they are well-formed.
 *
 * `modes` is document metadata, not a token: no emitter reads it, and the
 * tree never carries it. Malformed metadata fails the document rather than
 * sailing through — a studio that thinks its theme has two modes when the
 * document states something else renders toggles for nothing.
 */
function readModes(doc: unknown): DocumentModes | undefined {
  if (!isPlainObject(doc)) return undefined;
  const raw = (doc as Record<string, unknown>)["modes"];
  if (raw === undefined) return undefined;
  if (
    Array.isArray(raw) && raw.length > 0 &&
    raw.every((entry) => entry === "light" || entry === "dark")
  ) {
    return (raw as unknown) as DocumentModes;
  }
  return undefined;
}

/** Whether `parseDocument` would keep a root `modes` value. */
export function isValidModes(value: unknown): value is DocumentModes {
  return readModes({ modes: value }) !== undefined;
}

/** Decode without re-throwing; `parseTokens` has already reported the failure. */
function safeParse(input: string): unknown {
  try {
    return JSON.parse(input);
  } catch {
    return undefined;
  }
}

/**
 * Shared vocabulary for @spin/theme.
 *
 * The token vocabulary is CLOSED: a design token is one of `TOKEN_TYPES` and
 * nothing else. An unknown `$type` is a parse error, never a silent passthrough,
 * so a typo in an author file can never reach CSS.
 *
 * A `TokenTree` is a forest of `TokenNode` in document order. Leaves carry a
 * value; groups carry children. `path` is the DTCG identity of a node — the
 * full dotted path from the document root — and is the only thing that names a
 * token across parse -> resolve -> validate -> generate.
 */

/** Every `$type` a Spin token may declare. */
export const TOKEN_TYPES = [
  "color",
  "boolean",
  "dimension",
  "fontFamily",
  "fontWeight",
  "duration",
  "cubicBezier",
  "number",
  "strokeStyle",
  "border",
  "transition",
  "shadow",
  "gradient",
  "typography",
  // DTCG has no `text-transform` type, but uppercase/lowercase is exactly the
  // kind of decision a theme must own: it is most of what separates a
  // brutalist button from a terminal one. Added deliberately, with a closed
  // keyword set validated in `validate.ts`.
  "textTransform",
] as const;

/** Closed set of design-token types. */
export type TokenType = (typeof TOKEN_TYPES)[number];

/** A namespace of tokens. */
export interface TokenGroup {
  kind: "group";
  /** Final path segment — `color` for the group at `['color']`. */
  name: string;
  /** Full dotted path from the document root. */
  path: string[];
  /**
   * The group's own `$type`, when it declared one. Acts as the default type
   * for tokens below it that do not declare their own (DTCG 2025.10 §6.7: the
   * CLOSEST parent group with a `$type` wins). A group without a `$type`
   * passes the type it inherited downward, unchanged.
   */
  type?: TokenType;
  description?: string;
  children: TokenNode[];
}

/** A single design token. The unit of CSS emission. */
export interface TokenLeaf {
  kind: "token";
  name: string;
  /** Full dotted path from the document root — `['color', 'brand']`. */
  path: string[];
  /** Declared `$type`. Always a member of `TOKEN_TYPES`. */
  type: TokenType;
  /** `$value`. Aliases are kept as written: `'{color.primary}'`. */
  value: unknown;
  /**
   * Per-mode values, keyed by mode name — `{ dark: "#60a5fa" }`.
   *
   * A token that varies by mode carries its variants beside its base value
   * rather than in a second `dark` tree, because a reader of the token should
   * see every value it has in one place. Mode-eligibility is validated, not
   * implied: only the closed set of groups that may vary carries `$modes`.
   */
  modes?: Record<string, unknown>;
  description?: string;
}

export type TokenNode = TokenGroup | TokenLeaf;

/** A parsed token document: its top-level groups and tokens. */
export type TokenTree = TokenNode[];

/** Parse is total — failure is returned as data, never thrown. */
export type ParseResult =
  | { ok: true; tree: TokenTree }
  | { ok: false; error: string };

/** Aliases inlined, plus what could not be. See `resolve.ts`. */
export interface ResolvedTokenTree {
  /** A deep copy of the input with every resolvable alias replaced. */
  tree: TokenTree;
  /** Each alias cycle, as the DTCG paths that form it. */
  cycles: string[][];
  /** Paths whose alias points at a token that does not exist. */
  unresolved: string[];
}

/** One thing wrong with a tree. */
export interface ValidationIssue {
  /** DTCG dotted path — `''` for the document as a whole. */
  path: string;
  message: string;
}

/** Result of `validateTokens`. */
export interface ValidationReport {
  /** True when there are no issues at all. */
  valid: boolean;
  issues: ValidationIssue[];
}

/** Options for `validateTokens`. */
export interface ValidateOptions {
  /**
   * DTCG dotted paths that must exist, e.g. `['color', 'color.brand']`.
   *
   * An entry is satisfied when a GROUP or a TOKEN exists at exactly that path,
   * so both `color` and `color.brand` are meaningful requests. Matching is on
   * the full path, never on a bare leaf name: `color.brand` is missing when the
   * document only has `surface.brand`.
   */
  required?: readonly string[];
  /**
   * The modes the document serves, as its root `modes` field declares them.
   *
   * A mode the theme serves but does not override falls back to the base
   * values, so serving a mode costs nothing and promises no restatement. The
   * check that follows from the claim is the other direction: a value
   * written for a mode the theme does not serve is never shown.
   */
  modes?: readonly ("light" | "dark")[];
}

/** Options for CSS emission. */
export interface CssOptions {
  /** Selector the base block is written under. Defaults to `:root`. */
  selector?: string;
  /** Prepended to every custom property name: prefix `p` -> `--p-color-brand`. */
  prefix?: string;
  /** One indent level. Defaults to two spaces. */
  indent?: string;
  /**
   * A theme whose variables are also written under `:root`.
   *
   * A custom property cannot inherit upward, so variables scoped only to
   * `[data-theme]` are invisible to the `body {}` rules the typography
   * primitives emit — which leaves an app's base type falling back to the
   * browser default, and a studio whose chrome renders in Times. Naming a
   * root theme fixes the base without giving every theme a `:root` block
   * that would collide on shared names.
   */
  rootTheme?: string;
}

/**
 * A theme document, as authored.
 *
 * `Record<string, unknown>` rather than `unknown` because it rejects the one
 * mistake a caller can actually make: passing a parsed token tree, which is an
 * array. That compiles cleanly under `unknown` and fails inside a consumer's
 * bundler, which is the worst place to find out. The structural type accepts
 * anything `JSON.parse` produces, so a theme file costs no cast.
 *
 * It lives in the theme package rather than the preset because this is the
 * package that defines what a theme is — a preset that re-declared it would be
 * a second, unrelated definition of the same thing.
 */
export type ThemeDocument = Record<string, unknown>;

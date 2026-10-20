/**
 * The prop grammar's coercion, owned by the runtime.
 *
 * One implementation serves every boundary: the syntax package calls in at
 * build time to turn a declared prop's text into a value, and the element
 * bridge builds its attribute parsers here. No other module parses a prop's
 * text form — the scalar and object-array branches below are the only ones.
 *
 * The module is deliberately pure (no signals, no DOM) so the syntax package
 * can depend on it without pulling the rest of the runtime.
 */

/** The scope prop types this grammar coerces. */
export type PropCoerceType =
  | "bool"
  | "string"
  | "int"
  | "string[]"
  | "object-array";

/** A field of an object-array prop. */
export interface CoerceObjectField {
  readonly name: string;
  readonly type: "string" | "int" | "bool";
}

/** A declared prop, as the parser hands it to the grammar. */
export interface CoercePropDecl {
  readonly name: string;
  readonly type: PropCoerceType;
  readonly default?: string;
  readonly fields?: readonly CoerceObjectField[];
}

/**
 * bool: presence (`""`, `"true"`, absent) is true, `"false"` is false,
 * anything else is the fallback.
 */
/**
 * The initial-value twin of a prop: `value` -> `defaultValue`.
 *
 * The convention is the framework's: a host that writes `value` owns the
 * value, and a host that writes only `defaultValue` seeds it. Resolving
 * the twin before the machine's factory is called means the machine's
 * arguments are the live values, and the machine never sees the twin.
 */
export function defaultTwin(prop: string): string {
  return `default${prop.charAt(0).toUpperCase()}${prop.slice(1)}`;
}

/**
 * Resolve the twins in a prop bag: for each `defaultX`, the prop `X`
 * falls back to it.
 *
 * The fallback applies only when the host did not write `X`: a host
 * that writes the live prop owns the value, and a host that writes only
 * the twin seeds it. The bag is read live, so the resolution is a copy
 * — the host's own bag is never mutated.
 */
export function resolveTwins(
  props: Record<string, unknown>,
  authored?: (name: string) => boolean,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...props };
  for (const key of Object.keys(props)) {
    if (!key.startsWith("default")) continue;
    const twin = key.charAt(7).toLowerCase() + key.slice(8);
    if (authored !== undefined) {
      // The host wrote the live prop: it owns the value, and the twin is
      // only a fallback. The host did not: the twin seeds it — but only
      // when the host WROTE the twin. The element's DECLARED default is
      // the element's business, and must not reach the machine: the
      // machine's own default stands.
      if (!authored(key)) continue;
      if (authored(twin)) continue;
      out[twin] = props[key];
      continue;
    }
    if (out[twin] === undefined || out[twin] === null) out[twin] = props[key];
  }
  return out;
}

/**
 * Whether a value is a plain record: an object, not null, not an array.
 * The components' props arrive as records; the framework's grammar
 * speaks in records, so the test belongs here.
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function coerceBool(
  raw: string | null | undefined,
  fallback: boolean | undefined,
): boolean | undefined {
  if (raw === null || raw === undefined || raw === "" || raw === "true") {
    return true;
  }
  if (raw === "false") return false;
  return fallback;
}

/** string: absent is empty. */
export function coerceString(raw: string | null | undefined): string {
  return raw ?? "";
}

/** int: absent or malformed is the fallback, never NaN. */
export function coerceInt(
  raw: string | null | undefined,
  fallback: number | undefined,
): number | undefined {
  if (raw === null || raw === undefined) return fallback;
  const n = parseInt(raw, 10);
  return Number.isNaN(n) ? fallback : n;
}

/**
 * string[] from scope text: a bare comma list, or a bracketed one (`[a, b]`).
 * The grammar reserves top-level commas for prop separation, so the brackets
 * are optional.
 */
export function coerceList(raw: string | null | undefined): string[] {
  if (raw === null || raw === undefined || raw === "") return [];
  const trimmed = raw.trim();
  const inner = trimmed.startsWith("[") && trimmed.endsWith("]")
    ? trimmed.slice(1, -1)
    : trimmed;
  return inner.split(",").map((part) => part.trim()).filter((part) =>
    part.length > 0
  );
}

/** A JSON-encoded array; malformed or non-array is the fallback. */
export function coerceJsonArray(
  raw: string | null | undefined,
  fallback: unknown[],
): unknown[] {
  if (raw === null || raw === undefined || raw === "") return fallback;
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Object-array items: plain objects survive, the rest drop; declared `int`
 * fields coerce, malformed becoming `undefined`.
 */
export function coerceObjectArrayItems(
  value: unknown,
  fallback: unknown[],
  fields?: readonly CoerceObjectField[],
): Record<string, unknown>[] {
  if (!Array.isArray(value)) return fallback as Record<string, unknown>[];
  const out: Record<string, unknown>[] = [];
  for (const item of value) {
    if (item === null || typeof item !== "object" || Array.isArray(item)) {
      continue;
    }
    const obj: Record<string, unknown> = {
      ...(item as Record<string, unknown>),
    };
    if (fields) {
      for (const field of fields) {
        if (field.type === "int") {
          const v = obj[field.name];
          const n = typeof v === "number" ? v : parseInt(String(v), 10);
          obj[field.name] = Number.isNaN(n) ? undefined : n;
        }
      }
    }
    out.push(obj);
  }
  return out;
}

/** Coerce one raw prop text by its declared type. */
export function coerceByType(
  type: PropCoerceType,
  raw: string,
  def?: unknown,
  fields?: readonly CoerceObjectField[],
): unknown {
  switch (type) {
    case "bool":
      return coerceBool(raw, def as boolean | undefined);
    case "int":
      return coerceInt(raw, def as number | undefined);
    case "string[]":
      return coerceList(raw);
    case "string":
      return coerceString(raw);
    case "object-array": {
      const fallback = (def as unknown[] | undefined) ?? [];
      return coerceObjectArrayItems(
        coerceJsonArray(raw, fallback),
        fallback,
        fields,
      );
    }
  }
}

/** Coerce one declared prop, honouring an already-parsed (property-write) value. */
export function coerceValue(
  decl: CoercePropDecl,
  raw: string | null | undefined | object,
): unknown {
  const def = decl.default !== undefined
    ? coerceByType(decl.type, decl.default, undefined, decl.fields)
    : undefined;
  if (raw === undefined || raw === null) return def;
  if (decl.type === "object-array" && typeof raw !== "string") {
    return coerceObjectArrayItems(
      raw,
      (def as unknown[] | undefined) ?? [],
      decl.fields,
    );
  }
  return coerceByType(decl.type, raw as string, def, decl.fields);
}

/** Coerce every declared prop, keyed by both its camelCase and dashed name. */
export function coerceProps(
  decls: readonly CoercePropDecl[],
  attrs: Record<string, string | null | undefined | object>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const decl of decls) {
    const dashed = decl.name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
    const raw = attrs[dashed] ?? attrs[decl.name];
    const value = coerceValue(decl, raw);
    if (value !== undefined) {
      out[decl.name] = value;
      out[dashed] = value;
    }
  }
  return out;
}

/** True when `raw` is valid JSON — the object-array default gate. */
export function isValidJsonDefault(raw: string): boolean {
  try {
    JSON.parse(raw);
    return true;
  } catch {
    return false;
  }
}

/** The script scope: a `<script>` block the compiler reads for its props
 * and its consumed machines.
 *
 * The block is TypeScript, and the compiler keeps only the sanctioned
 * calls — `props({...})` and `consume(name)`. Everything else in the
 * block is an error: a script that could hold an effect is a script that
 * could hold a side effect, and the markup has none. That is the whole
 * point of the shape: the types are real TypeScript, and the compiler
 * decides what of it runs.
 *
 *   <script>
 *     props({ items: Item[] = [], disabled: boolean = false });
 *     consume(slider);
 *   </script>
 */

import type { Diagnostic, PropDecl, ScopeBlock } from "./ir.ts";

/** A prop's declared type, as TypeScript source. */
export interface ScriptProp {
  readonly name: string;
  /** The type as written: `Item[]`, `boolean`, `{ value: string }`. */
  readonly type: string;
  /** The default as written: `[]`, `false`, `"auto"`. */
  readonly default?: string;
}

export interface ScriptScope {
  readonly props: readonly ScriptProp[];
  readonly consume: readonly string[];
  readonly diagnostics: readonly Diagnostic[];
}

const PROP_TYPE = /^[A-Za-z_$][\w$]*(?:<[^<>]*>)?(?:\[\])?$/;
const OBJECT_TYPE = /^\{[\s\S]*\}$/;

/** The props of one `props({...})` call. */
function propsOf(body: string, at: number, out: ScriptProp[]): void {
  const open = body.indexOf("{", at);
  if (open < 0) return;
  let depth = 0;
  let close = -1;
  for (let i = open; i < body.length; i++) {
    const ch = body[i];
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        close = i;
        break;
      }
    }
  }
  if (close < 0) return;
  const inner = body.slice(open + 1, close);
  // The entries are separated by commas at the top level of the object.
  let depth2 = 0;
  let start = 0;
  const entries: string[] = [];
  for (let i = 0; i <= inner.length; i++) {
    const ch = inner[i];
    if (ch === "{" || ch === "[" || ch === "(") depth2++;
    else if (ch === "}" || ch === "]" || ch === ")") depth2--;
    else if ((ch === "," && depth2 === 0) || i === inner.length) {
      const entry = inner.slice(start, i).trim();
      if (entry.length > 0) entries.push(entry);
      start = i + 1;
    }
  }
  for (const entry of entries) {
    // `name: Type = default` — the type may carry a default of its own.
    const colon = entry.indexOf(":");
    if (colon < 0) continue;
    const name = entry.slice(0, colon).trim();
    const rest = entry.slice(colon + 1).trim();
    let type = rest;
    let value: string | undefined;
    const eq = rest.indexOf("=");
    if (eq >= 0) {
      type = rest.slice(0, eq).trim();
      value = rest.slice(eq + 1).trim();
    }
    if (!PROP_TYPE.test(type) && !OBJECT_TYPE.test(type)) continue;
    out.push(value === undefined ? { name, type } : { name, type, default: value });
  }
}

/** The script's scope: its props and its consumed machines. */
export function parseScript(source: string): ScriptScope {
  const props: ScriptProp[] = [];
  const consume: string[] = [];
  const diagnostics: Diagnostic[] = [];

  const open = source.indexOf("<script");
  if (open < 0) return { props, consume, diagnostics };
  const bodyStart = source.indexOf(">", open);
  if (bodyStart < 0) return { props, consume, diagnostics };
  const close = source.indexOf("</script>", bodyStart);
  const body = source.slice(bodyStart + 1, close < 0 ? source.length : close);

  // The sanctioned calls, and everything else.
  const CALL = /\b(props|consume)\s*\(/g;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = CALL.exec(body)) !== null) {
    const between = body.slice(last, match.index);
    if (between.replace(/[\s;]/g, "").length > 0) {
      diagnostics.push({
        code: "script-effect",
        message: "a script may only call props() and consume()",
        span: { start: bodyStart + 1 + last, end: bodyStart + 1 + match.index },
      });
    }
    const name = match[1] ?? "";
    const argsAt = match.index + match[0].length;
    if (name === "props") {
      propsOf(body, argsAt, props);
    } else {
      const closeParen = body.indexOf(")", argsAt);
      const arg = body.slice(argsAt, closeParen < 0 ? body.length : closeParen).trim();
      if (/^[A-Za-z_$][\w$]*$/.test(arg)) consume.push(arg);
    }
    // The call's end: what follows it is what the next call must not
    // interrupt.
    const closeParen = body.indexOf(")", match.index);
    last = closeParen < 0 ? match.index + match[0].length : closeParen + 1;
    CALL.lastIndex = last;
  }
  const tail = body.slice(last);
  if (tail.replace(/[\s;]/g, "").length > 0) {
    diagnostics.push({
      code: "script-effect",
      message: "a script may only call props() and consume()",
      span: { start: bodyStart + 1 + last, end: bodyStart + 1 + body.length },
    });
  }

  return { props, consume, diagnostics };
}

/** The script's scope, as the IR's block: the props' types are
 * TypeScript, so they are carried as text. */
export function scriptScope(source: string): { scope?: ScopeBlock; diagnostics: readonly Diagnostic[] } {
  const script = parseScript(source);
  const decls: PropDecl[] = script.props.map((prop) => ({
    name: prop.name,
    type: "string" as PropDecl["type"],
    ...(prop.default === undefined ? {} : { default: prop.default }),
  }));
  if (decls.length === 0 && script.consume.length === 0) {
    return { diagnostics: script.diagnostics };
  }
  return {
    scope: { props: decls, consume: script.consume },
    diagnostics: script.diagnostics,
  };
}

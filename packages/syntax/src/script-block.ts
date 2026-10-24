/** The script block: real TypeScript the checker sees.
 *
 * The script is a module the checker checks — not text the compiler
 * parses for types. The compiler's job is the allowlist: only type and
 * interface declarations, imports, and machine-factory calls survive.
 * Everything else is stripped before the check, and a stripped script
 * that leaves nothing meaningful behind is an empty component, not an
 * error somewhere else.
 *
 *   <script lang="ts">
 *     import { slider } from "../slider.machine.ts";
 *     const ctl = slider({ value: [50] });
 *   </script>
 *
 * The call's semantics are the factory's semantics: called here, fresh
 * instance, caller owns lifecycle. The template references the binding
 * (`ctl.getRootProps()`); the compiler wires it.
 */

import { skipQuoted } from "./braces.ts";

export interface ScriptCall {
  readonly name: string;
  readonly factory: string;
  readonly args: string;
}

export interface StrippedScript {
  /** The module text the checker sees. */
  readonly module: string;
  /** The binding names the template may reference. */
  readonly bindings: readonly string[];
  /** The parsed machine-factory calls, including multi-line args. */
  readonly calls: readonly ScriptCall[];
  /** What was stripped, for diagnostics. */
  readonly stripped: readonly string[];
}

const IMPORT_START = /^import(?:\s|\{|\*)/;
const TYPE_START = /^(?:export\s+)?(?:type|interface)\b/;
const MACHINE_CALL_START =
  /^(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*=\s*([A-Za-z_$][\w$]*)\s*\(/;

/** Find the matching `)` for the `(` at `openParen`, skipping strings and comments. */
function matchParen(source: string, openParen: number): number {
  const end = source.length;
  let depth = 0;
  let i = openParen;
  while (i < end) {
    const c = source[i]!;
    if (c === '"' || c === "'" || c === "`") {
      i = skipQuoted(source, i, end);
      continue;
    }
    if (c === "/" && source[i + 1] === "/") {
      const nl = source.indexOf("\n", i + 2);
      i = nl < 0 ? end : nl + 1;
      continue;
    }
    if (c === "/" && source[i + 1] === "*") {
      const close = source.indexOf("*/", i + 2);
      i = close < 0 ? end : close + 2;
      continue;
    }
    if (c === "(") depth += 1;
    else if (c === ")") {
      depth -= 1;
      if (depth === 0) return i;
    }
    i += 1;
  }
  return -1;
}

/** Scan a balanced top-level statement (`import`, `type`, `interface`) to its line end. */
function scanStatementEnd(source: string, start: number): number {
  const end = source.length;
  let depth = 0;
  let i = start;
  while (i < end) {
    const c = source[i]!;
    if (c === '"' || c === "'" || c === "`") {
      i = skipQuoted(source, i, end);
      continue;
    }
    if (c === "/" && source[i + 1] === "/") {
      const nl = source.indexOf("\n", i + 2);
      if (depth === 0) return nl < 0 ? end : nl;
      i = nl < 0 ? end : nl + 1;
      continue;
    }
    if (c === "/" && source[i + 1] === "*") {
      const close = source.indexOf("*/", i + 2);
      i = close < 0 ? end : close + 2;
      continue;
    }
    if (c === "{" || c === "(" || c === "[") depth += 1;
    else if (c === "}" || c === ")" || c === "]") {
      depth = Math.max(0, depth - 1);
    } else if (c === "\n" && depth === 0) {
      // Multi-line union/intersection types (`| Foo` on the next line) continue.
      const rest = source.slice(i + 1).trimStart();
      if (rest.startsWith("|") || rest.startsWith("&")) {
        i += 1;
        continue;
      }
      return i;
    }
    i += 1;
  }
  return end;
}

/** Strip a script body to what the checker sees. */
export function stripScript(body: string): StrippedScript {
  const kept: string[] = [];
  const bindings: string[] = [];
  const calls: ScriptCall[] = [];
  const stripped: string[] = [];
  const len = body.length;
  let pos = 0;

  while (pos < len) {
    const lineStart = pos;
    while (
      pos < len &&
      (body[pos] === " " || body[pos] === "\t" || body[pos] === "\r")
    ) pos += 1;
    if (pos >= len) {
      kept.push(body.slice(lineStart));
      break;
    }
    if (body[pos] === "\n") {
      kept.push(body.slice(lineStart, pos));
      pos += 1;
      continue;
    }
    const rest = body.slice(pos);
    if (rest.startsWith("//")) {
      const nl = body.indexOf("\n", pos);
      const end = nl < 0 ? len : nl;
      kept.push(body.slice(lineStart, end));
      pos = nl < 0 ? len : nl + 1;
      continue;
    }
    if (rest.startsWith("/*")) {
      const close = body.indexOf("*/", pos + 2);
      const after = close < 0 ? len : close + 2;
      const nl = body.indexOf("\n", after);
      const end = nl < 0 ? len : nl;
      kept.push(body.slice(lineStart, end));
      pos = nl < 0 ? len : nl + 1;
      continue;
    }
    if (IMPORT_START.test(rest) || TYPE_START.test(rest)) {
      const stmtEnd = scanStatementEnd(body, pos);
      kept.push(body.slice(lineStart, stmtEnd));
      pos = stmtEnd < len && body[stmtEnd] === "\n" ? stmtEnd + 1 : stmtEnd;
      continue;
    }
    const callMatch = MACHINE_CALL_START.exec(rest);
    if (callMatch !== null) {
      const name = callMatch[1] ?? "";
      const factory = callMatch[2] ?? "";
      const openParen = pos + callMatch[0].length - 1;
      const closeParen = matchParen(body, openParen);
      if (closeParen >= 0) {
        const nl = body.indexOf("\n", closeParen);
        const lineEnd = nl < 0 ? len : nl;
        const tail = body.slice(closeParen + 1, lineEnd).trim();
        if (tail === "" || tail === ";" || tail.startsWith("//")) {
          kept.push(body.slice(lineStart, lineEnd));
          bindings.push(name);
          calls.push({
            name,
            factory,
            args: body.slice(openParen + 1, closeParen).trim(),
          });
          pos = nl < 0 ? len : nl + 1;
          continue;
        }
      }
    }
    const nl = body.indexOf("\n", pos);
    const lineEnd = nl < 0 ? len : nl;
    stripped.push(body.slice(lineStart, lineEnd));
    pos = nl < 0 ? len : nl + 1;
  }

  return { module: kept.join("\n"), bindings, calls, stripped };
}

/** Extract the script block from markup source, if it has one. */
export function extractScript(source: string): string | undefined {
  const open = /<script(\s[^>]*)?>/.exec(source);
  if (open === null || open.index === undefined) return undefined;
  const bodyStart = open.index + open[0].length;
  const close = source.indexOf("</script>", bodyStart);
  if (close < 0) return undefined;
  return source.slice(bodyStart, close);
}

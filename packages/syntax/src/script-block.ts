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

export interface StrippedScript {
  /** The module text the checker sees. */
  readonly module: string;
  /** The binding names the template may reference. */
  readonly bindings: readonly string[];
  /** What was stripped, for diagnostics. */
  readonly stripped: readonly string[];
}

const IMPORT = /^\s*import\s[^;]+;?\s*$/;
const TYPE_DECL = /^\s*(export\s+)?(type|interface)\b/;
const MACHINE_CALL = /^\s*(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*=\s*([A-Za-z_$][\w$]*)\s*\(/;
const COMMENT = /^\s*(\/\/|\/\*|\*)/;

/** Strip a script body to what the checker sees. */
export function stripScript(body: string): StrippedScript {
  const kept: string[] = [];
  const bindings: string[] = [];
  const stripped: string[] = [];
  for (const line of body.split("\n")) {
    const text = line.trim();
    if (text.length === 0 || COMMENT.test(line)) {
      kept.push(line);
      continue;
    }
    if (IMPORT.test(line) || TYPE_DECL.test(line)) {
      kept.push(line);
      continue;
    }
    const call = MACHINE_CALL.exec(line);
    if (call !== null) {
      kept.push(line);
      bindings.push(call[1] ?? "");
      continue;
    }
    stripped.push(line);
  }
  return { module: kept.join("\n"), bindings, stripped };
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

/**
 * The facts codemod: a component declares its public state, and the parts
 * carry the facts they name.
 *
 * A fact is lifted only when EVERY part that writes it writes the SAME
 * expression, and that expression reads only the scope. A part's own
 * expression (a slot's value, a computed local) stays in the part: the
 * fact would be a different fact there.
 *
 *   deno run -A scripts/facts-codemod.ts            # the corpus
 *   deno run -A scripts/facts-codemod.ts --check    # what it would do
 */

import { globSync, readFileSync, writeFileSync } from "node:fs";

interface Site {
  name: string;
  expr: string;
  /** The site's line: from the line's start to the line after the
   * expression's comma. */
  from: number;
  to: number;
  part: string;
  /** The attribute is the line's only content: the line can go, and the
   * part's spread can take its place. */
  alone: boolean;
}

/** The matching close brace for the one at `open`. */
function matchBrace(src: string, open: number): number {
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    const ch = src[i];
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** The end of the expression that starts at `from`: the first comma at
 * depth zero. */
function exprEnd(src: string, from: number): number {
  let depth = 0;
  for (let i = from; i < src.length; i++) {
    const ch = src[i];
    if (ch === "(" || ch === "[" || ch === "{") depth++;
    else if (ch === ")" || ch === "]" || ch === "}") depth--;
    else if (ch === "," && depth === 0) return i;
  }
  return -1;
}

/** The identifiers an expression names, minus the ones that are not
 * variables. A property is not a variable: `scope.props` names `scope`. */
function identifiers(expr: string): string[] {
  const stripped = expr
    .replace(/"[^"]*"/g, '""')
    .replace(/'[^']*'/g, "''")
    .replace(/`[^`]*`/g, "``")
    .replace(/\.\s*[A-Za-z_$][\w$]*/g, ".");
  return [...stripped.matchAll(/[A-Za-z_$][\w$]*/g)].map((m) => m[0]);
}

const LITERALS = new Set([
  "true",
  "false",
  "null",
  "undefined",
  "scope",
  "dataAttr",
  "attr",
  "Boolean",
  "String",
  "Number",
]);

/** The expression reads only the scope: a fact may be lifted then. The
 * component's own helpers count — they take the scope, and the scope's
 * reads are recorded through them. A fact that reads the slot is the
 * SLOT's fact, and stays in the slot. */
function scopeOnly(expr: string, helpers: Set<string>): boolean {
  if (expr.includes("scope.slot")) return false;
  return identifiers(expr).every((id) => LITERALS.has(id) || helpers.has(id));
}

/** The names the file declares at its top level: the component's own
 * helpers. */
function helpersOf(src: string): Set<string> {
  const names = new Set<string>();
  for (const m of src.matchAll(/^(?:export )?(?:const|function|async function) (\w+)/gm)) {
    if (m[1] !== undefined) names.add(m[1]);
  }
  return names;
}

/** The expression without its boolean wrapper: `scope.attr(x)` and
 * `dataAttr(x)` are `x`. A conditional that yields an empty attribute is
 * the boolean itself — the runtime turns `true` into an empty attribute
 * and `false` into no attribute. */
function unwrap(expr: string): string {
  const e = expr.trim();
  for (const wrapper of ["scope.attr(", "dataAttr("]) {
    if (!e.startsWith(wrapper) || !e.endsWith(")")) continue;
    const inner = e.slice(wrapper.length, -1);
    let depth = 0;
    let balanced = true;
    for (const ch of inner) {
      if (ch === "(") depth++;
      else if (ch === ")") {
        depth--;
        if (depth < 0) balanced = false;
      }
    }
    if (balanced && depth === 0) return inner.trim();
  }
  const conditional = /^(.*?)\s*\?\s*""\s*:\s*undefined$/.exec(e);
  if (conditional !== null && /===|!==|>=|<=|>|</.test(conditional[1] ?? "")) {
    return (conditional[1] ?? "").trim();
  }
  return e;
}

/** The attribute sites in a def file. */
function sitesOf(src: string): Site[] {
  const sites: Site[] = [];
  const sectionRe = /^ {2}(parts|slots): \{$/gm;
  let section: RegExpExecArray | null;
  while ((section = sectionRe.exec(src)) !== null) {
    const open = src.indexOf("{", section.index);
    const close = matchBrace(src, open);
    if (close < 0) continue;
    const body = src.slice(open, close);
    const keyRe = /^ {4}(\w+): \{$/gm;
    let key: RegExpExecArray | null;
    while ((key = keyRe.exec(body)) !== null) {
      const part = key[1] ?? "";
      const partOpen = body.indexOf("{", key.index);
      const partClose = matchBrace(body, partOpen);
      if (partClose < 0) continue;
      const partBody = body.slice(partOpen, partClose);
      const attrsAt = partBody.search(/attrs:\s*\(/);
      if (attrsAt < 0) continue;
      const attrsOpen = partBody.indexOf("(", attrsAt);
      const attrsClose = matchBrace(partBody, attrsOpen);
      if (attrsClose < 0) continue;
      // the attrs body, in the file's own coordinates
      const attrsStart = open + partOpen + attrsOpen;
      const attrsBody = partBody.slice(attrsOpen, attrsClose);
      let at = 0;
      while (at < attrsBody.length) {
        const lineEnd = attrsBody.indexOf("\n", at);
        const stop = lineEnd < 0 ? attrsBody.length : lineEnd;
        const line = attrsBody.slice(at, stop);
        const lineStart = attrsStart + at;
        const lineTo = lineEnd < 0 ? src.length : attrsStart + lineEnd + 1;
        // a conditional spread: `...(cond ? { "data-x": value } : {})`
        const conditional = /^\s*\.\.\.\((.+?)\? \{ "data-([a-z-]+)": (.+?) \} : \{\}\),?$/.exec(line);
        if (conditional) {
          sites.push({
            name: `data-${conditional[2] ?? ""}`,
            expr: `${(conditional[1] ?? "").trim()} ? ${(conditional[3] ?? "").trim()} : undefined`,
            from: lineStart,
            to: lineTo,
            part,
            alone: true,
          });
          at = stop + 1;
          continue;
        }
        // a plain attribute: the expression may span lines
        const plain = /^(\s*)"(data-[a-z-]+)":\s*/.exec(line);
        if (plain) {
          const exprStart = at + plain[0].length;
          const comma = exprEnd(attrsBody, exprStart);
          if (comma >= 0) {
            const expr = attrsBody.slice(exprStart, comma).trim();
            const commaLine = attrsBody.lastIndexOf("\n", comma);
            const commaLineEnd = attrsBody.indexOf("\n", comma);
            const after = attrsBody.slice(comma, commaLineEnd < 0 ? attrsBody.length : commaLineEnd);
            sites.push({
              name: plain[2] ?? "",
              expr,
              from: lineStart,
              to: commaLineEnd < 0 ? src.length : attrsStart + commaLineEnd + 1,
              part,
              // the indentation is whitespace by construction, so the
              // attribute is alone on its line when nothing follows it
              alone: after.replace(/,/, "").trim().length === 0,
            });
            at = commaLineEnd < 0 ? attrsBody.length : commaLineEnd + 1;
            continue;
          }
        }
        at = stop + 1;
      }
    }
  }
  return sites;
}

/** The fact name an attribute carries: `data-disabled` is `disabled`. */
const factName = (attribute: string): string => attribute.slice("data-".length);

interface Plan {
  liftable: Map<string, string>;
  byPart: Map<string, string[]>;
}

/** What the file would become. */
function plan(src: string): Plan {
  const helpers = helpersOf(src);
  const sites = sitesOf(src).filter((s) => s.name !== "data-scope" && s.name !== "data-part");
  const byName = new Map<string, Site[]>();
  for (const site of sites) {
    const list = byName.get(site.name) ?? [];
    list.push(site);
    byName.set(site.name, list);
  }
  const liftable = new Map<string, string>();
  for (const [name, list] of byName) {
    const exprs = new Set(list.map((s) => s.expr.replace(/\s+/g, " ")));
    const body = unwrap(list[0]?.expr ?? "");
    if (exprs.size === 1 && list.every((s) => s.alone) && scopeOnly(body, helpers)) {
      liftable.set(factName(name), body);
    }
  }
  const byPart = new Map<string, string[]>();
  for (const [name, list] of byName) {
    if (!liftable.has(factName(name))) continue;
    for (const site of list) {
      const names = byPart.get(site.part) ?? [];
      names.push(factName(name));
      byPart.set(site.part, names);
    }
  }
  return { liftable, byPart };
}

/** The file with the facts declared and the parts carrying them. */
function rewrite(src: string): string {
  let out = fixImport(src);
  const { liftable, byPart } = plan(out);
  if (liftable.size === 0) return out;

  const all = sitesOf(src);
  // the sites to remove, and where each part's spread goes
  const removals: { from: number; to: number; part: string }[] = [];
  const firstAt = new Map<string, number>();
  for (const site of all) {
    if (site.name === "data-scope" || site.name === "data-part") continue;
    const fact = factName(site.name);
    if (!liftable.has(fact)) continue;
    removals.push({ from: site.from, to: site.to, part: site.part });
    const current = firstAt.get(site.part);
    if (current === undefined || site.from < current) firstAt.set(site.part, site.from);
  }

  // remove from the back so the offsets hold
  for (const removal of [...removals].sort((a, b) => b.from - a.from)) {
    const names = byPart.get(removal.part) ?? [];
    const spread = `...factAttrs(scope, facts, ${names.map((n) => `"${n}"`).join(", ")}),`;
    const isFirst = firstAt.get(removal.part) === removal.from;
    const line = out.slice(removal.from, out.indexOf("\n", removal.from));
    const prefix = /^(\s*)/.exec(line)?.[1] ?? "";
    const replacement = isFirst ? `${prefix}${spread}\n` : "";
    out = out.slice(0, removal.from) + replacement + out.slice(removal.to);
  }

  // the facts declaration, before the def. A file that already declares
  // one keeps it: the declaration is the component's, and a hand-written
  // fact is as good as a lifted one.
  const declares = /export const facts = \{/.test(out);
  if (!declares) {
    const defAt = out.search(/^(?:export )?const def\b/m);
    if (defAt < 0) return out;
    // the component's own scope type: an interface, a type alias, an
    // aliased import, or the runtime's own type
    const contextType = /ComponentDef<([A-Za-z0-9_]+),/.exec(out)?.[1] ?? "";
    const localScope =
      /^interface (\w+) extends PartScope<unknown, [A-Za-z0-9_]+> \{\}$/m.exec(out)?.[1] ??
        /^type (\w+) = PartScope<unknown, [A-Za-z0-9_]+>;$/m.exec(out)?.[1];
    const aliased = /type PartScope as (\w+)/.exec(out)?.[1];
    const scopeType = localScope ??
      (aliased && contextType !== "" ? `${aliased}<unknown, ${contextType}>` : undefined) ??
      (contextType === "" ? "FactScope<never>" : `PartScope<unknown, ${contextType}>`);
    const lines = [
      "/** The component's public state: the names the markup may key on. */",
      "export const facts = {",
    ];
    for (const [name, body] of liftable) {
      const key = /^[A-Za-z_$][\w$]*$/.test(name) ? name : `"${name}"`;
      lines.push(`  ${key}: (scope: ${scopeType}) => ${body},`);
    }
    lines.push("};", "", "");
    out = out.slice(0, defAt) + lines.join("\n") + out.slice(defAt);
  }

  return out;
}

/** The runtime's import: the values first, then the types, each
 * alphabetical. The import keeps its shape: a long one stays spread over
 * lines. */
function fixImport(src: string): string {
  return src.replace(
    /import \{([^}]*)\} from "@spin\/runtime";/,
    (_match, names: string) => {
      const parts = names.split(",").map((n) => n.trim()).filter((n) => n.length > 0);
      const values = parts.filter((p) => !p.startsWith("type "));
      const types = parts.filter((p) => p.startsWith("type "));
      if (!values.includes("factAttrs") && src.includes("factAttrs(")) {
        values.push("factAttrs");
      }
      if (src.includes("PartScope<") && !types.includes("type PartScope")) {
        types.push("type PartScope");
      }
      values.sort();
      types.sort();
      const all = [...values, ...types];
      if (names.includes("\n")) {
        return `import {\n${all.map((n) => `  ${n},`).join("\n")}\n} from "@spin/runtime";`;
      }
      return `import { ${all.join(", ")} } from "@spin/runtime";`;
    },
  );
}

const check = Deno.args.includes("--check");
let changed = 0;
for (const path of globSync("packages/components/src/*/*.bindings.ts").sort()) {
  const src = readFileSync(path, "utf8");
  const next = rewrite(src);
  if (next === src) continue;
  changed++;
  if (check) {
    console.log(`  would change: ${path}`);
    continue;
  }
  writeFileSync(path, next);
  console.log(`  changed: ${path}`);
}
console.log(`\n  the files: ${changed}`);

import type { ComponentIr, Node } from "@spin/runtime";

export interface EmitOutput {
  readonly js: string;
  readonly bindings: number;
}


const KEYWORDS = new Set([
  "true", "false", "null", "undefined", "this", "typeof", "void", "new",
  "in", "of", "instanceof", "return", "const", "let", "var", "if", "else",
  "for", "while", "do", "switch", "case", "break", "continue", "function",
  "arrow", "async", "await", "try", "catch", "finally", "throw", "class",
  "extends", "super", "import", "export", "default", "delete", "yield",
]);

function freeNames(expr: string, bound: Set<string>): string[] {
  const found: string[] = [];
  const re = /[A-Za-z_$][A-Za-z0-9_$]*/g;
  let m: RegExpExecArray | null;
  let depth = 0;
  const stripped = expr.replace(/"[^"]*"|'[^']*'|`[^`]*`/g, '""');
  while ((m = re.exec(stripped)) !== null) {
    const name = m[0]!;
    const before = stripped.slice(Math.max(0, m.index - 1), m.index);
    if (before === ".") continue;
    if (KEYWORDS.has(name)) continue;
    if (bound.has(name)) continue;
    if (!found.includes(name)) found.push(name);
  }
  void depth;
  return found;
}

function scopeExpr(expr: string, bound: Set<string>): string {
  // Rewrite free identifiers to values reads. Member bases stay bare
  // when bound (row.item) and become values reads otherwise.
  const names = freeNames(expr, bound);
  if (names.length === 0) return expr;
  let out = expr;
  for (const name of names.sort((a, b) => b.length - a.length)) {
    const re = new RegExp(`(?<![A-Za-z0-9_$."])${name}(?![A-Za-z0-9_$])`, "g");
    out = out.replace(re, `values.${name}`);
  }
  return out;
}

const pad = (depth: number): string => "  ".repeat(depth);

export function emit(ir: ComponentIr): EmitOutput {
  let bindings = 0;
  let seq = 0;

  const emitNodes = (nodes: readonly Node[], depth: number, host: string, parts = "parts", bound: Set<string> = new Set()): string[] => {
    const out: string[] = [];
    for (const node of nodes) {
      if (node.kind === "text") {
        const hasExpr = node.parts.some((part) => part.kind === "expr");
        if (!hasExpr) {
          const text = node.parts.map((part) => part.kind === "static" ? part.value : "").join("");
          if (text.length === 0) continue;
          out.push(`${pad(depth)}{ const t = document.createTextNode(${JSON.stringify(text)}); ${host}.appendChild(t); }`);
        } else {
          bindings++;
          const id = `t${seq++}`;
          const reads = node.parts.map((part) => {
            if (part.kind === "static") return JSON.stringify(part.value);
            return `String((${scopeExpr(part.expr, bound)}) ?? "")`;
          }).join(" + ");
          out.push(`${pad(depth)}{ const ${id} = text(""); ${parts}.push(() => { ${id}.set(${reads}); }); ${host}.appendChild(${id}.node); }`);
        }
        continue;
      }
      if (node.kind === "for") {
        bindings++;
        const id = `l${seq++}`;
        const keyScope = new Set([...bound, "item", "i"]);
        const withRow = new Set([...bound, node.binding, "item", "i"]);
        const key = node.key !== undefined
          ? `(item, i) => (${scopeExpr(node.key, keyScope).replace(new RegExp(`(?<![A-Za-z0-9_$."])${node.binding}(?![A-Za-z0-9_$])`, "g"), "item")})`
          : `(_item, i) => i`;
        out.push(`${pad(depth)}{ const ${id} = document.createComment("for"); ${host}.appendChild(${id});`);
        out.push(`${pad(depth + 1)}const view${id} = bindFor({ anchor: ${id},`);
        out.push(`${pad(depth + 2)}items: () => ((${scopeExpr(node.source, bound)}) ?? []),`);
        out.push(`${pad(depth + 2)}key: ${key},`);
        out.push(`${pad(depth + 2)}render: (item, i) => {`);
        out.push(`${pad(depth + 3)}const ${node.binding} = item;`);
        out.push(`${pad(depth + 3)}const rowParts = [];`);
        out.push(`${pad(depth + 3)}const frag = document.createDocumentFragment();`);
        for (const line of emitNodes(node.body, depth + 3, "frag", "rowParts", withRow)) out.push(line);
        out.push(`${pad(depth + 3)}return { nodes: [...frag.childNodes], update() { for (const u of rowParts) u(); } };`);
        out.push(`${pad(depth + 2)}});`);
        out.push(`${pad(depth + 1)}let last${id};`);
        out.push(`${pad(depth + 1)}${parts}.push(() => { const v = ((${scopeExpr(node.source, bound)}) ?? []); if (v !== last${id}) { last${id} = v; view${id}.sync(v); } });`);
        out.push(`${pad(depth)}}`);
        continue;
      }
      const el = `e${seq++}`;
      if (node.tag === "host") {
        out.push(`${pad(depth)}{ const ${el} = _host;`);
      } else {
        out.push(`${pad(depth)}{ const ${el} = document.createElement(${JSON.stringify(node.tag)});`);
      }
      for (const attr of node.attrs) {
        if (attr.value.kind === "static") {
          out.push(`${pad(depth + 1)}${el}.setAttribute(${JSON.stringify(attr.name)}, ${JSON.stringify(attr.value.value)});`);
        } else {
          bindings++;
          out.push(`${pad(depth + 1)}${parts}.push(bindAttr(${el}, ${JSON.stringify(attr.name)}, () => (${scopeExpr(attr.value.expr, bound)})));`);
        }
      }
      for (const ev of node.events) {
        bindings++;
        out.push(`${pad(depth + 1)}${parts}.push(on(${el}, ${JSON.stringify(ev.event)}, (...args) => (${scopeExpr(ev.handler, bound)})(...args)));`);
      }
      for (const use of node.actions) {
        bindings++;
        const param = use.param !== undefined ? `() => (${scopeExpr(use.param, bound)})` : `undefined`;
        out.push(`${pad(depth + 1)}runAction(${el}, actions[${JSON.stringify(use.name)}], ${param});`);
        out.push(
          `${pad(depth + 1)}if ((actions[${JSON.stringify(
            use.name,
          )}]).getter) {`,
        );
        out.push(
          `${pad(depth + 1)}  bindZag(${el}, () => { const a = actions[${JSON.stringify(
            use.name,
          )}]; return a.resolve ? (a.resolve(${el}, ${use.param !== undefined ? scopeExpr(use.param, bound) : "undefined"})) : undefined; }, (actions[${JSON.stringify(
            use.name,
          )}]).getter, () => { const a = actions[${JSON.stringify(
            use.name,
          )}]; const n = a.nodeOf ? a.nodeOf(${el}, ${use.param !== undefined ? scopeExpr(use.param, bound) : "undefined"}) : (${use.param !== undefined ? scopeExpr(use.param, bound) : "undefined"}); return (n ?? {}); });`,
        );
        out.push(`${pad(depth + 1)}}`);

      }
      for (const line of emitNodes(node.children, depth + 1, el, parts, bound)) out.push(line);
      if (node.tag !== "host") out.push(`${pad(depth + 1)}${host}.appendChild(${el});`);
      out.push(`${pad(depth)}}`);
    }
    return out;
  };

  const inner = emitNodes(ir.nodes, 2, "frag", "parts", new Set());
  const js = [
    `import { runAction, on, bindAttr, bindText as _bt, bindFor, text, bindZag } from "@spin/runtime";`,
    `void _bt;`,
    `export function create(actions, values, _host) {`,
    `  const parts = [];`,
    `  const frag = document.createDocumentFragment();`,
    ...inner,
    `  for (const u of parts) u();`,
    `  return { nodes: [...frag.childNodes], update() { for (const u of parts) u(); } };`,
    `}`,
  ].join("\n");
  return { js, bindings };
}

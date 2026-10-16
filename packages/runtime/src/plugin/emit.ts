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
  const depth = 0;
  const stripped = expr.replace(/"[^"]*"|'[^']*'|`[^`]*`/g, '""');
  while ((m = re.exec(stripped)) !== null) {
    const name = m[0]!;
    const before = stripped.slice(Math.max(0, m.index - 1), m.index);
    if (before === ".") continue;
    // An object-literal key (`{ index: i }`) is a name, not a scope read:
    // `{` or `,` before (past whitespace) and `:` after means the name
    // positions a value rather than reading one. Ternary consequents never
    // match — they follow `?`, not `{`/`,`.
    const behind = stripped.slice(0, m.index);
    const ahead = stripped.slice(m.index + name.length);
    if (/[{,]\s*$/.test(behind) && /^\s*:/.test(ahead)) continue;
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
          // ONE writer: the effect re-runs on the signals the reads touch
          // (machine text via its tick). The for-cell update has no signal
          // to move — a connect can hand out a stable holder it rewrites,
          // like the carousel readout — so the update path bumps the same
          // signal the effect subscribes to instead of writing the node a
          // second time.
          out.push(
            `${pad(depth)}{ const ${id} = document.createTextNode(""); const ${id}Fresh = signal(0); effect(() => { ${id}Fresh(); ${id}.data = (${reads}); }); ${parts}.push(() => ${id}Fresh(${id}Fresh() + 1)); ${host}.appendChild(${id}); }`,
          );
        }
        continue;
      }
      if (node.kind === "for") {
        bindings++;
        const id = `l${seq++}`;
        const keyScope = new Set([...bound, node.binding, "item", "i"]);
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
        out.push(`${pad(depth + 2)}}});`);
        out.push(`${pad(depth)}}`);
        continue;
      }
      if (node.tag === "slot") {
        // A transclusion point. `name` selects the assigned group from the
        // pre-projected `values["@@slots"]` map; the element's own children
        // are fallback content when nothing was assigned. Assigned nodes are
        // moved (never cloned) by placeSlot, which also owns re-placement on
        // update — hence pushed, unlike bindAttr/on.
        const nameAttr = node.attrs.find((a) => a.name === "name");
        const name = nameAttr !== undefined && nameAttr.value.kind === "static" ? nameAttr.value.value : "";
        const anchor = `s${seq++}`;
        const fragId = `sf${seq++}`;
        const fb = `f${seq++}`;
        out.push(`${pad(depth)}{ const ${anchor} = document.createComment("slot"); ${host}.appendChild(${anchor});`);
        out.push(`${pad(depth + 1)}const ${fragId} = document.createDocumentFragment();`);
        for (const line of emitNodes(node.children, depth + 1, fragId, parts, bound)) out.push(line);
        out.push(`${pad(depth + 1)}const ${fb} = [...${fragId}.childNodes];`);
        out.push(`${pad(depth + 1)}${parts}.push(() => placeSlot(${host}, ${anchor}, (values["@@slots"] || new Map()).get(${JSON.stringify(name)}), ${fb}));`);
        out.push(`${pad(depth)}}`);
        continue;
      }
      const el = `e${seq++}`;
      // `show={expr}` renders through bindIf: the element (and its subtree)
      // mounts only while the expression holds, and unmounts otherwise.
      // The test indexes two branches ([shown] vs empty), so a truthy read
      // shows and anything else hides — no new syntax beyond the attribute.
      const showTest = node.kind === "element" && node.show !== undefined
        ? `() => ((${scopeExpr(node.show, bound)}) ? 0 : 1)`
        : undefined;
      // Branch-local frag/parts: named once, threaded through the subtree.
      const bid = showTest !== undefined ? `b${seq++}` : undefined;
      if (showTest !== undefined) {
        bindings++;
        const aid = `a${seq++}`;
        out.push(`${pad(depth)}{ const ${aid} = document.createComment("show"); ${host}.appendChild(${aid});`);
        out.push(`${pad(depth + 1)}bindIf({ anchor: ${aid}, test: ${showTest}, branches: [() => {`);
        out.push(`${pad(depth + 2)}const ${bid}f = document.createDocumentFragment();`);
        out.push(`${pad(depth + 2)}const ${bid}p = [];`);
      }
      const iDepth = showTest !== undefined ? depth + 2 : depth;
      const iParts = bid !== undefined ? `${bid}p` : parts;
      if (node.tag === "host") {
        out.push(`${pad(iDepth)}{ const ${el} = _host;`);
      } else {
        out.push(`${pad(iDepth)}{ const ${el} = document.createElement(${JSON.stringify(node.tag)});`);
      }
      for (const attr of node.attrs) {
        if (attr.value.kind === "static") {
          out.push(`${pad(iDepth + 1)}${el}.setAttribute(${JSON.stringify(attr.name)}, ${JSON.stringify(attr.value.value)});`);
        } else {
          bindings++;
          out.push(`${pad(iDepth + 1)}bindAttr(${el}, ${JSON.stringify(attr.name)}, () => (${scopeExpr(attr.value.expr, bound)}));`);
        }
      }
      for (const ev of node.events) {
        bindings++;
        out.push(`${pad(iDepth + 1)}on(${el}, ${JSON.stringify(ev.event)}, (...args) => (${scopeExpr(ev.handler, bound)})(...args));`);
      }
      for (const use of node.actions) {
        bindings++;
        const param = use.param !== undefined ? `() => (${scopeExpr(use.param, bound)})` : `undefined`;
        out.push(`${pad(iDepth + 1)}runAction(${el}, actions[${JSON.stringify(use.name)}], ${param});`);
      }
      for (const spread of node.spreads) {
        bindings++;
        out.push(`${pad(iDepth + 1)}${iParts}.push(bindSpread(${el}, () => (${scopeExpr(spread.expr, bound)})));`);
      }
      for (const line of emitNodes(node.children, iDepth + 1, el, iParts, bound)) out.push(line);
      if (node.tag !== "host") out.push(`${pad(iDepth + 1)}${bid !== undefined ? `${bid}f` : host}.appendChild(${el});`);
      out.push(`${pad(iDepth)}}`);
      if (showTest !== undefined && bid !== undefined) {
        out.push(`${pad(depth + 2)}for (const u of ${bid}p) u();`);
        out.push(`${pad(depth + 2)}return { nodes: [...${bid}f.childNodes], update() { for (const u of ${bid}p) u(); } };`);
        out.push(`${pad(depth + 1)}}, () => ({ nodes: [], update() {} })]});`);
        out.push(`${pad(depth)}}`);
      }
    }
    return out;
  };

  const inner = emitNodes(ir.nodes, 2, "frag", "parts", new Set());
  const js = [
    `import { runAction, on, bindAttr, bindText, bindFor, bindIf, bindActionProps, bindSpread, placeSlot, signal, effect } from "@spin/runtime";`,
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

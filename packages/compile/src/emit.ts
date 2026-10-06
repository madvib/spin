import type { ComponentIr, Node } from "./ir.ts";

export interface EmitOutput {
  readonly js: string;
  readonly bindings: number;
}

const pad = (depth: number): string => "  ".repeat(depth);

export function emit(ir: ComponentIr): EmitOutput {
  let bindings = 0;
  let seq = 0;

  const emitNodes = (nodes: readonly Node[], depth: number, host: string, parts = "parts"): string[] => {
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
            return `String((${part.expr}) ?? "")`;
          }).join(" + ");
          out.push(`${pad(depth)}{ const ${id} = text(""); ${parts}.push(() => { ${id}.set(${reads}); }); ${host}.appendChild(${id}.node); }`);
        }
        continue;
      }
      if (node.kind === "for") {
        bindings++;
        const id = `l${seq++}`;
        const key = node.key !== undefined ? `(item, i) => (${node.key})` : `(_item, i) => i`;
        out.push(`${pad(depth)}{ const ${id} = document.createComment("for"); ${host}.appendChild(${id});`);
        out.push(`${pad(depth + 1)}const view${id} = bindFor({ anchor: ${id},`);
        out.push(`${pad(depth + 2)}items: () => ((${node.source}) ?? []),`);
        out.push(`${pad(depth + 2)}key: ${key},`);
        out.push(`${pad(depth + 2)}render: (item, i) => {`);
        out.push(`${pad(depth + 3)}const ${node.binding} = item;`);
        out.push(`${pad(depth + 3)}const rowParts = [];`);
        out.push(`${pad(depth + 3)}const frag = document.createDocumentFragment();`);
        for (const line of emitNodes(node.body, depth + 3, "frag", "rowParts")) out.push(line);
        out.push(`${pad(depth + 3)}return { nodes: [...frag.childNodes], update() { for (const u of rowParts) u(); } };`);
        out.push(`${pad(depth + 2)}});`);
        out.push(`${pad(depth + 1)}let last${id};`);
        out.push(`${pad(depth + 1)}${parts}.push(() => { const v = ((${node.source}) ?? []); if (v !== last${id}) { last${id} = v; view${id}.sync(v); } });`);
        out.push(`${pad(depth)}}`);
        continue;
      }
      const el = `e${seq++}`;
      out.push(`${pad(depth)}{ const ${el} = document.createElement(${JSON.stringify(node.tag)});`);
      for (const attr of node.attrs) {
        if (attr.value.kind === "static") {
          out.push(`${pad(depth + 1)}${el}.setAttribute(${JSON.stringify(attr.name)}, ${JSON.stringify(attr.value.value)});`);
        } else {
          bindings++;
          out.push(`${pad(depth + 1)}${parts}.push(bindAttr(${el}, ${JSON.stringify(attr.name)}, () => (${attr.value.expr})));`);
        }
      }
      for (const ev of node.events) {
        bindings++;
        out.push(`${pad(depth + 1)}${parts}.push(on(${el}, ${JSON.stringify(ev.event)}, ${ev.handler}));`);
      }
      for (const use of node.actions) {
        bindings++;
        const param = use.param !== undefined ? `() => (${use.param})` : `undefined`;
        out.push(`${pad(depth + 1)}runAction(${el}, actions[${JSON.stringify(use.name)}], ${param});`);
      }
      for (const line of emitNodes(node.children, depth + 1, el, parts)) out.push(line);
      out.push(`${pad(depth + 1)}${host}.appendChild(${el});`);
      out.push(`${pad(depth)}}`);
    }
    return out;
  };

  const inner = emitNodes(ir.nodes, 2, "frag");
  const js = [
    `import { runAction, on, bindAttr, bindText as _bt, bindFor, text } from "@spin/runtime";`,
    `void _bt;`,
    `export function create(ctx, actions) {`,
    `  void ctx;`,
    `  const parts = [];`,
    `  const frag = document.createDocumentFragment();`,
    ...inner,
    `  for (const u of parts) u();`,
    `  return { nodes: [...frag.childNodes], update() { for (const u of parts) u(); } };`,
    `}`,
  ].join("\n");
  return { js, bindings };
}

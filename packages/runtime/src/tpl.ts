export function tpl<T extends Element>(html: string): () => T {
  let proto: Element | undefined;
  return (): T => {
    if (proto === undefined) {
      const t = document.createElement("template") as unknown as {
        innerHTML: string;
        content: { firstElementChild: unknown };
      };
      t.innerHTML = html;
      proto = t.content.firstElementChild as unknown as Element;
    }
    return proto.cloneNode(true) as T;
  };
}

export interface Rendered {
  readonly node: Node;
  update(): void;
}

export function view(
  parts: (() => void)[],
  nodes: readonly Node[],
): Rendered {
  const host = document.createDocumentFragment();
  for (const n of nodes) host.appendChild(n);
  const rendered = {
    node: host as unknown as Node,
    update() {
      const n = parts.length;
      for (let i = 0; i < n; i++) parts[i]!();
    },
  };
  rendered.update();
  return rendered;
}

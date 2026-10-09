/**
 * Fixture DOM. The examples are machine-authored strings, so the parser
 * covers exactly their grammar: well-formed tags, quoted attributes, void
 * elements. Anything outside it throws rather than guesses.
 */

export interface DomNode {
  readonly tag: string;
  readonly classes: readonly string[];
  readonly attrs: Readonly<Record<string, string>>;
  /** Owned by the parser; consumers read it. */
  children: DomNode[];
  /** Own text, whitespace-collapsed the way normal flow collapses it. */
  text: string;
  readonly parent: DomNode | null;
}

const VOID_TAGS: Record<string, true> = {
  area: true,
  base: true,
  br: true,
  col: true,
  embed: true,
  hr: true,
  img: true,
  input: true,
  link: true,
  meta: true,
  source: true,
  track: true,
  wbr: true,
};

const TAG = /<!--[\s\S]*?-->|<\/?[a-zA-Z][^>]*>/g;
const ATTR = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*"([^"]*)")?/g;
const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&nbsp;": " ",
};

function decodeEntities(raw: string): string {
  return raw.replace(/&[a-z]+;|&#\d+;/gi, (m) => ENTITIES[m] ?? m);
}

export function parseHtml(html: string): DomNode {
  const root: DomNode = {
    tag: "#root",
    classes: [],
    attrs: {},
    children: [],
    text: "",
    parent: null,
  };
  const stack: DomNode[] = [root];
  let cursor = 0;
  for (let m = TAG.exec(html); m !== null; m = TAG.exec(html)) {
    const text = html.slice(cursor, m.index);
    if (text.trim() !== "") stack[stack.length - 1].text += collapse(text);
    cursor = m.index + m[0].length;
    const token = m[0];
    if (token.startsWith("<!--")) continue;
    const closing = token.startsWith("</");
    const body = token.replace(/^<\/?/, "").replace(/\/?>$/, "");
    const tag = (body.match(/^[a-zA-Z][-a-zA-Z0-9]*/) ?? [""])[0].toLowerCase();
    if (tag === "") throw new Error(`layout oracle: unparsable tag ${token}`);
    if (closing) {
      const open = stack.pop();
      if (open === undefined || open.tag !== tag) {
        throw new Error(`layout oracle: stray </${tag}>`);
      }
      continue;
    }
    const node: DomNode = {
      tag,
      classes: classesOf(body),
      attrs: attrsOf(body),
      children: [],
      text: "",
      parent: stack[stack.length - 1],
    };
    stack[stack.length - 1].children.push(node);
    if (!(tag in VOID_TAGS) && !token.endsWith("/>")) stack.push(node);
  }
  return root;
}

function collapse(text: string): string {
  return decodeEntities(text).replace(/\s+/g, " ");
}

function classesOf(body: string): string[] {
  const m = body.match(/\sclass\s*=\s*"([^"]*)"/);
  return m ? m[1].split(/\s+/).filter((c) => c !== "") : [];
}

function attrsOf(body: string): Record<string, string> {
  const rest = body.replace(/\s(class|id)\s*=\s*"[^"]*"/g, " ");
  const out: Record<string, string> = {};
  for (let m = ATTR.exec(rest); m !== null; m = ATTR.exec(rest)) {
    out[m[1].toLowerCase()] = m[2] ?? "";
  }
  const id = body.match(/\sid\s*=\s*"([^"]*)"/);
  if (id) out.id = id[1];
  return out;
}

/** Element children only — whitespace text nodes never take part in geometry. */
export function elementChildren(node: DomNode): DomNode[] {
  return [...node.children];
}

export function hasClass(node: DomNode, name: string): boolean {
  return node.classes.includes(name);
}

export function descendants(node: DomNode): DomNode[] {
  const out: DomNode[] = [];
  const walk = (n: DomNode): void => {
    for (const child of n.children) {
      out.push(child);
      walk(child);
    }
  };
  walk(node);
  return out;
}

export function textOf(node: DomNode): string {
  return node.text.trim();
}

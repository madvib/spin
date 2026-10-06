import { bindAttr, bindText } from "./bind.ts";
import { on, runAction } from "./use.ts";
import { scope as makeScope } from "../core/signal.ts";
import { bindFor } from "./for.ts";
import { runAction as act, type ElementAction } from "./use.ts";
import { parse } from "./parse.ts";
import type { ComponentIr, Node } from "./ir.ts";

/**
 * Ancestor-provided values, available during wiring and through effects.
 *
 * A `use:` action provides by calling `provide(key, value)`; a descendant
 * resolves via `consume(el, key)`. Two channels, in order:
 *
 * 1. The wiring scope: `provide` records on the loader's current scope,
 *    which descendants inherit as they are walked. Works before insertion,
 *    when DOM parents are still fragments.
 * 2. The DOM: `provide(el, ...)` form records on the element; `consume`
 *    falls back to walking `parentElement`. Works after insertion, when
 *    effects re-run.
 *
 * Lookup never goes sideways or global. Sibling subtrees are isolated by
 * save/restore around each element's children.
 */
const wiringScope: Array<Map<string, unknown>> = [];

export function provide(key: string, value: unknown): void;
export function provide(el: Element, key: string, value: unknown): void;
export function provide(
  elOrKey: Element | string,
  keyOrValue: string | unknown,
  value?: unknown,
): void {
  if (typeof elOrKey === "string") {
    const top = wiringScope[wiringScope.length - 1];
    if (top) top.set(elOrKey, keyOrValue);
    return;
  }
  const el = elOrKey;
  const key = keyOrValue as string;
  let map = provided.get(el);
  if (!map) provided.set(el, (map = new Map()));
  map.set(key, value);
}

const provided = new WeakMap<Element, Map<string, unknown>>();

export function consume(el: Element, key: string): unknown {
  for (let i = wiringScope.length - 1; i >= 0; i--) {
    const value = wiringScope[i]!.get(key);
    if (value !== undefined) return value;
  }
  let current = el.parentElement;
  while (current) {
    const value = provided.get(current)?.get(key);
    if (value !== undefined) return value;
    current = current.parentElement;
  }
  return undefined;
}

export interface LoaderActions {
  // Contravariant by necessity: actions accept specific params, the loader
  // passes unknowns. ElementAction<P> takes P, so ElementAction<Specific>
  // is not assignable to ElementAction<unknown> — hence `never`.
  // Callers cast at the boundary; the alternative is typing every use:
  // site, which is the compiler's job, not the loader's.
  readonly [name: string]: ElementAction<unknown>;
}

export interface LoaderScope {
  readonly [name: string]: unknown;
}

function resolve(value: unknown): unknown {
  if (typeof value === "function" && (value as (...a: never[]) => unknown).length === 0) {
    try {
      return (value as () => unknown)();
    } catch {
      return undefined;
    }
  }
  return value;
}

function readExpr(expr: string, values: LoaderScope): unknown {
  const names = Object.keys(values);
  const args = names.map((name) => values[name]);
  try {
    return resolve(new Function(...names, `return (${expr});`)(...args));
  } catch {
    return undefined;
  }
}

function callExpr(expr: string, values: LoaderScope): (...args: never[]) => unknown {
  const fn = readExpr(expr, values);
  if (typeof fn === "function") return fn as (...args: never[]) => unknown;
  return () => undefined;
}

function wire(
  root: Element | DocumentFragment,
  ir: ComponentIr,
  actions: LoaderActions,
  values: LoaderScope,
  _parts: (() => void)[],
): void {
  const walk = (
    nodes: readonly Node[],
    mount: ParentNode,
    _target: (() => void)[],
    rowScope?: LoaderScope,
  ): void => {
    const active = rowScope ?? values;
    for (const node of nodes) {
      if (node.kind === "text") {
        const hasExpr = node.parts.some((part) => part.kind === "expr");
        if (!hasExpr) {
          const text = node.parts.map((part) => part.kind === "static" ? part.value : "").join("");
          if (text.length > 0) mount.appendChild(document.createTextNode(text));
          continue;
        }
        const t = document.createTextNode("");
        mount.appendChild(t);
        bindText(t, () => {
          let out = "";
          for (const part of node.parts) {
            if (part.kind === "static") out += part.value;
            else {
              const v = readExpr(part.expr, active);
              out += v == null ? "" : String(v);
            }
          }
          return out;
        });
        continue;
      }
      if (node.kind === "for") {
        const anchor = document.createComment("for");
        mount.appendChild(anchor);
        bindFor<unknown>({
          anchor,
          items: () => (readExpr(node.source, active) as readonly unknown[]) ?? [],
          key: node.key !== undefined
            ? (item, i) => readExpr(node.key!, { ...active, [node.binding]: item, i })
            : (_item, i) => i,
          render: (item) => {
            const frag = document.createDocumentFragment();
            const rowScope = { ...active, [node.binding]: item };
            walk(node.body, frag, [], rowScope);
            return { nodes: [...frag.childNodes] };
          },
        });
        continue;
      }
      const el = document.createElement(node.tag);
      for (const attr of node.attrs) {
        if (attr.value.kind === "static") {
          el.setAttribute(attr.name, attr.value.value);
        } else {
          const expr = attr.value.expr;
          bindAttr(el, attr.name, () => readExpr(expr, active));
        }
      }
      for (const ev of node.events) {
        const handler = callExpr(ev.handler, active);
        on(el, ev.event, (e: Event) => (handler as (e: unknown) => void)(e));
      }
      for (const use of node.actions) {
        const action = actions[use.name];
        if (typeof action === "function") {
          if (use.param !== undefined) {
            act(el, action, () => readExpr(use.param!, active));
          } else {
            act(el, action, undefined);
          }
        }
      }
      mount.appendChild(el);
      wiringScope.push(new Map());
      try {
        walk(node.children, el, [], active);
      } finally {
        wiringScope.pop();
      }
    }
  };
  walk(ir.nodes, root as unknown as ParentNode & Element, _parts);
}

export function load(
  source: string,
  actions: LoaderActions,
  values: LoaderScope,
  onUnknown: "throw" | "skip" = "skip",
): { nodes: Node[]; dispose(): void } {
  void onUnknown;
  const ir = parse(source);
  const frag = document.createDocumentFragment();
  const owner = makeScope();
  const stop = owner.run(() => {
    wire(frag, ir, actions, values, []);
    return () => owner.dispose();
  });
  return { nodes: [...frag.childNodes] as unknown as Node[], dispose: stop };
}

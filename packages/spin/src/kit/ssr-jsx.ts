/**
 * The JSX runtime Deno renders the kit's components with.
 *
 * Solid's automatic runtime is the DOM one, and Deno has no DOM: under Deno
 * `solid-js` resolves to Solid's server build, whose JSX is written by
 * Solid's own compiler rather than by a runtime module. This is that
 * runtime — the automatic JSX calls over Solid's server toolkit — so the kit
 * can render its own components to a string in its own tests.
 *
 * The apps never load this. They compile the kit with Solid's DOM compiler,
 * and the browser runs the result; this is the Deno-side of the same
 * components, and nothing more.
 */
import { createComponent } from "solid-js/dist/server.js";
import type { JSX } from "solid-js";
import { ssrElement } from "solid-js/web/dist/server.js";
export type { JSX } from "solid-js/types/jsx.d.ts";

/** The props Solid's compiler hands the runtime. */
export type JsxProps = Record<string, unknown> & { children?: unknown };

/** A component, seen from the runtime: it takes props and returns a tree. */
type AnyComponent = (props: never) => JSX.Element;

/**
 * One element, one component.
 *
 * A component is asked for what it returns; a tag becomes an element with
 * its attributes and its children.
 */
export function jsx(
  type: string | AnyComponent,
  props: JsxProps,
): JSX.Element {
  if (typeof type === "function") {
    return createComponent(type, props as never);
  }
  return ssrElement(
    type,
    props,
    props.children,
    false,
  ) as unknown as JSX.Element;
}

/** The same call: the children of a keyed list arrive as an array. */
export const jsxs = jsx;

/** The dev-runtime entry: identical without debug metadata. */
export const jsxDEV = jsx;

/** A group of children with no element of its own. */
export function Fragment(props: JsxProps): unknown {
  return props.children;
}

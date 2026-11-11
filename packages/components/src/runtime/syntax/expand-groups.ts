/**
 * Variant-group expansion for static markup (`data-[open]:(bg-x text-y)`
 * → `data-[open]:bg-x data-[open]:text-y`).
 *
 * This mirrors core's `parseVariantGroup` for the shapes our markup uses,
 * without dragging `@unocss/core` into the runtime graph: the element
 * transform expands author spellings before emit (the DOM carries expanded
 * tokens), while `?raw` sources and the class gate see the compact form.
 * Nested groups expand inside out; separators are `:` then `-`, as in core.
 */

const GROUP = /([^\s:"'()]+):\(([^()]*)\)/g;

/** Expand one level of `prefix:(a b)` groups in a class string. */
function expandOnce(classes: string): string {
  return classes.replace(GROUP, (_match, prefix: string, body: string) => {
    const items = body.split(/\s+/).filter((item) => item.length > 0);
    return items.map((item) => `${prefix}:${item}`).join(" ");
  });
}

/** Expand variant groups in static text until none remain (nesting). */
export function expandVariantGroups(source: string): string {
  let prev = source;
  for (let depth = 0; depth < 5; depth++) {
    const next = expandOnce(prev);
    if (next === prev) return next;
    prev = next;
  }
  return prev;
}

/**
 * The one style serializer the runtime ships.
 *
 * `{ backgroundColor: "red" }` → `"background-color:red;"`. Custom properties
 * pass through untouched: their case IS their name, and a `--camelCased`
 * property is a different property. Everything else is camelCase, because the
 * values arrive from JS-side bindings.
 *
 * The string is written to `style` — never to a `style` attribute: the IDL
 * path composes, while an attribute write replaces every declaration the
 * theme, a utility, or an animation put there.
 */

/** `{ backgroundColor: "red" }` → `"background-color:red;"`. */
export function toStyleString(style: Record<string, unknown>): string {
  let out = "";
  for (const key in style) {
    const value = style[key];
    if (value === null || value === undefined) continue;
    if (!key.startsWith("--")) {
      const dashed = key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
      out += `${dashed}:${value};`;
      continue;
    }
    out += `${key}:${value};`;
  }
  return out;
}

/**
 * Converts zag's canonical prop names to DOM names.
 *
 * Zag emits React-shaped props. `onFocus` is `focusin`, not `focus`: zag wants
 * the event that bubbles, and `focus` does not. `onChange` is `input`, not
 * `change`. Getting these wrong is silent — the handler simply never fires.
 */

import { createNormalizer } from "@zag-js/types";

const PROP_MAP: Record<string, string> = {
  onFocus: "onFocusin",
  onBlur: "onFocusout",
  onChange: "onInput",
  onDoubleClick: "onDblclick",
  htmlFor: "for",
  className: "class",
  defaultValue: "value",
  defaultChecked: "checked",
};

/** Lowercasing these breaks them; every other attribute is case-insensitive. */
export const SVG_CASE_SENSITIVE = new Set([
  "viewBox",
  "preserveAspectRatio",
  "clipPath",
  "clipRule",
  "fillRule",
  "strokeWidth",
  "strokeLinecap",
  "strokeLinejoin",
  "strokeDasharray",
  "strokeDashoffset",
  "strokeMiterlimit",
]);

/** `{ backgroundColor: "red" }` → `"background-color:red;"`. */
export function toStyleString(style: Record<string, unknown>): string {
  let out = "";
  for (let key in style) {
    const value = style[key];
    if (value === null || value === undefined) continue;
    if (!key.startsWith("--")) key = key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
    out += `${key}:${value};`;
  }
  return out;
}

export const normalizeProps = createNormalizer((props: Record<string, unknown>) => {
  const out: Record<string, unknown> = {};
  for (const [rawKey, value] of Object.entries(props)) {
    if (value === undefined) continue;
    const mapped = PROP_MAP[rawKey] ?? rawKey;
    out[SVG_CASE_SENSITIVE.has(mapped) ? mapped : mapped.toLowerCase()] = value;
  }
  return out;
});

import type { Rule } from "@unocss/core";

/**
 * Input — the text field, and the type aliases that reach the native
 * controls.
 *
 * `<input>` is a text field. Its type is the platform's concern: `type="email"`
 * gets validation, `type="search"` gets a clear button, `type="number"` gets
 * a stepper, none of which this library has an opinion about. What the library
 * owns is the box, and that is `field.ts` — select and textarea read the same
 * one.
 *
 * The aliases here name the native control rather than a custom element:
 * `checkbox` means `input[type="checkbox"]`, not `<checkbox>`. A custom
 * element would style nothing the browser renders. It fires from
 * `<checkbox>` in markup, `class="checkbox"`, or `type="checkbox"` —
 * whichever the author reached for, because the contract is one idea and not
 * three spellings.
 */
export function inputRules(roots: readonly string[]): Rule[] {
  if (!roots.includes("input")) return [];
  return ALIASES.map(alias);
}

/**
 * A name that reaches a native control.
 *
 * `switch` is deliberately absent: it is not a type but a `role` on a
 * checkbox, and it draws a thumb rather than a tick, so it is a component of
 * its own — see `control.ts`.
 */
const ALIASES: ReadonlyArray<readonly [token: string, selector: string]> = [
  ["range", 'input[type="range"]'],
  ["color", 'input[type="color"]'],
  ["file", 'input[type="file"]'],
  ["label", "label"],
  ["fieldset", "fieldset"],
  ["legend", "legend"],
];

function alias([token, selector]: readonly [string, string]): Rule {
  return [
    new RegExp(`^${token}$`),
    function* (_m, ctx) {
      yield { [ctx.symbols.selector]: () => selector };
    },
    { layer: "primitives", autocomplete: token },
  ];
}

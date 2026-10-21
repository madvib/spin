/** The component's public state, named.
 *
 * A fact is one fact about the component — "it is disabled", "it is
 * horizontal" — written once and carried by every part that names it.
 */

/** What a fact reads: the props, the context, the machine's state, and the
 * part ids. */
export interface FactScope<C = unknown> {
  readonly props: Record<string, unknown>;
  readonly context: C;
  readonly state: string;
  readonly id: (part: string, slot?: unknown) => string;
}

/**
 * The attributes a part carries: the named facts, written.
 *
 * The value follows the spread's rule — `true` writes an empty attribute,
 * a string writes itself, and `false`/`null`/`undefined` leaves the
 * attribute off — so a fact and a hand-written attribute reach the DOM the
 * same way.
 *
 * The names are the declaration's keys, so a name the declaration does
 * not have does not compile.
 */
export function factAttrs<
  S extends FactScope<unknown>,
  F extends Record<string, (scope: S) => unknown>,
>(
  scope: S,
  facts: F,
  ...names: (keyof F & string)[]
): Record<string, unknown> {
  const attrs: Record<string, unknown> = {};
  for (const name of names) {
    const value = facts[name]?.(scope);
    if (value === undefined || value === null || value === false) continue;
    attrs[`data-${name}`] = value === true ? "" : value;
  }
  return attrs;
}

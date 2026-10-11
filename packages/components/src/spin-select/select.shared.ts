/**
 * Select's shared helpers: the one bag helper the connect and its tests
 * both spell, defined once.
 */

/** Zag's `dataAttr`: the attribute is present when the condition holds and
 * absent otherwise, which is what `hidden`-style utilities key on. */
export function dataAttr(value: boolean): string | undefined {
  return value ? "" : undefined;
}

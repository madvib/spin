/** Namespaced element ids: `<name>:<element-id>:<part>[:<slot>]`.
 *
 * One factory per connect replaces the hand-written id template strings.
 * Ids are stable per element instance; slot ids take the slot index. */

export type IdFn = (part: string, slot?: number) => string;

export function ids(name: string, id: string): IdFn {
  const root = `${name}:${id}`;
  return (part, slot) =>
    slot === undefined ? `${root}:${part}` : `${root}:${part}:${slot}`;
}

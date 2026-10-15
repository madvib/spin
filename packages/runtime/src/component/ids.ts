/** Namespaced element ids: `<name>:<element-id>:<part>[:<slot>]`.
 *
 * One factory per connect replaces the hand-written id template strings.
 * Ids are stable per element instance; slot ids take the slot index. */

export type IdFn = (part: string, slot?: unknown) => string;

/** Focus a part by id: a missing node is a no-op, never a throw (the
 * element may not be in the document). */
export function focuser(id: IdFn): (part: string, slot?: unknown) => void {
  return (part, slot) => {
    if (typeof document === "undefined") return;
    document.getElementById(id(part, slot))?.focus({ preventScroll: true });
  };
}

export function ids(name: string, id: string): IdFn {
  // An already-namespaced id is used verbatim: sub-scopes hand down their
  // own prefix, and a second namespace would orphan every part lookup.
  const root = id.startsWith(`${name}:`) ? id : `${name}:${id}`;
  return (part, slot) =>
    slot === undefined || slot === null ? `${root}:${part}` : `${root}:${part}:${String(slot)}`;
}

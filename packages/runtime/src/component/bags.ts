/** Shared connect machinery: bag memoization, attribute helpers, event guards.
 *
 * Every component connect re-implements this file. The semantics matter
 * because ticks are hot: a bag rebuilds only when the signature of the
 * fields it reads moves, so per-tick work is a string compare, not an
 * object allocation. */

export interface BagMemo {
  sig: string;
  bag: Record<string, unknown>;
}

export type BagBuilder = () => Record<string, unknown>;

/** A bag cached until the signature of the fields it reads moves. One memo
 * holds the single bag of one part (there is one root, one image, one
 * fallback per element), so a single slot is the whole cache. */
export function memo(): (sig: string, build: BagBuilder) => Record<string, unknown> {
  let sig = "";
  let bag: Record<string, unknown> | undefined;
  return (next, build) => {
    if (bag !== undefined && sig === next) return bag;
    sig = next;
    bag = build();
    return bag;
  };
}

/** Thumbs are stable slots, so the memo dies with the slot it came from. */
export function keyed<K extends object>(
  store: WeakMap<K, BagMemo>,
  owner: K,
  sig: string,
  build: BagBuilder,
): Record<string, unknown> {
  const hit = store.get(owner);
  if (hit !== undefined && hit.sig === sig) return hit.bag;
  const bag = build();
  store.set(owner, { sig, bag });
  return bag;
}

/** Zag's `dataAttr`: the attribute is present when the condition holds and
 * absent otherwise. */
export function dataAttr(value: boolean): string | undefined {
  return value ? "" : undefined;
}

/** Zag's `isComposingEvent`: a composing keystroke is not a navigation. */
export function isComposing(event: KeyboardEvent): boolean {
  return event.isComposing === true || event.keyCode === 229;
}

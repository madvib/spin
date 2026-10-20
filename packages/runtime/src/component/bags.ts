/** Shared connect machinery: bag memoization, attribute helpers, event guards.
 *
 * Every component connect re-implements this file. The semantics matter
 * because ticks are hot: a bag rebuilds only when the signature of the
 * fields it reads moves, so per-tick work is a string compare, not an
 * object allocation. */

export interface BagMemo {
  sig: string;
  bag: Record<string, unknown>;
  /** The context fields and the props the build read. */
  reads: BagReads;
}

export type BagBuilder = () => Record<string, unknown>;

/** What a bag's build read: the context fields and the props. */
export interface BagReads {
  readonly context: readonly string[];
  readonly props: readonly string[];
}

/** Records one read, so the build's dependencies are known without being
 * written by hand. */
export type ReadRecorder = (kind: "context" | "props", key: string) => void;

/** A bag cached until the signature of the fields it reads moves. One memo
 * holds the single bag of one part (there is one root, one image, one
 * fallback per element), so a single slot is the whole cache.
 *
 * The build RECORDS what it reads, so the key that decides the next
 * rebuild is derived from the reads rather than written by hand: a part
 * that forgot to name a field can no longer go stale. The hand-written
 * signature still applies — it is the author's own statement of the
 * dependency, and the derived key only adds what it missed. */
export function memo(): {
  (
    keyOf: (reads: BagReads) => string,
    build: (record: ReadRecorder) => Record<string, unknown>,
  ): Record<string, unknown>;
} {
  let sig = "";
  let bag: Record<string, unknown> | undefined;
  const context: string[] = [];
  const props: string[] = [];
  const record: ReadRecorder = (kind, key) => {
    const into = kind === "context" ? context : props;
    if (!into.includes(key)) into.push(key);
  };
  const reads = (): BagReads => ({ context: [...context], props: [...props] });
  return (keyOf, build) => {
    // The key comes from the reads of the LAST build, and the stored key
    // is the one from THIS build: the two agree, so a re-read of an
    // unchanged state returns the same bag.
    const next = keyOf(reads());
    if (bag !== undefined && sig === next) return bag;
    context.length = 0;
    props.length = 0;
    bag = build(record);
    sig = keyOf(reads());
    return bag;
  };
}

/** Thumbs are stable slots, so the memo dies with the slot it came from. */
export function keyed<K extends object>(
  store: WeakMap<K, BagMemo>,
  owner: K,
  keyOf: (reads: BagReads) => string,
  build: (record: ReadRecorder) => Record<string, unknown>,
): Record<string, unknown> {
  // The key function is the caller's: it sees THIS call's arguments.
  const hit = store.get(owner);
  const context: string[] = [];
  const props: string[] = [];
  const record: ReadRecorder = (kind, key) => {
    const into = kind === "context" ? context : props;
    if (!into.includes(key)) into.push(key);
  };
  const reads = (): BagReads => ({ context: [...context], props: [...props] });
  const next = keyOf(hit?.reads ?? { context: [], props: [] });
  if (hit !== undefined && hit.sig === next) return hit.bag;
  const bag = build(record);
  store.set(owner, { sig: keyOf(reads()), bag, reads: reads() });
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

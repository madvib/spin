/** Shared connect machinery: bag memoization, attribute helpers, event guards.
 *
 * Every component connect re-implements this file. The semantics matter
 * because ticks are hot: a bag rebuilds only when the signature of the
 * fields it reads moves, so per-tick work is a string compare, not an
 * object allocation. */

export interface BagMemo {
  /** The key the reads made: the bag rebuilds when it moves. */
  key: string;
  bag: Record<string, unknown>;
  /** The context fields, the props, the state and the slot's fields. */
  reads: BagReads;
}

export type BagBuilder = () => Record<string, unknown>;

/** What a bag's build read: the context fields, the props, the state, and
 * the slot's fields. */
export interface BagReads {
  readonly context: readonly string[];
  readonly props: readonly string[];
  /** The state name, when the build read it. */
  readonly state: boolean;
  /** The slot's fields. "*" stands for the slot read as a whole. */
  readonly slot: readonly string[];
}

/** What a read touched. The state carries no name of its own. */
export type ReadKind = "context" | "props" | "state" | "slot";

/** Records one read, so the build's dependencies are known without being
 * written by hand. */
export type ReadRecorder = (kind: ReadKind, key: string) => void;

/** The read that stands for the slot as a whole: the build took the slot
 * apart without naming a field, so every field counts. */
export const WHOLE = "*";

/** The identity of an object, as a number that never repeats. A replaced
 * array is a changed field even when its length is the same, and identity
 * is what says so. */
const identities = new WeakMap<object, number>();
let identityCount = 0;

/** A value as the key compares it: a primitive by its value, an object by
 * its identity. `String(value)` would make every object "[object Object]",
 * and a replaced field would look unchanged. The type rides along, so a
 * number and its text are not the same value. */
export function valueKey(value: unknown): string {
  if (value === null) return "n";
  if (typeof value === "string") return `s:${value}`;
  if (typeof value === "number") {
    return Number.isNaN(value) ? "d:NaN" : `d:${value}`;
  }
  if (typeof value === "boolean") return value ? "b:true" : "b:false";
  if (typeof value === "bigint") return `i:${value}`;
  if (typeof value === "undefined") return "u";
  if (typeof value === "symbol") return `y:${value.description ?? ""}`;
  // An object or a function: its identity, and nothing else. Two values
  // with the same content are different objects, and the key says so.
  const found = identities.get(value);
  if (found !== undefined) return `o:#${found}`;
  identityCount += 1;
  identities.set(value, identityCount);
  return `o:#${identityCount}`;
}

/** A slot's field, as the key compares it. The whole slot counts every
 * own field: the build took the slot apart without naming one. */
export function slotFieldKey(slot: unknown, field: string): string {
  if (typeof slot !== "object" || slot === null) {
    return field === WHOLE ? valueKey(slot) : "undefined";
  }
  if (field !== WHOLE) return valueKey(Reflect.get(slot, field));
  const parts: string[] = [];
  for (const key of Object.keys(slot)) {
    parts.push(`${key}=${valueKey(Reflect.get(slot, key))}`);
  }
  return parts.join(",");
}

/** One build's recorder and the reads it collected. A build can run
 * inside another one (a read that syncs a context field writes a signal,
 * which re-runs an effect, which builds another bag), so each build
 * collects its own reads. */
interface Recorder {
  readonly record: ReadRecorder;
  readonly reads: () => BagReads;
}

function createRecorder(): Recorder {
  const context: string[] = [];
  const props: string[] = [];
  const slot: string[] = [];
  let state = false;
  const record: ReadRecorder = (kind, key) => {
    if (kind === "context") {
      if (!context.includes(key)) context.push(key);
      return;
    }
    if (kind === "props") {
      if (!props.includes(key)) props.push(key);
      return;
    }
    if (kind === "slot") {
      if (!slot.includes(key)) slot.push(key);
      return;
    }
    state = true;
  };
  return {
    record,
    reads: () => ({
      context: [...context],
      props: [...props],
      state,
      slot: [...slot],
    }),
  };
}

const NO_READS: BagReads = { context: [], props: [], state: false, slot: [] };

/** A bag cached until the signature of the fields it reads moves. One memo
 * holds the single bag of one part (there is one root, one image, one
 * fallback per element), so a single slot is the whole cache.
 *
 * The build RECORDS what it reads, so the key that decides the next
 * rebuild is derived from the reads rather than written by hand: a part
 * that forgot to name a field can no longer go stale. */
export function memo(): {
  (
    keyOf: (reads: BagReads) => string,
    build: (record: ReadRecorder) => Record<string, unknown>,
  ): Record<string, unknown>;
} {
  let key = "";
  let bag: Record<string, unknown> | undefined;
  let reads: BagReads = NO_READS;
  return (keyOf, build) => {
    // The key comes from the reads of the LAST build, and the stored key
    // is the one from THIS build: the two agree, so a re-read of an
    // unchanged state returns the same bag.
    const next = keyOf(reads);
    if (bag !== undefined && key === next) return bag;
    const recorder = createRecorder();
    bag = build(recorder.record);
    reads = recorder.reads();
    key = keyOf(reads);
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
  const next = keyOf(hit?.reads ?? NO_READS);
  if (hit !== undefined && hit.key === next) return hit.bag;
  const recorder = createRecorder();
  const bag = build(recorder.record);
  const reads = recorder.reads();
  store.set(owner, { key: keyOf(reads), bag, reads });
  return bag;
}

/** The `dataAttr` helper: the attribute is present when the condition holds
 * and absent otherwise. */
export function dataAttr(value: boolean): string | undefined {
  return value ? "" : undefined;
}

/** The `isComposingEvent` rule: a composing keystroke is not a navigation. */
export function isComposing(event: KeyboardEvent): boolean {
  return event.isComposing === true || event.keyCode === 229;
}

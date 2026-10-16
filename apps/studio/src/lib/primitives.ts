/**
 * The components over RPC — never by importing the preset.
 *
 * The studio used to import `@spin/preset/rules/primitives/manifest.ts`
 * directly, which shipped the whole domain into the browser bundle and meant
 * the studio's component pages described the library rather than read it:
 * four pages of hand-written markup, none of it the ledger. Every consumer
 * reads the same `primitives.list`, so there is one answer to "what are the
 * button examples" and it lives with the rules.
 */

import { spinClient } from "./client.ts";

/** One example row, as the RPC surface carries it. */
export interface RpcExample {
  readonly name: string;
  readonly html: string;
}

/** One component, with its examples, in one payload. */
export interface RpcComponent {
  readonly name: string;
  readonly tags: readonly string[];
  readonly variants: readonly string[];
  /** The custom properties this component reads, so one call carries both
   * the vocabulary and what it spends. */
  readonly reads: readonly string[];
  readonly examples?: {
    readonly note: string;
    /** The line that finishes an example markup alone cannot finish. */
    readonly onLoad?: string;
    readonly rows: readonly RpcExample[];
  };
}

/** Every component, in one call. Measured at ~60 KiB for 32 components. */
export async function listPrimitives(): Promise<readonly RpcComponent[]> {
  const listed = await (await spinClient()).primitives.list({});
  return listed as readonly RpcComponent[];
}

/** One character token a component declares: its path, type, scaffold value. */
export interface RpcCharacter {
  readonly path: string;
  readonly type: string;
  /** What the token starts at — a manifest default, sometimes a reference
   * like `{border.width}` that the document resolves as authored. */
  readonly value: string;
}

/** One component's contract: vocabulary, reads, and its character tokens. */
export interface RpcContract {
  readonly tags: readonly string[];
  readonly variants: readonly string[];
  readonly reads: readonly string[];
  readonly character: readonly RpcCharacter[];
}

/**
 * A component's contract in one call — chiefly the character axis, which
 * `primitives.list` does not carry: the manifest's authored idea of what
 * `button.weight` starts at, so the component page can offer to CREATE the
 * token in themes that do not have it yet, scaffolded as authored.
 *
 * Undefined when the daemon knows no such component: the RPC spells that as
 * an error union rather than a failed call, and a page whose name does not
 * exist should reach its own "no component" fallback rather than crash on a
 * missing field.
 */
export async function primitivesContract(
  name: string,
): Promise<RpcContract | undefined> {
  const result = await (await spinClient()).primitives.contract({ name });
  if ("error" in result) return undefined;
  return result;
}

/** The custom properties a component reads, grouped by token group. */
export async function primitivesTokens(name: string) {
  return await (await spinClient()).primitives.tokens({ name });
}

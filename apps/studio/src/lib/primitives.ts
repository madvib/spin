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

/** The custom properties a component reads, grouped by token group. */
export async function primitivesTokens(name: string) {
  return await (await spinClient()).primitives.tokens({ name });
}

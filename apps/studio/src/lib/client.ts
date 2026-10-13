/**
 * The client the studio talks to.
 *
 * One address, decided once: the dev server that serves the studio also
 * mounts the API, so the studio dials a relative path on its own origin.
 * No ports, no discovery document, no `?rpc=` override — the split that
 * needed all three (studio on one port, daemon on another) is gone. The
 * studio never imports the domain for theme documents — `theme.text`
 * arrives over RPC, gets edited as text, and goes back over RPC. Tokens,
 * preview CSS, and validation all stay on the server side of this file.
 */

import { createSpinClient, type SpinClient } from "@spin/api";

/**
 * The API base, absolute against the page's own origin so it follows
 * whatever port the dev server took. Built at call time, not module scope:
 * the studio is a static bundle with no server, and the address follows
 * the page that loaded it.
 */
function rpcUrl(): string {
  // A `file://` preview or an opaque origin reports `"null"`: fall back
  // to the page URL rather than a dead origin.
  const origin = location.origin === "null" ? location.href : location.origin;
  return new URL("/__spin/rpc", origin).toString();
}

let instance: SpinClient | undefined;

/** The typed client, built once and shared. */
export async function spinClient(): Promise<SpinClient> {
  if (instance === undefined) instance = createSpinClient(rpcUrl());
  return instance;
}

/**
 * A client for another origin's mount — the app the studio previews
 * against when the two are separate servers. Uncached: the address comes
 * from the page URL and a second server is the exception, not the rule.
 */
export async function spinClientAt(url: string): Promise<SpinClient> {
  return createSpinClient(url);
}

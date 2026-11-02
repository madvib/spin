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

import { createSpinClient, type SpinClient } from "@spinjs/api/client";
import { studioRpc } from "./mount.ts";

/**
 * The host app the studio was pointed at, read once.
 *
 * `?app=` names another project's mount, and the studio's own links carry
 * paths, not queries — a rail click would otherwise drop the param and move
 * every later write to the studio's own checkout without saying so. Read at
 * load, the choice lasts the session; a reload without the param is a
 * different mode, the studio's own project, and starts over.
 */
function namedAtLoad(): string | null {
  if (typeof location === "undefined") return null;
  return new URLSearchParams(location.search).get("app");
}

/**
 * The API base, absolute against the page's own origin so it follows
 * whatever port the dev server took. Built at call time, not module scope:
 * the studio is a static bundle with no server, and the address follows
 * the page that loaded it.
 */
function rpcUrl(): string {
  // The studio is a UI; the project it edits is a host. Mounted, that host is
  // this origin. Loaded on its own dev server — which is how you work on the
  // studio with a host app — it is named by `?app=`, and every call goes
  // there, not just the overlay write. Without this the studio would edit
  // whatever project its own checkout happens to mount.
  const named = namedAtLoad();
  if (named !== null) {
    return new URL("/__spin/rpc", new URL(named)).toString();
  }
  // A `file://` preview or an opaque origin reports `"null"`: fall back
  // to the page URL rather than a dead origin.
  const origin = location.origin === "null" ? location.href : location.origin;
  return new URL(studioRpc(location.pathname), origin).toString();
}

let instance: SpinClient | undefined;

/** The typed client, built once and shared. */
export async function spinClient(): Promise<SpinClient> {
  if (instance === undefined) instance = createSpinClient(rpcUrl());
  return instance;
}

/**
 * One of the studio's own paths, still naming the host app.
 *
 * The rail's links carry paths, not queries, and a click that dropped
 * `?app=` would leave the address bar — and any reload — pointed at the
 * studio's own checkout. The param rides on the links so the URL keeps
 * saying which project is being edited.
 */
export function hostPath(path: string): string {
  const named = namedAtLoad();
  return named === null ? path : `${path}?app=${encodeURIComponent(named)}`;
}

/**
 * A client for another origin's mount — the app the studio previews
 * against when the two are separate servers. Uncached: the address comes
 * from the page URL and a second server is the exception, not the rule.
 */
export async function spinClientAt(url: string): Promise<SpinClient> {
  return createSpinClient(url);
}

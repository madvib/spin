/**
 * The daemon client the studio talks to.
 *
 * One address, decided once: the daemon the studio was started against. The
 * studio never imports the domain for theme documents — `theme.text` arrives
 * over RPC, gets edited as text, and goes back over RPC. Tokens, preview CSS,
 * and validation all stay on the daemon side of this file.
 */

import { createSpinClient, type SpinClient } from "@spin/api";

/**
 * Where the daemon listens.
 *
 * Resolved in this order: an explicit `?rpc=` on the page URL, then the
 * discovery document the daemon writes when it starts, then the default
 * port. A hardcoded address is a landmine — the port is free or it is not,
 * and a studio that cannot find its daemon should say so rather than dial a
 * dead number. Read from the DOM, not `process.env`, because this module
 * also loads under SSR and the studio renders on the client only.
 */
export const DEFAULT_DAEMON_PORT = 7463;
const DEFAULT_DAEMON_URL = `http://localhost:${DEFAULT_DAEMON_PORT}/rpc`;

/** The discovery document a running daemon publishes. */
export interface DaemonConnection {
  readonly port: number;
  readonly path: string;
}

function connectionFromUrl(): string | undefined {
  if (typeof location === "undefined") return undefined;
  const port = new URLSearchParams(location.search).get("rpc");
  return port === null ? undefined : `http://localhost:${port}/rpc`;
}

async function connectionFromDiscovery(): Promise<string | undefined> {
  if (typeof fetch !== "function") return undefined;
  try {
    const res = await fetch("/spin-connection.json", { cache: "no-store" });
    if (!res.ok) return undefined;
    const doc = (await res.json()) as Partial<DaemonConnection>;
    if (typeof doc.port !== "number") return undefined;
    return `http://localhost:${doc.port}${doc.path ?? "/rpc"}`;
  } catch {
    return undefined;
  }
}

/**
 * The daemon URL, resolved. `await`ed once at call time rather than at module
 * scope so a studio opened before the daemon is up still finds it.
 *
 * The studio talks to the daemon's ORIGIN, not a same-origin path: in
 * production the daemon serves the studio's own bundle so the two are one
 * origin and this collapses to a relative path; in development they are two
 * servers on two ports and the daemon answers the cross-origin request.
 */
export async function resolveDaemonUrl(): Promise<string> {
  return connectionFromUrl() ??
    (await connectionFromDaemon()) ??
    DEFAULT_DAEMON_URL;
}

/** Ask a daemon on the default port where it is, then trust its answer. */
async function connectionFromDaemon(): Promise<string | undefined> {
  if (typeof fetch !== "function") return undefined;
  try {
    const res = await fetch(
      `http://localhost:${DEFAULT_DAEMON_PORT}/spin-connection.json`,
      { cache: "no-store" },
    );
    if (!res.ok) return undefined;
  } catch {
    return undefined;
  }
  return `http://localhost:${DEFAULT_DAEMON_PORT}/rpc`;
}

let client: SpinClient | undefined;

/** The typed client, built once and shared against a resolved URL. */
export async function spinClient(): Promise<SpinClient> {
  if (client === undefined) client = createSpinClient(await resolveDaemonUrl());
  return client;
}

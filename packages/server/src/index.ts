/**
 * The project server: filesystem, procedures, and daemon session.
 *
 * The project owns where files are and what answers mean; the procedures
 * speak them over RPC. Consumers that serve (the daemon, the dev-server
 * mount) import this; consumers that only read shapes import `./project`.
 */

export * from "./project/index.ts";
export * from "./procedures/index.ts";
export { OVERLAY_SCRIPT } from "./overlay-client.ts";

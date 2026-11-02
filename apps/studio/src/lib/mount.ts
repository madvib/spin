/**
 * Where the studio is mounted, read from the page that loaded it.
 *
 * The same bundle serves two mounts: the plugin's `/__spin/studio/` and the
 * standalone daemon's `/studio/`. The build cannot bake either one, because
 * a published bundle runs under both — the mount is the page's own path, and
 * the API and the router are derived from it.
 */
export function studioMount(pathname: string): string {
  const at = pathname.indexOf("/studio");
  if (at >= 0) return pathname.slice(0, at + 1);
  // The studio's own dev server serves it at the root, with the host app's
  // API mounted at the plugin's path.
  return "/__spin/";
}

/** The router's base: the mount without its trailing slash. */
export function studioBase(pathname: string): string {
  return `${studioMount(pathname).replace(/\/$/, "")}/studio`;
}

/** The RPC endpoint beside the studio's mount. */
export function studioRpc(pathname: string): string {
  return `${studioMount(pathname)}rpc`;
}

/** Chromium user-data dirs the oracle creates, by name. */
export const PROFILE_PREFIX = "spin-visual-oracle-";

const OWNER = "oracle-owner";

/** An ownerless profile is only called leaked after this long. */
export const ORPHAN_GRACE_MS = 10 * 60 * 1000;

export async function claimProfile(
  profile: string,
  pid: number,
): Promise<void> {
  await Deno.writeTextFile(`${profile}/${OWNER}`, String(pid));
}

/** `PermissionDenied` means the process exists but is not ours. */
export function pidAlive(pid: number): boolean {
  try {
    Deno.kill(pid, 0);
    return true;
  } catch (error) {
    return !(error instanceof Deno.errors.NotFound);
  }
}

interface ReapOptions {
  readonly root?: string;
  readonly isAlive?: (pid: number) => boolean;
  readonly now?: () => number;
}

/** `makeTempDir` has no accessor for where it puts things. */
function systemTemp(): string {
  const probe = Deno.makeTempDirSync({ prefix: "spin-profiles-probe-" });
  const root = probe.slice(0, probe.lastIndexOf("/"));
  try {
    Deno.removeSync(probe, { recursive: true });
  } catch {
    // Stray probe dir; the answer is still correct.
  }
  return root;
}

/** Removes profiles of runs that are no longer running. */
export async function reapStaleProfiles(
  options: ReapOptions = {},
): Promise<string[]> {
  const root = options.root ?? systemTemp();
  const isAlive = options.isAlive ?? pidAlive;
  const now = options.now ?? Date.now;

  const reaped: string[] = [];
  for await (const entry of Deno.readDir(root)) {
    if (!entry.isDirectory || !entry.name.startsWith(PROFILE_PREFIX)) continue;
    const profile = `${root}/${entry.name}`;
    if (!(await isStale(profile, isAlive, now()))) continue;
    try {
      await Deno.remove(profile, { recursive: true });
      reaped.push(profile);
    } catch {
      // Gone, or still open.
    }
  }
  return reaped;
}

async function isStale(
  profile: string,
  isAlive: (pid: number) => boolean,
  now: number,
): Promise<boolean> {
  const owner = await Deno.readTextFile(`${profile}/${OWNER}`).catch(() =>
    null
  );

  if (owner === null) {
    const { mtime } = await Deno.stat(profile).catch(() => ({ mtime: null }));
    return mtime !== null && now - mtime.getTime() > ORPHAN_GRACE_MS;
  }

  const pid = Number(owner.trim());
  if (!Number.isInteger(pid)) return true;
  return !isAlive(pid);
}

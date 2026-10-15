import {
  claimProfile,
  pidAlive,
  PROFILE_PREFIX,
  reapStaleProfiles,
} from "./profiles.ts";

async function withRoot<T>(body: (root: string) => Promise<T>): Promise<T> {
  const root = await Deno.makeTempDir({ prefix: "profiles-test-" });
  try {
    return await body(root);
  } finally {
    await Deno.remove(root, { recursive: true });
  }
}

async function profile(
  root: string,
  name: string,
  pid: number,
): Promise<string> {
  const dir = `${root}/${name}`;
  await Deno.mkdir(dir, { recursive: true });
  await claimProfile(dir, pid);
  return dir;
}

async function deadPid(): Promise<number> {
  const child = new Deno.Command("true", { stdout: "null", stderr: "null" })
    .spawn();
  await child.status;
  return child.pid;
}

Deno.test("reaps a profile whose owner process is gone", async () => {
  await withRoot(async (root) => {
    const leaked = await profile(
      root,
      `${PROFILE_PREFIX}leaked`,
      await deadPid(),
    );

    const reaped = await reapStaleProfiles({ root });

    assertEquals(reaped, [leaked]);
    await assertMissing(leaked);
  });
});

Deno.test("keeps the profile of a run that is still alive", async () => {
  await withRoot(async (root) => {
    const mine = await profile(root, `${PROFILE_PREFIX}mine`, Deno.pid);
    const theirs = await profile(root, `${PROFILE_PREFIX}theirs`, 1);

    const reaped = await reapStaleProfiles({ root });

    assertEquals(reaped, []);
    await assertPresent(mine);
    await assertPresent(theirs);
  });
});

Deno.test("reaps a profile with no owner record only once it is old enough", async () => {
  await withRoot(async (root) => {
    const orphan = await Deno.makeTempDir({
      dir: root,
      prefix: `${PROFILE_PREFIX}orphan`,
    });
    const now = Date.now();

    const young = await reapStaleProfiles({ root, now: () => now });
    assertEquals(young, []);

    const old = await reapStaleProfiles({
      root,
      now: () => now + 60 * 60 * 1000 + 1,
    });
    assertEquals(old, [orphan]);
    await assertMissing(orphan);
  });
});

Deno.test("leaves alone anything that is not ours to reap", async () => {
  await withRoot(async (root) => {
    const foreign = await Deno.makeTempDir({
      dir: root,
      prefix: "something-else-",
    });
    await Deno.utime(foreign, new Date(0), new Date(0));

    const reaped = await reapStaleProfiles({ root, now: () => Date.now() });

    assertEquals(reaped, []);
    await assertPresent(foreign);
  });
});

Deno.test("does not call an unclaimed profile leaked before its time", async () => {
  await withRoot(async (root) => {
    const fresh = `${root}/${PROFILE_PREFIX}fresh`;
    await Deno.mkdir(fresh);

    const reaped = await reapStaleProfiles({ root, now: () => Date.now() });

    assertEquals(reaped, []);
    await assertPresent(fresh);
  });
});

Deno.test("a dead owner is still dead when the pid is absurd", async () => {
  await withRoot(async (root) => {
    const impossible = await profile(
      root,
      `${PROFILE_PREFIX}impossible`,
      999_999_999,
    );

    const reaped = await reapStaleProfiles({ root });

    assertEquals(reaped, [impossible]);
  });
});

Deno.test("pidAlive tells the living from the dead and from the merely foreign", async () => {
  assertEquals(pidAlive(Deno.pid), true);
  assertEquals(pidAlive(await deadPid()), false);
  assertEquals(pidAlive(1), true);
  assertEquals(pidAlive(999_999_999), false);
});

function assertEquals(got: unknown, want: unknown): void {
  const a = JSON.stringify(got);
  const b = JSON.stringify(want);
  if (a !== b) throw new Error(`got ${a}, want ${b}`);
}

async function assertMissing(path: string): Promise<void> {
  if (await exists(path)) throw new Error(`expected ${path} gone`);
}

async function assertPresent(path: string): Promise<void> {
  if (!(await exists(path))) throw new Error(`expected ${path} present`);
}

async function exists(path: string): Promise<boolean> {
  try {
    await Deno.stat(path);
    return true;
  } catch {
    return false;
  }
}

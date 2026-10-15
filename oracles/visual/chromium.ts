/**
 * Finding and launching the browser the oracle drives.
 *
 * The oracle is a local check, so the browser it uses has to be a browser
 * already on the machine: nothing here reaches the network. Discovery covers
 * the places a Chromium usually lands, and an explicit path always wins.
 */

import { CdpSocket } from "./cdp.ts";
import { PROFILE_PREFIX, claimProfile, reapStaleProfiles } from "./profiles.ts";

export interface LaunchedChromium {
  readonly socket: CdpSocket;
  close(): void;
}

export interface LaunchOptions {
  /** Explicit executable, in place of discovery. */
  readonly executable?: string;
  readonly viewport: { readonly width: number; readonly height: number };
}

/** Where a local Chromium tends to live, newest install first. */
const CHROMIUM_HOMES: readonly {
  readonly dir: string;
  /** Directories here are versions of the browser, not browsers themselves. */
  readonly executable: string;
  readonly namePrefix?: string;
}[] = [
  {
    dir: `${Deno.env.get("HOME") ?? "/home"}/.cache/puppeteer/chrome`,
    executable: "chrome-linux64/chrome",
  },
  {
    dir: `${Deno.env.get("HOME") ?? "/home"}/.cache/ms-playwright`,
    executable: "chrome-linux64/chrome",
    namePrefix: "chromium-",
  },
  {
    dir: `${
      Deno.env.get("HOME") ?? "/home"
    }/.cache/google-chrome-for-testing-headless`,
    executable: "chrome",
  },
];

const FIXED_PATHS = [
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/opt/google/chrome/chrome",
];

const LAUNCH_FLAGS = [
  "--headless=new",
  "--remote-debugging-port=0",
  // A container's /dev/shm is small enough that a full-page capture exhausts
  // it, and the oracle renders a trusted local page anyway.
  "--disable-dev-shm-usage",
  "--hide-scrollbars",
  "--mute-audio",
  "--disable-background-networking",
  "--disable-component-update",
  "--no-first-run",
  "--no-default-browser-check",
  "about:blank",
];

async function isExecutable(path: string): Promise<boolean> {
  try {
    const stat = await Deno.stat(path);
    return stat.isFile && stat.mode !== null && (stat.mode & 0o111) !== 0;
  } catch {
    return false;
  }
}

async function versionDirs(dir: string): Promise<string[]> {
  const versions: string[] = [];
  try {
    for await (const entry of Deno.readDir(dir)) {
      if (entry.isDirectory) versions.push(entry.name);
    }
  } catch {
    return [];
  }
  // Descending so a machine with several installs drives the newest one.
  return versions.sort().reverse();
}

async function discoverCandidates(
  explicit: string | undefined,
): Promise<string[]> {
  if (explicit !== undefined) return [explicit];
  const found: string[] = [];
  for (const variable of ["CHROME", "CHROMIUM_PATH"]) {
    const value = Deno.env.get(variable);
    if (value !== undefined && value !== "") found.push(value);
  }
  for (const home of CHROMIUM_HOMES) {
    for (const version of await versionDirs(home.dir)) {
      if (
        home.namePrefix !== undefined && !version.startsWith(home.namePrefix)
      ) {
        continue;
      }
      found.push(`${home.dir}/${version}/${home.executable}`);
    }
  }
  for (const path of FIXED_PATHS) found.push(path);
  const existing: string[] = [];
  for (const path of found) {
    if (await isExecutable(path)) existing.push(path);
  }
  return existing;
}

export async function launchChromium(
  options: LaunchOptions,
): Promise<LaunchedChromium> {
  const candidates = await discoverCandidates(options.executable);
  if (candidates.length === 0) {
    throw new Error(
      "no Chromium on this machine. Install one, or pass its path with --chrome.",
    );
  }
  const failures: string[] = [];
  for (const executable of candidates) {
    // The first try keeps Chromium's own sandbox; a sandbox that cannot start
    // in this environment is indistinguishable from any other launch failure,
    // so the retry is the honest way to tell the two apart.
    for (const dropSandbox of [false, true]) {
      try {
        return await launch(executable, options, dropSandbox);
      } catch (error) {
        failures.push(
          `${executable}${dropSandbox ? " (no sandbox)" : ""}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
  }
  throw new Error(`could not launch Chromium:\n${failures.join("\n")}`);
}

async function launch(
  executable: string,
  options: LaunchOptions,
  dropSandbox: boolean,
): Promise<LaunchedChromium> {
  // Leaked profiles accumulate ~320 MB each when a run dies before close().
  await reapStaleProfiles();
  const profile = await Deno.makeTempDir({ prefix: PROFILE_PREFIX });
  await claimProfile(profile, Deno.pid);
  const stop = () => {
    try {
      child.kill("SIGKILL");
    } catch {
      /* already exited */
    }
    void Deno.remove(profile, { recursive: true }).catch(() => {});
  };
  const child = new Deno.Command(executable, {
    args: [
      ...LAUNCH_FLAGS,
      ...(dropSandbox ? ["--no-sandbox"] : []),
      `--user-data-dir=${profile}`,
      `--window-size=${options.viewport.width},${options.viewport.height}`,
    ],
    stdin: "null",
    stdout: "null",
    stderr: "null",
  }).spawn();
  const port = await readDebugPort(
    `${profile}/DevToolsActivePort`,
    child,
    stop,
  );
  const version = await fetch(`http://127.0.0.1:${port}/json/version`)
    .then((response) =>
      response.json() as Promise<{ webSocketDebuggerUrl: string }>
    )
    .catch((error: unknown) => {
      stop();
      throw new Error(
        `Chromium is up but its debugging endpoint did not answer: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    });
  const socket = await CdpSocket.connect(version.webSocketDebuggerUrl).catch(
    (error: unknown) => {
      stop();
      throw error;
    },
  );
  return { socket, close: stop };
}

/** The port Chromium chose, written into the fresh profile once it is up. */
async function readDebugPort(
  portFile: string,
  child: Deno.ChildProcess,
  onDead: () => void,
): Promise<number> {
  const port = await Promise.race([
    pollPortFile(portFile, 20000),
    // A browser that died tells us more than a file that never appeared.
    child.status.then(
      (status) =>
        new Error(
          `Chromium exited with code ${status.code} before opening a port`,
        ),
      () => new Error("Chromium exited before opening a port"),
    ),
  ]).catch((error: unknown) => {
    onDead();
    throw error;
  });
  return port as number;
}

async function pollPortFile(
  portFile: string,
  timeoutMs: number,
): Promise<number> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const first = (await Deno.readTextFile(portFile)).split("\n")[0]?.trim();
      if (
        first !== undefined && first !== "" && Number.isFinite(Number(first))
      ) {
        return Number(first);
      }
    } catch {
      /* not written yet */
    }
    const { promise, resolve } = Promise.withResolvers<void>();
    setTimeout(resolve, 100);
    await promise;
  }
  throw new Error(`no debugging port appeared after ${timeoutMs}ms`);
}

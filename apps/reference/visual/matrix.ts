/**
 * The render matrix: every machine × every stem × every theme, joined at run
 * time and never transcribed.
 *
 * `components.list` carries the machines and their stems (`variants`); the
 * themes come from `project.themes.list` on the same origin. The harness
 * calls both and joins client-side: no single RPC returns both, and a list
 * kept beside the run would drift the first time an example is added.
 *
 * Plain fetch with the oRPC envelope (`{"json":{}}`), not the typed client:
 * the check runner is bun, and the envelope is the whole protocol it needs.
 */

/** One cell of the matrix: the example to open and the theme to seat. */
export interface RenderCell {
  /** The machine directory, e.g. `theme-picker`. */
  readonly machine: string;
  /** The example stem, e.g. `basic`. */
  readonly stem: string;
  /** The mount tag the daemon serves for the cell. */
  readonly mountTag: string;
  /** The theme to seat before measuring. */
  readonly theme: string;
}

/** The matrix, plus the stem sets the daemon reported (for drift checks). */
export interface RenderMatrix {
  readonly cells: readonly RenderCell[];
  /** Machine → stems, as the daemon reported them. */
  readonly reported: Readonly<Record<string, readonly string[]>>;
  /** Themes, as the daemon reported them. */
  readonly themes: readonly string[];
}

const mountOf = (machine: string, stem: string): string =>
  `${machine}-${stem}`;

async function post<T>(origin: string, path: string): Promise<T> {
  const response = await fetch(`${origin}/__spin/rpc/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: '{"json":{}}',
  });
  if (!response.ok) {
    throw new Error(`${path} answered ${response.status}`);
  }
  const parsed = (await response.json()) as { json: T };
  return parsed.json;
}

/**
 * Join the daemon's two lists into the matrix. The origin is the checked
 * app's own (`http://localhost:5199`), so the matrix describes the app
 * under check — never some other checkout's disk.
 */
export async function renderMatrix(
  origin: string,
): Promise<RenderMatrix> {
  const [listed, themes] = await Promise.all([
    post<readonly {
      readonly kind?: string;
      readonly name: string;
      readonly variants: readonly string[];
      readonly manifest?: unknown;
    }[]>(origin, "components/list"),
    post<readonly { readonly name: string }[]>(
      origin,
      "project/themes/list",
    ),
  ]);
  const themeNames = themes.map((entry) => entry.name);
  const reported: Record<string, readonly string[]> = {};
  const cells: RenderCell[] = [];
  for (const entry of listed) {
    if (entry.manifest === undefined) continue;
    const machine = entry.name;
    const stems = [...entry.variants];
    reported[machine] = stems;
    for (const stem of stems) {
      for (const theme of themeNames) {
        cells.push({ machine, stem, mountTag: mountOf(machine, stem), theme });
      }
    }
  }
  return { cells, reported, themes: themeNames };
}

/**
 * The daemon's stem sets against the build-time glob's: when the two differ
 * (dev vs published), the daemon's disk read wins and the glob call sites
 * convert — the gate never blesses two enumerations.
 */
export function globDrift(
  reported: RenderMatrix["reported"],
  globbed: Readonly<Record<string, readonly string[]>>,
): readonly string[] {
  const drift: string[] = [];
  for (const [machine, stems] of Object.entries(reported)) {
    const globbedStems = globbed[machine];
    if (globbedStems === undefined) {
      drift.push(`${machine}: daemon-only (no glob entry)`);
      continue;
    }
    const missing = stems.filter((stem) => !globbedStems.includes(stem));
    const extra = globbedStems.filter((stem) => !stems.includes(stem));
    if (missing.length > 0) {
      drift.push(`${machine}: daemon adds ${missing.join(", ")}`);
    }
    if (extra.length > 0) drift.push(`${machine}: glob adds ${extra.join(", ")}`);
  }
  for (const machine of Object.keys(globbed)) {
    if (reported[machine] === undefined) {
      drift.push(`${machine}: glob-only (no daemon entry)`);
    }
  }
  return drift;
}

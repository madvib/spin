/**
 * The shared-scale key contract: the keys themes that ship together owe each other.
 */

export interface ContractGap {
  /** The contracted scale group, e.g. `spacing` or `motion.duration`. */
  readonly group: string;
  /** The step the group owes every theme. */
  readonly key: string;
  /** The themes that do not declare it. */
  readonly missing: readonly string[];
}

export interface ContractReport {
  /** Every compared theme, sorted. */
  readonly themes: readonly string[];
  /** The steps some shipped theme does not declare. */
  readonly gaps: readonly ContractGap[];
  /** True when every key is in every theme. */
  readonly clean: boolean;
  /** The union's key count, across every contracted group. */
  readonly keys: number;
}

export interface ContractInsertion {
  /** The theme that owes the key. */
  readonly theme: string;
  /** The contracted scale group. */
  readonly group: string;
  /** The missing step. */
  readonly key: string;
  /** The JSON path to write, e.g. `spacing.4`. */
  readonly path: string;
  /** The nearest declared step before the gap, when one exists. */
  readonly before: string | null;
  /** The nearest declared step after the gap, when one exists. */
  readonly after: string | null;
}

/** The report's opening line: what clean means, in the reader's terms. */
export const CONTRACT_DEFINITION =
  "Contract: every theme you ship must declare the same scale keys — switching themes never drops a step.";

function isGroup(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** The declared steps of one group: child names, minus DTCG metadata. */
function keysOf(node: unknown): string[] {
  if (!isGroup(node)) return [];
  return Object.keys(node).filter((key) => !key.startsWith("$"));
}

function groupAt(document: unknown, path: readonly string[]): unknown {
  let node = document;
  for (const segment of path) {
    if (!isGroup(node)) return undefined;
    node = node[segment];
  }
  return node;
}

// Only these groups are read, so roles (`color.*`, per-element groups),
// `font.family`, and the designer-defined `font.style.*` names can never
// fail the contract: values and identity stay free, keys stay shared.
const SCALE_PATHS: ReadonlyArray<readonly string[]> = [
  ["spacing"],
  ["font", "size"],
  ["font", "weight"],
  ["font", "tracking"],
  ["font", "leading"],
  ["radius"],
  ["shadow"],
  ["opacity"],
  ["breakpoint"],
  ["z-index"],
];

function contractedPaths(themes: Record<string, unknown>): Array<{
  readonly group: string;
  readonly path: readonly string[];
}> {
  const paths = SCALE_PATHS.map((path) => ({
    group: path.join("."),
    path,
  }));
  const subgroups: string[] = [];
  for (const name of Object.keys(themes).sort()) {
    for (const key of keysOf(groupAt(themes[name], ["motion"]))) {
      if (!subgroups.includes(key)) subgroups.push(key);
    }
  }
  for (const key of subgroups) {
    paths.push({ group: `motion.${key}`, path: ["motion", key] });
  }
  return paths;
}

/**
 * Compare the scale keys across a shipped set.
 *
 * `themes` are the parsed documents behind the project's shipped theme
 * names. Clean means every union key is in every theme; anything else
 * lists the group, the key, and the themes lacking it.
 */
export function analyzeContract(options: {
  readonly themes: Record<string, unknown>;
}): ContractReport {
  const names = Object.keys(options.themes).sort();
  const gaps: ContractGap[] = [];
  let keys = 0;
  for (const { group, path } of contractedPaths(options.themes)) {
    const perTheme = new Map<string, Set<string>>();
    const union: string[] = [];
    const seen = new Set<string>();
    for (const name of names) {
      const own = new Set(keysOf(groupAt(options.themes[name], path)));
      perTheme.set(name, own);
      for (const key of own) {
        if (seen.has(key)) continue;
        seen.add(key);
        union.push(key);
      }
    }
    keys += union.length;
    for (const key of union) {
      const missing = names.filter((name) => !perTheme.get(name)?.has(key));
      if (missing.length > 0) gaps.push({ group, key, missing });
    }
  }
  return { themes: names, gaps, clean: gaps.length === 0, keys };
}

/**
 * Where each missing key goes, with the neighboring steps.
 *
 * The neighbors are keys, never values: the author picks the value that
 * keeps the ramp monotonic, and the tool never invents them. The ramp
 * order is the declaring theme's own document order — the theme that
 * states the step states where it sits — not an alphabetical sort, which
 * would seat `display` between `3xl` and `lg`.
 */
export function contractInsertions(options: {
  readonly report: ContractReport;
  readonly themes: Record<string, unknown>;
}): ContractInsertion[] {
  const out: ContractInsertion[] = [];
  for (const gap of options.report.gaps) {
    const path = gap.group.split(".");
    const donor = options.report.themes.find((name) =>
      keysOf(groupAt(options.themes[name], path)).includes(gap.key),
    );
    const ramp = donor === undefined
      ? [gap.key]
      : keysOf(groupAt(options.themes[donor], path));
    const at = ramp.indexOf(gap.key);
    for (const theme of gap.missing) {
      const own = keysOf(groupAt(options.themes[theme], path));
      const before =
        ramp.slice(0, at).reverse().find((key) => own.includes(key)) ??
        null;
      const after =
        ramp.slice(at + 1).find((key) => own.includes(key)) ?? null;
      out.push({
        theme,
        group: gap.group,
        key: gap.key,
        path: `${gap.group}.${gap.key}`,
        before,
        after,
      });
    }
  }
  return out;
}

/** The report as text lines: the definition first, then the gaps or clean. */
export function formatContractText(report: ContractReport): string[] {
  const lines = [CONTRACT_DEFINITION];
  if (report.clean) {
    lines.push(
      `Clean: ${report.themes.join(", ")} declare the same ${report.keys} scale key${report.keys === 1 ? "" : "s"}.`,
    );
    return lines;
  }
  for (const gap of report.gaps) {
    lines.push(
      `${gap.group}.${gap.key} is missing under ${gap.missing.join(", ")}.`,
    );
  }
  lines.push(
    `${report.gaps.length} contract gap${report.gaps.length === 1 ? "" : "s"} — switching themes drops these steps.`,
  );
  return lines;
}

/** The insertions as text lines: the path to write, between its neighbors. */
export function formatContractMigrate(
  insertions: readonly ContractInsertion[],
): string[] {
  return insertions.map(
    (insertion) =>
      `${insertion.theme}: add ${insertion.path} between ${insertion.before ?? "the start"} and ${insertion.after ?? "the end"}.`,
  );
}

/** The report as a JSON pintura: the shape CI pins. */
export function contractJson(report: ContractReport): {
  readonly status: "ok";
  readonly themes: readonly string[];
  readonly gaps: readonly {
    readonly group: string;
    readonly key: string;
    readonly missing: readonly string[];
  }[];
} {
  return {
    status: "ok",
    themes: [...report.themes],
    gaps: report.gaps.map((gap) => ({
      group: gap.group,
      key: gap.key,
      missing: [...gap.missing],
    })),
  };
}

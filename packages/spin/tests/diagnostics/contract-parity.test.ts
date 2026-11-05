import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "bun:test";
import { deepStrictEqual } from "node:assert/strict";
import { run } from "../../src/diagnostics/cli.ts";
import {
  analyzeContract,
  CONTRACT_DEFINITION,
  contractInsertions,
  contractJson,
  formatContractMigrate,
  formatContractText,
} from "../../src/diagnostics/contract-parity.ts";

/**
 * The shared-scale key contract: themes that ship together owe the same
 * scale keys, values free. The report answers per theme pair, before any
 * corpus exists — the launch report answers per corpus instead.
 */

const leaf = (value: string) => ({ $value: value, $type: "dimension" });

/** Two themes sharing every contracted key, differing only in values. */
function convergent(): Record<string, unknown> {
  const scales = {
    spacing: { "0": leaf("0"), "2": leaf("0.5rem"), "4": leaf("1rem") },
    font: {
      size: { sm: leaf("0.875rem"), md: leaf("1rem") },
      weight: { regular: leaf("400") },
      tracking: { normal: leaf("0") },
      leading: { normal: leaf("1.5") },
    },
    radius: { sm: leaf("2px"), md: leaf("4px") },
    shadow: { sm: leaf("none") },
    opacity: { "0": leaf("0"), "100": leaf("1") },
    breakpoint: { sm: leaf("640px"), md: leaf("768px") },
    "z-index": { base: leaf("0") },
    motion: {
      duration: { fast: leaf("100ms"), base: leaf("200ms") },
      easing: { linear: leaf("linear") },
    },
  };
  return {
    full: { ...scales, color: { text: leaf("#111") } },
    narrow: {
      ...structuredClone(scales),
      spacing: { "0": leaf("0"), "2": leaf("0.6rem"), "4": leaf("1.1rem") },
    },
  };
}

test("themes that share every scale key are clean", () => {
  const report = analyzeContract({ themes: convergent() });
  deepStrictEqual(report.themes, ["full", "narrow"]);
  deepStrictEqual(report.gaps, []);
  deepStrictEqual(report.clean, true);
});

test("a missing step reports the group, the key, and the themes lacking it", () => {
  const themes = convergent() as Record<string, Record<string, unknown>>;
  (themes["narrow"] as Record<string, unknown>)["spacing"] = {
    "0": leaf("0"),
    "2": leaf("0.5rem"),
  };
  const report = analyzeContract({ themes });
  deepStrictEqual(report.clean, false);
  deepStrictEqual(report.gaps, [
    { group: "spacing", key: "4", missing: ["narrow"] },
  ]);
});

test("roles and font-style names are excluded from parity", () => {
  // Identity stays free: palette roles, per-element groups, and the
  // designer-defined style names must never fail the key contract.
  const themes = convergent() as Record<string, Record<string, unknown>>;
  const full = themes["full"] as Record<string, unknown>;
  const narrow = themes["narrow"] as Record<string, unknown>;
  full["color"] = { text: leaf("#111"), accent: leaf("#c00") };
  narrow["color"] = { text: leaf("#222") };
  full["button"] = { radius: leaf("2px") };
  (full["font"] as Record<string, unknown>)["style"] = {
    body: { size: leaf("1rem") },
  };
  (narrow["font"] as Record<string, unknown>)["style"] = {
    prose: { size: leaf("1rem") },
  };
  (narrow["font"] as Record<string, unknown>)["family"] = {
    sans: leaf("system-ui"),
  };
  const report = analyzeContract({ themes });
  deepStrictEqual(report.gaps, []);
  deepStrictEqual(report.clean, true);
});

test("motion subgroups contract per subgroup", () => {
  const themes = convergent() as Record<string, Record<string, unknown>>;
  const narrow = themes["narrow"] as Record<string, unknown>;
  (narrow["motion"] as Record<string, unknown>)["duration"] = {
    fast: leaf("100ms"),
  };
  const report = analyzeContract({ themes });
  deepStrictEqual(report.gaps, [
    { group: "motion.duration", key: "base", missing: ["narrow"] },
  ]);
});

test("the contract JSON pins status, themes, and gaps", () => {
  const themes = convergent() as Record<string, Record<string, unknown>>;
  (themes["narrow"] as Record<string, unknown>)["spacing"] = {
    "0": leaf("0"),
    "2": leaf("0.5rem"),
  };
  const report = analyzeContract({ themes });
  deepStrictEqual(contractJson(report), {
    status: "ok",
    themes: ["full", "narrow"],
    gaps: [{ group: "spacing", key: "4", missing: ["narrow"] }],
  });
});

test("migrate insertions name neighbors and never values", () => {
  const themes = convergent() as Record<string, Record<string, unknown>>;
  const full = themes["full"] as Record<string, unknown>;
  const narrow = themes["narrow"] as Record<string, unknown>;
  // The declaring document states the ramp: `mid` sits between `near` and `far`.
  full["spacing"] = {
    near: leaf("0.5rem"),
    mid: leaf("1rem"),
    far: leaf("8rem"),
  };
  narrow["spacing"] = {
    near: leaf("0.5rem"),
    far: leaf("8rem"),
  };
  const report = analyzeContract({ themes });
  const insertions = contractInsertions({ report, themes });
  deepStrictEqual(insertions, [
    {
      theme: "narrow",
      group: "spacing",
      key: "mid",
      path: "spacing.mid",
      before: "near",
      after: "far",
    },
  ]);
  const text = formatContractMigrate(insertions).join("\n");
  deepStrictEqual(text.includes("8rem"), false);
  deepStrictEqual(text.includes("1rem"), false);
  deepStrictEqual(text.includes("spacing.mid"), true);
});

test("the contract reads as text: the definition first, then the gaps", () => {
  const themes = convergent() as Record<string, Record<string, unknown>>;
  (themes["narrow"] as Record<string, unknown>)["spacing"] = {
    "0": leaf("0"),
    "2": leaf("0.5rem"),
  };
  const report = analyzeContract({ themes });
  const lines = formatContractText(report);
  deepStrictEqual(lines[0], CONTRACT_DEFINITION);
  deepStrictEqual(
    lines.some((line) =>
      line.includes("spacing.4") && line.includes("narrow"),
    ),
    true,
  );
  const clean = formatContractText(
    analyzeContract({ themes: convergent() }),
  );
  deepStrictEqual(clean[0], CONTRACT_DEFINITION);
  deepStrictEqual(clean.length, 2);
});

/** A project root with the given themes, and optionally a config file. */
async function project(
  themes: Record<string, unknown>,
  config?: Record<string, unknown>,
): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "spin-cli-contract-"));
  await mkdir(join(dir, "spin"), { recursive: true });
  for (const [name, doc] of Object.entries(themes)) {
    await writeFile(join(dir, "spin", `${name}.json`), JSON.stringify(doc));
  }
  if (config !== undefined) {
    await writeFile(join(dir, "spin", "config.json"), JSON.stringify(config));
  }
  return dir;
}

test("the CLI passes convergent themes and fails divergent ones", async () => {
  const good = await project(convergent());
  try {
    const lines: string[] = [];
    const code = await run(
      ["theme", "analyze", "--contract", "full", "narrow", "--root", good],
      (line) => lines.push(line),
      () => {},
    );
    deepStrictEqual(code, 0);
    deepStrictEqual(lines[0], CONTRACT_DEFINITION);
  } finally {
    await rm(good, { recursive: true, force: true });
  }
  const themes = convergent() as Record<string, Record<string, unknown>>;
  (themes["narrow"] as Record<string, unknown>)["spacing"] = {
    "0": leaf("0"),
    "2": leaf("0.5rem"),
  };
  const bad = await project(themes);
  try {
    const lines: string[] = [];
    const code = await run(
      ["theme", "analyze", "--contract", "full", "narrow", "--root", bad],
      (line) => lines.push(line),
      () => {},
    );
    deepStrictEqual(code, 1);
    deepStrictEqual(lines[0], CONTRACT_DEFINITION);
    deepStrictEqual(
      lines.some((line) =>
        line.includes("spacing.4") && line.includes("narrow"),
      ),
      true,
    );
    const json: string[] = [];
    const jsonCode = await run(
      [
        "theme",
        "analyze",
        "--contract",
        "full",
        "narrow",
        "--root",
        bad,
        "--format",
        "json",
      ],
      (line) => json.push(line),
      () => {},
    );
    deepStrictEqual(jsonCode, 1);
    deepStrictEqual(JSON.parse(json.join("\n")), {
      status: "ok",
      themes: ["full", "narrow"],
      gaps: [{ group: "spacing", key: "4", missing: ["narrow"] }],
    });
  } finally {
    await rm(bad, { recursive: true, force: true });
  }
});

test("the contract is opt-in: no names and no flag means no contract", async () => {
  // Without the flag the shipped set is never assumed: divergent themes
  // without a config fail to read (exit 2), not to parity (exit 1).
  const themes = convergent() as Record<string, Record<string, unknown>>;
  (themes["narrow"] as Record<string, unknown>)["spacing"] = {
    "0": leaf("0"),
  };
  const dir = await project(themes);
  try {
    const warnings: string[] = [];
    const code = await run(
      ["theme", "analyze", "--contract", "--root", dir],
      () => {},
      (line) => warnings.push(line),
    );
    deepStrictEqual(code, 2);
    deepStrictEqual(
      warnings.some((line) => line.includes("contractThemes")),
      true,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("the contract reads its shipped set from the project config", async () => {
  const themes = convergent() as Record<string, Record<string, unknown>>;
  (themes["narrow"] as Record<string, unknown>)["spacing"] = {
    "0": leaf("0"),
    "2": leaf("0.5rem"),
  };
  const dir = await project(themes, { contractThemes: ["full", "narrow"] });
  try {
    const lines: string[] = [];
    const code = await run(
      ["theme", "analyze", "--contract", "--root", dir],
      (line) => lines.push(line),
      () => {},
    );
    deepStrictEqual(code, 1);
    deepStrictEqual(
      lines.some((line) =>
        line.includes("spacing.4") && line.includes("narrow"),
      ),
      true,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("migrate needs the contract, and lists insertions with neighbors", async () => {
  const dir = await project(convergent());
  try {
    const refused = await run(
      ["theme", "analyze", "--migrate", "--root", dir],
      () => {},
      () => {},
    );
    deepStrictEqual(refused, 2);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
  const themes = convergent() as Record<string, Record<string, unknown>>;
  (themes["narrow"] as Record<string, unknown>)["spacing"] = {
    "0": leaf("0"),
    "2": leaf("0.5rem"),
  };
  const bad = await project(themes);
  try {
    const lines: string[] = [];
    const code = await run(
      [
        "theme",
        "analyze",
        "--contract",
        "full",
        "narrow",
        "--migrate",
        "--root",
        bad,
      ],
      (line) => lines.push(line),
      () => {},
    );
    deepStrictEqual(code, 1);
    deepStrictEqual(
      lines.some((line) =>
        line.includes("spacing.4") && line.includes("narrow"),
      ),
      true,
    );
  } finally {
    await rm(bad, { recursive: true, force: true });
  }
});

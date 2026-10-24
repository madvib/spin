// Coverage summary from the lcov deno emits. Deno's own text reporter
// panics in this version (UTF-16 offset bug), so the task reads the lcov
// the tool DOES write and prints the per-file table. Under 95% listed.
import { readFileSync } from "node:fs";

const lcov = readFileSync(process.argv[2] ?? "coverage.lcov", "utf8");
const blocks = lcov.split("end_of_record").filter((block) =>
  block.includes("SF:")
);
const rows = blocks.map((block) => {
  const lines = [...block.matchAll(/^DA:(\d+),(\d+)/gm)];
  return {
    file: (/SF:(.*)/.exec(block)?.[1] ?? "?").split("/packages/")[1] ?? "?",
    found: lines.length,
    hit: lines.filter((line) => line[2] !== "0").length,
  };
});
const total = rows.reduce(
  (acc, row) => ({ f: acc.f + row.found, h: acc.h + row.hit }),
  { f: 0, h: 0 },
);
for (const row of rows.sort((a, b) => a.hit / a.found - b.hit / b.found)) {
  const pct = Math.round((row.hit / row.found) * 100);
  if (pct < 95) {
    console.log(
      `${String(pct).padStart(4)}%  ${row.file} (${row.hit}/${row.found})`,
    );
  }
}
console.log(
  `TOTAL: ${Math.round((total.h / total.f) * 100)}% (${total.h}/${total.f})`,
);

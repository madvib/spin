import { lintFiles } from "./src/service.ts";
import { readdir } from "node:fs/promises";
const files: string[] = [];
for (const d of ["splitter","steps","tabs","tags-input","timer","toast"]) {
  const dir = `/home/madvib/dev/spin/packages/components/src/${d}/examples`;
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (e.isFile() && e.name.endsWith(".html")) files.push(`${dir}/${e.name}`);
  }
}
const report = await lintFiles(files, undefined, { rules: ["no-redundant-class"] as any, semantic: true });
console.log("no-redundant count", report.findings.length);

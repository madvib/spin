import { lintFiles } from "./src/service.ts";
const files = ["/home/madvib/dev/spin/packages/components/src/angle-slider/examples/basic.html"];
const report = await lintFiles(files, undefined, { rules: ["closed-vocabulary"] as any, semantic: true });
console.log("count", report.findings.length);
for (const f of report.findings) console.log(f.ruleId, f.message.slice(0,80));

/**
 * The script gate: every example's <script> block typechecks.
 *
 * The plugin extracts and codegens scripts without checking them (fast
 * path — the transform runs on every build). This gate is the slow path:
 * it synthesizes a virtual module per example — the stripped script
 * written beside the example so its relative imports resolve — and runs
 * tsc --noEmit over the set. A mistyped machine arg is a build error
 * here, not a silent runtime wrong-value.
 *
 *   deno run -A scripts/script-check.ts
 *
 * The exit code is the point: this belongs beside `deno check`, not in a
 * human's memory of which args are typed.
 */

import { walk } from "@std/fs/walk";
import { extractScript, stripScript } from "../packages/syntax/src/index.ts";

const ROOT = new URL("..", import.meta.url).pathname;

async function main(): Promise<void> {
  const modules: string[] = [];
  const failures: string[] = [];
  try {
    for await (const entry of walk(ROOT + "packages/components/src", { exts: [".html"] })) {
      if (!entry.isFile) continue;
      const source = await Deno.readTextFile(entry.path);
      const body = extractScript(source);
      if (body === undefined) continue;
      const stripped = stripScript(body);
      if (stripped.stripped.length > 0) {
        failures.push(
          `${entry.path}: script has stripped statements (effects?):\n    ${stripped.stripped.join("\n    ")}`,
        );
      }
      // Beside the example, so `../slider.bindings.ts` resolves.
      const tmp = `${entry.path}.script-check.ts`;
      await Deno.writeTextFile(tmp, stripped.module);
      modules.push(tmp);
    }
    if (modules.length === 0) {
      console.log("script-check: no <script> blocks found");
      return;
    }
    const cmd = new Deno.Command("deno", {
      args: ["check", "--no-lock", ...modules],
      cwd: ROOT,
      stdout: "piped",
      stderr: "piped",
    });
    const { code, stdout, stderr } = await cmd.output();
    const out = new TextDecoder().decode(stdout) + new TextDecoder().decode(stderr);
    for (const f of failures) console.log(`FAIL ${f}`);
    if (code !== 0) {
      // Map tmp paths back to examples.
      console.log(out.replaceAll(".script-check.ts", ""));
      Deno.exit(1);
    }
    if (failures.length > 0) Deno.exit(1);
    console.log(`script-check: ${modules.length} script block(s), all clear`);
  } finally {
    for (const tmp of modules) await Deno.remove(tmp).catch(() => {});
  }
}

await main();

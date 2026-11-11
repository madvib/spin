import { test } from "bun:test";
import { deepStrictEqual } from "node:assert/strict";
import { projectComponentFiles } from "@spinjs/server/project";

test("discovery reads the local tree and refuses a specifier", async () => {
  const { mkdtemp, mkdir, writeFile } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { rejects } = await import("node:assert/strict");
  const root = await mkdtemp(join(tmpdir(), "spin-disc-"));
  await mkdir(join(root, "src/lib/components/greet"), { recursive: true });
  await writeFile(
    join(root, "package.json"),
    JSON.stringify({ name: "probe" }),
  );
  await writeFile(join(root, "src/lib/components/greet/basic.html"), "<p>hi</p>");
  deepStrictEqual(
    await projectComponentFiles(root, "src/lib/components"),
    ["src/lib/components/greet/basic.html"],
  );
  await rejects(
    projectComponentFiles(root, "@acme/kit/components"),
    /shared trees arrive through extends, not paths: '@acme\/kit\/components'/,
  );
});

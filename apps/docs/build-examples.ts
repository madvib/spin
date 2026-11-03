/**
 * Build the prebuilt framework matrix.
 *
 * Each framework gets one ESM module exporting `mount(root, subject)`. The
 * docs preview shell imports that module once and calls `mount` when the
 * selection changes; no compiler, workspace, or embed runs in a preview.
 *
 * Memory is the design constraint. Every step runs in its own process under an
 * address-space cap, no step imports a module it does not use, and the
 * stylesheet is generated from the handful of class names the subjects carry
 * rather than from a scanned source tree: feeding a whole examples corpus to
 * the generator is what took this box down.
 *
 * Usage: `bun run build-examples.ts [--only=<step>]`.
 */
import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { build } from "vite";
import { SUBJECT_HTML } from "./examples/shared.ts";

const docs = import.meta.dirname;
const repo = resolve(docs, "../..");
const out = resolve(docs, "public/examples");

const runtimeAlias = {
  find: /^@spinjs\/runtime$/,
  replacement: resolve(repo, "packages/runtime/src/index.ts"),
};

const shared = {
  configFile: false,
  root: docs,
  publicDir: false,
  logLevel: "warn" as const,
  resolve: { alias: [runtimeAlias] },
  define: { "process.env.NODE_ENV": '"production"' },
  build: {
    minify: false,
    cssCodeSplit: false,
    reportCompressedSize: false,
    sourcemap: false,
    rollupOptions: {
      output: {
        chunkFileNames: "chunks/[name]-[hash].js",
        assetFileNames: "chunks/[name]-[hash][extname]",
      },
    },
  },
};

const frameworks = {
  vanilla: "examples/vanilla/main.ts",
  solid: "examples/solid/main.tsx",
  react: "examples/react/main.tsx",
  vue: "examples/vue/main.ts",
  svelte: "examples/svelte/main.ts",
} as const satisfies Record<string, string>;

type Framework = keyof typeof frameworks;

/** Each framework's compiler, imported only in that framework's process. */
async function frameworkPlugins(name: Framework): Promise<unknown[]> {
  switch (name) {
    case "vanilla":
      return [];
    case "solid": {
      const { default: solid } = await import("vite-plugin-solid");
      return [solid()];
    }
    case "react": {
      const { default: react } = await import("@vitejs/plugin-react");
      return [react()];
    }
    case "vue": {
      const { default: vue } = await import("@vitejs/plugin-vue");
      return [vue()];
    }
    case "svelte": {
      const { svelte } = await import("@sveltejs/vite-plugin-svelte");
      return [svelte()];
    }
  }
}

async function buildFramework(name: Framework): Promise<void> {
  // Only the framework compiler runs here. The components stage is
  // deliberately absent: wired standalone into a lib build it never settles
  // (a 150s hang with no output), and the matrix does not need it — machine
  // elements are the docs page's subject, not the prebuilt preview's.
  const result = await build({
    ...shared,
    plugins: (await frameworkPlugins(name)) as never,
    build: {
      ...shared.build,
      lib: {
        entry: resolve(docs, frameworks[name]),
        formats: ["es"],
        fileName: () => "index.js",
      },
      outDir: resolve(out, name),
      emptyOutDir: true,
    },
  });
  const chunks = (
    Array.isArray(result) ? result.flatMap((r) => r.output) : result.output
  ).filter((chunk) => chunk.type === "chunk");
  if (chunks.length === 0) {
    throw new Error(`framework build emitted no chunk: ${name}`);
  }
}

/** Raw markup across all subjects so element, attribute, and class extractors all run. */
function candidates(): string {
  return Object.values(SUBJECT_HTML).join("\n");
}

async function writeCss(): Promise<void> {
  const [{ createGenerator }, { spinPreset }, { starterThemes }, list] =
    await Promise.all([
      import("@unocss/core"),
      import("../../packages/spin/src/compiler/index.ts"),
      import("../../packages/spin/src/theme/themes/index.ts"),
      candidates(),
    ]);
  const generator = await createGenerator({
    presets: [spinPreset({ themes: starterThemes })],
  });
  const generated = await generator.generate(list, {
    preflights: true,
  });
  await writeFile(resolve(out, "examples.css"), generated.css);
}

const steps: Record<string, () => Promise<void>> = {
  css: writeCss,
  ...Object.fromEntries(
    (Object.keys(frameworks) as Framework[]).map((name) => [
      name,
      () => buildFramework(name),
    ]),
  ),
};

/**
 * Run one step in its own process.
 *
 * The bound is structural, not a limit: one framework compiler per process,
 * no gallery compile, and a stylesheet generated from an explicit candidate
 * list. An address-space cap (`ulimit -v`) is not an option here — JSC
 * reserves address space it never touches, and a cap kills Bun outright.
 */
function runStep(name: string): void {
  const child = spawnSync(
    process.execPath,
    ["run", "build-examples.ts", `--only=${name}`],
    { cwd: docs, stdio: "inherit" },
  );
  if (child.status !== 0) {
    throw new Error(`examples step failed: ${name}`);
  }
}

const only = process.argv.find((arg) => arg.startsWith("--only="))?.slice(7);
if (only !== undefined && !(only in steps)) {
  throw new Error(`unknown examples step: ${only}`);
}

await mkdir(out, { recursive: true });
if (only !== undefined) {
  await steps[only]!();
} else {
  for (const name of Object.keys(steps)) {
    runStep(name);
  }
}

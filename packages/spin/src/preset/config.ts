/**
 * What an uno config that wires spin looks like, as text.
 */
export interface SpinConfigOptions {
  readonly include?: readonly string[];
}

export function spinConfig(options: SpinConfigOptions = {}) {
  return { spin: true, include: [...options.include ?? []] };
}

function scaffoldArg(options?: { themesDir?: string; componentsDir?: string; prefix?: string }): string {
  const parts: string[] = [];
  if (options?.themesDir !== undefined && options.themesDir !== "spin") {
    parts.push(`themesDir: ${JSON.stringify(options.themesDir)}`);
  }
  if (options?.componentsDir !== undefined && options.componentsDir !== "lib/components") {
    parts.push(`componentsDir: ${JSON.stringify(options.componentsDir)}`);
  }
  if (options?.prefix !== undefined && options.prefix !== "") {
    parts.push(`prefix: ${JSON.stringify(options.prefix)}`);
  }
  return parts.length ? `({ ${parts.join(", ")} })` : "()";
}

export function configScaffoldText(
  bundler: string = "vite",
  options?: { themesDir?: string; componentsDir?: string; prefix?: string },
): { filename: string; text: string } {
  const suffix = scaffoldArg(options);
  switch (bundler) {
    case "rspack":
      return {
        filename: "rspack.config.ts",
        text: `import { defineConfig } from "@rspack/cli";
import { spin } from "@spinjs/spin";

export default defineConfig({
  plugins: [spin.rspack${suffix}],
});
`,
      };
    case "webpack":
      return {
        filename: "webpack.config.js",
        text: `import { spin } from "@spinjs/spin";

export default {
  plugins: [spin.webpack${suffix}],
};
`,
      };
    case "rollup":
      return {
        filename: "rollup.config.js",
        text: `import { spin } from "@spinjs/spin";

export default {
  plugins: [spin.rollup${suffix}],
};
`,
      };
    case "rolldown":
      return {
        filename: "rolldown.config.ts",
        text: `import { spin } from "@spinjs/spin";
import { defineConfig } from "rolldown";

export default defineConfig({
  plugins: [spin.rolldown${suffix}],
});
`,
      };
    case "esbuild":
      return {
        filename: "spin.config.ts",
        text: `import { spin } from "@spinjs/spin";

export const plugins = [spin.esbuild${suffix}];
`,
      };
    case "bun":
      return {
        filename: "spin.config.ts",
        text: `import { spin } from "@spinjs/spin";

export const plugins = [spin.bun${suffix}];
`,
      };
    case "unocss":
      return {
        filename: "uno.config.ts",
        text: `import { defineConfig } from "unocss";
import { spinPreset } from "@spinjs/spin/preset";

export default defineConfig({
  presets: [spinPreset${suffix}],
});
`,
      };
    case "vite":
    default:
      return {
        filename: "vite.config.ts",
        text: `import { defineConfig } from "vite";
import { spin } from "@spinjs/spin";

export default defineConfig({
  plugins: [spin.vite${suffix}],
});
`,
      };
  }
}

export function wireConfigText(
  source: string,
  bundler: string,
  options?: { themesDir?: string; componentsDir?: string; prefix?: string },
): string {
  if (isWiredSource(source)) return source;
  const suffix = scaffoldArg(options);
  const importLine = bundler === "vite"
    ? 'import { spin } from "@spinjs/spin/vite";'
    : bundler === "unocss"
    ? 'import { spinPreset } from "@spinjs/spin/preset";'
    : 'import { spin } from "@spinjs/spin";';
  const call = bundler === "vite"
    ? `spin${suffix}`
    : bundler === "unocss"
    ? `spinPreset${suffix}`
    : `spin.${bundler}${suffix}`;
  let result = source;
  const importRegex = /^import\b[\s\S]*?;\s*$/gm;
  let lastEnd = 0;
  let m: RegExpExecArray | null;
  while ((m = importRegex.exec(result)) !== null) {
    lastEnd = m.index + m[0].length;
  }
  if (lastEnd > 0) {
    result = result.slice(0, lastEnd) + "\n" + importLine + result.slice(lastEnd);
  } else {
    result = importLine + "\n" + result;
  }
  const arrayRegex = bundler === "unocss"
    ? /presets\s*:\s*\[/
    : /plugins\s*:\s*\[/;
  if (arrayRegex.test(result)) {
    result = result.replace(arrayRegex, (match) => `${match}${call}, `);
  } else {
    const objRegex = /defineConfig\s*\(\s*\{|export\s+default\s*\{|module\.exports\s*=\s*\{/;
    result = result.replace(objRegex, (match) => `${match}\n  plugins: [${call}],`);
  }
  return result;
}

function isWiredSource(source: string): boolean {
  return /@spinjs\/spin|@spinjs\/config|spin\s*\(|spin\.(?:vite|rspack|webpack|rollup|rolldown|esbuild|bun)\s*\(|@spinjs\/preset|spinPreset/.test(
    source,
  );
}
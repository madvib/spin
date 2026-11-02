import { test } from "bun:test";
/**
 * The Uno options a project's configuration declares.
 *
 * A configuration is a module, so it is read as text. These tests are about
 * what the reader can say and what it refuses to guess: a declaration it
 * cannot read is reported as unreadable, never invented.
 */

import assert, { deepStrictEqual } from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  configurationIn,
  contentIn,
  extendsIn,
  mountIn,
  readConfiguration,
  shortcutsIn,
  themesIn,
} from "../../src/project/index.ts";

/** A root holding one configuration file. */
async function withConfig(name: string, text: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "spin-config-"));
  await writeFile(join(dir, name), text, "utf8");
  return dir;
}

const CONFIG = `import { defineConfig } from "unocss";
import { spin } from "@spinjs/config";

export default defineConfig({
  presets: [spin()],
});
`;

test("a config declares the shortcuts it composes", () => {
  const declared = shortcutsIn(
    `spin.vite({ shortcuts: { stack: "flex flex-col gap-4" } })`,
  );
  deepStrictEqual(declared.shortcuts["stack"], ["flex", "flex-col", "gap-4"]);
  deepStrictEqual(declared.unreadable, false);
});

test("a shortcut may be a list of classes", () => {
  const declared = shortcutsIn(
    `spin.vite({ shortcuts: { stack: ["flex", "flex-col"] } })`,
  );
  deepStrictEqual(declared.shortcuts["stack"], ["flex", "flex-col"]);
});

test("a table kept in the config's own constant is read", () => {
  const declared = shortcutsIn(`
const studioShortcuts = { stack: "flex flex-col gap-4" };
spin.vite({ shortcuts: studioShortcuts });
`);
  deepStrictEqual(declared.shortcuts["stack"], ["flex", "flex-col", "gap-4"]);
  deepStrictEqual(declared.unreadable, false);
});

test("a table this cannot see is reported as unreadable", () => {
  const declared = shortcutsIn(`spin.vite({ shortcuts: studioShortcuts })`);
  deepStrictEqual(declared.unreadable, true);
  deepStrictEqual(Object.keys(declared.shortcuts), []);
});

test("a shortcut whose expansion is not knowable is reported", () => {
  const declared = shortcutsIn(
    `spin.vite({ shortcuts: { stack: makeStack() } })`,
  );
  deepStrictEqual(declared.unreadable, true);
});

test("a config declares the content it scans", () => {
  const declared = contentIn(`spin.vite({
  content: { filesystem: ["src/**/*.{tsx,ts}", "index.html"] },
})`);
  deepStrictEqual(declared.globs, ["src/**/*.{tsx,ts}", "index.html"]);
  deepStrictEqual(declared.unreadable, false);
});

test("a glob the config computes is reported as unreadable", () => {
  const declared = contentIn(`spin.vite({
  content: { filesystem: ["src/**/*.{tsx,ts}", resolve(dir, "extra.ts")] },
})`);
  deepStrictEqual(declared.globs, ["src/**/*.{tsx,ts}"]);
  deepStrictEqual(declared.unreadable, true);
});

test("a config declares the app it mounts", () => {
  const declared = mountIn(`spin.vite({ mount: mountSpinApp(root) })`);
  deepStrictEqual(declared, "root");
});

test("the mounted app is named as the config names it", () => {
  const declared = mountIn(
    `spin.vite({ mount: mountSpinApp(resolve(import.meta.dirname, "../app")) })`,
  );
  deepStrictEqual(declared, 'resolve(import.meta.dirname, "../app")');
});

test("a config that mounts nothing says nothing", () => {
  deepStrictEqual(mountIn(`spin.vite({ themes: {} })`), null);
});

test("a comment cannot declare a shortcut", () => {
  const declared = shortcutsIn(`
// shortcuts: { ghost: "hidden" }
/* shortcuts: { other: "hidden" } */
spin.vite({ shortcuts: { stack: "flex" } });
`);
  deepStrictEqual(Object.keys(declared.shortcuts), ["stack"]);
});

test("a project's configuration is read from its own file", async () => {
  const dir = await withConfig(
    "vite.config.ts",
    `export default {
  spin: { shortcuts: { stack: "flex" }, content: { filesystem: ["src/**"] } },
};
`,
  );

  const declared = await readConfiguration(dir);
  deepStrictEqual(declared.file, "vite.config.ts");
  deepStrictEqual(declared.shortcuts["stack"], ["flex"]);
  deepStrictEqual(declared.content, ["src/**"]);
});

test("a project with no configuration declares none", async () => {
  const dir = await mkdtemp(join(tmpdir(), "spin-config-"));

  const declared = await readConfiguration(dir);
  deepStrictEqual(declared.file, null);
  deepStrictEqual(declared.shortcuts, {});
  deepStrictEqual(declared.content, []);
  deepStrictEqual(declared.mount, null);
  deepStrictEqual(declared.unreadable, false);
});

test("the configuration a text declares is the declaration itself", () => {
  const declared = configurationIn(CONFIG, "uno.config.ts");
  deepStrictEqual(declared.file, "uno.config.ts");
  deepStrictEqual(declared.shortcuts, {});
  deepStrictEqual(declared.unreadable, false);
});

test("a config that wires spin is read like any other", async () => {
  const dir = await withConfig("uno.config.ts", CONFIG);
  await mkdir(join(dir, "spin"), { recursive: true });

  const declared = await readConfiguration(dir);
  deepStrictEqual(declared.file, "uno.config.ts");
  assert(
    declared.unreadable === false,
    "a config this can read is not reported as unreadable",
  );
});

test("a config declares the module its brand arrives from", () => {
  const declared = extendsIn(
    `import { acmeBrand } from "@acme/brand";\nspin.vite({ extends: acmeBrand })`,
  );
  deepStrictEqual(declared, {
    kind: "brand",
    value: { source: "@acme/brand", exportName: "acmeBrand" },
  });
});

test("a default-imported brand resolves to its module", () => {
  const declared = extendsIn(
    `import acmeBrand from "./brand.ts";\nspin.vite({ extends: acmeBrand })`,
  );
  deepStrictEqual(declared, {
    kind: "brand",
    value: { source: "./brand.ts", exportName: "default" },
  });
});

test("an aliased brand resolves to the export it names", () => {
  const declared = extendsIn(
    `import { brand as acmeBrand } from "@acme/brand";\nspin.vite({ extends: acmeBrand })`,
  );
  deepStrictEqual(declared, {
    kind: "brand",
    value: { source: "@acme/brand", exportName: "brand" },
  });
});

test("an inline themes record resolves to the import it names", () => {
  const declared = extendsIn(
    `import { starterThemes } from "@spinjs/spin/theme/themes";\nspin.vite({ extends: { themes: starterThemes } })`,
  );
  deepStrictEqual(declared, {
    kind: "inline",
    record: {
      kind: "record",
      value: {
        source: "@spinjs/spin/theme/themes",
        exportName: "starterThemes",
      },
    },
  });
});

test("an inline per-key map resolves to its entries", () => {
  const declared = extendsIn(
    `import halide from "./halide.json";\nspin.vite({ extends: { themes: { halide } } })`,
  );
  deepStrictEqual(declared, {
    kind: "inline",
    record: {
      kind: "entries",
      entries: [
        {
          key: "halide",
          value: { source: "./halide.json", exportName: "default" },
        },
      ],
    },
  });
});

test("a theme named like the other option does not hijack it", () => {
  const extendsFirst = extendsIn(
    `import { acmeBrand } from "@acme/brand";\nspin.vite({ themes: { extends: acmeBrand }, extends: acmeBrand })`,
  );
  deepStrictEqual(extendsFirst?.kind, "brand");
  const themesFirst = themesIn(
    `import halide from "./halide.json";\nspin.vite({ extends: { themes: { halide } } })`,
  );
  deepStrictEqual(themesFirst, null);
});

test("an extends in no followable shape is unresolved", () => {
  deepStrictEqual(
    extendsIn(`spin.vite({ extends: makeBrand() })`),
    { kind: "unresolved" },
  );
  deepStrictEqual(
    extendsIn(`spin.vite({ extends: acmeBrand })`),
    { kind: "unresolved" },
  );
  deepStrictEqual(
    extendsIn(
      `import * as brand from "@acme/brand";\nspin.vite({ extends: brand })`,
    ),
    { kind: "unresolved" },
  );
});

test("a config without extends declares none", () => {
  deepStrictEqual(extendsIn(`spin.vite({ themes: {} })`), null);
  deepStrictEqual(configurationIn(CONFIG, "uno.config.ts").extends, null);
});

test("a config declares its verbatim themes as followable imports", () => {
  const declared = themesIn(
    `import halide from "./halide.json";\nspin.vite({ themes: { halide } })`,
  );
  deepStrictEqual(declared, {
    kind: "entries",
    entries: [
      { key: "halide", value: { source: "./halide.json", exportName: "default" } },
    ],
  });
});

test("a verbatim record names the import it arrives from", () => {
  const declared = themesIn(
    `import { myThemes } from "./themes.ts";\nspin.vite({ themes: myThemes })`,
  );
  deepStrictEqual(declared, {
    kind: "record",
    value: { source: "./themes.ts", exportName: "myThemes" },
  });
});

test("a verbatim entry that cannot be followed is kept without an import", () => {
  const declared = themesIn(`spin.vite({ themes: { mine: { color: {} } } })`);
  deepStrictEqual(declared, {
    kind: "entries",
    entries: [{ key: "mine", value: null }],
  });
  const unimported = themesIn(`spin.vite({ themes: { mine: halide } })`);
  deepStrictEqual(unimported, {
    kind: "entries",
    entries: [{ key: "mine", value: null }],
  });
});

test("a config without themes declares no verbatim map", () => {
  deepStrictEqual(themesIn(`spin.vite({})`), null);
  deepStrictEqual(
    configurationIn(CONFIG, "uno.config.ts").verbatimThemes,
    null,
  );
});

test("a directory field that is not a literal falls back and says so", () => {
  const declared = configurationIn(
    `spin.vite({ themesDir: join(root, "spin"), componentsDir: "lib/x" })`,
    "vite.config.ts",
  );
  deepStrictEqual(declared.themesDir, "spin");
  deepStrictEqual(declared.componentsDir, "lib/x");
  deepStrictEqual(declared.unreadableFields, ["themesDir"]);
});

test("readable fields name nothing unreadable", () => {
  const declared = configurationIn(
    `spin.vite({ themesDir: "spin", prefix: "acme" })`,
    "vite.config.ts",
  );
  deepStrictEqual(declared.unreadableFields, []);
  deepStrictEqual(declared.prefix, "acme");
});

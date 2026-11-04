import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { test } from "bun:test";
import assert from "node:assert/strict";
import { spin } from "../../src/plugin/plugin.ts";
import { starterThemes } from "../../src/theme/themes/index.ts";
import {
  candidatesInFile,
  checkStrictClasses,
  deadClasses,
  formatStrictClassesError,
  nearestSuggestion,
  suggestFor,
} from "../../src/plugin/strict-classes.ts";
import { describeCatalog } from "../../src/compiler/catalog.ts";
import { primitiveVariants } from "../../src/compiler/index.ts";
import { animationVariants } from "../../src/animation/index.ts";
import { parseTokens } from "../../src/theme/index.ts";

type ViteOptions = {
  configResolved?: (config: { root: string; command: string }) => void;
  resolveId?: (id: string) => string | null | Promise<string | null>;
  load?: (id: string) => Promise<string | null> | string | null;
};

async function stylesheetStage(
  stages: readonly ViteOptions[],
): Promise<ViteOptions> {
  for (const stage of stages) {
    if ((await stage.resolveId?.("uno.css")) != null) return stage;
  }
  return stages[0]!;
}

async function fixture(files: Record<string, string>): Promise<string> {
  const root = await mkdtemp(join(import.meta.dir, ".tmp-strict-"));
  await writeFile(join(root, "package.json"), JSON.stringify({ name: "probe" }));
  for (const [name, text] of Object.entries(files)) {
    const path = join(root, name);
    await mkdir(join(path, ".."), { recursive: true });
    await writeFile(path, text, "utf8");
  }
  return root;
}

function vocabulary(): Set<string> {
  const trees = Object.values(starterThemes).flatMap((document) => {
    const parsed = parseTokens(
      document as Parameters<typeof parseTokens>[0],
    );
    return parsed.ok ? [parsed.tree] : [];
  });
  return new Set([
    ...trees.flatMap((tree) =>
      describeCatalog(tree).flatMap((section) => section.utilities)
    ),
    ...primitiveVariants(),
    ...animationVariants(),
  ]);
}

test("text-text fails the production build as a dead class", async () => {
  // T5 (remove `text-text`): the catalog no longer names it, so the build
  // error treats it like any dead class — while `text-text-muted` stays
  // producible and clean.
  const root = await fixture({
    "spin/local.json": JSON.stringify(starterThemes.silk),
    "src/index.html": '<div class="bg-surface text-text">hi</div>\n',
  });
  try {
    const stages = spin.vite({
      content: { filesystem: [`${root}/src/**/*.html`] },
    }) as unknown as ViteOptions[];
    const plugin = await stylesheetStage(stages);
    plugin.configResolved?.({ root, command: "build" });
    const id = await plugin.resolveId!("uno.css");
    assert(id);
    let message = "";
    try {
      await plugin.load!(id);
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    assert.match(message, /text-text/);
    assert.match(message, /src\/index\.html/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
test("an arbitrary type size fails the production build as a dead class", async () => {
  // T2 (remove the type hatch): no rule emits `text-[14px]`, so the build
  // error treats it like any dead class — while `text-lg` stays producible
  // and clean.
  const root = await fixture({
    "spin/local.json": JSON.stringify(starterThemes.silk),
    "src/index.html": '<p class="text-lg text-[14px]">hi</p>\n',
  });
  try {
    const stages = spin.vite({
      content: { filesystem: [`${root}/src/**/*.html`] },
    }) as unknown as ViteOptions[];
    const plugin = await stylesheetStage(stages);
    plugin.configResolved?.({ root, command: "build" });
    const id = await plugin.resolveId!("uno.css");
    assert(id);
    let message = "";
    try {
      await plugin.load!(id);
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    assert.match(message, /text-\[14px\]/);
    assert.match(message, /src\/index\.html/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
test("a dead class fails the production build with file, class, and suggestion", async () => {
  const root = await fixture({
    "spin/local.json": JSON.stringify(starterThemes.silk),
    "src/index.html": '<div class="p-4 bg-primry">hi</div>\n',
  });
  try {
    const stages = spin.vite({
      content: { filesystem: [`${root}/src/**/*.html`] },
    }) as unknown as ViteOptions[];
    const plugin = await stylesheetStage(stages);
    plugin.configResolved?.({ root, command: "build" });
    const id = await plugin.resolveId!("uno.css");
    assert(id);
    let message = "";
    try {
      await plugin.load!(id);
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    assert.match(message, /bg-primry/);
    assert.match(message, /src\/index\.html/);
    assert.match(message, /bg-primary/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("the same project warns in dev and still serves the sheet", async () => {
  const root = await fixture({
    "spin/local.json": JSON.stringify(starterThemes.silk),
    "src/index.html": '<div class="p-4 bg-primry">hi</div>\n',
  });
  try {
    const warnings: string[] = [];
    const original = console.warn;
    console.warn = (message?: unknown) => {
      warnings.push(String(message));
    };
    try {
      const stages = spin.vite({
        content: { filesystem: [`${root}/src/**/*.html`] },
      }) as unknown as ViteOptions[];
      const plugin = await stylesheetStage(stages);
      plugin.configResolved?.({ root, command: "serve" });
      const id = await plugin.resolveId!("uno.css");
      assert(id);
      const css = await plugin.load!(id);
      assert(typeof css === "string" && css.length > 0);
    } finally {
      console.warn = original;
    }
    assert(
      warnings.some((warning) =>
        warning.includes("bg-primry") && warning.includes("bg-primary")
      ),
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("strictClasses: false restores silence in a production build", async () => {
  const root = await fixture({
    "spin/local.json": JSON.stringify(starterThemes.silk),
    "src/index.html": '<div class="p-4 bg-primry">hi</div>\n',
  });
  try {
    const stages = spin.vite({
      content: { filesystem: [`${root}/src/**/*.html`] },
      strictClasses: false,
    }) as unknown as ViteOptions[];
    const plugin = await stylesheetStage(stages);
    plugin.configResolved?.({ root, command: "build" });
    const id = await plugin.resolveId!("uno.css");
    assert(id);
    const css = await plugin.load!(id);
    assert(typeof css === "string" && css.length > 0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("a clean project builds with the flag at its default", async () => {
  const root = await fixture({
    "spin/local.json": JSON.stringify(starterThemes.silk),
    "src/index.html": '<div class="p-4 text-primary">hi</div>\n',
  });
  try {
    const stages = spin.vite({
      content: { filesystem: [`${root}/src/**/*.html`] },
    }) as unknown as ViteOptions[];
    const plugin = await stylesheetStage(stages);
    plugin.configResolved?.({ root, command: "build" });
    const id = await plugin.resolveId!("uno.css");
    assert(id);
    const css = await plugin.load!(id);
    assert(typeof css === "string" && css.length > 0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("icon glyphs, variant cores, and shortcuts never flag", () => {
  const vocab = vocabulary();
  const prefixes = new Set(["hover:", "focus:", "md:"]);
  assert.deepEqual(
    deadClasses({
      files: new Map([["/r/a.tsx", '<i class="i-lucide-folder"></i>']]),
      matched: new Set<string>(),
      themes: { ...starterThemes },
      root: "/r",
    }),
    [],
  );
  assert.deepEqual(
    deadClasses({
      files: new Map([["/r/a.tsx", '<div class="hover:p-4 primary"></div>']]),
      matched: new Set(["hover:p-4", "primary"]),
      themes: { ...starterThemes },
      root: "/r",
    }),
    [],
  );
  assert.deepEqual(
    deadClasses({
      files: new Map([["/r/a.tsx", '<div class="mine">x</div>']]),
      matched: new Set(["mine"]),
      themes: { ...starterThemes },
      shortcuts: { mine: "p-4 text-primary" },
      root: "/r",
    }),
    [],
  );
  assert(suggestFor("hover:p-4", prefixes, vocab) !== undefined);
  assert.equal(vocab.has("i-lucide-folder"), false);
});

test("a shortcut that spends a dead class is reported against the shortcut", () => {
  const dead = deadClasses({
    files: new Map(),
    matched: new Set(["mine"]),
    themes: { ...starterThemes },
    shortcuts: { mine: "p-4 bogus-xyz" },
    root: "/r",
  });
  assert(dead.some((entry) => entry.shortcut === "mine" && entry.cls === "bogus-xyz"));
  assert.match(
    formatStrictClassesError(dead),
    /`mine` in the project configuration expands to `bogus-xyz`/,
  );
});

test("computed class names stay silent and unexpanded groups expand", () => {
  assert.deepEqual(
    candidatesInFile("a.tsx", '<div class={`p-4 ${tone}`}>x</div>'),
    ["p-4"],
  );
  assert.deepEqual(
    candidatesInFile("a.tsx", '<div class={tone}>x</div>'),
    [],
  );
  assert(
    candidatesInFile("a.tsx", '<div class="hover:(p-4 m-2)">x</div>').includes(
      "hover:p-4",
    ),
  );
});

test("the suggestion keeps the variant and stays silent on noise", () => {
  const vocab = vocabulary();
  const prefixes = new Set(["hover:", "focus:", "md:"]);
  assert.equal(suggestFor("hover:bg-primry", prefixes, vocab), "hover:bg-primary");
  assert.equal(nearestSuggestion("xyzzy-qqq-zzz", vocab), undefined);
});

test("checkStrictClasses throws in builds and warns in dev", () => {
  const base = {
    files: new Map([["/r/a.tsx", '<div class="bogus-xyz">x</div>']]),
    matched: new Set<string>(),
    themes: { ...starterThemes },
    root: "/r",
  };
  assert.throws(
    () => checkStrictClasses({ ...base, envMode: "build", report: () => {} }),
    /bogus-xyz/,
  );
  assert.throws(
    () =>
      checkStrictClasses({
        ...base,
        strict: true,
        envMode: "dev",
        report: () => {},
      }),
    /bogus-xyz/,
  );
  const warnings: string[] = [];
  checkStrictClasses({
    ...base,
    envMode: "dev",
    report: (message) => warnings.push(message),
  });
  assert(warnings.some((warning) => warning.includes("bogus-xyz")));
  assert.doesNotThrow(() =>
    checkStrictClasses({
      ...base,
      strict: false,
      envMode: "build",
      report: () => {
        throw new Error("must stay silent");
      },
    })
  );
});

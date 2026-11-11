/**
 * Implements {@link componentsContract}. Primitives are in-memory data from
 * the manifest; machines are discovered on the filesystem — each ships
 * `examples/*.html` beside it (file stem = variant name), so the directory
 * listing IS the list.
 */

import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { implement } from "@orpc/server";
import {
  primitiveComponents,
  primitiveReadsByGroup,
} from "@spinjs/preset";
import { componentExamples } from "@spinjs/preset";
import { EXAMPLE_ONLOAD } from "../examples/index.ts";
import { componentsContract } from "./components-contract.ts";
import { prefixOf, readConfiguration } from "@spinjs/server/project";
import { writeProjectComponentsDts } from "@spinjs/server/project";
import { tagForProjectFile } from "@spinjs/components/compiler";
import { rootFor } from "@spinjs/server/procedures";

export { componentsContract };

/**
 * Every primitive a reader can browse: the ones that ship examples.
 *
 * The manifest is not that set. It also holds `a11y`, a utility family, and
 * `field`, the contract input/textarea share — neither is something a
 * gallery card can open. And it misses the components whose examples are
 * authored beside rules it does not name at all. The gallery is therefore
 * driven by what has something to show, and the manifest's tags, variants and
 * reads ride along wherever it models the same name.
 */
export function listedPrimitives(): {
  name: string;
  tags: string[];
  variants: string[];
  reads: string[];
  examples?: {
    onLoad?: string;
    note: string;
    classes?: { name: string; kind: string; description: string }[];
    rows: { name: string; html: string }[];
  };
}[] {
  return Object.values(componentExamples).map((examples) => {
    const component = primitiveComponents[examples.id];
    return {
      name: examples.id,
      tags: [...(component?.tags ?? [])],
      variants: [...(component?.variants ?? [])],
      reads: [...(component?.reads ?? [])],
      examples: {
        ...(examples.onLoad !== undefined ? { onLoad: examples.onLoad } : {}),
        ...(examples.classes !== undefined
          ? { classes: [...examples.classes] }
          : {}),
        note: examples.note,
        rows: [...examples.rows],
      },
    };
  });
}

const HERE = new URL(
  ".",
  pathToFileURL(createRequire(import.meta.url).resolve("@spinjs/components")),
);

/** `spin-tree-view` → `tree-view`: the directory prefix is packaging. */
const machineOf = (dir: string): string =>
  dir.startsWith("spin-") ? dir.slice("spin-".length) : dir;

const titleOf = (stem: string): string =>
  stem.split("-").map((word) =>
    word.length === 0 ? word : word[0]?.toUpperCase() + word.slice(1)
  ).join(" ");

interface MachineExampleRow {
  readonly name: string;
  readonly title: string;
  readonly html: string;
  readonly mountHtml: string;
  readonly stem: string;
  readonly onLoad?: string;
}

const readDir = async (dir: URL): Promise<string[]> => {
  try {
    const { readdir } = await import("node:fs/promises");
    return (await readdir(dir)).filter((entry) => entry.endsWith(".html"))
      .sort();
  } catch {
    return [];
  }
};

/** Every machine with a `examples/` directory, and its stems. */
const discover = async (): Promise<Map<string, string[]>> => {
  const { readdir } = await import("node:fs/promises");
  const found = new Map<string, string[]>();
  let dirs: string[];
  try {
    dirs = await readdir(HERE);
  } catch {
    return found;
  }
  for (const dir of dirs) {
    if (dir.includes(".") || dir === "shared") continue;
    const stems = await readDir(new URL(`./${dir}/examples/`, HERE));
    if (stems.length === 0) continue;
    found.set(
      machineOf(dir),
      stems.map((file) => file.slice(0, -".html".length)),
    );
  }
  return found;
};

const readExampleFile = async (
  machine: string,
  example: string,
): Promise<{ name: string; title: string; html: string } | null> => {
  if (
    example.includes("/") || example.includes("\\") || machine.includes("/")
  ) return null;
  try {
    const { readFile } = await import("node:fs/promises");
    let html = await readFile(
      new URL(`./${machine}/examples/${example}.html`, HERE),
      "utf8",
    );
    for (let pass = 0; pass < 8; pass += 1) {
      const m = /<include\s+file="([^"]+)"\s*\/?>/.exec(html);
      if (m === null) break;
      const target = m[1]!.replace(/^\.\//, "");
      if (target.includes("/") || target.includes("\\")) break;
      const included = await readFile(
        new URL(`./${machine}/examples/${target}`, HERE),
        "utf8",
      );
      const body = included.replace(/<script(\s[^>]*)?>[\s\S]*?<\/script>\s*/, "");
      html = html.replace(m[0], body);
    }
    return { name: example, title: titleOf(example), html };
  } catch {
    return null;
  }
};

const machineRow = async (
  machine: string,
  stem: string,
): Promise<MachineExampleRow | null> => {
  const row = await readExampleFile(machine, stem);
  if (row === null) return null;
  const onLoad = EXAMPLE_ONLOAD[`${machine}/${stem}`];
  return {
    name: row.title,
    title: row.title,
    html: row.html,
    mountHtml: `<${machine}-${stem} class="flex w-full min-w-0 flex-col items-center"></${machine}-${stem}>`,
    stem,
    ...(onLoad !== undefined ? { onLoad } : {}),
  };
};

const rewriteExampleImports = (html: string): string =>
  html.replace(
    /from\s+["']\.\.\/(?:\.\.\/)?[^"']*?([^/"']+)\.(?:presentation|controller-def)\.ts["']/g,
    (_match, _stem) => `from "@spinjs/components"`,
  );
type ComponentManifest = {
  readonly parts: string[];
  readonly slots: string[];
  readonly readers: string[];
  readonly methods: string[];
  readonly commands: string[];
  readonly events: string[];
};

const EMPTY_MANIFEST: ComponentManifest = {
  parts: [],
  slots: [],
  readers: [],
  methods: [],
  commands: [],
  events: [],
};

const camelOf = (name: string): string =>
  name.split("-").map((word, i) =>
    i === 0
      ? word
      : word.length === 0
      ? word
      : word[0]?.toUpperCase() + word.slice(1)
  ).join("");

let catalogCache: Record<string, unknown> | undefined;
const manifestOf = async (name: string): Promise<ComponentManifest> => {
  catalogCache ??= await import("@spinjs/components").catch(() => ({}));
  const rec = catalogCache;
  const handle = rec[camelOf(name)] as {
    readonly manifest?: Partial<ComponentManifest>;
  } | undefined;
  if (handle?.manifest !== undefined) {
    const m = handle.manifest;
    return {
      parts: [...(m.parts ?? [])],
      slots: [...(m.slots ?? [])],
      readers: [...(m.readers ?? [])],
      methods: [...(m.methods ?? [])],
      commands: [...(m.commands ?? [])],
      events: [...(m.events ?? [])],
    };
  }
  const sibling = rec[`${camelOf(name)}Manifest`] as
    | Partial<ComponentManifest>
    | undefined;
  if (sibling !== undefined) {
    return {
      parts: [...(sibling.parts ?? [])],
      slots: [...(sibling.slots ?? [])],
      readers: [...(sibling.readers ?? [])],
      methods: [...(sibling.methods ?? [])],
      commands: [...(sibling.commands ?? [])],
      events: [...(sibling.events ?? [])],
    };
  }
  return EMPTY_MANIFEST;
};

const readsCache = new Map<string, string[]>();

const machineReads = async (name: string): Promise<string[]> => {
  const cached = readsCache.get(name);
  if (cached !== undefined) return [...cached];
  const found = await discover();
  const stems = found.get(name) ?? [];
  const classes = new Set<string>();
  const runtime = await import("@spinjs/components/runtime").catch(() => undefined);
  if (runtime === undefined) {
    readsCache.set(name, []);
    return [];
  }
  const { classTokens, parse } = runtime;
  for (const stem of stems) {
    const row = await readExampleFile(name, stem);
    if (row === null) continue;
    // The script and scope blocks are machine wiring, not markup: the
    // classes the component spends are the markup's. Same strip the
    // class check uses, so the two agree on what an example spends.
    const stripped = row.html
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/<script(\s[^>]*)?>[\s\S]*?<\/script>\s*/g, "")
    for (const token of classTokens(parse(stripped))) classes.add(token);
  }
  if (classes.size === 0) {
    readsCache.set(name, []);
    return [];
  }
  const { createGenerator } = await import("@unocss/core");
  const { spinPreset } = await import("@spinjs/preset");
  const { starterThemes } = await import("@spinjs/theme/themes");
  const generator = await createGenerator({
    presets: [spinPreset({ themes: starterThemes })],
  });
  const { css } = await generator.generate(classes, { preflights: false });
  const vars = new Set<string>();
  for (const match of css.matchAll(/var\(\s*(--[^,)]+)/g)) {
    vars.add(match[1]!);
  }
  const reads = [...vars].sort();
  readsCache.set(name, reads);
  return reads;
};

/** `component-` / `spin-` prefixes are caller shorthand, never storage. */
const bareName = (name: string): string =>
  name.replace(/^(?:component-|spin-)/, "");

/**
 * The moniker a machine's tag carries: the served project's own, or a
 * wildcard when the call is about no project (or one that names nothing).
 * A tag is where a component lands in a user's document, so it carries
 * their moniker — never the catalog's.
 */
const tagMoniker = async (input: Record<string, unknown>): Promise<string> => {
  try {
    return (await prefixOf(rootFor(input))) ?? "*";
  } catch {
    return "*";
  }
};

const os = implement(componentsContract);

const list = os.components.list.handler(async ({ input }) => {
  const moniker = await tagMoniker(input);
  const primitives = listedPrimitives().map((entry) => ({
    kind: "primitive" as const,
    name: entry.name,
    tags: entry.tags,
    variants: entry.variants,
    reads: entry.reads,
    ...(entry.examples !== undefined ? { examples: entry.examples } : {}),
  }));
  const found = await discover();
  const machines = await Promise.all(
    [...found.entries()].map(async ([name, stems]) => {
      const reads = await machineReads(name);
      const rows: MachineExampleRow[] = [];
      for (const stem of stems) {
        const row = await machineRow(name, stem);
        if (row !== null) rows.push(row);
      }
      return {
        kind: "machine" as const,
        name,
        tags: [`${moniker}-${name}`],
        variants: [...stems],
        reads,
        manifest: await manifestOf(name),
        examples: {
          note:
            "Interactive machine component. Requires the runtime (@spinjs/components/runtime).",
          rows,
        },
      };
    }),
  );
  return [...primitives, ...machines];
});

const contract = os.components.contract.handler(async ({ input }) => {
  const name = bareName(input.name);
  const primitive = primitiveComponents[name] ?? primitiveComponents[input.name];
  if (primitive !== undefined) {
    const examples = componentExamples[primitive.name];
    return {
      kind: "primitive" as const,
      name: primitive.name,
      tags: [...primitive.tags],
      variants: [...primitive.variants],
      reads: [...primitive.reads],
      component: [...primitive.component],
      ...(examples !== undefined
        ? {
          examples: {
            ...(examples.onLoad !== undefined
              ? { onLoad: examples.onLoad }
              : {}),
            ...(examples.classes !== undefined
              ? { classes: [...examples.classes] }
              : {}),
            note: examples.note,
            rows: [...examples.rows],
          },
        }
        : {}),
    };
  }
  const found = await discover();
  const stems = found.get(name);
  if (stems === undefined) return { error: `Unknown component: ${input.name}` };
  const reads = await machineReads(name);
  const moniker = await tagMoniker(input);
  const rows: MachineExampleRow[] = [];
  for (const stem of stems) {
    const row = await machineRow(name, stem);
    if (row !== null) rows.push(row);
  }
  return {
    kind: "machine" as const,
    name,
    tags: [`${moniker}-${name}`],
    variants: [...stems],
    reads,
    manifest: await manifestOf(name),
    examples: {
      note:
        "Interactive machine component. Requires the runtime (@spinjs/components/runtime).",
      rows,
    },
  };
});

const tokens = os.components.tokens.handler(async ({ input }) => {
  const all = primitiveReadsByGroup();
  const merged: Record<string, Set<string>> = {};
  for (const [group, names] of Object.entries(all)) {
    merged[group] = new Set(names);
  }
  if (input.name === undefined) {
    const found = await discover();
    for (const name of found.keys()) {
      for (const read of await machineReads(name)) {
        const group = read.slice("--".length).split("-")[0] ?? read;
        (merged[group] ??= new Set()).add(read);
      }
    }
    return {
      reads: Object.fromEntries(
        Object.entries(merged).map(([group, names]) => [group, [...names]]),
      ),
    };
  }
  const name = bareName(input.name);
  const primitive = primitiveComponents[name] ??
    primitiveComponents[input.name];
  if (primitive !== undefined) {
    const wanted: ReadonlySet<string> = new Set(primitive.reads);
    const filtered: Record<string, string[]> = {};
    for (const [group, names] of Object.entries(all)) {
      const matching = names.filter((token) => wanted.has(token));
      if (matching.length > 0) filtered[group] = matching;
    }
    return { reads: filtered };
  }
  const reads = await machineReads(name);
  const grouped: Record<string, string[]> = {};
  for (const read of reads) {
    const group = read.slice("--".length).split("-")[0] ?? read;
    (grouped[group] ??= []).push(read);
  }
  return { reads: grouped };
});

const examples = os.components.examples.handler(async ({ input }) => {
  const name = bareName(input.name);
  const found = await discover();
  const stems = found.get(name) ?? [];
  const rows: MachineExampleRow[] = [];
  for (const stem of stems) {
    const row = await machineRow(name, stem);
    if (row !== null) rows.push(row);
  }
  return { examples: rows };
});

const copy = os.components.copy.handler(async ({ input }) => {
  const name = bareName(input.name);
  const found = await readExampleFile(name, input.example);
  if (found === null) {
    return {
      file: null,
      tag: null,
      error: `Unknown example: ${input.name}/${input.example}`,
    };
  }
  try {
    const { mkdir, writeFile } = await import("node:fs/promises");
    const { join } = await import("node:path");
    // The caller's project, or the daemon's own — one process serves many
    // projects, so the root rides the call the way project.* carries it.
    const root = rootFor(input);
    const config = await readConfiguration(root);
    // The copy lands in the project's own tree, which is always local:
    // shared trees arrive through `extends`, never through this path.
    const componentsDir = config.componentsDir;
    const file = join(componentsDir, name, `${input.example}.html`);
    await mkdir(join(root, componentsDir, name), { recursive: true });
    await writeFile(
      join(root, file),
      rewriteExampleImports(found.html),
      "utf8",
    );
    const moniker = (await prefixOf(root)) ?? "*";
    const tag = tagForProjectFile(
      join(root, file),
      componentsDir,
      moniker,
    );
    await writeProjectComponentsDts(
      root,
      {
        componentsDir,
        ...(moniker !== "*" ? { prefix: moniker } : {}),
      },
      { onlyIfSrcExists: true },
    );
    return { file, tag, error: null };
  } catch (err) {
    return {
      file: null,
      tag: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
});

const reads = os.components.reads.handler(async ({ input }) => {
  const name = bareName(input.name);
  return { reads: await machineReads(name) };
});

export const componentsRouter = os.router({
  components: {
    list,
    contract,
    tokens,
    examples,
    copy,
    reads,
  },
});

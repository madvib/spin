/**
 * Implements {@link componentsContract}. Discovery is the filesystem:
 * each machine ships `examples/*.html` beside it (file stem = variant
 * name), so the directory listing IS the list — no index, no map.
 */

import { implement } from "@orpc/server";

import { componentsContract } from "./components-contract.ts";
import * as catalog from "@spinjs/components";

export { componentsContract };

const HERE = new URL("../../components/src/", import.meta.url);

/** `spin-tree-view` → `tree-view`: the directory prefix is packaging. */
const machineOf = (dir: string): string =>
  dir.startsWith("spin-") ? dir.slice("spin-".length) : dir;

const titleOf = (stem: string): string =>
  stem.split("-").map((word) =>
    word.length === 0 ? word : word[0]?.toUpperCase() + word.slice(1)
  ).join(" ");

interface ExampleRow {
  readonly name: string;
  readonly title: string;
  readonly html: string;
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

const readExample = async (
  machine: string,
  example: string,
): Promise<ExampleRow | null> => {
  if (
    example.includes("/") || example.includes("\\") || machine.includes("/")
  ) return null;
  try {
    const { readFile } = await import("node:fs/promises");
    const html = await readFile(
      new URL(`./${machine}/examples/${example}.html`, HERE),
      "utf8",
    );
    return { name: example, title: titleOf(example), html };
  } catch {
    return null;
  }
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

const manifestOf = (name: string): ComponentManifest => {
  const rec = catalog as unknown as Record<string, unknown>;
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

const os = implement(componentsContract);

const list = os.components.list.handler(async () => {
  const found = await discover();
  return [...found.entries()].map(([name, examples]) => ({
    name,
    examples,
    manifest: manifestOf(name),
  }));
});

const examples = os.components.examples.handler(async ({ input }) => {
  const found = await discover();
  const stems = found.get(input.name) ?? [];
  const rows: ExampleRow[] = [];
  for (const stem of stems) {
    const row = await readExample(input.name, stem);
    if (row !== null) rows.push(row);
  }
  return { examples: rows };
});

const copy = os.components.copy.handler(async ({ input }) => {
  const found = await readExample(input.name, input.example);
  if (found === null) {
    return {
      file: null,
      error: `Unknown example: ${input.name}/${input.example}`,
    };
  }
  try {
    const { mkdir, writeFile } = await import("node:fs/promises");
    const { join } = await import("node:path");
    // The caller's project, or the daemon's own — one process serves many
    // projects, so the root rides the call the way project.* carries it.
    const root = input.root ?? ".";
    const file = join("spin", input.name, `${input.example}.html`);
    await mkdir(join(root, "spin", input.name), { recursive: true });
    await writeFile(
      join(root, file),
      rewriteExampleImports(found.html),
      "utf8",
    );
    return { file, error: null };
  } catch (err) {
    return {
      file: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
});

export const componentsRouter = os.router({
  components: {
    list,
    examples,
    copy,
  },
});

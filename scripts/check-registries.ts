/**
 * Every component that ships an element is in the runtime's registry, and
 * every registry entry resolves to a package the public entry can reach.
 *
 * Why this exists, borrowed from ark's `check-anatomy`: a machine and its
 * element drift apart silently. A component package gets written, its `define`
 * call works, its own tests pass — and nothing ever resolves `use:tree`,
 * because the registry was never told the name. The failure surfaces in a
 * browser, as an element that renders inert, long after the code that caused
 * it stopped being edited. A machine in the registry with no package behind it
 * fails the same way in the other direction: a name that resolves to nothing,
 * and no import error to point at the typo that caused it.
 *
 * Two directions, because one is not enough. A package missing from the
 * registry renders nothing when markup names it. A registry entry with no
 * package behind it resolves to a broken import the moment anything uses it.
 * Neither is visible from the package's own tests, which is exactly why this
 * is a gate rather than a review note.
 *
 * The registry is read as text, never imported. Importing it would execute
 * every component's `define` call, and `customElements.define` needs a DOM —
 * the gate would fail for a reason that has nothing to do with what it checks.
 *
 *     deno task check:registries
 */

import {
  allManifests,
  elementRegistrations,
  importSpecifiers,
  makeResolver,
  readJson,
  relative,
  report,
  ROOT,
  workspacePackages,
  type PackageManifest,
  type WorkspacePackage,
} from "./lib/packages.ts";

/** Where the closed machine registry lives, per PLAN §5 rule 3. */
const REGISTRY = new URL("packages/runtime/src/registry.ts", ROOT);

/** Names a registry module may use for its exported record. */
const REGISTRY_NAMES = ["registry", "machines"] as const;

interface RegistryEntry {
  /** The tag or machine name the registry maps. */
  readonly key: string;
  readonly line: number;
}

/** The runtime's public entry, plus every subpath its `deno.json` exports. */
async function publicEntries(): Promise<URL[]> {
  const runtimeManifest = await readJson(
    new URL("packages/runtime/deno.json", ROOT),
  ) as PackageManifest | undefined;
  const entries = [new URL("packages/runtime/src/index.ts", ROOT)];
  for (const target of Object.values(runtimeManifest?.exports ?? {})) {
    entries.push(new URL(`packages/runtime/${target}`, ROOT));
  }
  return [...new Set(entries.map((url) => url.href))].map((href) => new URL(href));
}

/**
 * Extracts the top-level keys of a registry record from its source text.
 *
 * Brace-matched so a nested object — a per-machine config — does not contribute
 * its keys, and string-aware so a `}` inside a machine name or a doc comment
 * does not end the record early.
 */
function parseRegistryKeys(source: string): RegistryEntry[] {
  // The record may carry a type annotation — `Record<string, () => Promise<unknown>>`
  // is the natural one — and that annotation contains `=>`, so the search is
  // for the first `=` that is not part of an arrow, rather than for the first
  // `=` at all.
  const declaration = new RegExp(
    `export\\s+const\\s+(?:${REGISTRY_NAMES.join("|")})\\b[^;]*?=(?!>)\\s*(?:as\\s+[A-Za-z_$][\\w$<>,\\[\\] ]*\\s*)?\\{`,
  ).exec(source);
  if (declaration === null) return [];

  const open = declaration.index + declaration[0].length - 1;
  let depth = 0;
  let quote: string | undefined;
  let lineComment = false;
  let blockComment = false;
  let end = open;
  for (let i = open; i < source.length; i++) {
    const char = source[i];
    const next = source[i + 1];
    if (lineComment) {
      if (char === "\n") lineComment = false;
      continue;
    }
    if (blockComment) {
      if (char === "*" && next === "/") {
        blockComment = false;
        i++;
      }
      continue;
    }
    if (quote !== undefined) {
      if (char === "\\") i++;
      else if (char === quote) quote = undefined;
      continue;
    }
    if (char === "/" && next === "/") {
      lineComment = true;
      i++;
      continue;
    }
    if (char === "/" && next === "*") {
      blockComment = true;
      i++;
      continue;
    }
    if (char === '"' || char === "'" || char === "`") {
      quote = char;
      continue;
    }
    if (char === "{") depth++;
    else if (char === "}") {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }

  const body = source.slice(open + 1, end);
  const keys: RegistryEntry[] = [];
  let nesting = 0;
  let cursor = 0;
  const keyPattern = /^\s*(?:(["'`])([a-z][a-z0-9-]*)\1|([a-z][a-z0-9-]*))\s*[:,]/;
  while (cursor < body.length) {
    const char = body[cursor];
    if (char === '"' || char === "'" || char === "`") {
      const close = body.indexOf(char, cursor + 1);
      cursor = close === -1 ? body.length : close + 1;
      continue;
    }
    if (char === "{" || char === "[" || char === "(") {
      nesting++;
      cursor++;
      continue;
    }
    if (char === "}" || char === "]" || char === ")") {
      nesting--;
      cursor++;
      continue;
    }
    if (nesting === 0) {
      const rest = body.slice(cursor);
      const match = keyPattern.exec(rest);
      if (match !== null) {
        keys.push({
          key: match[2] ?? match[3],
          line: source.slice(0, open + 1 + cursor).split("\n").length,
        });
        cursor += match[0].length;
        continue;
      }
    }
    cursor++;
  }
  return keys;
}

/** Every `.ts` file reachable from the runtime's public entries. */
async function reachableSources(): Promise<Set<string>> {
  // An `imports` entry is relative to the manifest that declares it, so each
  // manifest contributes its own scoped map: the root's resolves against the
  // root, a package's against that package.
  const scoped: { base: URL; entries: Record<string, string> }[] = [];
  for (const manifestUrl of await allManifests()) {
    const manifest = await readJson(manifestUrl) as PackageManifest | undefined;
    if (!manifest?.imports) continue;
    scoped.push({ base: new URL(".", manifestUrl), entries: manifest.imports });
  }

  const resolve = makeResolver(scoped);
  const seen = new Set<string>();
  const queue = await publicEntries();
  for (const entry of queue) seen.add(entry.pathname);
  while (queue.length > 0) {
    const current = queue.pop()!;
    let source: string;
    try {
      source = await Deno.readTextFile(current);
    } catch {
      continue;
    }
    for (const specifier of importSpecifiers(source)) {
      const target = resolve(specifier, current);
      if (target === undefined || seen.has(target.pathname)) continue;
      seen.add(target.pathname);
      queue.push(target);
    }
  }
  return seen;
}

/** A component package: one whose source calls `define(tag, spec)`. */
/** One component package, with the tags it registers and any dynamic call. */
interface ComponentEntry {
  pkg: WorkspacePackage;
  tags: string[];
  dynamic: string[];
}

async function componentPackages(): Promise<ComponentEntry[]> {
  const components: ComponentEntry[] = [];
  for (const pkg of await workspacePackages()) {
    const registrations = await elementRegistrations(pkg);
    if (registrations.length === 0) continue;
    const tags: string[] = [];
    const dynamic: string[] = [];
    for (const registration of registrations) {
      if (registration.tag === undefined) {
        dynamic.push(`${relative(registration.file)}:${registration.position}`);
        continue;
      }
      tags.push(registration.tag);
    }
    components.push({ pkg, tags, dynamic });
  }
  return components;
}

async function main(): Promise<void> {
  const components = await componentPackages();
  const findings: string[] = [];

  for (const { dynamic } of components) {
    for (const site of dynamic) {
      findings.push(
        `${site}: define() called with a tag this gate cannot read statically. ` +
          `The registry is text-parsed, so the tag has to be a literal.`,
      );
    }
  }

  // (a) Every component's tag is in the registry.
  const registrySource = await Deno.readTextFile(REGISTRY).catch(() => undefined);
  if (registrySource === undefined) {
    for (const { pkg, tags } of components) {
      findings.push(
        `${relative(REGISTRY)} does not exist, so <${tags.join(">, <")}> from ` +
          `packages/${pkg.stem} cannot be resolved by name. The closed machine registry is what ` +
          `turns ` + "`use:tree`" + ` into an element; without it, markup naming a component ` +
          `renders nothing.`,
      );
    }
  }
  const registered = registrySource === undefined ? [] : parseRegistryKeys(registrySource);
  if (registrySource !== undefined && registered.length === 0) {
    findings.push(
      `${relative(REGISTRY)} exports no readable registry record. This gate reads a ` +
        `\`export const registry = { … }\` (or \`machines\`) object literal; a computed or ` +
        `imported record cannot be checked statically and will not be noticed.`,
    );
  }
  const registeredKeys = new Set(registered.map((entry) => entry.key));

  for (const { pkg, tags } of components) {
    for (const tag of tags) {
      if (!registeredKeys.has(tag)) {
        findings.push(
          `packages/${pkg.stem} defines <${tag}> but ${relative(REGISTRY)} has no "${tag}" entry. ` +
            `Markup naming it will resolve to nothing — add the entry.`,
        );
      }
    }
  }

  // …and in the other direction: every registry entry has a package behind it.
  const shippedTags = new Set(components.flatMap((component) => component.tags));
  for (const entry of registered) {
    if (!shippedTags.has(entry.key)) {
      findings.push(
        `${relative(REGISTRY)}:${entry.line} registers "${entry.key}", but no package under ` +
          `packages/ defines an element with that tag. A registry entry with no package behind ` +
          `it is a broken import waiting for the first markup that names it.`,
      );
    }
  }

  // (b) Every component is reachable from the runtime's public entry.
  const reachable = await reachableSources();
  for (const { pkg, tags } of components) {
    if (pkg.stem === "runtime") continue;
    const entry = pkg.sources.find((source) => reachable.has(source.pathname));
    if (entry !== undefined) continue;
    findings.push(
      `packages/${pkg.stem} defines <${tags.join(">, <")}> but nothing in its source is reachable ` +
        `from packages/runtime/src/index.ts. A component the public entry cannot reach is ` +
        `published but not loadable — export it from the runtime entry or add the import to the ` +
        `workspace imports in deno.json.`,
    );
  }

  const componentCount = components.length;
  report(
    "registries",
    findings,
    componentCount === 0
      ? `No component packages yet: nothing under packages/ calls define(), so there is nothing ` +
        `to register and nothing to reach. This gate passes trivially — it starts meaning ` +
        `something when the first @spin/<component> lands.`
      : `${componentCount} component package${componentCount === 1 ? "" : "s"}, ` +
        `${shippedTags.size} element tag${shippedTags.size === 1 ? "" : "s"}, all in ` +
        `${relative(REGISTRY)} and all reachable from packages/runtime/src/index.ts.`,
  );
}

if (import.meta.main) await main();
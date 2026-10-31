/**
 * The example gallery: every example recipe as text, by machine and stem,
 * and every example registered as its own element.
 *
 * The gallery is what reference, docs, and studio all read when they show
 * the machine components: a machine with examples to show is listed, named,
 * and rendered, and one without them is not. One module, so the three apps
 * never maintain three manifests. Importing it — for names or for its side
 * effect — also registers every `<machine-stem>` element through the
 * compiled twin below, so the mount tags upgrade in the importing window.
 */

const sources = import.meta.glob<string>(
  "./*/examples/*.html",
  { eager: true, query: "?raw", import: "default" },
);

// Compiled: each example is its own element, registered by the element
// transform as a side effect. Same glob, no `?raw`.
import.meta.glob("./*/examples/*.html", { eager: true });

/** One example recipe: its stem and its source text. */
export interface ExampleSource {
  readonly stem: string;
  readonly html: string;
}

/** The machine-qualified mount tag for a machine and stem. */
export function mountTag(machine: string, stem: string): string {
  return `${machine}-${stem}`;
}

/** Every example, grouped by machine directory name. */
export function exampleSources(): Map<string, readonly ExampleSource[]> {
  const grouped = new Map<string, ExampleSource[]>();
  const byPath = new Map<string, string>(Object.entries(sources));
  const expand = (machine: string, html: string): string => {
    let out = html;
    for (let pass = 0; pass < 8; pass += 1) {
      const m = /<include\s+file="([^"]+)"\s*\/?>/.exec(out);
      if (m === null) break;
      const target = m[1]!.replace(/^\.\//, "");
      const key = `./${machine}/examples/${target}`;
      const included = byPath.get(key);
      if (included === undefined) break;
      const body = included.replace(/<script(\s[^>]*)?>[\s\S]*?<\/script>\s*/, "");
      out = out.replace(m[0], body);
    }
    return out;
  };
  for (const [path, html] of Object.entries(sources)) {
    const machine = path.split("/").at(-3) ?? "";
    const stem = path.split("/").at(-1)?.slice(0, -".html".length) ?? path;
    if (machine === "" || stem === "") continue;
    const group = grouped.get(machine) ?? [];
    group.push({ stem, html: expand(machine, html) });
    grouped.set(machine, group);
  }
  for (const [machine, group] of grouped) {
    grouped.set(
      machine,
      [...group].sort((a, b) => a.stem.localeCompare(b.stem)),
    );
  }
  return grouped;
}

/** The machine names that ship examples, sorted. */
export function exampleMachines(): readonly string[] {
  return [...exampleSources().keys()].sort();
}

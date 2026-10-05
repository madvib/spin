/**
 * Every `@zag-js/*` in the workspace pins one version, and it is a range.
 *
 * Why this exists, borrowed from ark's `check-zag-versions`: Zag machines are
 * coupled packages, not independent ones. `@zag-js/tree-view` resolves its
 * context through `@zag-js/core` and shares the `Service` type with it; two
 * copies of core in one graph means two module instances, two `WeakMap`s, two
 * sets of private fields on the same object. Nothing throws at import time. The
 * machine constructs, `connect` runs, and the failure appears as a context
 * that is subtly not the one the machine wrote to — a value that reads stale,
 * an event that resolves to `undefined`. Exactly the failure PLAN §2 says cost
 * a day on the bridge, arriving for a different reason.
 *
 * The second half of the rule is the range. `1.44.0` exact is one version. A
 * caret is a promise about the future that nobody audits, and Zag ships minor
 * releases that touch machine internals. This workspace has already committed
 * both forms: the root `deno.json` pins `1.44.0` exact, `packages/runtime`
 * pins `~1.44.0`. That is the finding this gate exists to name, so it is
 * reported as one rather than normalized away.
 *
 *     deno task check:zag-versions
 */

import {
  allManifests,
  readJson,
  relative,
  report,
  type PackageManifest,
} from "./lib/packages.ts";

/** One `@zag-js/*` pin, and where it was written. */
interface Pin {
  readonly package: string;
  readonly version: string;
  /** The manifest that declares it, relative to the worktree root. */
  readonly source: string;
}

/**
 * The release a specifier names, with any range operator stripped: `~1.44.0`
 * and `1.44.0` both name release 1.44.0. A range does not name a release, so
 * the separate floating-pin finding is what reports the operator as the
 * problem; this only answers "which release is it".
 */
function releaseOf(specifier: string): string {
  const version = specifier.replace(/^(?:npm|jsr):/, "").split("@").pop() ?? "";
  return version.replace(/^[\^~><=\s]+/, "");
}

/** The operator a specifier floats with, or `"exact"`. */
function operatorOf(specifier: string): string {
  const version = specifier.replace(/^(?:npm|jsr):/, "").split("@").pop() ?? "";
  if (version === "" || version === "*") return "floating";
  return /^[\^~><=]/.test(version) ? version[0] : "exact";
}

async function main(): Promise<void> {
  const pins: Pin[] = [];
  const packages = new Set<string>();

  for (const manifestUrl of await allManifests()) {
    const manifest = await readJson(manifestUrl) as PackageManifest | undefined;
    if (!manifest) continue;
    packages.add(manifest.name ?? relative(manifestUrl));
    for (
      const group of [
        manifest.dependencies,
        manifest.devDependencies,
        manifest.peerDependencies,
        manifest.imports,
      ]
    ) {
      for (const [name, specifier] of Object.entries(group ?? {})) {
        if (!name.startsWith("@zag-js/")) continue;
        pins.push({
          package: name,
          version: specifier,
          source: relative(manifestUrl),
        });
      }
    }
  }

  const findings: string[] = [];

  // Per-package version agreement, then whole-workspace agreement.
  const byPackage = new Map<string, Pin[]>();
  for (const pin of pins) {
    const list = byPackage.get(pin.package) ?? [];
    list.push(pin);
    byPackage.set(pin.package, list);
  }

  for (const [name, group] of [...byPackage].sort(([a], [b]) => a.localeCompare(b))) {
    const versions = [...new Set(group.map((pin) => pin.version))];
    if (versions.length > 1) {
      findings.push(
        `${name} is pinned ${versions.length} different ways, which is ${versions.length} ` +
          `copies in one graph:\n` +
          group.map((pin) => `      ${pin.source}: ${pin.package}@${pin.version}`).join("\n") +
          `\n    Zag packages resolve context through each other. Two copies of one of them is ` +
          `a stale context at runtime, not an import error.`,
      );
    }
  }

  // The workspace must agree on one Zag release, not merely on one pinning per
  // package: a tree-view on 1.44 and a core on 1.45 is the same split, one
  // package further apart.
  const releases = new Map<string, Pin[]>();
  for (const pin of pins) {
    const release = releaseOf(pin.version);
    const list = releases.get(release) ?? [];
    list.push(pin);
    releases.set(release, list);
  }
  if (releases.size > 1) {
    findings.push(
      `The workspace spans ${releases.size} Zag releases:\n` +
        [...releases].sort(([a], [b]) => a.localeCompare(b))
          .map(([release, group]) =>
            `      ${release}:\n` +
            group.map((pin) => `        ${pin.source}: ${pin.package}@${pin.version}`).join("\n")
          ).join("\n") +
        `\n    One Zag release per workspace. Pick one and write it into every deno.json.`,
    );
  }

  // A floating pin is a version nobody chose.
  for (const pin of pins) {
    const operator = operatorOf(pin.version);
    if (operator === "exact") continue;
    findings.push(
      `${pin.source}: ${pin.package}@${pin.version} floats. Zag machines share internals with ` +
        `each other, so an unpinned minor is an unreviewed coupling — pin the exact release.`,
    );
  }

  if (pins.length === 0) {
    report(
      "zag versions",
      [],
      `No @zag-js/* dependency is declared anywhere in the workspace yet, so there is nothing ` +
        `to disagree. The gate starts biting when packages/runtime's Zag bridge lands.`,
    );
  }

  const pinned = new Set(pins.map((pin) => releaseOf(pin.version)));
  const distinct = [...pinned].sort();
  report(
    "zag versions",
    findings,
    `${byPackage.size} @zag-js package${byPackage.size === 1 ? "" : "s"} across ` +
      `${packages.size} manifest${packages.size === 1 ? "" : "s"}, all on Zag ` +
      `${distinct.join(", ")}${distinct.length === 1 ? "" : " (see above)"}:\n` +
      [...byPackage].sort(([a], [b]) => a.localeCompare(b))
        .map(([name, group]) => `    ${name}@${group[0].version}`)
        .join("\n"),
  );
}

if (import.meta.main) await main();
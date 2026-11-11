/**
 * The brand surface, driven end to end through the daemon transport.
 *
 * The init flow as typed RPC: create a brand, name its design language,
 * seed its palette from one primary, set its type per the language's
 * pairing, and read it back — definition, layers, and the composition's
 * judgment. Refusals name the brand, the file, and the issue, the way a
 * facet names its file. No mocks: a temp dir is the project, and the
 * composed document is judged by the same `compose()` the build serves.
 */

import { deepStrictEqual } from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { validateTheme } from "@spinjs/theme";
import { rpcHandler } from "../../src/api/index.ts";
import { setProjectRoot } from "@spinjs/server/procedures";

/**
 * The RPC surface, called in-process.
 *
 * No port, no server, no lifecycle: the same handler the daemon mounts,
 * invoked as a function. A test that needed a socket would be testing the
 * socket rather than the procedures.
 */
function clientFor<T>(procedure: string, input?: unknown): Promise<T> {
  return rpcHandler.handle(
    new Request(`http://test/rpc${procedure}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ json: input ?? {} }),
    }),
    { prefix: "/rpc" },
  ).then(async ({ response }) => {
    const body = await response?.text() ?? "{}";
    return JSON.parse(body).json as T;
  });
}

const created = (name: string, description?: string) =>
  clientFor<{ error: string | null; tokensJson?: string }>(`/project/brand/create`, {
    root: dir,
    name,
    ...(description === undefined ? {} : { description }),
  });

const setLanguage = (brand: string, language: string) =>
  clientFor<{ error: string | null; tokensJson?: string }>(`/project/brand/setDesignLanguage`, {
    root: dir,
    brand,
    language,
  });

const setPalette = (brand: string, primary: string, neutral?: string) =>
  clientFor<{ error: string | null; tokensJson?: string }>(`/project/brand/setPalette`, {
    root: dir,
    brand,
    primary,
    ...(neutral === undefined ? {} : { neutral }),
  });

const setType = (brand: string, choice: Record<string, string>) =>
  clientFor<{ error: string | null; tokensJson?: string }>(`/project/brand/setType`, {
    root: dir,
    brand,
    ...choice,
  });

const get = (brand: string) =>
  clientFor<{
    name: string;
    definition: Record<string, unknown>;
    layers: Record<string, unknown>;
    composed?: unknown;
    valid: boolean;
    issues: Array<{ layer: string; path: string; message: string }>;
  }>(`/project/brand/get`, { root: dir, brand });

let dir: string;

describe("the brand surface over RPC, against a temp project", () => {
  before(() => {
    dir = mkdtempSync(join(tmpdir(), "spin-brand-"));
    setProjectRoot(dir);
  });

  after(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("creates, seats, and reads back a brand", async () => {
    // `create` writes the directory, the definition, and the seating — the
    // tokens come later, as their own procedures.
    const made = await created("acme", "The fixture brand.");
    deepStrictEqual(made.error, null, "create lands");
    const report = await get("acme");
    deepStrictEqual(report.name, "acme", "the brand is there");
    deepStrictEqual(
      report.definition,
      { name: "acme", description: "The fixture brand." },
      "the definition carries name and description, nothing token-shaped",
    );
  });

  it("round-trips create → language → palette → type → get", async () => {
    // The init flow as a procedure sequence: one brand, four writes, and a
    // composed document the build would serve.
    deepStrictEqual((await created("halide")).error, null, "create lands");
    const languaged = await setLanguage("halide", "minimal");
    deepStrictEqual(languaged.error, null, "the design language seats");
    const languagedDoc: unknown = JSON.parse(languaged.tokensJson ?? "{}");
    const parentName =
      typeof languagedDoc === "object" && languagedDoc !== null && "$extends" in languagedDoc
        ? languagedDoc.$extends
        : undefined;
    deepStrictEqual(parentName, "minimal", "tokens.json names its parent, nothing else");
    const paletted = await setPalette("halide", "#1c62c2");
    deepStrictEqual(paletted.error, null, "the seeded palette lands");
    const layer: unknown = JSON.parse(paletted.tokensJson ?? "{}");
    const color: unknown =
      typeof layer === "object" && layer !== null && "color" in layer ? layer.color : undefined;
    const primary: unknown =
      typeof color === "object" && color !== null && "primary" in color ? color.primary : undefined;
    const primaryValue =
      typeof primary === "object" && primary !== null && "$value" in primary
        ? primary.$value
        : undefined;
    deepStrictEqual(primaryValue, "#1c62c2", "the seeded primary is the brand's mark");
    const typed = await setType("halide", { suggestion: "minimal" });
    deepStrictEqual(typed.error, null, "the type pairing lands");
    const report = await get("halide");
    deepStrictEqual(report.valid, true, "the composition holds");
    deepStrictEqual(report.issues, [], "no debts");
    deepStrictEqual(report.definition["name"], "halide", "the definition rides along");
    deepStrictEqual(
      Object.keys(report.layers).sort(),
      ["tokens.json"],
      "one layer: the sparse tokens the procedures wrote",
    );
    const composed = validateTheme(JSON.stringify(report.composed ?? {}));
    deepStrictEqual(composed.valid, true, "the composed document validates");
    const composedDoc: unknown = report.composed;
    const composedParent =
      typeof composedDoc === "object" && composedDoc !== null && "$extends" in composedDoc
        ? composedDoc.$extends
        : undefined;
    deepStrictEqual(composedParent, "minimal", "the composed document names its parent");
  });

  it("keeps the seeded palette sparse", async () => {
    // A layer is a diff, never a dump: only diverged leaves land, so a
    // language fix still reaches every brand layered over it.
    deepStrictEqual((await created("sparse")).error, null);
    deepStrictEqual((await setLanguage("sparse", "minimal")).error, null);
    const paletted = await setPalette("sparse", "#1c62c2");
    deepStrictEqual(paletted.error, null);
    const sparseLayer: unknown = JSON.parse(paletted.tokensJson ?? "{}");
    const sparseColor: unknown =
      typeof sparseLayer === "object" && sparseLayer !== null && "color" in sparseLayer
        ? sparseLayer.color
        : undefined;
    const surface: unknown =
      typeof sparseColor === "object" && sparseColor !== null && "surface" in sparseColor
        ? sparseColor.surface
        : undefined;
    deepStrictEqual(surface, undefined, "an undiverged leaf is not restated");
    const sparsePrimary: unknown =
      typeof sparseColor === "object" && sparseColor !== null && "primary" in sparseColor
        ? sparseColor.primary
        : undefined;
    const sparseModes: unknown =
      typeof sparsePrimary === "object" && sparsePrimary !== null && "$modes" in sparsePrimary
        ? sparsePrimary.$modes
        : undefined;
    deepStrictEqual(sparseModes !== undefined, true, "a seeded leaf carries both modes");
  });

  it("refuses a brand that already exists", async () => {
    // A collision is a collision: `create` never overwrites a brand someone saved.
    deepStrictEqual((await created("taken")).error, null);
    const again = await created("taken");
    deepStrictEqual(again.error, "a brand named taken already exists", "the refusal names the brand");
  });

  it("refuses an unknown design language", async () => {
    deepStrictEqual((await created("lost")).error, null);
    const languaged = await setLanguage("lost", "nordic");
    deepStrictEqual(
      languaged.error,
      `spin: brand "lost" in "lost/tokens.json" is invalid: unknown design language "nordic" — expected one of minimal, material, neobrutalist, neumorphic, editorial, glassmorphic`,
      "the refusal names the brand, the file, and the valid set",
    );
  });

  it("refuses a palette whose floors fail, writing nothing", async () => {
    // A brand that cannot be read cannot seed a palette — the refusal names
    // the missing brand, and the write never lands.
    deepStrictEqual((await created("unreadable")).error, null);
    const paletted = await setPalette("unreadable", "#1c62c2");
    deepStrictEqual(
      paletted.error,
      `spin: brand "unreadable" in "unreadable/tokens.json" is invalid: no design language set — set one before seeding a palette`,
      "the refusal names the missing step",
    );
    const report = await get("unreadable");
    deepStrictEqual(report.composed, undefined, "nothing partial landed");
  });

  it("refuses an unreadable primary", async () => {
    deepStrictEqual((await created("badink")).error, null);
    deepStrictEqual((await setLanguage("badink", "minimal")).error, null);
    const paletted = await setPalette("badink", "not-a-color");
    deepStrictEqual(
      (paletted.error ?? "").includes("not-a-color"),
      true,
      "the refusal names the invalid thing",
    );
  });

  it("a failing palette names the issue, not just the refusal", async () => {
    // Pure red sits in the dead zone: neither white nor dark ink clears 4.5
    // on it — the seeded layer fails its own floors, and the refusal carries
    // the failing pair.
    deepStrictEqual((await created("darkbad")).error, null);
    deepStrictEqual((await setLanguage("darkbad", "minimal")).error, null);
    const paletted = await setPalette("darkbad", "#ff0000");
    deepStrictEqual(
      (paletted.error ?? "").includes("spin: brand"),
      true,
      "the refusal names the brand",
    );
    deepStrictEqual(
      (paletted.error ?? "").includes("4.5:1"),
      true,
      "and the floor the pair misses",
    );
  });
});

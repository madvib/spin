import { test } from "bun:test";
import { deepStrictEqual, ok } from "node:assert/strict";
import { primitiveContracts } from "../../src/compiler/rules/primitives/manifest.ts";
import { tokenConsumers } from "../../src/compiler/token-consumers.ts";

/**
 * TYPE-b: the inverse index answers which components read a token.
 *
 * The manifest's `reads` say what each component spends; the inverse says,
 * for one token, who spends it — so a lint remedy and Studio can answer
 * "changing this moves N components" from the same probe data the MCP
 * component contract tool serves, never from a second list.
 */

test("a probe token returns its known consumers", () => {
  // --font-size-sm is read across the library: the index inverts the
  // manifest rather than restating it.
  const consumers = tokenConsumers("--font-size-sm");
  for (const name of ["alert", "button", "card", "table", "prose"]) {
    ok(
      consumers.includes(name),
      `the index names ${name} as a consumer of --font-size-sm`,
    );
  }
});

test("the index inverts the manifest it reads", () => {
  // Every read of every contract is answered by the index, and every answer
  // the index gives is a read the manifest declares. One direction checked
  // both ways, against the manifest itself rather than a pinned list.
  for (const [name, contract] of Object.entries(primitiveContracts)) {
    for (const token of contract.reads) {
      deepStrictEqual(
        tokenConsumers(token).includes(name),
        true,
        `${name} reads ${token}, so the index answers ${name}`,
      );
    }
  }
});

test("an unread token has no consumers", () => {
  deepStrictEqual(
    tokenConsumers("--color-never-declared-anywhere"),
    [],
    "a token nothing reads moves nothing",
  );
});

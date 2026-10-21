import { assertEquals } from "@std/assert";
import { starterThemes, themeModes } from "@spin/theme/themes";
import { modesFor, starterList } from "../src/theme-state.ts";
import type { StarterName } from "../src/theme-state.ts";

/**
 * The theme state's contract with the theme package.
 *
 * The control must never offer a lie: a starter it lists is a starter the
 * package ships, and a mode it offers is a mode that starter's own document
 * declares. Both facts are DERIVED here rather than written down, so a starter
 * added to the package appears in the control without anyone maintaining a
 * list beside it.
 */

Deno.test("the starters are the package's own, in order", () => {
  assertEquals(starterList, Object.keys(starterThemes).sort());
});

Deno.test("a starter offers the modes its own document declares", () => {
  for (const name of starterList) {
    const document = starterThemes[name as StarterName];
    assertEquals(
      modesFor(name),
      themeModes(document),
      `${name} offers a mode its document does not declare`,
    );
  }
});

Deno.test("a starter that does not exist offers one mode", () => {
  // The control reads the starter list to decide what to show, so a name it
  // cannot resolve must still answer with something it can render: one mode,
  // the light one every theme renders in.
  assertEquals(modesFor("no-such-starter"), ["light"]);
});

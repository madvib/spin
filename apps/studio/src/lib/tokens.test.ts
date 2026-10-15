import { assertEquals } from "@std/assert";
import { indexTree, parseTokens } from "@spin/theme";
import { editorRouteFor, toPx } from "./tokens.ts";
import { ROUTE_PATHS, ROUTES } from "./routes.ts";

/**
 * The route a token link names has to exist.
 *
 * No table of expectations here: the claims are read from `ROUTES`, the one
 * list the router and the rail already use. A list typed into a test is a
 * second copy of the truth that stays green while the first copy rots, which
 * is how every token in a component readout came to link to `/background` —
 * a route the studio had not shipped for two generations.
 */
Deno.test("editorRouteFor answers the route that claims a token's group", () => {
  const claims = ROUTES.flatMap((route) =>
    "owns" in route
      ? route.owns.map((prefix) => ({ route, prefix }))
      : []
  );
  // Without this the test is a loop over nothing, and a table that claimed
  // no groups at all would pass it.
  assertEquals(
    claims.length > 0,
    true,
    "no route in the table claims a token group",
  );
  for (const { route, prefix } of claims) {
    const path = [...prefix, "probe"].join(".");
    assertEquals(editorRouteFor(path), route.path, path);
  }
});

/**
 * Every token in the project's own theme. The reference theme is data rather
 * than a list someone maintains: it is the document the studio is pointed
 * at, so it covers the groups a real project has instead of the groups
 * whoever wrote the test remembered.
 */
Deno.test("toPx reads a length as the pixels it is", () => {
  assertEquals(toPx("0"), 0);
  assertEquals(toPx("0px"), 0);
  assertEquals(toPx("4px"), 4);
  assertEquals(toPx("1rem"), 16);
  assertEquals(toPx("0.5rem"), 8);
  assertEquals(toPx("2.5rem"), 40);
  // A value that is not a length has no width to draw, and saying so beats
  // drawing nothing without a reason.
  assertEquals(toPx("cubic-bezier(0, 0, 0, 1)"), undefined);
});

Deno.test("every token in the reference theme links to a route that exists", async () => {
  const text = await Deno.readTextFile(
    new URL("../../../reference/spin/default.json", import.meta.url),
  );
  const parsed = parseTokens(JSON.parse(text));
  if (!parsed.ok) throw new Error(`reference theme does not parse: ${parsed.error}`);

  const paths = Object.values(indexTree(parsed.tree).leaves).map((leaf) =>
    leaf.path.join(".")
  );
  const known = new Set(ROUTE_PATHS);
  let claimed = 0;
  for (const path of paths) {
    const segments = path.split(".");
    const route = editorRouteFor(path);
    const claimer = ROUTES.find((candidate) =>
      "owns" in candidate &&
      candidate.owns.some((prefix) =>
        prefix.every((segment, i) => segments[i] === segment)
      )
    );
    if (claimer !== undefined) {
      claimed++;
      assertEquals(route, claimer.path, path);
    }
    // A group no editor claims still has to land somewhere a reader can use.
    assertEquals(known.has(route), true, `${path} → ${route}`);
  }
  assertEquals(
    claimed > 0,
    true,
    "no token in the reference theme is claimed by any editor",
  );
});

import { assert, assertEquals } from "@std/assert";
import { indexTree, parseTokens, type TokenTree } from "@spin/theme";
import { silkTheme } from "@spin/theme/themes";
import {
  borderUtilityOf,
  compositeLadders,
  editorRouteFor,
  formatComposite,
  isCompositeType,
  parseComposite,
  tokenRowAt,
  toPx,
} from "./tokens.ts";
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
    "owns" in route ? route.owns.map((prefix) => ({ route, prefix })) : []
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

/** A corner that varies by mode, and a colour nested under its ramp. */
function rowFixture(): TokenTree {
  const parsed = parseTokens({
    radius: {
      $type: "dimension",
      sm: { $value: "0.25rem", $modes: { dark: "0.5rem" } },
    },
    color: { $type: "color", neutral: { "50": { $value: "#f8fafc" } } },
  });
  if (!parsed.ok) throw new Error(`fixture does not parse: ${parsed.error}`);
  return parsed.tree;
}

Deno.test("tokenRowAt answers an exact path with the theme's own row", () => {
  assertEquals(tokenRowAt(rowFixture(), "radius.sm", "light"), {
    path: "radius.sm",
    variable: "--radius-sm",
    value: "0.25rem",
    type: "dimension",
  });
});

Deno.test("tokenRowAt reads the value the asked-for mode holds", () => {
  assertEquals(tokenRowAt(rowFixture(), "radius.sm", "dark")?.value, "0.5rem");
});

Deno.test("tokenRowAt does not read a token under a path as the path itself", () => {
  // `color.neutral` is a group; the leaf beneath it answers for
  // `color.neutral.50`, and offering creation for a group as if it were a
  // missing token would scaffold over a namespace the theme already has.
  assertEquals(tokenRowAt(rowFixture(), "color.neutral", "light"), undefined);
});

Deno.test("every token in the reference theme links to a route that exists", () => {
  // The reference app serves the shipped default as its own theme: the
  // document is the package's, not a file anyone maintains a copy of.
  const parsed = parseTokens(silkTheme);
  if (!parsed.ok) {
    throw new Error(`reference theme does not parse: ${parsed.error}`);
  }

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

Deno.test("borderUtilityOf names the utility the vocabulary spells", () => {
  // `border.width` is the hairline and reads as the bare utility; the steps
  // carry their number. A page that printed `border-width-2` was naming a
  // utility nothing could write.
  assertEquals(borderUtilityOf("border.width"), "border");
  assertEquals(borderUtilityOf("border.width-2"), "border-2");
  assertEquals(borderUtilityOf("border.width-8"), "border-8");
});

/**
 * The composites, and a value each one is written in.
 *
 * The values are the theme's own spelling: the CSS a browser takes, which
 * is how the theme writes every value it holds.
 */
const COMPOSITES: readonly { type: string; value: string }[] = [
  { type: "typography", value: "600 1rem Inter, sans-serif 0.01em" },
  { type: "border", value: "2px solid #c8102e" },
  { type: "transition", value: "200ms cubic-bezier(0.4, 0, 0.2, 1)" },
  {
    type: "gradient",
    value: "linear-gradient(90deg, #c8102e 0%, #0f766e 100%)",
  },
];

Deno.test("the composite types are the four the studio gives a control", () => {
  assertEquals(isCompositeType("typography"), true);
  assertEquals(isCompositeType("border"), true);
  assertEquals(isCompositeType("transition"), true);
  assertEquals(isCompositeType("gradient"), true);
  // A shadow is a composite in CSS and is not one of these: the studio
  // already has an editor for it, and a value with no parts is not one.
  assertEquals(isCompositeType("shadow"), false);
  assertEquals(isCompositeType("color"), false);
});

Deno.test("a composite is read as the parts it is made of", () => {
  assertEquals(parseComposite("border", "2px solid #c8102e"), {
    type: "border",
    width: "2px",
    style: "solid",
    color: "#c8102e",
  });
  assertEquals(
    parseComposite("typography", "600 1rem Inter, sans-serif 0.01em"),
    {
      type: "typography",
      family: "Inter, sans-serif",
      size: "1rem",
      weight: "600",
      tracking: "0.01em",
      leading: "",
    },
  );
  assertEquals(
    parseComposite("transition", "200ms cubic-bezier(0.4, 0, 0.2, 1)"),
    {
      type: "transition",
      property: "",
      duration: "200ms",
      easing: "cubic-bezier(0.4, 0, 0.2, 1)",
      delay: "",
    },
  );
  assertEquals(
    parseComposite(
      "gradient",
      "linear-gradient(90deg, #c8102e 0%, #0f766e 100%)",
    ),
    {
      type: "gradient",
      direction: "90deg",
      stops: [
        { color: "#c8102e", position: "0%" },
        { color: "#0f766e", position: "100%" },
      ],
    },
  );
});

Deno.test("a composite that is written back says the same thing", () => {
  // The round trip the editor depends on: a value that is read into its
  // parts and written again is the value that was there.
  for (const composite of COMPOSITES) {
    const parts = parseComposite(composite.type, composite.value);
    assert(parts !== undefined, `${composite.type} did not parse`);
    assertEquals(formatComposite(parts), composite.value, composite.type);
  }
});

Deno.test("changing one part of a composite leaves the others as they were", () => {
  const parts = parseComposite("border", "2px solid #c8102e");
  assert(parts !== undefined, "the border did not parse");
  assert(parts.type === "border", "the border did not parse as a border");
  assertEquals(
    formatComposite({ ...parts, color: "#0f766e" }),
    "2px solid #0f766e",
  );
  assertEquals(
    formatComposite({ ...parts, style: "dashed" }),
    "2px dashed #c8102e",
  );
});

Deno.test("a type the studio has no parts for is not a composite", () => {
  assertEquals(parseComposite("color", "#c8102e"), undefined);
  assertEquals(parseComposite("dimension", "1rem"), undefined);
});

Deno.test("the ladders a composite offers are the theme's own steps", () => {
  const parsed = parseTokens(silkTheme);
  if (!parsed.ok) {
    throw new Error(`the shipped theme does not parse: ${parsed.error}`);
  }
  const ladders = compositeLadders(parsed.tree, "light");
  // Every ladder is a group the theme declares, and every step is a token
  // in it — the control offers the theme's steps or nothing.
  for (const [group, steps] of Object.entries(ladders)) {
    assert(steps.length > 0, `the theme declares no ${group}`);
    for (const step of steps) {
      assert(
        indexTree(parsed.tree).leaves[step.path] !== undefined,
        `${step.path} is not a token of the theme`,
      );
    }
  }
  assertEquals(
    ladders.widths.map((step) => step.name),
    ["width", "width-2", "width-4", "width-8"],
  );
  assertEquals(
    ladders.sizes.map((step) => step.name),
    ["2xs", "xs", "sm", "md", "lg", "xl", "2xl", "3xl"],
  );
});

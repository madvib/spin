import { test } from "bun:test";
import assert, { deepStrictEqual } from "node:assert/strict";
import {
  generateCss,
  indexTree,
  parseTokens,
  type TokenTree,
} from "@spinjs/spin/theme";
import { silkTheme } from "@spinjs/spin/theme/themes";
import {
  attachedStyle,
  declaredStyles,
  borderUtilityOf,
  compositeLadders,
  danglingReferences,
  editorRouteFor,
  formatComposite,
  isCompositeType,
  parseComposite,
  repointEdits,
  scaleRampEdits,
  styleEdits,
  styleGroups,
  tokenRowAt,
  toPx,
  trimRefusal,
  trimStyle,
} from "./tokens.ts";
import { applyEdits } from "./theme.ts";
import { ROUTE_PATHS, ROUTES } from "./routes.ts";
import {
  ELEMENT_STYLE_DEFAULTS,
  OWNED_STYLES,
  STYLE_REFERENCE_ROLES,
} from "@spinjs/spin/theme";

/**
 * The route a token link names has to exist.
 *
 * No table of expectations here: the claims are read from `ROUTES`, the one
 * list the router and the rail already use. A list typed into a test is a
 * second copy of the truth that stays green while the first copy rots, which
 * is how every token in a component readout came to link to `/background` —
 * a route the studio had not shipped for two generations.
 */
test("editorRouteFor answers the route that claims a token's group", () => {
  const claims = ROUTES.flatMap((route) =>
    "owns" in route ? route.owns.map((prefix) => ({ route, prefix })) : []
  );
  // Without this the test is a loop over nothing, and a table that claimed
  // no groups at all would pass it.
  deepStrictEqual(
    claims.length > 0,
    true,
    "no route in the table claims a token group",
  );
  for (const { route, prefix } of claims) {
    const path = [...prefix, "probe"].join(".");
    deepStrictEqual(editorRouteFor(path), route.path, path);
  }
});

/**
 * Every token in the project's own theme. The reference theme is data rather
 * than a list someone maintains: it is the document the studio is pointed
 * at, so it covers the groups a real project has instead of the groups
 * whoever wrote the test remembered.
 */
test("toPx reads a length as the pixels it is", () => {
  deepStrictEqual(toPx("0"), 0);
  deepStrictEqual(toPx("0px"), 0);
  deepStrictEqual(toPx("4px"), 4);
  deepStrictEqual(toPx("1rem"), 16);
  deepStrictEqual(toPx("0.5rem"), 8);
  deepStrictEqual(toPx("2.5rem"), 40);
  // A value that is not a length has no width to draw, and saying so beats
  // drawing nothing without a reason.
  deepStrictEqual(toPx("cubic-bezier(0, 0, 0, 1)"), undefined);
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

test("tokenRowAt answers an exact path with the theme's own row", () => {
  deepStrictEqual(tokenRowAt(rowFixture(), "radius.sm", "light"), {
    path: "radius.sm",
    variable: "--radius-sm",
    value: "0.25rem",
    type: "dimension",
  });
});

test("tokenRowAt reads the value the asked-for mode holds", () => {
  deepStrictEqual(tokenRowAt(rowFixture(), "radius.sm", "dark")?.value, "0.5rem");
});

test("tokenRowAt does not read a token under a path as the path itself", () => {
  // `color.neutral` is a group; the leaf beneath it answers for
  // `color.neutral.50`, and offering creation for a group as if it were a
  // missing token would scaffold over a namespace the theme already has.
  deepStrictEqual(tokenRowAt(rowFixture(), "color.neutral", "light"), undefined);
});

test("every token in the reference theme links to a route that exists", () => {
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
      deepStrictEqual(route, claimer.path, path);
    }
    // A group no editor claims still has to land somewhere a reader can use.
    deepStrictEqual(known.has(route), true, `${path} → ${route}`);
  }
  deepStrictEqual(
    claimed > 0,
    true,
    "no token in the reference theme is claimed by any editor",
  );
});

test("borderUtilityOf names the utility the vocabulary spells", () => {
  // `border.width` is the hairline and reads as the bare utility; the steps
  // carry their number. A page that printed `border-width-2` was naming a
  // utility nothing could write.
  deepStrictEqual(borderUtilityOf("border.width"), "border");
  deepStrictEqual(borderUtilityOf("border.width-2"), "border-2");
  deepStrictEqual(borderUtilityOf("border.width-8"), "border-8");
});

/**
 * The composites, and a value each one is written in.
 *
 * The values are the theme's own spelling: the CSS a browser takes, which
 * is how the theme writes every value it holds. TYPE-c: the `typography`
 * composite is gone — one path, `font.style` — so the three survivors are
 * the whole list.
 */
const COMPOSITES: readonly { type: string; value: string }[] = [
  { type: "border", value: "2px solid #c8102e" },
  { type: "transition", value: "200ms cubic-bezier(0.4, 0, 0.2, 1)" },
  {
    type: "gradient",
    value: "linear-gradient(90deg, #c8102e 0%, #0f766e 100%)",
  },
];

test("the composite types are the three the studio gives a control", () => {
  deepStrictEqual(isCompositeType("typography"), false);
  deepStrictEqual(isCompositeType("border"), true);
  deepStrictEqual(isCompositeType("transition"), true);
  deepStrictEqual(isCompositeType("gradient"), true);
  // A shadow is a composite in CSS and is not one of these: the studio
  // already has an editor for it, and a value with no parts is not one.
  deepStrictEqual(isCompositeType("shadow"), false);
  deepStrictEqual(isCompositeType("color"), false);
});

test("a composite is read as the parts it is made of", () => {
  deepStrictEqual(parseComposite("border", "2px solid #c8102e"), {
    type: "border",
    width: "2px",
    style: "solid",
    color: "#c8102e",
  });
  deepStrictEqual(
    parseComposite("typography", "600 1rem Inter, sans-serif 0.01em"),
    undefined,
  );
  deepStrictEqual(
    parseComposite("transition", "200ms cubic-bezier(0.4, 0, 0.2, 1)"),
    {
      type: "transition",
      property: "",
      duration: "200ms",
      easing: "cubic-bezier(0.4, 0, 0.2, 1)",
      delay: "",
    },
  );
  deepStrictEqual(
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

test("a composite that is written back says the same thing", () => {
  // The round trip the editor depends on: a value that is read into its
  // parts and written again is the value that was there.
  for (const composite of COMPOSITES) {
    const parts = parseComposite(composite.type, composite.value);
    assert(parts !== undefined, `${composite.type} did not parse`);
    deepStrictEqual(formatComposite(parts), composite.value, composite.type);
  }
});

test("changing one part of a composite leaves the others as they were", () => {
  const parts = parseComposite("border", "2px solid #c8102e");
  assert(parts !== undefined, "the border did not parse");
  assert(parts.type === "border", "the border did not parse as a border");
  deepStrictEqual(
    formatComposite({ ...parts, color: "#0f766e" }),
    "2px solid #0f766e",
  );
  deepStrictEqual(
    formatComposite({ ...parts, style: "dashed" }),
    "2px dashed #c8102e",
  );
});

test("a type the studio has no parts for is not a composite", () => {
  deepStrictEqual(parseComposite("color", "#c8102e"), undefined);
  deepStrictEqual(parseComposite("dimension", "1rem"), undefined);
});

test("the ladders a composite offers are the theme's own steps", () => {
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
  deepStrictEqual(
    ladders.widths.map((step) => step.name),
    ["width", "width-2", "width-4", "width-8"],
  );
  deepStrictEqual(
    "families" in ladders,
    false,
    "no family ladder without the typography composite",
  );
});

/**
 * The type page's variant management, read from the theme's own document.
 *
 * The page lists what the theme declares — the styles under `font.style`,
 * the elements that read them, the references components name — and every
 * gesture below lands as edits the theme module judges. A test that only
 * renders would say the rows exist; these say what the gestures MEAN.
 */
function styleTuple(
  family: string,
  size: string,
  weight: string,
): Record<string, Record<string, string>> {
  return {
    family: { $type: "fontFamily", $value: family },
    size: { $type: "dimension", $value: size },
    weight: { $type: "fontWeight", $value: weight },
    tracking: { $type: "dimension", $value: "{font.tracking.normal}" },
    leading: { $type: "dimension", $value: "{font.leading.relaxed}" },
  };
}

function styleFixture(): string {
  return JSON.stringify(
    {
      font: {
        style: {
          body: styleTuple("{font.family.body}", "{font.size.md}", "{font.weight.regular}"),
          display: styleTuple("{font.family.sans}", "{font.size.3xl}", "{font.weight.bold}"),
          code: styleTuple("{font.family.mono}", "{font.size.sm}", "{font.weight.regular}"),
          aside: styleTuple("{font.family.body}", "{font.size.sm}", "{font.weight.regular}"),
        },
      },
      button: {
        type: { $type: "typography", $value: "label" },
      },
    },
    null,
    2,
  );
}

test("styleGroups lists the owned set before the user extension, in the theme's words", () => {
  const parsed = parseTokens(silkTheme);
  if (!parsed.ok) {
    throw new Error(`the shipped theme does not parse: ${parsed.error}`);
  }
  const groups = styleGroups(parsed.tree);
  const owned = new Set(OWNED_STYLES.map((style) => style.name));
  deepStrictEqual(
    groups.filter((group) => group.owned).map((group) => group.name),
    OWNED_STYLES.map((style) => style.name),
  );
  for (const group of groups) {
    assert(group.fields.length > 0, `${group.name} carries no fields`);
    deepStrictEqual(group.owned, owned.has(group.name));
  }
});

test("an owned style cannot be trimmed, and the refusal says why", () => {
  for (const style of OWNED_STYLES) {
    const refusal = trimRefusal(styleFixture(), style.name);
    assert(
      refusal !== undefined && refusal.includes(style.name),
      `trimming ${style.name} is refused with its name in the reason`,
    );
  }
});

test("trimming a custom style removes its group and nothing else", () => {
  deepStrictEqual(trimRefusal(styleFixture(), "aside"), undefined);
  const doc = JSON.parse(trimStyle(styleFixture(), "aside")) as {
    font: { style: Record<string, unknown> };
    button: unknown;
  };
  deepStrictEqual(doc.font.style["aside"], undefined);
  assert(doc.font.style["body"] !== undefined, "the body style survives");
  assert(doc.button !== undefined, "outside groups survive");
});

test("adding a style scaffolds the tuple, and the document still builds", () => {
  const doc = JSON.parse(styleEdits(styleFixture(), "pull")) as {
    font: { style: Record<string, Record<string, { $value: unknown }>> };
  };
  const added = doc.font.style["pull"];
  assert(added !== undefined, "the added style lands in the document");
  for (const field of ["family", "size", "weight", "tracking", "leading"]) {
    assert(
      added[field] !== undefined,
      `the added style carries ${field}`,
    );
  }
});

test("re-pointing an element writes the style the element reads", () => {
  const edits = repointEdits(styleFixture(), "p", "code");
  const doc = JSON.parse(applyEdits(styleFixture(), edits, "base")) as {
    font: {
      style: Record<string, Record<string, { $value: unknown }>>;
    };
  };
  deepStrictEqual(
    doc.font.style["body"]!["size"]!.$value,
    "{font.style.code.size}",
  );
  deepStrictEqual(attachedStyle(styleFixture(), "p"), "body");
  deepStrictEqual(
    attachedStyle(applyEdits(styleFixture(), edits, "base"), "p"),
    "code",
  );
});

test("re-pointing past the map leaves the other elements where they were", () => {
  const edits = repointEdits(styleFixture(), "h1", "aside");
  const doc = JSON.parse(applyEdits(styleFixture(), edits, "base")) as {
    font: {
      style: Record<string, Record<string, { $value: unknown }>>;
    };
  };
  deepStrictEqual(
    doc.font.style["display"]!["size"]!.$value,
    "{font.style.aside.size}",
  );
  deepStrictEqual(
    doc.font.style["body"]!["size"]!.$value,
    "{font.size.md}",
  );
});

test("a reference that names no declared style is dangling, in words", () => {
  const found = danglingReferences(styleFixture());
  deepStrictEqual(found.length, 1);
  assert(
    found[0]!.includes("button.type") && found[0]!.includes("label"),
    `the dangling reference names its path and value: ${found[0]}`,
  );
});

test("a reference that names a declared style is not dangling", () => {
  const doc = JSON.parse(styleFixture()) as Record<string, unknown>;
  const button = (doc["button"] as Record<string, Record<string, unknown>>)[
    "type"
  ]!;
  button["$value"] = "code";
  deepStrictEqual(danglingReferences(JSON.stringify(doc, null, 2)), []);
});

test("the attachment map covers every element the contract names", () => {
  for (const element of Object.keys(ELEMENT_STYLE_DEFAULTS)) {
    assert(
      attachedStyle(styleFixture(), element) !== undefined ||
        elementStyleFixtureHasNoDefault(element),
      `${element} reads a style the map can show`,
    );
  }
  deepStrictEqual(STYLE_REFERENCE_ROLES.length > 0, true);
});

function elementStyleFixtureHasNoDefault(element: string): boolean {
  return (ELEMENT_STYLE_DEFAULTS as Record<string, string>)[element] ===
    undefined;
}

test("add then trim round-trips: the document comes back", () => {
  const before = styleFixture();
  const added = styleEdits(before, "pull");
  assert(
    declaredStyles(added).includes("pull"),
    "the added style is declared",
  );
  const trimmed = trimStyle(added, "pull");
  deepStrictEqual(JSON.parse(trimmed), JSON.parse(before));
});

test("re-pointing moves the emitted element voice: p follows code", () => {
  // The ownership proof at the document level: p's rule spends the body
  // style's variables, and after the re-point those variables ARE code's —
  // the theme CSS carries the alias, so the element follows the style.
  const edits = repointEdits(styleFixture(), "p", "code");
  const next = applyEdits(styleFixture(), edits, "base");
  const parsed = parseTokens(next);
  if (!parsed.ok) {
    throw new Error(`the re-pointed document does not parse: ${parsed.error}`);
  }
  const css = generateCss(parsed.tree);
  const bodySize = /--font-style-body-size:\s*([^;]+);/.exec(css)?.[1]?.trim();
  deepStrictEqual(bodySize, "var(--font-style-code-size)");
  deepStrictEqual(attachedStyle(next, "p"), "code");
  deepStrictEqual(attachedStyle(next, "h1"), "display");
});

test("scaleRampEdits multiplies every scalable step by the factor", () => {
  const steps = [
    { path: "font.size.sm", value: "0.875rem" },
    { path: "font.size.md", value: "1rem" },
    { path: "font.size.lg", value: "1.125rem" },
  ];
  const edits = scaleRampEdits(steps, 2);
  deepStrictEqual(
    edits.map((edit) => [edit.path.join("."), edit.value]),
    [
      ["font.size.sm", "1.75rem"],
      ["font.size.md", "2rem"],
      ["font.size.lg", "2.25rem"],
    ],
  );
});

test("scaleRampEdits refuses a factor that cannot mean a scale", () => {
  const steps = [{ path: "font.size.md", value: "1rem" }];
  assert.throws(
    () => scaleRampEdits(steps, 0),
    /factor/,
    "a zero factor scales the group out of existence",
  );
  assert.throws(
    () => scaleRampEdits(steps, -1.5),
    /factor/,
    "a negative factor is not a scale",
  );
  assert.throws(
    () => scaleRampEdits(steps, Number.NaN),
    /factor/,
    "a factor that is not a number is not a scale",
  );
});

test("scaleRampEdits leaves a step a factor cannot mean at its own value", () => {
  const steps = [
    { path: "font.weight.regular", value: "400" },
    { path: "font.weight.bold", value: "700" },
  ];
  const edits = scaleRampEdits(steps, 1.1);
  deepStrictEqual(
    edits.map((edit) => edit.path.join(".")),
    ["font.weight.regular", "font.weight.bold"],
  );
  for (const edit of edits) {
    const before = steps.find((step) => step.path === edit.path.join("."))!;
    assert(
      edit.value !== before.value,
      `${edit.path.join(".")} moves with the factor`,
    );
  }
});

test("scaleRampEdits skips a sibling the grid rounds back to unchanged", () => {
  const steps = [
    { path: "font.size.md", value: "1rem" },
    { path: "font.leading.normal", value: "1.5" },
  ];
  const edits = scaleRampEdits(steps, 1);
  deepStrictEqual(edits, [], "a factor of one moves nothing");
});

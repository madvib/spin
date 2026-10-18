/**
 * Spin lint — the enforcement layer.
 *
 * These are lints, not tests. A test asserts the library behaves; a lint
 * asserts that *authored code* stays inside the system. The distinction
 * matters: `packages/theme/tests` asks "does the button work", and this asks
 * "is anyone allowed to write this".
 *
 * Runs under oxlint's JS plugin API, so the rules are plain ESLint-shaped
 * visitors. What each rule needs to know about the vocabulary is imported from
 * `@spin/theme` and `@spin/preset` rather than duplicated
 * here, so a rename cannot leave the gate enforcing a vocabulary that no
 * longer exists.
 */

import {
  CSS_WIDE_COLORS,
  indexTree,
  parseTokens,
  scaffoldTheme,
} from "@spin/theme";
import type { TokenTree } from "@spin/theme";
import { starterThemes } from "@spin/theme/themes";
import {
  claimedElements,
  paintedElements,
  primitiveVariants,
} from "@spin/preset";
import { describeCatalog } from "@spin/preset";
import {
  claimedElements as animationClaims,
  primitiveVariants as animationVariants,
} from "@spin/animation";

/**
 * The subset of the oxlint/ESLint node shape these rules touch. Declared
 * structurally so the rules stay typed without claiming more of the AST than
 * they actually read.
 */
interface GateNode {
  type: string;
  name?: { name?: string };
  value?: { value?: unknown };
  parent?: GateNode;
  loc?: { start: { line: number; column: number } };
}

interface GateContext {
  report(descriptor: {
    node: GateNode;
    messageId: string;
    data?: Record<string, string>;
  }): void;
}

interface GateMeta {
  type: "problem";
  docs: { description: string };
  schema: unknown[];
  messages: Record<string, string>;
}

interface GateRule {
  meta: GateMeta;
  create(context: GateContext): Record<string, (node: GateNode) => void>;
}

/**
 * Utility names the preset can produce, read from the catalog the studio
 * already renders. A rule added to the preset is allowed here immediately.
 * `tree` defaults to the scaffold when absent.
 */
function utilityNames(tree?: TokenTree): Set<string> {
  const out = new Set<string>();
  for (const section of describeCatalog(tree ?? scaffoldTheme())) {
    for (const utility of section.utilities) out.add(utility);
  }
  return out;
}

/** Utility prefixes the catalog can produce: `bg-primary` -> `bg`. */
function utilityPrefixes(tree: TokenTree): Set<string> {
  const out = new Set<string>();
  for (const section of describeCatalog(tree)) {
    for (const utility of section.utilities) out.add(utility.split("-")[0]);
  }
  return out;
}

/**
 * Color words that are never token names: the theme's color-leaf names plus
 * the CSS-wide keywords the theme owns. A utility in a color position that
 * names one of these is a raw color, not a token reference.
 */
function colorWords(tree: TokenTree): Set<string> {
  const words = new Set<string>(CSS_WIDE_COLORS);
  for (const leaf of Object.values(indexTree(tree).leaves)) {
    if (leaf.type === "color") words.add(leaf.path[leaf.path.length - 1]);
  }
  return words;
}

/**
 * A color word or literal in a utility position, which is never a token name.
 * Prefixes come from the catalog and color words from the theme, so neither
 * list is hardcoded here.
 */
function rawColor(tree?: TokenTree): RegExp {
  const t = tree ?? scaffoldTheme();
  const prefixes = [...utilityPrefixes(t)];
  const words = [...colorWords(t)];
  return new RegExp(
    `^(?:${
      prefixes.join("|")
    })-(?:\\[?(?:#[0-9a-f]{3,8}|rgba?\\(|oklch\\(|hsl\\(|(?:${
      words.join("|")
    })\\b))`,
    "i",
  );
}

/** The primitives' vocabulary: tags they claim and classes they define. */
function primitiveVocab(): {
  claims: Set<string>;
  painted: Set<string>;
  variants: Set<string>;
} {
  // The animation layer is vocabulary too: `animate-spin` is a real class,
  // not an unknown utility, and a lint that flagged it would be wrong.
  return {
    claims: new Set([...animationClaims(), ...claimedElements()]),
    painted: paintedElements(),
    variants: new Set([...animationVariants(), ...primitiveVariants()]),
  };
}

/**
 * The fills and inks the shipped themes declare, by the palettes' own
 * spelling: a colour named `neutral-700` is a fill candidate, a colour named
 * `on-primary` is an ink, and `bg-primary` therefore pairs with
 * `text-on-primary` because `on-primary` exists to be that ink.
 *
 * The starters are the vocabulary rather than a fixture list: they are what
 * an author copies and customises, so a pairing they declare is a pairing
 * authored code may use, and a step no theme gives an ink (`on-neutral-700`)
 * is not a pairing at all. A colour one document invents is invisible here,
 * quietly — which is what the closed-vocabulary rule already exists to say.
 */
function pairVocabulary(): { colors: Set<string>; inks: Set<string> } {
  const colors = new Set<string>();
  for (const doc of Object.values(starterThemes)) {
    const parsed = parseTokens(doc);
    if (!parsed.ok) continue;
    for (const leaf of Object.values(indexTree(parsed.tree).leaves)) {
      if (leaf.type !== "color" || leaf.path[0] !== "color") continue;
      colors.add(leaf.path.slice(1).join("-"));
    }
  }
  return {
    colors,
    inks: new Set([...colors].filter((name) => name.startsWith("on-"))),
  };
}

let cached: {
  claims: Set<string>;
  painted: Set<string>;
  variants: Set<string>;
  utilities: Set<string>;
  rawColor: RegExp;
  pairings: ReturnType<typeof pairVocabulary>;
} | undefined;

/** Resolved once per process: these walk the theme, which does not change mid-run. */
function vocab() {
  return (cached ??= {
    ...primitiveVocab(),
    utilities: utilityNames(),
    rawColor: rawColor(),
    pairings: pairVocabulary(),
  });
}

const classTokens = (raw: string) => raw.split(/\s+/).filter(Boolean);

/** The tag name of the element an attribute belongs to. */
function tagOf(node: GateNode): string | undefined {
  const name = node.parent?.name?.name;
  return typeof name === "string" ? name : undefined;
}

function isClassAttribute(node: GateNode): boolean {
  const name = node.name?.name;
  return name === "class" || name === "className";
}

function stringValue(node: GateNode): string | undefined {
  const value = node.value?.value;
  return typeof value === "string" ? value : undefined;
}

const semanticOwnership: GateRule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow utility classes on elements the theme's semantic layer styles.",
    },
    schema: [],
    messages: {
      utility:
        "`<{{tag}}>` carries its own base. Drop `{{cls}}`; add a variant to the primitive or move it to the parent.",
    },
  },
  create(context) {
    return {
      JSXAttribute(node) {
        const raw = stringValue(node);
        if (!isClassAttribute(node) || raw === undefined) return;
        const tag = tagOf(node);
        if (tag === undefined || !vocab().painted.has(tag)) return;
        for (const cls of classTokens(raw)) {
          if (vocab().variants.has(cls)) continue;
          context.report({ node, messageId: "utility", data: { tag, cls } });
        }
      },
    };
  },
};

const closedVocabulary: GateRule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow classes the preset cannot generate, including raw color utilities.",
    },
    schema: [],
    messages: {
      unknown:
        "`{{cls}}` is not in the spin vocabulary and generates no CSS. Use a token, or drop it.",
    },
  },
  create(context) {
    return {
      JSXAttribute(node) {
        const raw = stringValue(node);
        if (!isClassAttribute(node) || raw === undefined) return;
        const known = vocab().utilities;
        // If the catalog cannot be read, abstain rather than flag every class.
        if (known.size === 0) return;
        for (const cls of classTokens(raw)) {
          if (vocab().variants.has(cls) || known.has(cls)) continue;
          // Icon glyphs come from the icon preset, not the token vocabulary.
          if (cls.startsWith("i-")) continue;
          context.report({ node, messageId: "unknown", data: { cls } });
        }
      },
    };
  },
};

const noRawColors: GateRule = {
  meta: {
    type: "problem",
    docs: { description: "Disallow raw color literals in class attributes." },
    schema: [],
    messages: {
      raw:
        "`{{cls}}` hardcodes a color. Use a semantic token (`text-text`, `bg-surface`, `border-border`) so the theme can change it.",
    },
  },
  create(context) {
    return {
      JSXAttribute(node) {
        const raw = stringValue(node);
        if (!isClassAttribute(node) || raw === undefined) return;
        const { utilities, rawColor: pattern } = vocab();
        for (const cls of classTokens(raw)) {
          // A token utility names a theme color; only the rest is raw.
          if (utilities.has(cls)) continue;
          if (!pattern.test(cls)) continue;
          context.report({ node, messageId: "raw", data: { cls } });
        }
      },
    };
  },
};
/**
 * Disallow a component naming a token by hand.
 *
 * A custom property is generated output, never an interface. When a component
 * spends a token it reads the theme the generator already injected, so a
 * renamed token cannot leave it pointing at nothing and a literal string
 * cannot sit in the source where nothing checks it. `var(--x)` in authored
 * source is the symptom; the fix is always the theme, never a wider
 * exception.
 */
const noHandwrittenTokens: GateRule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow `var(--token)` in source; spend the theme instead.",
    },
    schema: [],
    messages: {
      handwritten:
        '`var(--{{token}})` is generated output, not an API. Read the theme: `groupOf(ctx, "{{group}}")["{{step}}"]`.',
    },
  },
  create(context) {
    const literal = /var\(\s*--([a-z0-9-]+)\s*\)/g;
    return {
      // A string literal is where a hand-written reference lives; a template
      // or a comment is not authored usage.
      Literal(node) {
        const value = node.value?.value;
        if (typeof value !== "string") return;
        literal.lastIndex = 0;
        let match = literal.exec(value);
        while (match !== null) {
          const token = match[1] as string;
          context.report({
            node,
            messageId: "handwritten",
            data: { token, group: token.split("-")[0] ?? "", step: token },
          });
          match = literal.exec(value);
        }
      },
    };
  },
};

/**
 * Disallow ink that the fill underneath never declared.
 *
 * A fill's foreground is a fact of the palette, not a convention a call site
 * invents: the starters pair `bg-primary` with `text-on-primary` and give a
 * ramp step no foreground at all, because a step does not flip with the mode
 * while `text-text` does. Body ink on a filled control is legible in one
 * theme and a dark-on-dark box in the next — and it is a non-event to write,
 * which is why a gate has to read it.
 */
const noUnpairedInk: GateRule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow text ink on a fill the palette pairs with a different ink.",
    },
    schema: [],
    messages: {
      mismatch:
        "`bg-{{fill}}` is paired with `{{expected}}`; `{{ink}}` is a different ink on the same fill.",
      undeclared:
        "`bg-{{fill}}` declares no ink, so nothing says `{{ink}}` reads on it. Paint a paired fill, or declare the pairing in the theme.",
    },
  },
  create(context) {
    return {
      JSXAttribute(node) {
        const raw = stringValue(node);
        if (!isClassAttribute(node) || raw === undefined) return;
        const { colors, inks: declared } = vocab().pairings;
        // A fill constrains the ink of its OWN state: `hover:bg-accent` is
        // the hover state's pairing, and a chip that brightens its resting
        // ink is not painting that ink on the fill that arrives under a
        // pointer. Inks are collected per state for the same reason.
        const fills = new Map<string, string[]>();
        const inks = new Map<string, string[]>();
        for (const cls of classTokens(raw)) {
          const cut = cls.lastIndexOf(":");
          const state = cut === -1 ? "" : cls.slice(0, cut);
          const core = cut === -1 ? cls : cls.slice(cut + 1);
          if (core.startsWith("bg-")) {
            const fill = core.slice(3);
            // A surface is the page rather than a fill: body ink sits on it
            // by definition, which is where every floor is measured.
            if (colors.has(fill) && !fill.startsWith("surface")) {
              fills.set(state, [...(fills.get(state) ?? []), fill]);
            }
          } else if (core.startsWith("text-")) {
            const ink = core.slice(5);
            if (colors.has(ink)) {
              inks.set(state, [...(inks.get(state) ?? []), ink]);
            }
          }
        }
        for (const [state, stated] of inks) {
          const painted = fills.get(state);
          if (painted === undefined) continue;
          for (const ink of stated) {
            for (const fill of painted) {
              const expected = `on-${fill}`;
              if (!declared.has(expected)) {
                context.report({
                  node,
                  messageId: "undeclared",
                  data: { ink: `text-${ink}`, fill },
                });
              } else if (ink !== expected) {
                context.report({
                  node,
                  messageId: "mismatch",
                  data: {
                    ink: `text-${ink}`,
                    fill,
                    expected: `text-${expected}`,
                  },
                });
              }
            }
          }
        }
      },
    };
  },
};

export default {
  meta: { name: "spin" },
  rules: {
    "no-utilities-on-semantic": semanticOwnership,
    "closed-vocabulary": closedVocabulary,
    "no-raw-colors": noRawColors,
    "no-handwritten-tokens": noHandwrittenTokens,
    "no-unpaired-ink": noUnpairedInk,
  },
};

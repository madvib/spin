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

import { CSS_WIDE_COLORS, indexTree, scaffoldTheme } from "@spin/theme";
import type { TokenTree } from "@spin/theme";
import { claimedElements, primitiveVariants } from "@spin/preset";
import {
  claimedElements as animationClaims,
  primitiveVariants as animationVariants,
} from "@spin/animation";
import { describeCatalog } from "@spin/preset";

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
function primitiveVocab(): { claims: Set<string>; variants: Set<string> } {
  // The animation layer is vocabulary too: `animate-spin` is a real class,
  // not an unknown utility, and a lint that flagged it would be wrong.
  return {
    claims: new Set([...animationClaims(), ...claimedElements()]),
    variants: new Set([...animationVariants(), ...primitiveVariants()]),
  };
}

let cached: {
  claims: Set<string>;
  variants: Set<string>;
  utilities: Set<string>;
  rawColor: RegExp;
} | undefined;

/** Resolved once per process: these walk the theme, which does not change mid-run. */
function vocab() {
  return (cached ??= {
    ...primitiveVocab(),
    utilities: utilityNames(),
    rawColor: rawColor(),
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
        "`<{{tag}}>` is styled by the theme. Drop `{{cls}}`; use a variant or wrap the element instead.",
    },
  },
  create(context) {
    return {
      JSXAttribute(node) {
        const raw = stringValue(node);
        if (!isClassAttribute(node) || raw === undefined) return;
        const tag = tagOf(node);
        if (tag === undefined || !vocab().claims.has(tag)) return;
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
        "`var(--{{token}})` is generated output, not an API. Read the theme: `groupOf(ctx, \"{{group}}\")[\"{{step}}\"]`.",
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

export default {
  meta: { name: "spin" },
  rules: {
    "no-utilities-on-semantic": semanticOwnership,
    "closed-vocabulary": closedVocabulary,
    "no-raw-colors": noRawColors,
    "no-handwritten-tokens": noHandwrittenTokens,
  },
};

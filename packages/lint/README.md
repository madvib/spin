# @spin/lint

The lints: rules that help authored markup stay idiomatic inside the system.
These are lints, not tests — a test asks whether the library behaves; a lint
asks whether anyone is allowed to write this.

The rules are decided once, in a core that knows nothing about a linter, and
delivered three ways: an **oxlint plugin**, an **ESLint plugin**, and a
**standalone CLI**. All three run the same rules, under the same names, with the
same messages and the same options — so moving between them changes a
configuration and nothing else.

## Exports

```
@spin/lint
  default           the oxlint plugin: { meta, rules }

  rules
    no-utilities-on-semantic   a utility that paints over an element's own look
    closed-vocabulary          a class the project's theme cannot generate
    no-raw-colors              a hardcoded colour literal in a class attribute
    no-handwritten-tokens      a custom property written by hand in markup
    no-unpaired-ink            an ink the palette does not pair with the fill

  checkClosedVocabulary       the decisions, over facts and a class list
  checkNoUtilitiesOnSemantic
  checkNoRawColors
  checkNoUnpairedInk
  checkNoHandwrittenTokens
  factsFor                     the facts, from a set of theme documents
  projectFacts                 the facts, from a project's own themes
  findProjectRoot              the project a file belongs to

@spin/lint/eslint
  default           the ESLint plugin: { meta, rules, configs }
  rules             the same rules, in ESLint's shape
  configs           recommended: the five rules, as errors

@spin/lint/cli
  run               the CLI: the rules over a path, and what they found
```

## Wiring it up

### oxlint

The plugin is a JavaScript plugin; oxlint loads it and names its rules
`spin/<rule>`.

```json
{
  "jsPlugins": ["@spin/lint"],
  "rules": {
    "spin/closed-vocabulary": "error",
    "spin/no-raw-colors": "error"
  }
}
```

### ESLint

The plugin is a flat-config plugin. It goes into `plugins`, and its rules are
named `spin/<rule>` — the same names oxlint gives them.

```js
// eslint.config.js
import spin from "@spin/lint/eslint";

export default [
  {
    files: ["**/*.{jsx,tsx}"],
    plugins: { spin },
    rules: {
      "spin/closed-vocabulary": "error",
      "spin/no-raw-colors": "error",
    },
  },
];
```

Or the preset, which turns the five rules on:

```js
import spin from "@spin/lint/eslint";

export default [...spin.configs.recommended];
```

The plugin reads its options the ESLint way, from `context.options`, so the dial
below is written exactly as it is for oxlint. ESLint's own parser cannot read
JSX on its own — a project with JSX configures its parser (typescript-eslint, or
`ecmaFeatures.jsx`), as it would for any rule.

### The CLI

The checks with no linter at all: a project runs them over its own source and
reads what they say.

```
deno task lint:cli src/          # from a project that depends on spin
deno run -A jsr:@spin/lint/cli src/
```

```
spin lint — the checks, without a linter.

Usage:
  spin-lint [options] <path...>

Options:
  --format <text|json>     how the findings are printed (default: text)
  --strictness <dial>      strict | balanced | lenient (default: strict)
  --semantic-tags <which>  all | native | spin | none (default: all)
  --rule <name>            run only this rule (repeatable)
  -h, --help               this text
```

Paths may be files or directories; the files read are the JavaScript and
TypeScript ones. The findings are printed one per line, with the file, the line
and column, the rule and the sentence:

```
src/routes/buttons.tsx
  4:15  spin/no-utilities-on-semantic  `<button>` already sets its own fill; drop `bg-primary`; add a variant to the primitive or move it to the parent.

1 finding
```

`--format json` prints the same findings for a machine:

```json
{
  "version": 1,
  "findings": [
    {
      "file": "src/routes/buttons.tsx",
      "line": 4,
      "column": 15,
      "ruleId": "spin/no-utilities-on-semantic",
      "messageId": "utility",
      "message": "`<button>` already sets its own fill; drop `bg-primary`; ...",
      "severity": "error"
    }
  ],
  "summary": { "findings": 1, "files": 1 }
}
```

The exit code is what a script reads: `0` when there is nothing to report, `1`
when there is, `2` when the CLI could not read what it was asked to read.

## The vocabulary

The vocabulary is the **project's own theme**, catalogued, unioned with the
shipped starters — the same set a project renders, so a class the theme can
produce is never called unknown. A project is found the way the daemon finds
one: the nearest ancestor of the file being linted that holds a `spin/`
directory. A project with no theme of its own falls back to the starters, and a
vocabulary nobody could read makes every rule abstain rather than guess.

The vocabulary is read, never copied. The utility names come from the preset's
catalog, the element and variant names from the primitives' manifest, the colour
words from the themes' own tokens, and the fill/ink pairings from the same
documents. A rename therefore cannot leave a lint enforcing a vocabulary that no
longer exists, and a theme that declares a new pairing is pairable immediately.

The catalog describes spin's own rules; the preset also layers wind4 underneath
them. The classes wind4 answers for — `truncate`, `bg-transparent`, an arbitrary
`w-[16rem]` — are asked of the generator itself, so the rule and the editor
cannot disagree about whether a class exists.

## What the semantic rule says

A utility on a raw element is fine. A utility that paints over an element's own
decision is not. The catalog's own grouping says which is which, so the tiers
are read rather than listed:

- **layout** — display, flex and grid, gap, alignment, position, sizing,
  ordering, spacing. Free anywhere.
- **skin** — colour, background, border, radius, shadow, font, opacity. Reported
  on an element a primitive paints.
- **structure** — the type scale. Reported on an element a primitive paints.

"Paints" is a PLACE, not a list of tags. Every primitive declares the scope it
paints — its own element, and, for a document surface, the elements of the
column it owns — and the rule asks whether the element is inside that scope and
whether the primitive decides the thing the utility decides. A paragraph in no
document column is the author's; a button is the button primitive's; and a
control that sets its own fill says nothing about the scale its text is read in,
so a type size on it is not a second opinion.

## What the handwritten-token rule reads

A custom property is generated output, never an interface. When a component
spends a token it reads the theme the generator already injected, so a renamed
token cannot leave it pointing at nothing.

The rule reads **authored markup**: the attributes the document reads as markup
— `class`, `className`, `style`, and the raw-HTML attributes — and the strings
they hold, whether a literal or a template. A stylesheet a package _generates_
is not authored markup: the theme's own CSS, the preset's rules and the
animation layer's keyframes all name the custom properties they spend, because
that is what generated output looks like. Reporting those would be reporting the
generator rather than the author.

## The dial

`spin/no-utilities-on-semantic` takes options:

```json
{
  "rules": {
    "spin/no-utilities-on-semantic": [
      "error",
      { "strictness": "strict", "semanticTags": "all" }
    ]
  }
}
```

- `strictness` — `strict` (skin and structure), `balanced` (skin only),
  `lenient` (neither).
- `semanticTags` — `all`, `native` (the elements HTML defines), `spin` (spin's
  own elements), `none`.

The CLI takes the same dials as flags: `--strictness balanced`,
`--semantic-tags native`.

## The shape

The decisions themselves do not know about a linter. They take facts and a
normalized view of the code and answer with findings, and an adapter walks the
AST and reports them. The rules — the message each finding is reported under,
the dials, and the visitor that turns a node into facts — are shared by all
three front ends, so they cannot drift: `tests/frontends.test.ts` runs one
fixture through the core, through oxlint, through ESLint and through the CLI,
and holds the four to the same findings.

The facts are read the same way too: the project's theme and the catalogued
vocabulary come from one provider that knows no linter at all, so what a rule
decides does not depend on who is asking.

## The dependencies

The package carries no dependency on a linter: the oxlint plugin, the ESLint
plugin and the rules between them import nothing but spin. Two npm packages are
here for the tooling around them, and neither is imported by the rules:

- `@typescript-eslint/parser` — the CLI's parser. The CLI has no linter to bring
  a tree with it, and this reads TypeScript and JavaScript, JSX included, into
  the same shape ESLint's own parser produces.
- `eslint` — the tests'. It is how the ESLint plugin is run for real, over a
  fixture, and held to ESLint's own types.

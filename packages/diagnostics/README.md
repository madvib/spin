# @spin/diagnostics

The diagnostics: what is wrong with this code, and how do I fix it.

Two halves. The **lints** read the source — rules that ask whether authored
markup stays inside the system: a class the theme cannot produce, a decision the
theme already made, an ink the palette does not pair. The **rendered checks**
read the page — contrast in every state, geometry, a console with something
thrown into it. Both answer in the same shape: a finding, and the edit that
settles it.

The rules are decided once, in a core that knows nothing about a linter, and
delivered four ways: an **oxlint plugin**, an **ESLint plugin**, a **standalone
CLI**, and the **service** — the two operations every other delivery is a client
of. All four run the same rules, under the same names, with the same messages
and the same options — so moving between them changes a configuration and
nothing else.

## Exports

```
@spin/diagnostics
  default           the oxlint plugin: { meta, rules }

  rules
    no-redundant-class        a class that says what the element already says
    prefer-theme-value        a class that overrides a decision the theme made
    prefer-element            a class that reaches for another element's decision
    closed-vocabulary         a class the project's theme cannot generate
    no-handwritten-tokens     a custom property written by hand in markup
    no-unpaired-ink           an ink the palette does not pair with the fill

  checkNoRedundantClass      the decisions, over facts and a class list
  checkPreferThemeValue
  checkPreferElement
  checkClosedVocabulary
  checkNoUnpairedInk
  checkNoHandwrittenTokens
  factsFor                     the facts, from a set of theme documents
  projectFacts                 the facts, from a project's own themes
  findProjectRoot              the project a file belongs to

  lint(path, view?)            the service: the rules over a path
  check(url, harness)          the service: the rendered checks

@spin/diagnostics/eslint
  default           the ESLint plugin: { meta, rules, configs }
  rules             the same rules, in ESLint's shape
  configs           recommended: the rules, as errors

@spin/diagnostics/cli
  run               the CLI: the service, and what it found
```

## The service

A module owns its facts, so it owns the operations over them. The service is the
package's front door, and it has two operations.

### `lint(path, view?)`

The rules over a path, returning the findings **with their fixes**.

The path is a file or a directory; the files read are the JavaScript and the
TypeScript ones. The answer is data:

```ts
interface LintReport {
  readonly findings: readonly Diagnostic[];
  readonly unreadable: readonly string[];
  readonly missing: readonly string[];
}
```

A `Diagnostic` carries where it is (file, line, column), which rule said it
(`ruleId`, `messageId`), the sentence (`message`), how bad it is (`severity`),
and the edit that settles it (`fix`) when there is one.

**The view is what is being linted.** By default it is the disk. A caller that
holds the text it wants read can hand it over instead:

```ts
const report = await lint("src/app.tsx", {
  kind: "staged",
  documents: [{ path: "src/app.tsx", text: unsaved }],
});
```

That is the studio's findings panel: it reports on what the editor holds, while
the editor's linter reports on what is saved. The two are the same operation
over different bytes — the same rules, the same facts, the same decisions — so a
finding means the same thing either way. A staged document is found by the path
it resolves to, so a caller may hand a path absolute or relative.

The service never writes. The decision about what to change belongs to the core;
the change belongs to whoever holds the file.

### `check(url, harness)`

The rendered checks, over a running app: contrast in every state, the geometry
the theme named, the console, the network.

The checks are the harness's — it is what knows how to ask a browser what it
painted, and it holds the app's own facts (the routes, the themes, how the app
says it has rendered). So the service calls the harness through a port and reads
back what it measured; it never looks at a page itself, because a second set of
eyes would be a second set of answers.

```ts
interface RenderedHarness {
  run(url: string): Promise<{
    readonly findings: readonly RenderedFinding[];
    readonly passed: boolean;
  }>;
}
```

The harness in the workspace's own tree is bound to that port by
`workspaceHarness(config)`: it is internal tooling, and the service calls it
rather than copying it.

## Wiring it up

### oxlint

The plugin is a JavaScript plugin; oxlint loads it and names its rules
`spin/<rule>`.

```json
{
  "jsPlugins": ["@spin/diagnostics"],
  "rules": {
    "spin/closed-vocabulary": "error",
    "spin/no-redundant-class": "error"
  }
}
```

### ESLint

The plugin is a flat-config plugin. It goes into `plugins`, and its rules are
named `spin/<rule>` — the same names oxlint gives them.

```js
// eslint.config.js
import spin from "@spin/diagnostics/eslint";

export default [
  {
    files: ["**/*.{jsx,tsx}"],
    plugins: { spin },
    rules: {
      "spin/closed-vocabulary": "error",
      "spin/no-redundant-class": "error",
    },
  },
];
```

Or the preset, which turns the rules on — as errors, except `prefer-element`,
which is a warning:

```js
import spin from "@spin/diagnostics/eslint";

export default [...spin.configs.recommended];
```

The severity is the configuration's to decide, in both linters: the preset above
is the stance the plugin ships with, and a project that writes the rules out by
name writes its own.

The plugin reads its options the ESLint way, from `context.options`, so the dial
below is written exactly as it is for oxlint. ESLint's own parser cannot read
JSX on its own — a project with JSX configures its parser (typescript-eslint, or
`ecmaFeatures.jsx`), as it would for any rule.

### The CLI

The checks with no linter at all: a project runs them over its own source and
reads what they say. The CLI is a client of the service: it reads the command
line, asks the service, and prints what came back.

```
spin lint [options] <path...>
spin check [options] [url]
```

```
deno task lint:cli lint src/       # from a project that depends on spin
deno run -A jsr:@spin/diagnostics/cli lint src/
```

```
spin — the diagnostics, without a linter.

Usage:
  spin lint [options] <path...>
  spin check [options] [url]

Options for lint:
  --format <text|json>     how the findings are printed (default: text)
  --strictness <dial>      strict | balanced | lenient (default: strict)
  --semantic-tags <which>  all | native | spin | none (default: all)
  --rule <name>            run only this rule (repeatable)
  --fix                    apply the edits the findings carry
  -h, --help               this text

Exit codes:
  0  nothing to report, or only warnings
  1  an error to report
  2  the CLI could not read what it was asked to read
```

Paths may be files or directories; the files read are the JavaScript and
TypeScript ones. The findings are printed one per line, with the file, the line
and column, the rule and the sentence:

```
src/routes/buttons.tsx
  4:15  spin/no-redundant-class  `bg-primary` sets `background-color` to what `<button>` already sets. Drop the class.

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
      "ruleId": "spin/no-redundant-class",
      "messageId": "redundant",
      "message": "`bg-primary` sets `background-color` to what `<button>` already sets. ...",
      "severity": "error"
    }
  ],
  "summary": { "findings": 1, "files": 1 }
}
```

The exit code is what a script reads: `0` when there is nothing to report, `1`
when there is an error, `2` when the CLI could not read what it was asked to
read. A warning is reported and does not fail the run: the CLI has no
configuration, so the rule's own stance is what decides — `prefer-theme-value`
is an error, and `prefer-element` is a warning.

`--fix` applies the edits the findings carry: a class that says what the element
already says, and a class the theme cannot produce, are both dropped. The files
are written back, and the findings that remain are the ones no edit settled.

### Running it

The package ships a `bin`, so it runs without being installed:

```
npx @spin/diagnostics lint src/
bunx @spin/diagnostics lint src/
```

The bin is a JavaScript file, not a compiled executable: `dist/cli.js` runs on
Node and on Bun, and the build gives it the shebang and the bit that says it may
be run.

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

## What the semantic rules say

A class on a raw element is fine. A class that says something the element's own
theme already said is not — and what it says decides which of the three rules
speaks:

- **`no-redundant-class`** — the class sets a property the element sets too, and
  it sets it to the value the element already has. It changes nothing, so it is
  dead weight: the rule reports it and drops it.
- **`prefer-theme-value`** — the class sets a property the system owns, to a
  different value. That is a second opinion about a decision the system made,
  and **a one-off override is banned**: the theme is where decisions recur, so a
  class that fights it is a decision that will not. The rule reports it as an
  error and names the way out — the theme's value, or the variant the element
  declares.
- **`prefer-element`** — the class carries a decision the theme gave to another
  element: a `<span>` carrying the size the theme gives `h1`. The element that
  carries it is named. This one is **advisory**: the wrong element cannot be
  banned, because a span inside a heading may be deliberate.

The override message says who owns the decision, and what to write instead. It
does not hedge, and it does not send the author to the theme — a one-off
override in the theme is worse than one in the markup, because the theme is
where decisions recur. The three families read:

```
the theme sets the size of `<h3>`; `text-sm` fights it. Use the theme's value.
`<button>` sets its own fill; `bg-surface` fights it. Use a variant (`bare`, `contrast`, …) or the theme's value.
the theme owns the space between blocks; `mt-6` fights it. Use the theme's value.
```

- **typography** — the text's own shape: the scale, the weight, the family, the
  capitalisation, the tracking. The theme states it for the elements it types.
- **skin** — the painted appearance: colour, background, border, radius, shadow.
  A primitive states it for the element it paints, and the variant is how that
  element is told to change.
- **spacing** — the space between blocks, wherever the theme types the element
  and states its rhythm.

What stays free: **layout** — where a box sits, how big it is, how things line
up — and any property on an element the system does not decide.

The catalog's own grouping says what a class does, so the tiers are read rather
than listed:

- **layout** — display, flex and grid, gap, alignment, position, sizing,
  ordering, spacing. Free anywhere: where a box sits is the author's.
- **skin** — colour, background, border, radius, shadow, font, opacity.
- **structure** — the type scale.
- **spacing** — the space between blocks, on an element the theme types. The
  tier is CONTEXTUAL: a margin or a padding is layout everywhere else, and the
  document's rhythm wherever the theme types the element.

"Paints" is a PLACE, not a list of tags. Every primitive declares the scope it
paints — its own element, and, for a document surface, the elements of the
column it owns — and the rules ask whether the element is inside that scope and
whether the primitive decides the thing the class decides. A paragraph in no
document column is the author's; a button is the button primitive's; and a
control that sets its own fill says nothing about the scale its text is read in,
so a type size on it is not a second opinion.

What the element already sets is read from the theme's own rules — the preset's
rules are run, so the lint cannot disagree with the stylesheet the theme ships.
Two values are compared as the theme resolves them: `1px` and
`var(--border-width)` are the same value when the theme's border is a pixel
wide.

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

The three semantic rules take options:

```json
{
  "rules": {
    "spin/no-redundant-class": [
      "error",
      { "strictness": "strict", "semanticTags": "all" }
    ]
  }
}
```

- `strictness` — `strict` (skin, structure and spacing), `balanced` (skin only),
  `lenient` (neither).
- `semanticTags` — `all`, `native` (the elements HTML defines), `spin` (spin's
  own elements), `none`.

The CLI takes the same dials as flags: `--strictness balanced`,
`--semantic-tags native`.

## The shape

The decisions themselves do not know about a linter. They take facts and a
normalized view of the code and answer with findings, and an adapter walks the
AST and reports them. A finding may carry an EDIT — the range it covers and the
text that replaces it — and the decision about what to change belongs to the
core; the change itself belongs to whoever is holding the file. So oxlint's
fixer, ESLint's fixer and the CLI's own writer all apply the same edit. The
rules — the message each finding is reported under, the dials, and the visitor
that turns a node into facts — are shared by all four front ends, so they cannot
drift: `tests/frontends.test.ts` runs one fixture through the core, through
oxlint, through ESLint, through the CLI and through the service, and holds the
five to the same findings — and to the same edits.

The facts are read the same way too: the project's theme and the catalogued
vocabulary come from one provider that knows no linter at all, so what a rule
decides does not depend on who is asking.

## The dependencies

The package carries no dependency on a linter: the oxlint plugin, the ESLint
plugin, the service and the rules between them import nothing but spin. Two npm
packages are here for the tooling around them, and neither is imported by the
rules:

- `@typescript-eslint/parser` — the CLI's parser. The CLI has no linter to bring
  a tree with it, and this reads TypeScript and JavaScript, JSX included, into
  the same shape ESLint's own parser produces.
- `eslint` — the tests'. It is how the ESLint plugin is run for real, over a
  fixture, and held to ESLint's own types.

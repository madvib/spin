<!-- USER COPY SLOT: contract-intro — your own DTCG framing, or the default below. -->

# Theme Contract & Modes

A theme is one JSON document in the DTCG shape: groups of tokens, each token a
`$value` and, when the group does not already say it, a `$type`. Types inherit
down the group tree — declare `$type: "color"` on `color` once and every token
inside it is a color until a token says otherwise. In a Spin project the
document lives at `spin/<name>.json`, and the name is the file stem.

An alias names another token in braces: `"{color.neutral.50}"`. The build
resolves it through a CSS `var(--color-neutral-50)` reference, not by copying
the value — so changing one ramp step repaints every role that names it at
runtime, with no rebuild.

Fonts travel in `$extensions.spin.fonts`: each entry names a `family`, a `src`
(local file or URL), and optionally `weight`, `style`, and `display`. The
preflight layer turns them into `@font-face` blocks, so the typeface a theme
names is the typeface the browser loads.

## Modes

A mode is a variant of a token, not a second theme. The root `"modes"` array
declares which modes the document serves: `["light", "dark"]`, `["light"]`, or
`["dark"]`. A per-token `$modes: { "dark": "..." }` restates that token's value
in dark; tokens without a restatement inherit their base `$value`.

Alias resolution is mode-relative: if `color.surface` is `"{color.neutral.50}"`,
dark mode resolves `color.neutral.50`'s own `$modes.dark` value automatically.
You restate the ramp, not every role that reads it.

> **Warning:** Three mode edges fail the gates: (1) writing `$modes.dark` when
> `"dark"` is not in root `"modes"`; (2) declaring `"modes": ["light", "dark"]`
> with zero `$modes.dark` restatements anywhere (an empty promise); (3)
> restating a non-color, non-shadow scale token (`spacing.*`, `radius.*`,
> `motion.duration.*`) in `$modes.dark` — dark mode changes ink and surface,
> never space or type.

## What the page below adds

The contract table lists every required role, its type, and the exact WCAG floor
it owes. The probe beside it renders the same markup in both modes at once — the
proof that a mode is a rendering, not a document. Component and
element-typography tokens (`card.*`, `alert.*`, `h1`–`h6`) are optional
overrides that fall back to the shared scales when omitted; the schema page
lists them all.

<!-- USER COPY SLOT: contract-close — your own authoring advice or links. -->

<!-- USER COPY SLOT: why-intro — frame the argument in your own words, or leave this as the working version. -->

# Why Spin

An agent writes your markup, and the markup is wrong in ways a review does not
catch. Spin exists for that case: you write the decisions down once, and the
output is checked against them mechanically.

<!-- USER COPY SLOT: why-problem — the failure mode you have seen most. -->

## The problem

An agent writes a page. The layout is right, the copy reads, the elements are
the ones a person would have chosen. Then, in one line, it writes `bg-[#c8102e]`
where the theme owns a primary. Or `p-13`, a spacing step nobody declared. Or
`text-text` on a `bg-primary` fill, where the palette says the ink must be
`text-on-primary`. Or it picks a colour that reads in light and disappears in
dark.

None of that is visible in a diff. Each instance is a word long, and a reviewer
reads a page of them without noticing. The same bug arrives in a new shape each
time, so it never adds up to a pattern somebody can catch. Review removes
instances of a bug. It does not remove the class of bug.

The class of bug is not carelessness. It is that the decision was never written
down anywhere the agent could be held to, and nothing measured the result.

## The four layers

Spin writes the decisions down, then holds the markup to them — in four layers,
in the order they stack.

1. **`@spin/theme` — the decisions, written down.** One JSON document per theme
   on disk: colors, type, spacing, radii, motion, and the modes each token
   serves. Aliases resolve at build time, so one ramp step feeds every role that
   names it. Six mechanical gates hold the floor: every required role present,
   every ink legible on its surface in every mode, every scale descending,
   motion bounded, modes served honestly, dark restatements limited to color and
   shadow.
2. **`@spin/preset` — the vocabulary the theme spends.** A closed UnoCSS preset:
   a class the theme cannot produce emits no CSS at all. Native HTML elements
   arrive styled when `classless` is on — `<button>`, `<input>`, `<dialog>`,
   `<table>` — and Spin custom elements (`<card>`, `<alert>`, `<badge>`,
   `<stat>`) carry the decisions no native tag owns. Each element's owned CSS
   properties are derived into a machine-readable manifest, so the lints know
   exactly what each element claims.
3. **`@spin/api` + Studio — the editor beside the app.** The daemon serves the
   Studio on the same origin as your app in dev. Every edit validates before it
   previews: an invalid token value or a broken legibility floor is refused with
   the reason named, never written. Save writes `spin/*.json` back to disk.
   Undo, redo, disk-conflict guard, keyboard verbs throughout.
4. **`@spin/diagnostics` + `@spin/mcp` — the oracles.** Theme-aware lints read
   the source (oxlint, ESLint, CLI): dead classes, redundant classes, overrides
   of element-owned decisions, unpaired inks, handwritten tokens. Playwright
   probes read the rendered page: resting and state contrast, zero-area
   controls, strobe animations, geometry claims. MCP tools let the agent read
   the theme, the utilities, and the element contracts before it writes a word.

## What adopting Spin costs

The vocabulary is closed, and that is the point — and the cost.

- **No escape hatches in markup.** There is no `p-[1rem]`, no `bg-[#c8102e]`, no
  half-step `py-0.5` the theme never named. If a value matters, it exists as a
  named token. If it is not named, it does not ship.
- **Element skin overrides go through variants or tokens.** `<button>` owns its
  background and ink. You clear the ownership with a variant (`ghost`, `bare`,
  `card-ghost`) or you change the token — you do not fight the element with a
  utility class.
- **The theme is work.** The scaffold gives you every required role with
  deliberately unfinished placeholder values. Finishing them — the palette, the
  ramps, the dark mode designed rather than inverted — is a day of judgement,
  not an hour of configuration.

<!-- USER COPY SLOT: why-close — your own closing argument, or the default below. -->

> **Note:** The machine checks the floor: the roles the document owes, the
> contrast it owes, the ladders that must descend, the modes it must serve. It
> cannot tell you whether a theme is dull. Distinctness and restraint are
> judgement, and a person makes them.

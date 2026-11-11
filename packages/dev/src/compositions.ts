import type { UserShortcuts } from "@unocss/core";

/**
 * The shared composition set — utility bundles a project opts into BY NAME.
 *
 * These are not components. A composition emits a CLASS selector: uno gives
 * it no way to say `card:`, only `.card`. That is fine for `cluster`, which
 * is a bundle of utilities someone chooses deliberately, and wrong for
 * anything meant to be a tag — a shortcut primitive renders nothing, because
 * the markup carries no class for it to match.
 *
 * Every primitive is therefore a rule, in `compiler/rules/primitives/`. Card
 * was built as shortcuts first and a bare `<card>` came out unstyled; the
 * surface is a tag vocabulary, so it has to be rules.
 *
 * A composition does have two properties worth knowing, both verified rather
 * than assumed:
 *
 * - It composes another composition, and emits no separate rule for the
 *   inner name. `cluster` naming `gap-2` is just the gap.
 * - It CANNOT compose a rule. Naming `button` inside a composition drops it
 *   silently, because a rule is a state machine and a shortcut is a
 *   declaration list. Composition between components happens in the markup.
 *
 * The preset ships none of these: compositions are a project's own decision
 * and belong in its build configuration (`spin.vite({ shortcuts: { ... } })`
 * — the install reference shows this table as the worked example, and each
 * of the toolchain's own surfaces (kit, docs, reference, studio) inlines
 * the handful of entries it uses into its own config rather than importing
 * this module). The lint reads the same declaration, so a class an app
 * declares is a class the lint knows.
 */
export const spinCompositions: UserShortcuts = {
  /** A row of items with a consistent gap, wrapping when it runs out. */
  cluster: "flex flex-wrap items-center gap-2",
  "cluster-sm": "flex flex-wrap items-center gap-1",
  "cluster-lg": "flex flex-wrap items-center gap-4",
  /** A column of items with a consistent gap. */
  "stack-xs": "flex flex-col gap-1",
  "stack-sm": "flex flex-col gap-2",
  stack: "flex flex-col gap-4",
  "stack-lg": "flex flex-col gap-8",
  /** A horizontal row of items. */
  "row-sm": "flex items-center gap-2",
  row: "flex items-center gap-4",
  "row-lg": "flex items-center gap-8",
  /** A row that gives its ends to their owners. */
  split: "flex items-center justify-between gap-4",
  /** A cluster that centres its items and its own content. */
  inline: "inline-flex items-center gap-1",
};

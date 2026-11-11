/**
 * The lints page's specimens: one bad/good pair per rule.
 *
 * Beside the page rather than in it so the snippets gate can import the
 * pairs without executing the page's Solid tree: the gate runs each bad
 * specimen through the real rules and each good specimen to silence, so
 * the page can never show a finding that does not fire or a remedy that
 * does not fix.
 */
export const PAIRS: readonly {
  rule: string;
  bad: string;
  good: string;
  note: string;
}[] = [
  {
    rule: "spin/closed-vocabulary",
    bad: `<div class="type-caption p-13">Quarterly revenue</div>`,
    good: `<div class="type-caption p-4">Quarterly revenue</div>`,
    note:
      "p-13 is not a declared spacing step — it emits no CSS. The fix names a declared step.",
  },
  {
    rule: "spin/no-redundant-class",
    bad: `<p class="type-body">Quarterly revenue</p>`,
    good: `<p>Quarterly revenue</p>`,
    note:
      "The paragraph already reads the body style. The fix drops the redundant class.",
  },
  {
    rule: "spin/prefer-theme-value",
    bad: `<button class="rounded-full">Pay now</button>`,
    good: `<button>Pay now</button>`,
    note:
      "The button owns its radius. Restyle the token, or release the skin with bare and name the full replacement.",
  },
  {
    rule: "spin/prefer-element",
    bad: `<span class="text-link">Documentation</span>`,
    good: `<a href="/docs">Documentation</a>`,
    note:
      "The link ink belongs to exactly one element, so this is an error. Shared inks and type-* styles are placement-open and never flag.",
  },
  {
    rule: "spin/no-unpaired-ink",
    bad: `<div class="bg-primary text-primary">Subscribed</div>`,
    good: `<div class="bg-primary text-on-primary">Subscribed</div>`,
    note:
      "The primary fill pairs with text-on-primary. Surfaces are the exception — the default ink belongs there.",
  },
  {
    rule: "spin/no-handwritten-tokens",
    bad: `<span style="color: #2563eb">Pinned blue</span>`,
    good: `<span class="text-primary">Pinned blue</span>`,
    note:
      "Spend the token through a utility instead of setting theme-owned properties by hand.",
  },
];

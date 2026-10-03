// Throwaway scoped proof for the button.css / feedback.css fixes.
import { readFileSync } from "node:fs";
import { createGenerator } from "@unocss/core";
import type { UnocssPluginContext } from "@unocss/core";
import MagicString from "npm:magic-string@^1.4.1";
import { spinPreset } from "@spin/preset";
import { deriveReads, deriveVariants } from "./packages/primitives/codegen.ts";
import { primitiveContracts } from "./packages/primitives/src/manifest.ts";

let failures = 0;
function check(label: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : ` — ${detail}`}`);
  if (!ok) failures++;
}

const THEME = JSON.parse(
  readFileSync("./packages/theme/examples/default/light.json", "utf8"),
);
const preset = spinPreset({ themes: { light: THEME } });
const uno = await createGenerator({ presets: [preset] });
const transformer = preset.transformers?.[0];
if (transformer === undefined) throw new Error("no directives transformer");

async function expand(css: string): Promise<string> {
  const code = new MagicString(css);
  await transformer!.transform(code, "primitive.css", {
    uno,
  } as unknown as UnocssPluginContext);
  return code.toString();
}

const buttonCss = readFileSync("./packages/primitives/src/button.css", "utf8");
const feedbackCss = readFileSync(
  "./packages/primitives/src/feedback.css",
  "utf8",
);

const expandedButton = await expand(buttonCss);
const expandedFeedback = await expand(feedbackCss);
check("button.css and feedback.css expand through the preset", true);

const outlineRule = expandedButton.match(/\.outline \{[^}]*\}/);
check(
  "outline emits color:var(--color-primary)",
  !!outlineRule && outlineRule[0].includes("color:var(--color-primary)"),
  outlineRule?.[0],
);
check(
  "outline emits border-color:var(--color-accent)",
  !!outlineRule && outlineRule[0].includes("border-color:var(--color-accent)"),
  outlineRule?.[0],
);
check(
  "outline no longer collapses (no border-color:var(--color-primary))",
  !!outlineRule && !outlineRule[0].includes("border-color:var(--color-primary)"),
  outlineRule?.[0],
);

const dangerRule = expandedButton.match(/\.danger \{[^}]*\}/);
check(
  "danger emits color:var(--color-on-danger)",
  !!dangerRule && dangerRule[0].includes("color:var(--color-on-danger)"),
  dangerRule?.[0],
);
check(
  "danger keeps the semantic-error fill",
  !!dangerRule &&
    dangerRule[0].includes("background-color:var(--color-semantic-error)"),
  dangerRule?.[0],
);

const ghostRule = expandedButton.match(/\.ghost \{[^}]*\}/);
check(
  "ghost keeps all three declarations (no collapse)",
  !!ghostRule &&
    ghostRule[0].includes("color:var(--color-text)") &&
    ghostRule[0].includes("background-color:transparent") &&
    ghostRule[0].includes("border-color:transparent"),
  ghostRule?.[0],
);

const contrastRule = expandedButton.match(/\.contrast \{[^}]*\}/);
check(
  "contrast keeps all three declarations (no collapse)",
  !!contrastRule &&
    contrastRule[0].includes("color:var(--color-surface)") &&
    contrastRule[0].includes("background-color:var(--color-text)") &&
    contrastRule[0].includes("border-color:var(--color-text)"),
  contrastRule?.[0],
);

// No --at-apply line can collapse: collapse happens exactly when a text-X
// value equals a bg-Y/border-Y value in the same line.
let collapseFound = false;
for (const line of buttonCss.split("\n")) {
  const atApply = line.match(/--at-apply:\s*(.+);/);
  if (!atApply) continue;
  const utilities = atApply[1].split(/\s+/);
  const textValues = new Set(
    utilities
      .filter((u) => u.startsWith("text-"))
      .map((u) => u.slice("text-".length)),
  );
  const fillValues = new Set(
    utilities
      .filter((u) => u.startsWith("bg-") || u.startsWith("border-"))
      .map((u) => u.slice(u.indexOf("-") + 1)),
  );
  for (const v of textValues) {
    if (fillValues.has(v)) {
      collapseFound = true;
      console.log(`  collapsible line: ${atApply[1]} (text-${v} vs fill ${v})`);
    }
  }
}
check("no --at-apply line in button.css can collapse a colour", !collapseFound);

const busyRules = expandedFeedback.match(
  /\[aria-busy="true"\]:not\(:is\([^)]*\)\)/g,
) ?? [];
check(
  "feedback.css keeps its aria-busy rules",
  busyRules.length >= 3,
  `${busyRules.length} rules`,
);
check(
  "every exclusion list includes button",
  busyRules.length > 0 && busyRules.every((r) => r.includes(", button")),
  busyRules.join(" | "),
);
check(
  'every exclusion list includes [role="button"]',
  busyRules.length > 0 && busyRules.every((r) => r.includes('[role="button"]')),
  busyRules.join(" | "),
);

// Reads/variants guards: the primitives test derives from the expanded css.
const expandedByName: Record<string, string> = {
  button: expandedButton,
  feedback: expandedFeedback,
};
for (const name of ["button", "feedback"] as const) {
  const css = expandedByName[name];
  const contract = primitiveContracts[name];
  const derivedReads = [...deriveReads(css)].sort();
  check(
    `${name}: checked-in reads match a fresh derive`,
    JSON.stringify([...contract.reads].sort()) === JSON.stringify(derivedReads),
    `new reads needing codegen: ${
      derivedReads.filter((r) => !contract.reads.includes(r)).join(", ") || "none"
    }`,
  );
  check(
    `${name}: checked-in variants match a fresh derive`,
    JSON.stringify([...contract.variants].sort()) ===
      JSON.stringify([...deriveVariants(css)].sort()),
  );
}

console.log(
  failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`,
);

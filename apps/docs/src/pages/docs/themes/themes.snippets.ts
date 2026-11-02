/**
 * Code snippets for the Themes & Tokens subgroup (`/docs/themes/*`).
 */
export const THEMES_SNIPPETS = {
  minimalTheme: `{
  "$description": "Warm paper and one red ink.",
  "color": {
    "$type": "color",
    "neutral": {
      "50": { "$value": "#f7f4ee", "$modes": { "dark": "#141312" } },
      "900": { "$value": "#161513", "$modes": { "dark": "#f0ebe3" } }
    },
    "surface": { "$value": "{color.neutral.50}" },
    "text": { "$value": "{color.neutral.900}" },
    "primary": {
      "$value": "#c8102e",
      "$modes": { "dark": "#ff5a63" }
    }
  },
  "font": {
    "family": {
      "sans": { "$type": "fontFamily", "$value": "Inter, system-ui, sans-serif" }
    }
  },
  "spacing": {
    "$type": "dimension",
    "4": { "$value": "1rem" }
  },
  "modes": ["light", "dark"]
}`,
  themeGates: `import { readFile } from "node:fs/promises";
import { themeGate, themeGates } from "@spinjs/spin/theme";

const text = await readFile("spin/<name>.json", "utf8");
const report = themeGates(text);
if (!report.valid) {
  for (const gate of report.gates) {
    for (const issue of gate.issues) {
      console.log(gate.gate + ": " + issue.path + " — " + issue.message);
    }
  }
}

// Run one gate or judge one mode on its own:
const darkLegibility = themeGate("legibility", text, { mode: "dark" });`,
  resolveTheme: `import {
  indexTree,
  parseTokens,
  resolveAliases,
  resolveTheme,
} from "@spinjs/spin/theme";
import { spinTheme } from "@spinjs/spin/theme/themes";

// Flat value map for one mode (throws on a malformed document;
// broken aliases are listed in \`unresolved\` rather than thrown):
const resolved = resolveTheme(spinTheme, "dark");
console.log(resolved.mode); // "dark"
console.log(resolved.values["color.primary"]); // "#ff5a63"
console.log(resolved.unresolved); // []

// Total parse + leaf index (never throws; keeps leaf types and $modes):
const parsed = parseTokens(spinTheme);
if (parsed.ok) {
  const index = indexTree(resolveAliases(parsed.tree).tree);
  const primary = index.leaves["color.primary"];
  console.log(primary?.type, primary?.value, primary?.modes?.dark);
}`,
} as const;

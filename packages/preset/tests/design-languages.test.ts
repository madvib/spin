import { test } from "bun:test";
import { deepStrictEqual } from "node:assert/strict";
import { createGenerator } from "@unocss/core";
import { designLanguages, type ThemeDocument } from "@spinjs/theme";
import { spinPreset } from "../src/index.ts";

async function generateFor(markup: string, theme: ThemeDocument): Promise<string> {
  const uno = await createGenerator({
    presets: [spinPreset({ theme })],
  });
  return (await uno.generate(markup)).css;
}

function ruleDeclarations(
  css: string,
  matchSelector: string | ((selector: string) => boolean),
): Record<string, string> {
  const out: Record<string, string> = {};
  const testSelector = typeof matchSelector === "function"
    ? matchSelector
    : (selector: string) => selector.includes(matchSelector);
  const blockPattern = /([^{}]+)\{([^{}]+)\}/g;
  for (const match of css.matchAll(blockPattern)) {
    const selector = (match[1] ?? "").trim();
    const body = match[2] ?? "";
    if (!testSelector(selector)) continue;
    for (const entry of body.split(";")) {
      const colon = entry.indexOf(":");
      if (colon === -1) continue;
      const prop = entry.slice(0, colon).trim();
      const val = entry.slice(colon + 1).trim();
      if (prop !== "") out[prop] = val;
    }
  }
  return out;
}

test("neobrutalist buttons wear a strong frame, resting offset shadow, and active stamp press", async () => {
  const css = await generateFor(
    '<button class="primary">Launch</button><button class="secondary">Docs</button><button class="danger">Stop</button><button class="ghost">Cancel</button><button class="bare">Raw</button>',
    designLanguages.neobrutalist,
  );
  const root = ruleDeclarations(css, ":root");
  deepStrictEqual(root["--button-edge"], "var(--color-border-strong)");
  deepStrictEqual(root["--button-shadow"], "var(--shadow-sm)");
  deepStrictEqual(root["--button-shadow-hover"], "var(--shadow-md)");
  deepStrictEqual(root["--button-shadow-active"], "none");
  deepStrictEqual(root["--button-active-x"], "2px");
  deepStrictEqual(root["--button-active-y"], "2px");
  const primary = ruleDeclarations(css, (s) => s.endsWith('[variant~="primary"]'));
  deepStrictEqual(primary["border-color"], "var(--button-edge, var(--color-primary))");
  const secondary = ruleDeclarations(css, (s) => s.endsWith('[variant~="secondary"]'));
  deepStrictEqual(secondary["border-color"], "var(--button-edge, var(--color-border))");
  const danger = ruleDeclarations(css, (s) => s.endsWith('[variant~="danger"]'));
  deepStrictEqual(danger["border-color"], "var(--button-edge, var(--color-semantic-error))");

  const active = ruleDeclarations(css, (s) => s.startsWith(":is(button") && !s.includes(".ghost") && !s.includes(".bare") && s.includes(":active"));
  deepStrictEqual(active["box-shadow"], "var(--button-shadow-active, var(--button-shadow))");
  deepStrictEqual(
    active["transform"],
    "translate(var(--button-active-x, 0), var(--button-active-y, 0))",
  );

  const ghostActive = ruleDeclarations(css, ".ghost:active");
  deepStrictEqual(ghostActive["box-shadow"], "none");
  deepStrictEqual(ghostActive["transform"], "none");

  const bareActive = ruleDeclarations(css, ".bare:active");
  deepStrictEqual(bareActive["box-shadow"], "none");
  deepStrictEqual(bareActive["transform"], "none");
});

test("material buttons rest on a subtle shadow and settle flat when pressed while keeping variant borders", async () => {
  const css = await generateFor(
    '<button class="primary">Save</button>',
    designLanguages.material,
  );
  const root = ruleDeclarations(css, ":root");
  deepStrictEqual(root["--button-shadow"], "var(--shadow-sm)");
  deepStrictEqual(root["--button-shadow-active"], "none");

  const primary = ruleDeclarations(css, (s) => s.endsWith('[variant~="primary"]'));
  deepStrictEqual(primary["border-color"], "var(--color-primary)");
});

test("glassmorphic surfaces emit optical backdrop-filter blur and paint-free variants clear it", async () => {
  const css = await generateFor(
    '<card class="card-ghost">A</card><panel>B</panel><dialog open>C</dialog><button class="ghost">D</button><button class="bare">E</button>',
    designLanguages.glassmorphic,
  );
  const root = ruleDeclarations(css, ":root");
  deepStrictEqual(root["--surface-blur"], "16px");

  for (const matcher of [
    (s: string) => s === "card",
    (s: string) => s === "panel",
    (s: string) => s === "dialog",
    (s: string) => s.startsWith(":is(button") && s.endsWith('[role="button"])'),
  ]) {
    const found = ruleDeclarations(css, matcher);
    deepStrictEqual(found["backdrop-filter"], "blur(var(--surface-blur))");
    deepStrictEqual(found["-webkit-backdrop-filter"], "blur(var(--surface-blur))");
  }

  const cardGhost = ruleDeclarations(css, (s) => s === "card.card-ghost");
  deepStrictEqual(cardGhost["backdrop-filter"], "none");
  deepStrictEqual(cardGhost["-webkit-backdrop-filter"], "none");

  const ghost = ruleDeclarations(css, (s) => s.endsWith('[variant~="ghost"]'));
  deepStrictEqual(ghost["backdrop-filter"], "none");
  deepStrictEqual(ghost["-webkit-backdrop-filter"], "none");

  const bare = ruleDeclarations(css, (s) => s === '.bare,[variant~="bare"]' || s === '.bare, [variant~="bare"]');
  deepStrictEqual(bare["backdrop-filter"], "none");
  deepStrictEqual(bare["-webkit-backdrop-filter"], "none");
});

test("multi-theme stylesheets preserve fallback borders for edge-free languages alongside neobrutalist and glassmorphic", async () => {
  const uno = await createGenerator({
    presets: [spinPreset({ themes: designLanguages })],
  });
  const { css } = await uno.generate('<button class="primary">Ship</button><span class="type-brand">spin</span>');
  const primary = ruleDeclarations(css, (s) => s.endsWith('[variant~="primary"]'));
  deepStrictEqual(primary["border-color"], "var(--button-edge, var(--color-primary))");

  const brand = ruleDeclarations(css, ".type-brand");
  deepStrictEqual(brand["font-family"], "var(--font-style-brand-family)");
  deepStrictEqual(brand["font-size"], "var(--font-style-brand-size)");
  deepStrictEqual(brand["font-weight"], "var(--font-style-brand-weight)");
  deepStrictEqual(brand["letter-spacing"], "var(--font-style-brand-tracking)");
  deepStrictEqual(brand["line-height"], "var(--font-style-brand-leading)");
});

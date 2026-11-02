/**
 * Injects the preview surface's stylesheet.
 *
 * The chrome's theme ships in the build; the project theme is generated here
 * and scoped to its own `data-theme`, so a preview never leaks its variables
 * into the tool around it.
 */

import { createEffect, createResource, Show } from "solid-js";
import type { Mode, TokenTree } from "@spinjs/spin/theme";
import studioTheme from "../../theme.json" with { type: "json" };
import { previewCssSafely, previewKey } from "../lib/preview.ts";
import {
  activeMode,
  activeName,
  activeTree,
  renderedMarkup,
  themeText,
} from "../lib/store.ts";
import { analyzeTheme } from "../lib/theme.ts";
import { groupTokens } from "../lib/tokens.ts";

const ISOLATED_GROUPS: string[][] = [
  ["spacing"],
  ["radius"],
  ["font", "size"],
  ["motion", "duration"],
  ["motion", "easing"],
];

function extractScaleDeclarations(
  tree: TokenTree | undefined,
  mode: Mode,
): string {
  if (tree === undefined) return "";
  const rows = groupTokens(tree, ISOLATED_GROUPS, mode);
  return rows
    .filter((row) => row.value !== "")
    .map((row) => `${row.variable}: ${row.value};`)
    .join(" ");
}

const STUDIO_CHROME_VARS = (() => {
  const parsed = analyzeTheme(JSON.stringify(studioTheme));
  return extractScaleDeclarations(parsed.tree, "light");
})();
export default function PreviewStyles() {
  const [css] = createResource(
    // The markup is a key, not just an argument: it arrives after first
    // render, and a resource keyed only on theme would generate for an
    // empty page and never refetch once the route registers what it
    // renders. Every specimen would sit unstyled.
    () =>
      previewKey(themeText(), activeName(), activeTree(), renderedMarkup()),
    (key) => previewCssSafely(key.text, key.name, key.markup),
  );

  // A failure is rendered as a banner on the preview surface, never as a
  // missing page: the author is looking at the theme that failed, and the
  // message belongs with it.
  //
  // The message, not a flag: the daemon says WHY the theme does not build
  // ("theme \"x\" is incomplete: color.text: missing required token
  // \"color.text\""), and a banner that says only that it does not build
  // asks the author to find the reason themselves.
  const failure = () => {
    const rendered = css();
    return typeof rendered === "object" ? rendered.error : undefined;
  };
  const previewHost = () =>
    document.querySelector("[data-theme][data-mode] > div");

  createEffect(() => {
    previewHost();
    const rendered = css();
    if (rendered === undefined) return;
    let tag = document.getElementById("spin-preview");
    if (!tag) {
      tag = document.createElement("style");
      tag.id = "spin-preview";
      // Before the chrome's own stylesheet, not after it: the preview
      // scope is zero-specificity, so ties fall to the later sheet — and
      // the later sheet must be the tool's, not the specimen's.
      const first = document.head.querySelector(
        'link[rel="stylesheet"], style:not(#spin-preview)',
      );
      if (first?.parentNode === document.head) {
        document.head.insertBefore(tag, first);
      } else {
        document.head.appendChild(tag);
      }
    }
    // A failed generation leaves the last good stylesheet in place and says
    // so, rather than wiping the preview to nothing.
    tag.textContent = typeof rendered === "string" ? rendered : "";
  });

  createEffect(() => {
    const tree = activeTree();
    const mode = activeMode();
    const name = activeName();
    let iso = document.getElementById("studio-layout-isolation");
    if (!iso) {
      iso = document.createElement("style");
      iso.id = "studio-layout-isolation";
      document.head.appendChild(iso);
    }
    const specimenVars = extractScaleDeclarations(tree, mode);
    iso.textContent = [
      `[data-studio-chrome] { ${STUDIO_CHROME_VARS} }`,
      `input[type="range"]::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: var(--spacing-4, 1rem); height: var(--spacing-4, 1rem); border-radius: 50%; background-color: var(--color-surface); border: var(--border-width, 1px) solid var(--color-primary); cursor: pointer; }`,
      `input[type="range"]::-moz-range-thumb { -moz-appearance: none; appearance: none; width: var(--spacing-4, 1rem); height: var(--spacing-4, 1rem); border-radius: 50%; background-color: var(--color-surface); border: var(--border-width, 1px) solid var(--color-primary); cursor: pointer; }`,
      specimenVars === ""
        ? ""
        : `.spin-preview[data-theme="${name}"], .spin-preview[data-theme="${name}"] [data-studio-specimen] { ${specimenVars} }`,
    ].join("\n");
  });

  return (
    <Show when={failure()}>
      {(message) => (
        <alert role="alert" class="alert-danger">
          This theme does not build: {message()}
        </alert>
      )}
    </Show>
  );
}

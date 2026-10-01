/**
 * Injects the preview surface's stylesheet.
 *
 * The chrome's theme ships in the build; the project theme is generated here
 * and scoped to its own `data-theme`, so a preview never leaks its variables
 * into the tool around it.
 */

import { createEffect, createResource } from "solid-js";
import { previewCss } from "../lib/preview.ts";
import { analyzeTheme } from "../lib/theme.ts";
import { activeName, themeText } from "../lib/store.ts";

export default function PreviewStyles() {
  const [css] = createResource(
    () => ({ tree: analyzeTheme(themeText()).tree, name: activeName() }),
    ({ tree, name }) => (tree ? previewCss(tree, name) : Promise.resolve("")),
  );

  createEffect(() => {
    const rendered = css();
    if (rendered === undefined) return;
    let tag = document.getElementById("spin-preview");
    if (!tag) {
      tag = document.createElement("style");
      tag.id = "spin-preview";
      document.head.appendChild(tag);
    }
    tag.textContent = rendered;
  });

  return null;
}

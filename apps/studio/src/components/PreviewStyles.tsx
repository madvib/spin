/**
 * Injects the preview surface's stylesheet.
 *
 * The chrome's theme ships in the build; the project theme is generated here
 * and scoped to its own `data-theme`, so a preview never leaks its variables
 * into the tool around it.
 */

import { createEffect, createResource, Show } from "solid-js";
import { previewCssSafely } from "../lib/preview.ts";
import { analyzeTheme } from "../lib/theme.ts";
import { activeName, renderedMarkup, themeText } from "../lib/store.ts";

export default function PreviewStyles() {
  const [css] = createResource(
    // The markup is a key, not just an argument: it arrives after first
    // render, and a resource keyed only on theme would generate for an
    // empty page and never refetch once the route registers what it
    // renders. Every specimen would sit unstyled.
    () => ({
      tree: analyzeTheme(themeText()).tree,
      name: activeName(),
      markup: renderedMarkup(),
    }),
    () => previewCssSafely(themeText(), activeName(), renderedMarkup()),
  );

  // A failure is rendered as a banner on the preview surface, never as a
  // missing page: the author is looking at the theme that failed, and the
  // message belongs with it.
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

  return (
    <Show when={failure() !== undefined}>
      {(message) => (
        <p class="bg-semantic-error border-semantic-error text-on-semantic-error m-4 rounded-md border p-3 text-sm">
          This theme does not build: {message()}
        </p>
      )}
    </Show>
  );
}

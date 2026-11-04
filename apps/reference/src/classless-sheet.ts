/**
 * The `classless: false` probe sheet, generated at build time.
 *
 * Two presets, one theme set: the default (classless) sheet the app serves
 * as `uno.css`, and this sibling sheet built with `{ classless: false }`.
 * The route injects it alongside the app sheet and reads both with
 * `document.styleSheets`, so the probe asserts on the served CSS — not on a
 * screenshot, and not on a second build.
 *
 * Prose selectors must be IDENTICAL in both (bare tags like `h1{...}`,
 * never `.h1`); custom elements (`button`, `card`) must flip to class
 * selectors here while the prose specimen renders unchanged.
 *
 * Route shape follows the existing conventions: a `#/...` hash route the
 * visual check walks via `APP_ROUTES`, rendering the prose specimen plus
 * one custom-element specimen side by side.
 */
import { starterThemes } from "@spinjs/spin/theme/themes";
import { spinPreset } from "@spinjs/spin";
import { createGenerator } from "@unocss/core";

const PROBE_MARKUP = [
  "<h1>Title</h1>",
  "<h2>Section</h2>",
  "<p>Body copy.</p>",
  "<ul><li>One</li><li>Two</li></ul>",
  "<ol><li>First</li></ol>",
  "<blockquote><p>Quote</p><footer>Author</footer></blockquote>",
  "<pre><code>code()</code></pre>",
  "<a href='#'>Link</a>",
  "<button class='primary'>Save</button>",
  "<card><card-header><card-title>T</card-title></card-header></card>",
  "<prose><h1>Column title</h1><p>Column body.</p></prose>",
].join("");

export async function classlessOffSheet(): Promise<string> {
  const uno = await createGenerator({
    presets: [spinPreset({ themes: { ...starterThemes }, classless: false })],
  });
  const result = await uno.generate(PROBE_MARKUP, { preflights: true });
  return result.css;
}

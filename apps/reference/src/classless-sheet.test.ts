import { test } from "bun:test";
import assert from "node:assert/strict";
import { classlessOffSheet } from "./classless-sheet.ts";

/** Prose tags the probe markup names; each must keep its tag selector. */
const PROSE = ["h1", "h2", "p", "ul", "ol", "blockquote", "code", "pre", "a", "prose"];

test("the classless-off sheet keeps prose tags and flips custom elements", async () => {
  // The route injects this sheet BESIDE the app sheet, so the probe reads
  // each sheet separately in the browser: here, the generated text alone.
  const css = await classlessOffSheet();
  assert(css.length > 1000, "the probe sheet must be a real stylesheet");
  for (const tag of PROSE) {
    const bare = new RegExp(`(^|[\\s,{])${tag}\\{`);
    assert(
      bare.test(css),
      `prose keeps its tag selector in classless-off mode: ${tag}`,
    );
    assert(
      !new RegExp(`\\.${tag}(?![a-zA-Z0-9_-])`).test(css),
      `no .${tag} class is emitted in classless-off mode`,
    );
  }
  // `card` flips tag → class under the toggle (`card{...}` → `.card{...}`).
  assert(
    new RegExp("\\.card(?![a-zA-Z0-9_-])").test(css),
    "card flips to its class in classless-off mode",
  );
  assert(
    !/(^|[\s,{])card\{/.test(css),
    "card no longer claims its bare tag in classless-off mode",
  );
  // `button` is attribute-matched (`:is(button, [type=...])`) and stays
  // tag-shaped by design — the mode-aware primitive the behaviour suite
  // pins is `details`, not `button` (C3b territory). The probe's named
  // button (`class="button primary"`) resolves `primary` against the same
  // sheet, which is the assertion that matters here.
  assert(
    /\.button-icon(?![a-zA-Z0-9_-])/.test(css),
    "the button part class still resolves in classless-off mode",
  );
});

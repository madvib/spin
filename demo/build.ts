/**
 * Render the button so the API is visible rather than asserted.
 *
 *     deno task demo            # writes demo/index.html
 *     open demo/index.html
 *
 * Everything below is the real pipeline: the preset emits the utilities, the
 * primitives ship their stylesheet, and the two meet in one document.
 */
import { createGenerator } from "@unocss/core";
import { spinPreset } from "@spin/preset";
import { generatePrimitivesCss } from "@spin/primitives";
import { readFile, writeFile, mkdir } from "node:fs/promises";

const OUT = new URL("./", import.meta.url);
const THEME = JSON.parse(
  await readFile("packages/theme/examples/default/light.json"),
);

const uno = await createGenerator({
  presets: [spinPreset({ themes: { light: THEME } })],
});
const { css } = await uno.generate("flex grid items-center gap-4 text-lg p-4");

// The primitives ship as CSS; a consumer links it, it does not need uno.
const primitives = generatePrimitivesCss();

const button = (label: string, cls = "", extra = "") =>
  `<button class="btn ${cls}" ${extra}>${label}</button>`;

await mkdir(OUT, { recursive: true });
await writeFile(
  new URL("index.html", OUT),
  `<!doctype html>
<html lang="en" data-theme="light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>spin · button</title>
<style>${css}</style>
<style>${primitives}</style>
<style>
  body { margin: 0; font-family: var(--font-family-sans); background: var(--color-surface); color: var(--color-text); }
  .demo { max-width: 46rem; margin: 0 auto; padding: 3rem 1.5rem; }
  h1 { font-size: 1.5rem; margin: 0 0 .25rem; }
  p.lede { color: var(--color-text-muted); margin: 0 0 2.5rem; }
  section { margin-block: 2rem; }
  h2 { font-size: .8125rem; text-transform: uppercase; letter-spacing: .08em;
       color: var(--color-text-muted); margin: 0 0 .875rem; font-weight: 600; }
  code { font-family: var(--font-family-mono); font-size: .8125rem;
         background: var(--color-surface-raised); padding: .125rem .375rem;
         border-radius: var(--radius-sm); }
  pre { background: var(--color-surface-raised); padding: 1rem;
        border-radius: var(--radius-md); overflow-x: auto; margin: 0;
        font-family: var(--font-family-mono); font-size: .8125rem;
        border: 1px solid var(--color-border); }
  .states { display: flex; gap: .75rem; flex-wrap: wrap; align-items: center; }
</style>
</head>
<body>
<div class="demo">
  <h1>spin primitives</h1>
  <p class="lede">The classless surface, as it actually ships.</p>

  <section>
    <h2>Variants · classless</h2>
    <div class="states">
      ${button("default")}
      ${button("secondary", "secondary")}
      ${button("outline", "outline")}
      ${button("contrast", "contrast")}
      ${button("danger", "danger")}
      ${button("ghost", "ghost")}
    </div>
  </section>

  <section>
    <h2>States</h2>
    <div class="states">
      ${button("hover me")}
      ${button("disabled", "", "disabled")}
      <button class="btn" aria-busy="true">busy</button>
    </div>
  </section>

  <section>
    <h2>Sizes</h2>
    <div class="states">
      ${button("small", "s-sm")}
      ${button("medium")}
      ${button("large", "s-lg")}
    </div>
  </section>

  <section>
    <h2>A group · joined corners</h2>
    <div role="group" style="display:flex">
      ${button("left", "secondary")}
      ${button("middle", "secondary")}
      ${button("right", "secondary")}
    </div>
  </section>

  <section>
    <h2>Utilities still win</h2>
    <div class="states">
      ${button("bg-secondary", "secondary", 'style="background:var(--color-secondary)"')}
    </div>
  </section>

  <section>
    <h2>Source</h2>
    <pre>&lt;button&gt;Save&lt;/button&gt;
&lt;button class="secondary"&gt;Save&lt;/button&gt;
&lt;button class="danger" aria-busy="true"&gt;Save&lt;/button&gt;</pre>
  </section>
</div>
</body>
</html>`,
);

console.log("wrote demo/index.html");

/**
 * The Phase 4 gate, as a page you can click.
 *
 *     deno task demo:tree          # writes demo/tree/index.html and serves it
 *
 * Everything on the page comes from spin's own pipeline: the preset emits the
 * theme variables and the primitive rules for the bare tags the component
 * renders, and the component contributes no class attributes at all. If a
 * Zag machine could not be expressed as semantic tags spin already styles,
 * this page would show it — unstyled `<div>`s with no role-specific rules —
 * which is exactly the failure this demo exists to catch.
 *
 * The machine ships as a bundle because the browser cannot run a Deno import
 * map. The bundle is a delivery detail; the source next to it is what the
 * claim rests on.
 */
import { createGenerator } from "@unocss/core";
import { spinPreset } from "@spin/preset";
import { generatePrimitivesCss } from "@spin/primitives";
import { execFile } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";

const ROOT = new URL("../../", import.meta.url);
const OUT = new URL("./", import.meta.url);

const THEME = JSON.parse(
  await readFile(new URL("packages/theme/examples/default/light.json", ROOT), "utf8"),
);

// The page's own chrome is not the component under test, so it asks for the
// handful of utilities it needs and nothing more. The component below asks for
// none, because it writes none.
const uno = await createGenerator({
  presets: [spinPreset({ themes: { light: THEME } })],
});

const PAGE_CHROME =
  "max-w-2xl mx-auto p-8 font-sans text-text bg-surface min-h-screen";

const { css } = await uno.generate(PAGE_CHROME);

// The primitives ship as CSS and are preflights in the preset too; emitting
// them directly keeps the page honest about which half of spin styled what.
const primitives = generatePrimitivesCss();

// The machine ships as a bundle because the browser cannot run a Deno import
// map. `deno bundle` is the built-in subcommand for that; the source next to
// it, not this artefact, is what the zero-classes claim rests on.
const dist = new URL("./dist/main.js", import.meta.url);
await new Promise<void>((resolve, reject) => {
  execFile(
    "deno",
    [
      "bundle",
      "--platform",
      "browser",
      new URL("./main.ts", import.meta.url).pathname,
      "-o",
      dist.pathname,
    ],
    { cwd: ROOT.pathname },
    (error, _stdout, stderr) =>
      error
        ? reject(error)
        : stderr.includes("error:")
        ? reject(new Error(stderr))
        : resolve(),
  );
});

const bundle = await readFile(dist, "utf8");

const html = `<!doctype html>
<html lang="en" data-theme="light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>spin · zag tree-view</title>
<style>${css}</style>
<style>${primitives}</style>
</head>
<body>
<main class="${PAGE_CHROME}">
  <h1 class="text-2xl font-bold">zag tree-view, spin-styled</h1>
  <p class="text-text-muted">
    One machine. Semantic tags only. Not one <code>class</code> attribute in
    the component source.
  </p>
  <tree-view></tree-view>
</main>
<script type="module">${bundle.replaceAll("</script", "<\\/script")}</script>
</body>
</html>`;

await writeFile(new URL("index.html", OUT), html);

const server = Deno.serve({ port: 8010 }, () =>
  new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } })
);

console.log(`tree-view demo on http://localhost:${(server.addr as Deno.NetAddr).port}`);

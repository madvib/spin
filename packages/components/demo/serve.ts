/** Serves the tree-view demo. The machine is bundled; the browser has no import map. */
import { createGenerator } from "@unocss/core";
import { spinPreset } from "@spin/preset";
import { starterThemes } from "@spin/theme/themes";
import { execFile } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";

const ROOT = new URL("../../../", import.meta.url);
const OUT = new URL("./", import.meta.url);

const THEMES = { default: starterThemes.default };

// Page chrome only. The component under test writes no utilities of its own.
const uno = await createGenerator({
  presets: [spinPreset({ themes: THEMES })],
});

const PAGE_CHROME =
  "max-w-2xl mx-auto p-8 font-sans text-text bg-surface min-h-screen";

const { css } = await uno.generate(PAGE_CHROME);

// The browser cannot run a Deno import map, so the machine ships as a bundle.
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
<html lang="en" data-theme="default">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>spin · zag tree-view</title>
<style>${css}</style>
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

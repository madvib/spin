/**
 * Renders every reference route to a static HTML file the Uno scanner reads.
 *
 * The reference renders at REQUEST time (pure string renderers behind a
 * middleware), so the scanner never sees the markup a page demonstrates: the
 * classes exist only in memory while a response is built. The catalog
 * safelist used to compensate by enumerating utilities, but a catalog cannot
 * name a PRIMITIVE token — `button`, `secondary`, `tone-accent` — because
 * those are produced by the element extractor reading real markup, not by any
 * utility list. So the pages are rendered HERE, ahead of the scanner, and the
 * scanner reads the content it would otherwise never see.
 *
 * This calls the reference's own renderers — `shell` for each route, and the
 * `sampleElement`/`cell` pair for the specimens a page shows one at a time —
 * so the sheet is generated from the same source as the pages. It must run
 * before `vite dev` / `vite build`; the `content` task does that and both
 * tasks depend on it.
 */
import { SECTIONS } from "@spin/preset/organization.ts";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { demoFor } from "../../server/demos.ts";
import {
  catalogSections,
  cell,
  rendered,
  sampleElement,
} from "../../server/specimen.ts";
import { shell } from "../../server/shell.ts";

const THEME = "default";
const MODE = "base";
const OUT = new URL("./src/content/", import.meta.url);

/**
 * Every page the middleware serves, as (route path, rendered document).
 *
 * The legacy `/<fixture-id>` route and `/` render the same document as
 * `/components/<id>` (same active id, same surface), so they are not written
 * twice: scanning is per-class, not per-URL, and a duplicate file would only
 * duplicate the same tokens.
 */
function pages(): { path: string; html: string }[] {
  const out: { path: string; html: string }[] = [
    {
      path: "components",
      html: shell("components", THEME, MODE, "components", ""),
    },
    {
      path: "utilities",
      html: shell("utilities", THEME, MODE, "utilities", ""),
    },
  ];
  for (const fixture of rendered) {
    out.push({
      path: `components/${fixture.id}`,
      html: shell(fixture.id, THEME, MODE, "components", ""),
    });
  }
  for (const section of SECTIONS) {
    out.push({
      path: `utilities/${section.id}`,
      html: shell(section.id, THEME, MODE, "utilities", section.id),
    });
  }
  return out;
}

/**
 * Every specimen a page can only show ONE of.
 *
 * A SCALE (padding, type-size, opacity, ...) is one preview with its steps as
 * controls: the page markup carries the initial step and the rest exist only
 * after a click. The scanner cannot click, so every utility is rendered here
 * as the surface renders any specimen — a cell per name, the class under test
 * on a live element — using the same `sampleElement`/`cell` pair the rail
 * does. The demo's promotion (`opacity-5` shown as `opacity-75`) is a display
 * choice, so the raw name is what is demonstrated here: a name a demo renames
 * must still generate its own rule.
 */
function specimenIndex(): string {
  const cells: string[] = [];
  for (const group of catalogSections()) {
    const demo = demoFor(group.id);
    if (demo === undefined) continue;
    for (const name of group.utilities) {
      cells.push(cell(sampleElement(name, demo, group.id), name, demo));
    }
  }
  return cells.join("");
}

export async function buildContent(): Promise<void> {
  // A stale page keeps generating CSS for markup that no longer exists, so the
  // directory is rebuilt rather than overwritten in place.
  await rm(OUT, { recursive: true, force: true });

  const all = [...pages(), { path: "specimens", html: specimenIndex() }];
  for (const { path, html } of all) {
    const file = new URL(`${path}.html`, OUT);
    await mkdir(new URL("./", file), { recursive: true });
    await writeFile(file, html);
  }
  console.log(`build-content: wrote ${all.length} pages to ${OUT.pathname}`);
}

// Run only when executed directly (`deno run -A build-content.ts`); the dev
// server's HMR plugin imports `buildContent` and calls it per change.
if (import.meta.main) await buildContent();

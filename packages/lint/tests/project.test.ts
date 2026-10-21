import { assertEquals } from "@std/assert";
import { findProjectRoot, readProjectThemes } from "../src/project.ts";

/**
 * The project is found the way the rest of the system finds it.
 *
 * A spin project is marked by a `spin/` directory at its root — the same
 * marker the daemon reads. The lint walks up from the file being linted and
 * takes the nearest ancestor that holds one, so a file in a project is
 * judged by that project's theme and a file outside every project falls
 * back to the starters.
 */

Deno.test("the nearest ancestor holding a spin directory is the project", async () => {
  const root = await Deno.makeTempDir();
  try {
    await Deno.mkdir(`${root}/spin`);
    await Deno.mkdir(`${root}/src/pages`, { recursive: true });
    assertEquals(findProjectRoot(`${root}/src/pages/page.tsx`), root);
  } finally {
    await Deno.remove(root, { recursive: true });
  }
});

Deno.test("a file outside every project has no root", async () => {
  const root = await Deno.makeTempDir();
  try {
    await Deno.mkdir(`${root}/src`, { recursive: true });
    assertEquals(findProjectRoot(`${root}/src/page.tsx`), undefined);
  } finally {
    await Deno.remove(root, { recursive: true });
  }
});

Deno.test("the project's themes are read by name", async () => {
  const root = await Deno.makeTempDir();
  try {
    await Deno.mkdir(`${root}/spin`);
    await Deno.writeTextFile(
      `${root}/spin/acme.json`,
      JSON.stringify({ color: { primary: { $value: "#c8102e" } } }),
    );
    const themes = readProjectThemes(root);
    assertEquals(Object.keys(themes), ["acme"]);
    assertEquals(themes["acme"], {
      color: { primary: { $value: "#c8102e" } },
    });
  } finally {
    await Deno.remove(root, { recursive: true });
  }
});

Deno.test("a theme that does not parse is skipped, not thrown on", async () => {
  // A half written theme in an editor must not cost the lint the themes
  // the project has.
  const root = await Deno.makeTempDir();
  try {
    await Deno.mkdir(`${root}/spin`);
    await Deno.writeTextFile(`${root}/spin/broken.json`, "{ not json");
    await Deno.writeTextFile(
      `${root}/spin/acme.json`,
      JSON.stringify({ color: { primary: { $value: "#c8102e" } } }),
    );
    assertEquals(Object.keys(readProjectThemes(root)), ["acme"]);
  } finally {
    await Deno.remove(root, { recursive: true });
  }
});

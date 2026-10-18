/**
 * The project procedures: the daemon's own, because only a host has a disk.
 *
 * Every handler here resolves a root per call — its own, or the one the call
 * names — because a single process should serve many projects without shared
 * state to stomp on. The fallback root is set once, by the host that starts
 * the daemon, and a client that names another root gets that root instead.
 */

import { implement } from "@orpc/server";
import { projectContract } from "./project-contract.ts";

export { initFiles, isWired, PROJECT_DIR } from "./project-contract.ts";

let projectRoot: string | undefined;

/**
 * The project a daemon serves by default. Set by `startDaemon`, read by every
 * procedure that is not told otherwise.
 */
export function setProjectRoot(root: string): void {
  projectRoot = root;
}

/**
 * The root a call is about: its own, or the daemon's.
 *
 * A client that names a root gets that root's themes; a client that names
 * none gets the project the daemon was started with. One process can serve
 * many projects this way, with no shared state to stomp on.
 */
function rootFor(input: { readonly root?: string }): string {
  if (input.root !== undefined) return input.root;
  if (projectRoot === undefined) {
    throw new Error(
      "project procedures need a root: the daemon was started without one",
    );
  }
  return projectRoot;
}

const os = implement(projectContract);

const CONFIG_FILENAME = "uno.config.ts";

/**
 * The shipped starters by name.
 *
 * Canonical JSON, not the package's file bytes: a theme is a document, and
 * this is the text the system writes for one. A project inherits the
 * starters rather than restating them, so an unforked theme lists as text
 * from here and a read falls back to it.
 */
async function shippedThemes(): Promise<Record<string, unknown>> {
  const { starterThemes } = await import("@spin/theme/themes");
  return starterThemes as Record<string, unknown>;
}

/** A theme document as the text written for it. */
function themeJson(document: unknown): string {
  return JSON.stringify(document, null, 2) + "\n";
}

/**
 * The project report for a root: the shared body of `detect` and `current`.
 *
 * One function because the two procedures differ only in which root they
 * examine, and a second copy of this walk would be a second place for the
 * notions of "has spin", "has uno", "is wired" to drift.
 */
async function reportFor(root: string) {
  const { readdir, readFile } = await import("node:fs/promises");
  const { join } = await import("node:path");
  const { existsSync } = await import("node:fs");
  const { isWired, PROJECT_DIR } = await import("./project-contract.ts");
  const here = join(root, PROJECT_DIR);
  const hasSpin = existsSync(here);
  let themes: string[] = [];
  if (hasSpin) {
    try {
      themes = (await readdir(here)).filter((e) => e.endsWith(".json"))
        .sort();
    } catch {
      themes = [];
    }
  }
  // The uno config is where the preset is wired, so it answers the other
  // half of "is this a spin project" without being the mark of one: a
  // project can hold themes it has not wired up yet.
  const unoName = ["uno.config.ts", "uno.config.js", "uno.config.mjs"]
    .find((name) => existsSync(join(root, name)));
  let wired = false;
  if (unoName !== undefined) {
    try {
      const text = await readFile(join(root, unoName), "utf8");
      wired = isWired(text);
    } catch {
      wired = false;
    }
  }
  return {
    root,
    spin: hasSpin,
    uno: unoName !== undefined,
    wired,
    themes,
  };
}

export const projectRouter = os.router({
  project: {
    detect: os.project.detect.handler(({ input }) => reportFor(input.root)),

    current: os.project.current.handler(() => reportFor(rootFor({}))),

    init: os.project.init.handler(async ({ input }) => {
      const { mkdir, writeFile } = await import("node:fs/promises");
      const { join } = await import("node:path");
      const { initFiles, PROJECT_DIR } = await import("./project-contract.ts");
      try {
        const written: string[] = [];
        const dir = join(input.root, PROJECT_DIR);
        await mkdir(dir, { recursive: true });
        for (
          const [file, text] of Object.entries(
            initFiles({ name: input.name, starter: input.starter }),
          )
        ) {
          await writeFile(
            file === CONFIG_FILENAME ? join(input.root, file) : join(dir, file),
            text,
            "utf8",
          );
          written.push(file === CONFIG_FILENAME ? file : `spin/${file}`);
        }
        void written;
        return { error: null };
      } catch (err) {
        return { error: err instanceof Error ? err.message : String(err) };
      }
    }),

    themes: {
      list: os.project.themes.list.handler(async ({ input }) => {
        const { readdir, readFile } = await import("node:fs/promises");
        const { join } = await import("node:path");
        const { PROJECT_DIR } = await import("./project-contract.ts");
        const root = rootFor(input);
        let entries: string[] = [];
        try {
          entries = await readdir(join(root, PROJECT_DIR));
        } catch {
          entries = [];
        }
        const themes: Array<{
          name: string;
          text: string;
          file: string | null;
        }> = [];
        for (const entry of entries.sort()) {
          if (!entry.endsWith(".json")) continue;
          themes.push({
            name: entry.replace(/\.json$/, ""),
            text: await readFile(join(root, PROJECT_DIR, entry), "utf8"),
            // Project-relative, so a path a developer sees never carries the
            // machine's filesystem layout: a screenshot, a log line, an issue
            // report. The daemon knows the root; the contract does not leak it.
            file: join(PROJECT_DIR, entry),
          });
        }
        // The starters a project has not forked, beside its own files: the
        // same base the plugin serves, so the studio lists what an app
        // renders. A fork replaces its entry rather than joining it.
        const forked = new Set(themes.map((theme) => theme.name));
        for (const [name, document] of Object.entries(await shippedThemes())) {
          if (forked.has(name)) continue;
          themes.push({ name, text: themeJson(document), file: null });
        }
        return themes.sort((a, b) =>
          a.name < b.name ? -1 : a.name > b.name ? 1 : 0
        );
      }),

      read: os.project.themes.read.handler(async ({ input }) => {
        const { readFile } = await import("node:fs/promises");
        const { join } = await import("node:path");
        const { PROJECT_DIR } = await import("./project-contract.ts");
        try {
          return {
            text: await readFile(
              join(rootFor(input), PROJECT_DIR, `${input.name}.json`),
              "utf8",
            ),
          };
        } catch {
          const document = (await shippedThemes())[input.name];
          return { text: document === undefined ? null : themeJson(document) };
        }
      }),

      write: os.project.themes.write.handler(async ({ input }) => {
        const { mkdir, writeFile } = await import("node:fs/promises");
        const { join } = await import("node:path");
        const { PROJECT_DIR } = await import("./project-contract.ts");
        try {
          const dir = join(rootFor(input), PROJECT_DIR);
          // A write is also the first write for a project that has never
          // held a theme: `spin/` is created rather than demanded. The
          // alternative shipped for a while — an ENOENT in a dialog on a
          // fresh checkout — was the directory's absence surfacing as the
          // writer's failure.
          await mkdir(dir, { recursive: true });
          await writeFile(
            join(dir, `${input.name}.json`),
            input.text,
            "utf8",
          );
          // Disk moved under the overlay: refresh the noted document so
          // the dirty comparison — and the badge reading it — clears.
          const { noteDiskDocument } = await import("@spin/preset");
          noteDiskDocument(input.name, input.text);
          return { error: null };
        } catch (err) {
          return { error: err instanceof Error ? err.message : String(err) };
        }
      }),

      remove: os.project.themes.remove.handler(async ({ input }) => {
        const { rm } = await import("node:fs/promises");
        const { join } = await import("node:path");
        const { PROJECT_DIR } = await import("./project-contract.ts");
        try {
          await rm(
            join(rootFor(input), PROJECT_DIR, `${input.name}.json`),
          );
          return { error: null };
        } catch (err) {
          return { error: err instanceof Error ? err.message : String(err) };
        }
      }),

      copy: os.project.themes.copy.handler(async ({ input }) => {
        const { mkdir, readFile, writeFile } = await import("node:fs/promises");
        const { join } = await import("node:path");
        const { PROJECT_DIR } = await import("./project-contract.ts");
        try {
          const dir = join(rootFor(input), PROJECT_DIR);
          const source = join(dir, `${input.from}.json`);
          // Read first so a missing source is an error, not an empty file —
          // and so a shipped starter answers for a name the project never
          // wrote. The copy is the text, so a fork copies byte for byte.
          let text: string;
          try {
            text = await readFile(source, "utf8");
          } catch {
            const document = (await shippedThemes())[input.from];
            if (document === undefined) {
              throw new Error(`no theme named ${input.from}`);
            }
            text = themeJson(document);
          }
          await mkdir(dir, { recursive: true });
          await writeFile(join(dir, `${input.to}.json`), text, "utf8");
          return { error: null };
        } catch (err) {
          return { error: err instanceof Error ? err.message : String(err) };
        }
      }),
    },
  },
});

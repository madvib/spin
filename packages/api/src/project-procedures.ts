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
import { generatePreview, previewContract } from "./preview-procedures.ts";

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

export const projectRouter = os.router({
  project: {
    detect: os.project.detect.handler(async ({ input }) => {
      const { readdir, readFile } = await import("node:fs/promises");
      const { join } = await import("node:path");
      const { existsSync } = await import("node:fs");
      const { isWired, PROJECT_DIR } = await import("./project-contract.ts");
      const here = join(input.root, PROJECT_DIR);
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
        .find((name) => existsSync(join(input.root, name)));
      let wired = false;
      if (unoName !== undefined) {
        try {
          const text = await readFile(join(input.root, unoName), "utf8");
          wired = isWired(text);
        } catch {
          wired = false;
        }
      }
      return {
        root: input.root,
        spin: hasSpin,
        uno: unoName !== undefined,
        wired,
        themes,
      };
    }),

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
          return [];
        }
        const themes: Array<{ name: string; text: string; file: string }> = [];
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
        return themes;
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
          return { text: null };
        }
      }),

      write: os.project.themes.write.handler(async ({ input }) => {
        const { writeFile } = await import("node:fs/promises");
        const { join } = await import("node:path");
        const { PROJECT_DIR } = await import("./project-contract.ts");
        try {
          await writeFile(
            join(rootFor(input), PROJECT_DIR, `${input.name}.json`),
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
        const { copyFile, readFile } = await import("node:fs/promises");
        const { join } = await import("node:path");
        const { PROJECT_DIR } = await import("./project-contract.ts");
        try {
          const from = join(
            rootFor(input),
            PROJECT_DIR,
            `${input.from}.json`,
          );
          // Read first so a missing source is an error, not an empty file.
          await readFile(from, "utf8");
          await copyFile(
            from,
            join(rootFor(input), PROJECT_DIR, `${input.to}.json`),
          );
          return { error: null };
        } catch (err) {
          return { error: err instanceof Error ? err.message : String(err) };
        }
      }),
    },
  },
});

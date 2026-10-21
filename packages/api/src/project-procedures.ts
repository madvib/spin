/**
 * The project procedures: the transport over `@spin/project`.
 *
 * Every handler here resolves a root per call — its own, or the one the call
 * names — because a single process should serve many projects without shared
 * state to stomp on. The fallback root is set once, by the host that starts
 * the daemon, and a client that names another root gets that root instead.
 *
 * The LOGIC lives in `@spin/project`. The project owns where its files are,
 * what a theme document is, and what a configuration declares; the daemon
 * owns the wire. A handler names the root, asks the service, and answers —
 * there is no filesystem here, and no rule about what a project is.
 */

import { implement } from "@orpc/server";
import { projectService } from "../../project/src/index.ts";
import { projectContract } from "./project-contract.ts";

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

export const projectRouter = os.router({
  project: {
    // `detect` and `current` are the same walk over different roots: one
    // asks about a root it names, the other about the daemon's own.
    detect: os.project.detect.handler(({ input }) =>
      projectService.detect(input.root)
    ),

    current: os.project.current.handler(() =>
      projectService.current(rootFor({}))
    ),

    init: os.project.init.handler(({ input }) => projectService.init(input)),

    themes: {
      list: os.project.themes.list.handler(({ input }) =>
        projectService.themes.list(rootFor(input))
      ),

      read: os.project.themes.read.handler(({ input }) =>
        projectService.themes.read(rootFor(input), input.name)
      ),

      write: os.project.themes.write.handler(async ({ input }) => {
        const written = await projectService.themes.write(
          rootFor(input),
          input.name,
          input.text,
        );
        if (written.error === null) {
          // Disk moved under the overlay: refresh the noted document so
          // the dirty comparison — and the badge reading it — clears. The
          // overlay is the daemon's own session, so the note is the
          // daemon's to make.
          const { noteDiskDocument } = await import("@spin/preset");
          noteDiskDocument(input.name, input.text);
        }
        return written;
      }),

      remove: os.project.themes.remove.handler(({ input }) =>
        projectService.themes.remove(rootFor(input), input.name)
      ),

      copy: os.project.themes.copy.handler(({ input }) =>
        projectService.themes.copy(rootFor(input), input.from, input.to)
      ),
    },
  },
});

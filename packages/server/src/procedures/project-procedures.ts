/**
 * The project procedures: the transport over `@spinjs/project`.
 *
 * Every handler here resolves a root per call — its own, or the one the call
 * names — because a single process should serve many projects without shared
 * state to stomp on. The fallback root is set once, by the host that starts
 * the daemon, and a client that names another root gets that root instead.
 *
 * The LOGIC lives in `@spinjs/project`. The project owns where its files are,
 * what a theme document is, and what a configuration declares; the daemon
 * owns the wire. A handler names the root, asks the service, and answers —
 * there is no filesystem here, and no rule about what a project is.
 */

import { implement } from "@orpc/server";
import { projectService } from "../project/index.ts";
import { createBrand, getBrand, renameBrand, setBrandDesignLanguage, setBrandPalette, setBrandType } from "../project/index.ts";
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
 *
 * Exported because another procedure family serves project data too — the
 * saved icons — and the rule about which root a call is about is the
 * daemon's, not one family's.
 */
export function rootFor(input: { readonly root?: string }): string {
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

    brand: {
      create: os.project.brand.create.handler(({ input }) =>
        createBrand({
          root: input.root,
          name: input.name,
          ...(input.description === undefined ? {} : { description: input.description }),
          ...(input.themesDir === undefined ? {} : { themesDir: input.themesDir }),
          ...(input.seat === undefined ? {} : { seat: input.seat }),
        })
      ),

      setDesignLanguage: os.project.brand.setDesignLanguage.handler(({ input }) =>
        setBrandDesignLanguage(input.root, input.brand, input.language, input.themesDir)
      ),

      setPalette: os.project.brand.setPalette.handler(({ input }) =>
        setBrandPalette(
          input.root,
          input.brand,
          {
            primary: input.primary,
            ...(input.neutral === undefined ? {} : { neutral: input.neutral }),
          },
          input.themesDir,
        )
      ),

      setType: os.project.brand.setType.handler(({ input }) =>
        setBrandType(
          input.root,
          input.brand,
          {
            ...(input.display === undefined ? {} : { display: input.display }),
            ...(input.body === undefined ? {} : { body: input.body }),
            ...(input.mono === undefined ? {} : { mono: input.mono }),
            ...(input.suggestion === undefined ? {} : { suggestion: input.suggestion }),
            ...(input.icons === undefined ? {} : { icons: input.icons }),
            ...(input.stroke === undefined ? {} : { stroke: input.stroke }),
          },
          input.themesDir,
        )
      ),

      get: os.project.brand.get.handler(({ input }) =>
        getBrand(input.root, input.brand, input.themesDir)
      ),

      rename: os.project.brand.rename.handler(({ input }) =>
        renameBrand(input.root, input.brand, input.to, input.themesDir)
      ),
    },
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
          const { noteDiskDocument } = await import("../project/index.ts");
          noteDiskDocument(input.name, input.text);
        }
        return written;
      }),

      remove: os.project.themes.remove.handler(async ({ input }) => {
        const removed = await projectService.themes.remove(rootFor(input), input.name);
        if (removed.error === null) {
          const { forgetDiskDocument } = await import("../project/index.ts");
          forgetDiskDocument(input.name);
        }
        return removed;
      }),

      copy: os.project.themes.copy.handler(({ input }) =>
        projectService.themes.copy(rootFor(input), input.from, input.to)
      ),

      createFacet: os.project.themes.createFacet.handler(({ input }) =>
        projectService.themes.createFacet(
          rootFor(input),
          input.name,
          input.base,
          input.kind,
          input.tokens,
        )
      ),

      facets: os.project.themes.facets.handler(({ input }) =>
        projectService.themes.facets(rootFor(input))
      ),
    },

    config: {
      read: os.project.config.read.handler(({ input }) =>
        projectService.config.read(rootFor(input))
      ),

      write: os.project.config.write.handler(({ input }) =>
        projectService.config.write(rootFor(input), input.config)
      ),
    },

    skills: {
      status: os.project.skills.status.handler(async ({ input }) => {
        const { projectSkillStatus } = await import("../project/skill.ts");
        return projectSkillStatus(rootFor(input), input.customDir);
      }),

      install: os.project.skills.install.handler(async ({ input }) => {
        const { installProjectSkills } = await import("../project/skill.ts");
        return installProjectSkills({
          root: rootFor(input),
          skillDir: input.skillDir,
          ...(input.general === undefined ? {} : { general: input.general }),
          ...(input.brandSkill === undefined ? {} : { brandSkill: input.brandSkill }),
          ...(input.brandDir === undefined ? {} : { brandDir: input.brandDir }),
        });
      }),
    },
  },
});

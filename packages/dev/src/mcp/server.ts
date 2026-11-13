/**
 * The spin MCP server: a thin client over the daemon's RPC.
 *
 * The default surface is three authoring tools (`component`, `icon`,
 * `utility`) plus read-only resources (`spin://project`, `spin://themes/{name}`).
 * When Studio is active on the daemon, `brand_draft` is also registered so
 * agents can stage in-memory brand drafts for Studio review without touching disk.
 */

import { createRequire } from "node:module";
import { z } from "zod";
import type { SpinClient } from "../api/index.ts";
import {
  mergeThemeDocuments,
  seedPalette,
  type ThemeDocument,
} from "@spinjs/theme";
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/server";

/** What every tool answers with: text content, and whether it failed. */
interface ToolResult {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
  /** The protocol's `Result` carries an index signature; so does this. */
  [x: string]: unknown;
}

/** A tool's successful answer: the value, as JSON. */
function json(value: unknown): ToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(value, null, 2) }],
  };
}

/** A tool refusal: a sentence, plus whatever a caller branches on. */
function failed(error: string, data: Record<string, unknown> = {}): ToolResult {
  return {
    content: [{
      type: "text",
      text: JSON.stringify({ error, ...data }, null, 2),
    }],
    isError: true,
  };
}

/** Build the MCP server bound to one daemon. */
export function buildSpinMcpServer(
  client: SpinClient,
  options?: { studioActive?: boolean },
): McpServer {
  // The published version rides the package manifest, never a literal: the
  // server answers with the version of the `@spinjs/dev` that built it.
  // `createRequire` resolves through the workspace member in this checkout
  // and through the published package root once bundled into `dist/`.
  const manifest = createRequire(import.meta.url)("@spinjs/dev/package.json") as {
    version?: unknown;
  };
  const version = typeof manifest.version === "string" ? manifest.version : "0.0.0";
  const server = new McpServer({ name: "spin", version });

  const theme = z.string().describe("Theme name, e.g. 'default'.");

  // Components and the utility surface.

  server.registerTool(
    "component",
    {
      title: "Components: primitives and machines",
      description:
        "The component libraries: CSS primitives (tags, variants, token reads, component tokens, example markup) and machine components (statechart-driven elements with typed bridges, example markup, and copy-to-project). List both, read one component's contract, list a machine's examples, or copy a machine example into the project.",
      inputSchema: {
        action: z.enum(["list", "contract", "examples", "copy"]).describe(
          "What to return.",
        ),
        name: z
          .string()
          .optional()
          .describe(
            "contract/examples/copy: a component name, e.g. 'button' or 'tree-view'.",
          ),
        example: z
          .string()
          .optional()
          .describe("copy: the example name, e.g. 'basic'."),
        root: z
          .string()
          .optional()
          .describe(
            "copy: the project root to write into (defaults to the daemon root).",
          ),
      },
    },
    async ({ action, name, example, root }) => {
      if (action === "list") {
        const listed = await client.components.list({});
        return json(
          listed.map((entry) => ({
            name: entry.name,
            kind: entry.kind,
            tags: entry.tags,
            variants: entry.variants,
            reads: entry.reads,
            ...(entry.kind === "machine"
              ? { examples: entry.examples.rows.map((row) => row.stem), manifest: entry.manifest }
              : {}),
          })),
        );
      }
      if (action === "examples") {
        if (name === undefined) {
          return failed("examples needs a component name");
        }
        const bare = name.replace(/^(?:component-|spin-)/, "");
        const ex = await client.components.examples({ name: bare });
        return json({ name: bare, examples: ex.examples });
      }
      if (action === "copy") {
        if (name === undefined) return failed("copy needs a component name");
        if (example === undefined) return failed("copy needs an example name");
        const bare = name.replace(/^(?:component-|spin-)/, "");
        const copied = await client.components.copy({
          name: bare,
          example,
          ...(root !== undefined ? { root } : {}),
        });
        if (copied.error !== null) return failed(copied.error);
        return json({ file: copied.file });
      }
      if (name === undefined) return failed("contract needs a component name");
      const resolved = await client.components.contract({ name });
      if ("error" in resolved) return failed(resolved.error);
      return json(resolved);
    },
  );

  server.registerTool(
    "utility",
    {
      title: "Utility classes",
      description:
        "The utility classes a theme can produce, grouped by reader intent (colors, spacing, typography, …) with each section's purpose.",
      inputSchema: { theme },
    },
    async ({ theme }) => {
      const read = await client.project.themes.read({ name: theme });
      if (read.text === null) {
        return failed(`no theme named "${theme}" in this project`);
      }
      const organized = await client.preset.organization({ text: read.text });
      if (organized.error !== null) return failed(organized.error);
      return json({ sections: organized.sections });
    },
  );

  // Icons: the installed catalogues.

  server.registerTool(
    "icon",
    {
      title: "Icons",
      description:
        "The installed iconify collections (lucide, material-symbols, tabler, carbon, ph): find glyph names, or fetch one glyph's inline SVG body and its box, for rendering at the theme's icon sizes.",
      inputSchema: {
        action: z.enum(["search", "body"]).describe("What to return."),
        query: z
          .string()
          .optional()
          .describe("search: case-insensitive substring of the glyph name."),
        collection: z
          .string()
          .optional()
          .describe(
            "search: one collection prefix; body: the glyph's, e.g. 'lucide'.",
          ),
        name: z
          .string()
          .optional()
          .describe("body: the glyph name, e.g. 'layout-dashboard'."),
        limit: z
          .number()
          .int()
          .positive()
          .max(200)
          .optional()
          .describe("search: rows to return (default 40)."),
      },
    },
    async ({ action, query, collection, name, limit }) => {
      if (action === "search") {
        const needle = query?.trim().toLowerCase() ?? "";
        const rows = (await client.icons.catalog({}))
          .filter((row) =>
            collection === undefined || row.collection === collection
          )
          .filter((row) =>
            needle === "" || row.name.toLowerCase().includes(needle)
          );
        return json({
          matching: rows.length,
          icons: rows.slice(0, limit ?? 40),
        });
      }
      if (collection === undefined || name === undefined) {
        return failed("body needs a collection and a glyph name");
      }
      const body = await client.icons.body({ collection, name });
      if (body === null) {
        return failed(`no glyph "${name}" in collection "${collection}"`);
      }
      return json(body);
    },
  );

  if (options?.studioActive === true) {
    server.registerTool(
      "brand_draft",
      {
        title: "Stage a brand draft in Studio",
        description:
          "Stage proposed brand token, palette, or typography changes into Studio's in-memory overlay without writing to disk. Only available while Studio is active.",
        inputSchema: {
          brand: z.string().describe("The brand or theme name to stage a draft for."),
          tokensJson: z
            .string()
            .optional()
            .describe("Complete DTCG JSON document text to stage."),
          palette: z
            .object({
              primary: z.string().describe("Primary color seed (hex/oklch)."),
              neutral: z
                .string()
                .optional()
                .describe("Optional neutral ramp seed."),
            })
            .optional()
            .describe("Palette seeds to apply onto the current brand document."),
          type: z
            .object({
              display: z.string().optional().describe("Display font family."),
              body: z.string().optional().describe("Body font family."),
              mono: z.string().optional().describe("Monospace font family."),
            })
            .optional()
            .describe("Typography families to apply onto the current brand document."),
        },
      },
      async ({ brand, tokensJson, palette, type }) => {
        const status = await client.overlay.status({});
        if (!status.studioActive) {
          return failed(
            "Studio is not active; start Studio to stage brand drafts.",
          );
        }

        let nextText = tokensJson;
        if (nextText === undefined) {
          const currentOverlay = await client.overlay.get({});
          const overlaid = currentOverlay.themes[brand];
          let baseText: string | null = overlaid !== undefined
            ? JSON.stringify(overlaid, null, 2)
            : null;
          if (baseText === null) {
            const read = await client.project.themes.read({ name: brand });
            baseText = read.text;
          }
          if (baseText === null) {
            return failed(`no theme named "${brand}" in this project`);
          }

          let workingDoc = JSON.parse(baseText) as ThemeDocument & {
            $extends?: string;
            modes?: string[];
          };

          if (palette !== undefined) {
            const language = typeof workingDoc.$extends === "string"
              ? workingDoc.$extends
              : "editorial";
            const seeded = seedPalette(language, {
              primary: palette.primary,
              ...(palette.neutral === undefined
                ? {}
                : { neutral: palette.neutral }),
            });
            if (seeded.layer === undefined) {
              return failed(seeded.issues.join("; "));
            }
            workingDoc = mergeThemeDocuments(
              workingDoc,
              seeded.layer,
            ) as ThemeDocument & { $extends?: string; modes?: string[] };
          }

          if (type !== undefined) {
            const family: Record<string, { $type: "fontFamily"; $value: string }> = {};
            if (type.display !== undefined) {
              family.display = { $type: "fontFamily", $value: type.display };
            }
            if (type.body !== undefined) {
              family.body = { $type: "fontFamily", $value: type.body };
            }
            if (type.mono !== undefined) {
              family.mono = { $type: "fontFamily", $value: type.mono };
            }
            if (Object.keys(family).length > 0) {
              workingDoc = mergeThemeDocuments(workingDoc, {
                font: { family },
              } as ThemeDocument) as ThemeDocument & {
                $extends?: string;
                modes?: string[];
              };
            }
          }

          nextText = JSON.stringify(workingDoc, null, 2);
        }

        const analysis = await client.theme.analyze({ text: nextText });
        if (analysis.error !== null) return failed(analysis.error);

        const currentOverlay = await client.overlay.get({});
        await client.overlay.set({
          themes: {
            ...currentOverlay.themes,
            [brand]: JSON.parse(nextText) as ThemeDocument,
          },
        });
        const after = await client.overlay.status({});
        return json({
          drafted: true,
          brand,
          dirty: after.dirty,
          issues: analysis.issues,
          message:
            "Draft staged in Studio; approve and save in Studio to write to disk.",
        });
      },
    );
  }

  server.registerResource(
    "project",
    "spin://project",
    {
      title: "The project",
      description:
        "The project this daemon serves: root, spin/ and uno config presence, theme files.",
      mimeType: "application/json",
    },
    async (uri) => {
      const report = await client.project.current({});
      return {
        contents: [{ uri: uri.href, text: JSON.stringify(report, null, 2) }],
      };
    },
  );

  server.registerResource(
    "theme",
    new ResourceTemplate("spin://themes/{name}", {
      list: async () => {
        const themes = await client.project.themes.list({});
        return {
          resources: themes.map((entry) => ({
            uri: `spin://themes/${entry.name}`,
            name: entry.name,
            mimeType: "application/json",
          })),
        };
      },
    }),
    {
      title: "A theme document",
      description: "One theme, as DTCG JSON text.",
      mimeType: "application/json",
    },
    async (uri, { name }) => {
      const themeName = String(name);
      const read = await client.project.themes.read({ name: themeName });
      if (read.text === null) {
        throw new Error(`no theme named "${themeName}" in this project`);
      }
      return { contents: [{ uri: uri.href, text: read.text }] };
    },
  );

  return server;
}

/** Build the MCP server, gating Studio-only tools on live Studio presence. */
export async function createSpinMcpServer(
  client: SpinClient,
): Promise<McpServer> {
  const status = await client.overlay
    .status({})
    .catch(() => ({ studioActive: false }));
  return buildSpinMcpServer(client, { studioActive: status.studioActive });
}

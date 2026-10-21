/**
 * The spin MCP server: a thin client over the daemon's RPC.
 *
 * Every tool maps to procedures the daemon already serves — same inputs, same
 * refusals, same files on disk — through the same typed client the studio
 * uses. This file adds exactly three things and no more: the names and
 * descriptions an agent reads, the composition of read → mutate → write →
 * validate into single calls (the RPC is deliberately stateless, and an agent
 * holding text across calls would also have to carry its own staleness), and
 * MCP's framing.
 *
 * The surface is one tool per noun an agent acts on, with `action` naming the
 * verb where a noun has more than one — seven tools rather than a tool per
 * procedure. The read-only documents are resources as well
 * (`spin://project`, `spin://themes/{name}`), so a client that renders
 * resources can look without calling a tool.
 *
 * When a tool needs something the RPC cannot answer, the fix is a procedure
 * in the daemon, never a workaround here.
 */

import { z } from "zod";
import type { SpinClient } from "@spin/api";
import { MODES, TOKEN_TYPES } from "@spin/theme";
import { McpServer, ResourceTemplate } from "./sdk.ts";

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

/**
 * The modes a document declares, in the vocabulary the analysis accepts.
 *
 * Read from the root `modes` field — the same place every consumer reads it —
 * so a theme that serves dark gets its coverage checked and one that does not
 * is analyzed as it is. Unparseable text is not this function's report to
 * make: analyze says what is wrong with it.
 */
function declaredModes(text: string): Array<"light" | "dark"> | undefined {
  try {
    const doc = JSON.parse(text) as { modes?: unknown };
    if (!Array.isArray(doc.modes)) return undefined;
    const modes = doc.modes.filter(
      (entry): entry is "light" | "dark" =>
        entry === "light" || entry === "dark",
    );
    return modes.length > 0 ? modes : undefined;
  } catch {
    return undefined;
  }
}

/**
 * The analysis a document gets after an edit: parse, validation, legibility,
 * and the document's own mode coverage. An edit is not done when the file
 * lands — it is done when the file still builds.
 */
async function analyzeWritten(client: SpinClient, text: string) {
  const modes = declaredModes(text);
  return await client.theme.analyze({
    text,
    ...(modes !== undefined ? { modes } : {}),
  });
}

/** The mutation reply, as every `theme.tokens.*` procedure returns it. */
interface MutationReply {
  error: string | null;
  code: string | null;
  text: string | null;
}

/**
 * Read → mutate → write → analyze: the shape every token edit takes.
 *
 * One tool call per edit because the RPC is deliberately stateless. The
 * mutation's refusal code survives the trip; the issues say whether the
 * document an edit produced still builds.
 */
async function edit(
  client: SpinClient,
  theme: string,
  mutate: (text: string) => Promise<MutationReply>,
): Promise<ToolResult> {
  const read = await client.project.themes.read({ name: theme });
  if (read.text === null) {
    return failed(`no theme named "${theme}" in this project`);
  }
  const result = await mutate(read.text);
  if (result.error !== null) {
    return failed(
      result.error,
      result.code === null ? {} : { code: result.code },
    );
  }
  const text = result.text as string;
  const written = await client.project.themes.write({ name: theme, text });
  if (written.error !== null) return failed(written.error);
  const analysis = await analyzeWritten(client, text);
  return json({ issues: analysis.issues, parseError: analysis.error });
}

/** Build the MCP server bound to one daemon. */
export function buildSpinMcpServer(client: SpinClient): McpServer {
  const server = new McpServer({ name: "spin", version: "0.1.0" });

  const theme = z.string().describe("Theme name, e.g. 'default'.");
  const mode = z
    .enum([...MODES] as ["light", "dark"])
    .optional()
    .describe("A mode's override ($modes.<mode>) instead of the base value.");

  // Themes: the documents an agent edits.

  server.registerTool(
    "theme",
    {
      title: "Themes",
      description:
        "A project's themes: list them, read one as DTCG JSON text, create one (a copy of an existing theme, or the scaffold of the required roles), write one whole, analyze one, or delete one. Write answers with the issues the written document still has.",
      inputSchema: {
        action: z
          .enum(["list", "read", "create", "write", "analyze", "delete"])
          .describe("What to do."),
        name: z
          .string()
          .optional()
          .describe(
            "The theme's name — read, create, write, analyze and delete.",
          ),
        from: z
          .string()
          .optional()
          .describe(
            "create: an existing theme to copy; scaffolded when absent.",
          ),
        text: z
          .string()
          .optional()
          .describe("write: the whole document, as DTCG JSON text."),
      },
    },
    async ({ action, name, from, text }) => {
      switch (action) {
        case "list": {
          const themes = await client.project.themes.list({});
          return json(
            themes.map((entry) => ({ name: entry.name, file: entry.file })),
          );
        }
        case "read": {
          if (name === undefined) return failed("read needs a theme name");
          const read = await client.project.themes.read({ name });
          if (read.text === null) {
            return failed(`no theme named "${name}" in this project`);
          }
          return { content: [{ type: "text", text: read.text }] };
        }
        case "create": {
          if (name === undefined) return failed("create needs a theme name");
          if (from !== undefined) {
            const copied = await client.project.themes.copy({
              from,
              to: name,
            });
            if (copied.error !== null) return failed(copied.error);
            return json({ theme: name, copiedFrom: from });
          }
          const scaffolded = await client.theme.scaffold({});
          const written = await client.project.themes.write({
            name,
            text: scaffolded.text,
          });
          if (written.error !== null) return failed(written.error);
          return json({ theme: name, copiedFrom: null });
        }
        case "write": {
          if (name === undefined) return failed("write needs a theme name");
          if (text === undefined) {
            return failed("write needs the document text");
          }
          const written = await client.project.themes.write({ name, text });
          if (written.error !== null) return failed(written.error);
          const analysis = await analyzeWritten(client, text);
          return json({ error: analysis.error, issues: analysis.issues });
        }
        case "analyze": {
          if (name === undefined) return failed("analyze needs a theme name");
          const read = await client.project.themes.read({ name });
          if (read.text === null) {
            return failed(`no theme named "${name}" in this project`);
          }
          const analysis = await analyzeWritten(client, read.text);
          return json({ error: analysis.error, issues: analysis.issues });
        }
        case "delete": {
          if (name === undefined) return failed("delete needs a theme name");
          const removed = await client.project.themes.remove({ name });
          if (removed.error !== null) return failed(removed.error);
          return json({ theme: name, removed: true });
        }
      }
    },
  );

  // Tokens: one edit per call, each validated on the way out.

  server.registerTool(
    "token",
    {
      title: "Tokens",
      description:
        "One theme's tokens: set a value (creating the token when the path is new), remove one, or rename one — a rename carries the value and its mode overrides. Every edit reads, mutates, writes and validates in one call, and answers with the issues the document still has.",
      inputSchema: {
        action: z.enum(["set", "remove", "rename"]).describe("What to do."),
        theme,
        path: z
          .string()
          .optional()
          .describe("set and remove: dotted path, e.g. 'color.primary'."),
        value: z
          .unknown()
          .optional()
          .describe(
            "set: the $value as JSON: a string like '#1d4ed8', a number, or an object for composite types.",
          ),
        type: z
          .enum(TOKEN_TYPES)
          .optional()
          .describe(
            "set: the DTCG $type; required when the token does not exist yet.",
          ),
        mode,
        from: z
          .string()
          .optional()
          .describe("rename: the token's current dotted path."),
        to: z.string().optional().describe("rename: its new dotted path."),
      },
    },
    async ({ action, theme, path, value, type, mode, from, to }) => {
      switch (action) {
        case "set": {
          if (path === undefined) return failed("set needs a token path");
          if (value === undefined) return failed("set needs a value");
          return await edit(
            client,
            theme,
            (text) =>
              client.theme.tokens.set({
                text,
                path: path.split("."),
                value,
                ...(type !== undefined ? { type } : {}),
                ...(mode !== undefined ? { mode } : {}),
              }),
          );
        }
        case "remove": {
          if (path === undefined) return failed("remove needs a token path");
          return await edit(
            client,
            theme,
            (text) =>
              client.theme.tokens.remove({ text, path: path.split(".") }),
          );
        }
        case "rename": {
          if (from === undefined || to === undefined) {
            return failed("rename needs both a from and a to path");
          }
          return await edit(
            client,
            theme,
            (text) =>
              client.theme.tokens.rename({
                text,
                from: from.split("."),
                to: to.split("."),
              }),
          );
        }
      }
    },
  );

  // Components and the utility surface.

  server.registerTool(
    "component",
    {
      title: "Primitive components",
      description:
        "The primitive library: list every component with its tags, variants and token reads, or one component's contract — tags, variants, reads, its component tokens, and the example markup it ships.",
      inputSchema: {
        action: z.enum(["list", "contract"]).describe("What to return."),
        name: z
          .string()
          .optional()
          .describe("contract: a component name, e.g. 'button'."),
      },
    },
    async ({ action, name }) => {
      if (action === "list") {
        const components = await client.primitives.list({});
        return json(
          components.map((entry) => ({
            name: entry.name,
            tags: entry.tags,
            variants: entry.variants,
            reads: entry.reads,
          })),
        );
      }
      if (name === undefined) return failed("contract needs a component name");
      const contract = await client.primitives.contract({ name });
      if ("error" in contract) return failed(contract.error);
      const summary = (await client.primitives.list({})).find(
        (entry) => entry.name === name,
      );
      return json({ ...contract, examples: summary?.examples ?? null });
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

  // Icons and fonts: the installed catalogues.

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

  server.registerTool(
    "font",
    {
      title: "Fonts",
      description:
        "The fontsource catalogue by family name — what a theme's `font.family.*` may name.",
      inputSchema: {
        query: z.string().optional().describe("Case-insensitive substring."),
      },
    },
    async ({ query }) =>
      json(
        await client.fonts.catalog(
          query === undefined ? {} : { query },
        ),
      ),
  );

  // The preview: the stylesheet a theme plus markup produces.

  server.registerTool(
    "preview",
    {
      title: "Preview a theme",
      description:
        "Generate the stylesheet a theme produces for the given markup — the studio's own preview path, scoped under .spin-preview.",
      inputSchema: {
        theme,
        markup: z
          .string()
          .optional()
          .describe("The markup whose utilities the sheet must carry."),
      },
    },
    async ({ theme, markup }) => {
      const read = await client.project.themes.read({ name: theme });
      if (read.text === null) {
        return failed(`no theme named "${theme}" in this project`);
      }
      const preview = await client.preview.css({
        text: read.text,
        name: theme,
        ...(markup !== undefined ? { markup } : {}),
      });
      if (preview.error !== null) return failed(preview.error);
      return json({ css: preview.css });
    },
  );

  // Read-only documents, for clients that render resources.

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

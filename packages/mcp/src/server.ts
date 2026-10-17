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
  const path = z.string().describe("Dotted token path, e.g. 'color.primary'.");
  const mode = z
    .enum([...MODES] as ["light", "dark"])
    .optional()
    .describe("A mode's override ($modes.<mode>) instead of the base value.");

  // The project.

  server.registerTool(
    "project_info",
    {
      title: "Project info",
      description:
        "The project this daemon serves: its root, whether it holds a spin/ directory and an uno config, and its theme file names.",
      inputSchema: {},
    },
    async () => json(await client.project.current({})),
  );

  // Themes: the documents themselves.

  server.registerTool(
    "list_themes",
    {
      title: "List themes",
      description:
        "Every theme in the project, with its path relative to the project root.",
      inputSchema: {},
    },
    async () => {
      const themes = await client.project.themes.list({});
      return json(
        themes.map((entry) => ({ name: entry.name, file: entry.file })),
      );
    },
  );

  server.registerTool(
    "read_theme",
    {
      title: "Read a theme",
      description: "One theme document, as DTCG JSON text.",
      inputSchema: { theme },
    },
    async ({ theme }) => {
      const read = await client.project.themes.read({ name: theme });
      if (read.text === null) {
        return failed(`no theme named "${theme}" in this project`);
      }
      return { content: [{ type: "text", text: read.text }] };
    },
  );

  server.registerTool(
    "create_theme",
    {
      title: "Create a theme",
      description:
        "Create a theme: a copy of an existing one, or a scaffold of the required roles when no source is named.",
      inputSchema: {
        theme,
        from: z.string().optional().describe("An existing theme to copy."),
      },
    },
    async ({ theme, from }) => {
      if (from !== undefined) {
        const copied = await client.project.themes.copy({ from, to: theme });
        if (copied.error !== null) return failed(copied.error);
        return json({ theme, copiedFrom: from });
      }
      const scaffolded = await client.theme.scaffold({});
      const written = await client.project.themes.write({
        name: theme,
        text: scaffolded.text,
      });
      if (written.error !== null) return failed(written.error);
      return json({ theme, copiedFrom: null });
    },
  );

  server.registerTool(
    "delete_theme",
    {
      title: "Delete a theme",
      description: "Delete a theme's file from the project.",
      inputSchema: { theme },
    },
    async ({ theme }) => {
      const removed = await client.project.themes.remove({ name: theme });
      if (removed.error !== null) return failed(removed.error);
      return json({ theme, removed: true });
    },
  );

  server.registerTool(
    "write_theme",
    {
      title: "Write a theme",
      description:
        "Replace a theme document with the given DTCG JSON text. Answers with the issues the written document still has.",
      inputSchema: {
        theme,
        text: z.string().describe("The whole document, as DTCG JSON text."),
      },
    },
    async ({ theme, text }) => {
      const written = await client.project.themes.write({ name: theme, text });
      if (written.error !== null) return failed(written.error);
      const analysis = await analyzeWritten(client, text);
      return json({ error: analysis.error, issues: analysis.issues });
    },
  );

  server.registerTool(
    "analyze_theme",
    {
      title: "Analyze a theme",
      description:
        "Parse, validate and legibility-check a theme file, including dark coverage when the document declares a dark mode. Writes nothing.",
      inputSchema: { theme },
    },
    async ({ theme }) => {
      const read = await client.project.themes.read({ name: theme });
      if (read.text === null) {
        return failed(`no theme named "${theme}" in this project`);
      }
      const analysis = await analyzeWritten(client, read.text);
      return json({ error: analysis.error, issues: analysis.issues });
    },
  );

  // Tokens: one edit per call, each validated on the way out.

  server.registerTool(
    "set_token",
    {
      title: "Set a token",
      description:
        "Set a token's value, creating it when the path is new ($type is then required). With mode, writes that mode's override. Answers with the issues the edited document still has.",
      inputSchema: {
        theme,
        path,
        value: z
          .unknown()
          .describe(
            "The $value as JSON: a string like '#1d4ed8', a number, or an object for composite types.",
          ),
        type: z
          .enum(TOKEN_TYPES)
          .optional()
          .describe(
            "The DTCG $type; required when the token does not exist yet.",
          ),
        mode,
      },
    },
    async ({ theme, path, value, type, mode }) =>
      await edit(client, theme, (text) =>
        client.theme.tokens.set({
          text,
          path: path.split("."),
          value,
          ...(type !== undefined ? { type } : {}),
          ...(mode !== undefined ? { mode } : {}),
        })),
  );

  server.registerTool(
    "remove_token",
    {
      title: "Remove a token",
      description:
        "Remove a token by path. Refused when the path names a required role. Answers with the issues the edited document still has.",
      inputSchema: { theme, path },
    },
    async ({ theme, path }) =>
      await edit(
        client,
        theme,
        (text) => client.theme.tokens.remove({ text, path: path.split(".") }),
      ),
  );

  server.registerTool(
    "rename_token",
    {
      title: "Rename a token",
      description:
        "Move a token to a new path, carrying its value and mode overrides. Answers with the issues the edited document still has.",
      inputSchema: {
        theme,
        from: z.string().describe("The token's current dotted path."),
        to: z.string().describe("Its new dotted path."),
      },
    },
    async ({ theme, from, to }) =>
      await edit(client, theme, (text) =>
        client.theme.tokens.rename({
          text,
          from: from.split("."),
          to: to.split("."),
        })),
  );

  // Components and the utility surface.

  server.registerTool(
    "list_components",
    {
      title: "List components",
      description:
        "Every primitive component: its name, tags, variants, and the theme tokens it reads.",
      inputSchema: {},
    },
    async () => {
      const components = await client.primitives.list({});
      return json(
        components.map((entry) => ({
          name: entry.name,
          tags: entry.tags,
          variants: entry.variants,
          reads: entry.reads,
        })),
      );
    },
  );

  server.registerTool(
    "component_contract",
    {
      title: "One component's contract",
      description:
        "One component's contract — tags, variants, token reads, and its character tokens — plus the example markup it ships.",
      inputSchema: {
        name: z.string().describe("Component name, e.g. 'button'."),
      },
    },
    async ({ name }) => {
      const contract = await client.primitives.contract({ name });
      if ("error" in contract) return failed(contract.error);
      const summary = (await client.primitives.list({})).find(
        (entry) => entry.name === name,
      );
      return json({ ...contract, examples: summary?.examples ?? null });
    },
  );

  server.registerTool(
    "list_utilities",
    {
      title: "List utilities",
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

  // Icons and fonts.

  server.registerTool(
    "search_icons",
    {
      title: "Search icons",
      description:
        "Find glyph names in the installed iconify collections (lucide, material-symbols, tabler, carbon, ph).",
      inputSchema: {
        query: z
          .string()
          .optional()
          .describe("Case-insensitive substring of the glyph name."),
        collection: z.string().optional().describe("One collection prefix."),
        limit: z
          .number()
          .int()
          .positive()
          .max(200)
          .optional()
          .describe("Rows to return (default 40)."),
      },
    },
    async ({ query, collection, limit }) => {
      const needle = query?.trim().toLowerCase() ?? "";
      const rows = (await client.icons.catalog({}))
        .filter((row) =>
          collection === undefined || row.collection === collection
        )
        .filter((row) =>
          needle === "" || row.name.toLowerCase().includes(needle)
        );
      return json({ matching: rows.length, icons: rows.slice(0, limit ?? 40) });
    },
  );

  server.registerTool(
    "icon_body",
    {
      title: "One icon's body",
      description:
        "One glyph's inline SVG body and its box, for rendering at the theme's icon sizes.",
      inputSchema: {
        collection: z.string().describe("Collection prefix, e.g. 'lucide'."),
        name: z.string().describe("Glyph name, e.g. 'layout-dashboard'."),
      },
    },
    async ({ collection, name }) => {
      const body = await client.icons.body({ collection, name });
      if (body === null) {
        return failed(`no glyph "${name}" in collection "${collection}"`);
      }
      return json(body);
    },
  );

  server.registerTool(
    "search_fonts",
    {
      title: "Search fonts",
      description: "Search the fontsource catalogue by family name.",
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
    "preview_css",
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

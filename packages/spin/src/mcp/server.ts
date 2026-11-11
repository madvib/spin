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
 * verb where a noun has more than one — nine tools rather than a tool per
 * procedure. The read-only documents are resources as well
 * (`spin://project`, `spin://themes/{name}`), so a client that renders
 * resources can look without calling a tool.
 *
 * When a tool needs something the RPC cannot answer, the fix is a procedure
 * in the daemon, never a workaround here.
 */

import { z } from "zod";
import type { SpinClient } from "../api/index.ts";
import { MODES, TOKEN_TYPES } from "@spinjs/theme";
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
        "A project's themes: list them, read one as DTCG JSON text, create one as a copy of an existing theme, write one whole, analyze one, or delete one. Write answers with the issues the written document still has.",
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
            "create: an existing theme to copy.",
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
          if (from === undefined) return failed("create needs a source theme to copy via from");
          const copied = await client.project.themes.copy({
            from,
            to: name,
          });
          if (copied.error !== null) return failed(copied.error);
          return json({ theme: name, copiedFrom: from });
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
    "savedIcon",
    {
      title: "Saved icons",
      description:
        "The icons this project has saved — its own curated library, as against the searchable catalogue the `icon` tool reads. Use this when an icon is part of the project: list what it has kept (each with where it came from), read one's markup, save a glyph the project has chosen, or remove one. Use `icon` to find a glyph in the installed collections; use this to keep one.",
      inputSchema: {
        action: z.enum(["list", "read", "save", "remove"]).describe(
          "What to do.",
        ),
        name: z
          .string()
          .optional()
          .describe("read, save and remove: the icon's name, e.g. 'arrow-up'."),
        markup: z
          .string()
          .optional()
          .describe("save: the inline SVG markup the icon draws."),
        collection: z
          .string()
          .optional()
          .describe("save: the collection the glyph came from, e.g. 'lucide'."),
        author: z
          .string()
          .optional()
          .describe("save: who made it."),
        license: z
          .string()
          .optional()
          .describe("save: the licence it is under, e.g. 'ISC'."),
      },
    },
    async ({ action, name, markup, collection, author, license }) => {
      switch (action) {
        case "list": {
          const icons = await client.icons.saved.list({});
          return json(
            icons.map((icon) => ({
              name: icon.name,
              attribution: icon.attribution,
            })),
          );
        }
        case "read": {
          if (name === undefined) return failed("read needs an icon name");
          const read = await client.icons.saved.read({ name });
          if (read.icon === null) {
            return failed(`no saved icon named "${name}" in this project`);
          }
          return json({
            name: read.icon.name,
            markup: read.icon.markup,
            attribution: read.icon.attribution,
          });
        }
        case "save": {
          if (name === undefined) return failed("save needs an icon name");
          if (markup === undefined) {
            return failed("save needs the icon's markup");
          }
          const saved = await client.icons.saved.save({
            name,
            markup,
            attribution: {
              collection: collection ?? null,
              author: author ?? null,
              license: license ?? null,
            },
          });
          if (saved.error !== null) return failed(saved.error);
          return json({ name, saved: true });
        }
        case "remove": {
          if (name === undefined) return failed("remove needs an icon name");
          const removed = await client.icons.saved.remove({ name });
          if (removed.error !== null) return failed(removed.error);
          return json({ name, removed: true });
        }
      }
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

  // Diagnostics and corpus findings: what the lints say about the project's source.

  server.registerTool(
    "findings",
    {
      title: "Findings",
      description:
        "Run the project's lints and corpus analysis over its source files: list all lint findings grouped by rule, apply one finding's quick-fix edit to disk, inspect repeated class compositions and class-order drift across the corpus, rewrite a file's class lists in canonical order, or declare a reusable shortcut in the project's config.",
      inputSchema: {
        action: z
          .enum(["list", "fix", "corpus", "order", "shortcut"])
          .describe("What to do."),
        file: z
          .string()
          .optional()
          .describe("fix and order: project-relative file path."),
        ruleId: z
          .string()
          .optional()
          .describe("fix: rule identifier, e.g. 'spin/no-redundant-class'."),
        line: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("fix: 1-based line number of the finding."),
        column: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("fix: 1-based column number of the finding."),
        name: z
          .string()
          .optional()
          .describe("shortcut: class name to declare, e.g. 'stack'."),
        classes: z
          .string()
          .optional()
          .describe("shortcut: class list the shortcut expands to."),
      },
    },
    async ({ action, file, ruleId, line, column, name, classes }) => {
      switch (action) {
        case "list":
          return json(await client.findings.list({}));
        case "corpus":
          return json(await client.findings.corpus({}));
        case "fix": {
          if (
            file === undefined ||
            ruleId === undefined ||
            line === undefined ||
            column === undefined
          ) {
            return failed(
              "fix requires file, ruleId, line, and column",
            );
          }
          const res = await client.findings.fix({
            file,
            ruleId,
            line,
            column,
          });
          if (res.error !== null) return failed(res.error);
          return json(res);
        }
        case "order": {
          if (file === undefined) {
            return failed("order requires a file path");
          }
          const res = await client.findings.order({ file });
          if (res.error !== null) return failed(res.error);
          return json(res);
        }
        case "shortcut": {
          if (name === undefined || classes === undefined) {
            return failed("shortcut requires name and classes");
          }
          const res = await client.findings.shortcut({
            name,
            classes: classes.split(/\s+/).filter((c) => c.length > 0),
          });
          if (res.error !== null) return failed(res.error);
          return json(res);
        }
      }
    },
  );

  server.registerTool(
    "brand_rename",
    {
      title: "Rename a brand",
      description:
        "Rename a brand: its spin/<brand>/ directory, the config seating and order naming it, and the name inside its definition. Flat themes are not brands and cannot be renamed.",
      inputSchema: {
        brand: z.string().describe("The brand's current name."),
        to: z.string().describe("The name the brand takes."),
      },
    },
    async ({ brand, to }) => {
      const project = await client.project.current({});
      const renamed = await client.project.brand.rename({
        root: project.root,
        brand,
        to,
      });
      if (renamed.error !== null) return failed(renamed.error);
      return json({ brand: to, renamedFrom: brand });
    },
  );

  // Brands: the init sequence's procedures, one tool each.

  server.registerTool(
    "brand_create",
    {
      title: "Create a brand",
      description:
        "Create a brand: its spin/<brand>/ directory, its brand.json definition, and its config seating. Zero tokens; the design language, palette, and type follow as their own calls.",
      inputSchema: {
        name: z.string().describe("The brand's name: the directory and the seating key."),
        description: z.string().optional().describe("Plain text on the brand definition file."),
      },
    },
    async ({ name, description }) => {
      const project = await client.project.current({});
      const created = await client.project.brand.create({
        root: project.root,
        name,
        ...(description === undefined ? {} : { description }),
      });
      if (created.error !== null) return failed(created.error);
      return json({ brand: name });
    },
  );

  server.registerTool(
    "brand_setDesignLanguage",
    {
      title: "Set the brand's design language",
      description:
        "Name the brand's design language: writes $extends in tokens.json, nothing else.",
      inputSchema: {
        brand: z.string().describe("The brand to seat a language on."),
        language: z.string().describe("One of the shipped design languages."),
      },
    },
    async ({ brand, language }) => {
      const project = await client.project.current({});
      const seated = await client.project.brand.setDesignLanguage({
        root: project.root,
        brand,
        language,
      });
      if (seated.error !== null) return failed(seated.error);
      return json({ brand, language });
    },
  );

  server.registerTool(
    "brand_setPalette",
    {
      title: "Seed the brand's palette",
      description:
        "Seed the brand's palette from one primary color plus an optional neutral seed. Floors validated before write; a refusal names why.",
      inputSchema: {
        brand: z.string().describe("The brand to seed."),
        primary: z.string().describe("The brand's mark: primary actions, links, focus rings."),
        neutral: z.string().optional().describe("The neutral ramp's own seed."),
      },
    },
    async ({ brand, primary, neutral }) => {
      const project = await client.project.current({});
      const seeded = await client.project.brand.setPalette({
        root: project.root,
        brand,
        primary,
        ...(neutral === undefined ? {} : { neutral }),
      });
      if (seeded.error !== null) return failed(seeded.error);
      return json({ brand, primary });
    },
  );

  server.registerTool(
    "brand_setType",
    {
      title: "Set the brand's type",
      description:
        "Set the brand's type: a curated suggestion by design language, explicit faces, and the icon collection plus stroke beside them.",
      inputSchema: {
        brand: z.string().describe("The brand to set type on."),
        suggestion: z.string().optional().describe("A design language whose pairing to wear outright."),
        display: z.string().optional().describe("The display face."),
        body: z.string().optional().describe("The body face."),
        mono: z.string().optional().describe("The mono face."),
        icons: z.string().optional().describe("The icon collection, kept as metadata."),
        stroke: z.string().optional().describe("The icon stroke: outline or filled."),
      },
    },
    async ({ brand, suggestion, display, body, mono, icons, stroke }) => {
      const project = await client.project.current({});
      const set = await client.project.brand.setType({
        root: project.root,
        brand,
        ...(suggestion === undefined ? {} : { suggestion }),
        ...(display === undefined ? {} : { display }),
        ...(body === undefined ? {} : { body }),
        ...(mono === undefined ? {} : { mono }),
        ...(icons === undefined ? {} : { icons }),
        ...(stroke === undefined ? {} : { stroke }),
      });
      if (set.error !== null) return failed(set.error);
      return json({ brand });
    },
  );

  server.registerTool(
    "brand_get",
    {
      title: "Read a brand",
      description:
        "Read a brand: its definition, its sparse layers, and the composition's judgment.",
      inputSchema: {
        brand: z.string().describe("The brand to read."),
      },
    },
    async ({ brand }) => {
      const project = await client.project.current({});
      const report = await client.project.brand.get({
        root: project.root,
        brand,
      });
      return json(report);
    },
  );

  server.registerTool(
    "facet_create",
    {
      title: "Create a facet",
      description:
        "Write one facet file beside the theme it composes over: a palette facet (color.*) or a spacing facet (spacing.*). Shape-checked before write; a refusal names the file and the wrong keys.",
      inputSchema: {
        name: z.string().describe("The facet's name."),
        base: z.string().describe("The theme the facet composes over."),
        kind: z.enum(["palette", "spacing"]).describe("Which tokens the facet carries."),
        tokens: z.record(z.string(), z.unknown()).describe("The facet document, as DTCG JSON."),
      },
    },
    async ({ name, base, kind, tokens }) => {
      const project = await client.project.current({});
      const created = await client.project.themes.createFacet({
        root: project.root,
        name,
        base,
        kind,
        tokens,
      });
      if (created.error !== null) return failed(created.error);
      return json({ facet: `${name}.${kind}` });
    },
  );

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

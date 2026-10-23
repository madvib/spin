<!-- USER COPY SLOT: mcp-intro — your own agent-workflow framing, or the default below. -->

# MCP & Agents

An agent that writes markup blind invents names. The MCP server connects the
agent to your project before it writes a word: eight tools over the daemon RPC,
two resources for read-only documents, and the house skill that teaches the
theme language.

```json
{
  "mcpServers": {
    "spin": {
      "command": "deno",
      "args": [
        "run",
        "--allow-net",
        "--allow-env",
        "packages/mcp/src/main.ts",
        "--daemon",
        "http://127.0.0.1:7463/rpc"
      ]
    }
  }
}
```

Run it from your spin workspace: `main.ts` is the stdio entry, `--daemon` points
at the daemon the dev server already runs, and the tools answer over that RPC.
Nothing is published yet — v0.1 is source-first, so the server runs from the
tree you have.

## The eight tools

| Tool        | Actions                                                | What the agent gets                                                                                                                     |
| ----------- | ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| `theme`     | `list`, `read`, `create`, `write`, `analyze`, `delete` | Whole DTCG documents — create forks a theme or scaffolds the required roles; `analyze` answers with the issues the document still has   |
| `token`     | `set`, `remove`, `rename`                              | Atomic token edits: read → mutate → write → validate in one call, so the document is never half-written                                 |
| `component` | `list`, `contract`                                     | Every primitive's tags, variants, token reads, component tokens, and example HTML — the names the agent may write                       |
| `utility`   | —                                                      | The project theme's utilities grouped by intent — the classes the agent may spend                                                       |
| `icon`      | `search`, `body`                                       | The 5 installed Iconify collections (`lucide`, `material-symbols`, `tabler`, `carbon`, `ph`): find glyph names, fetch inline SVG bodies |
| `savedIcon` | `list`, `read`, `save`, `remove`                       | Your project's `spin/icons/*.svg` — saved glyphs with attribution                                                                       |
| `font`      | —                                                      | The Fontsource catalog by family name — what `font.family.*` may name                                                                   |
| `preview`   | —                                                      | Scoped `.spin-preview` CSS for a theme plus a markup snippet — render before committing                                                 |

## The two resources

`spin://project` answers what the project holds — themes, primitives, shortcuts
— for any client that renders before acting. `spin://themes/{name}` answers one
theme as DTCG JSON text, the same bytes the Studio edits and the sheet spends.

## The house skill

The skill is the theme module's manual: the order of the work, the checklist of
the theme's own groups, the gates and what each failure means. This site serves
the assembled file beside the docs — install it with:

```bash
curl -fsSL http://localhost:5199/skill/spin-theme/SKILL.md -o ~/.claude/skills/spin-theme/SKILL.md
```

<!-- USER COPY SLOT: mcp-close — your own agent policy (which tools are read-only, who may write). -->

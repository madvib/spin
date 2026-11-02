<!-- USER COPY SLOT: mcp-intro — your own agent-workflow framing, or the default below. -->

An agent that writes markup blind invents names. The MCP server connects the
agent to your project before it writes a word: eight tools over the daemon RPC,
two resources for read-only documents, and the house skill that teaches the
theme language.

`spin mcp` starts the stdio server and reads the project's themes and
components. Add `--url http://127.0.0.1:7463/rpc` to dial a running daemon
instead. `spin studio` serves that RPC at `http://127.0.0.1:7463/rpc` and the
Studio at `http://127.0.0.1:7463/studio/`. 0.1 is a preview; the server ships
in `@spinjs/spin` as `spin mcp`.

## The eight tools

`theme` (whole DTCG documents — list, read, create, write, analyze, delete),
`token` (atomic token edits — set, remove, rename), `component` (every
primitive's tags, variants, token reads, and example HTML), `utility` (the
project theme's utilities grouped by intent), `icon` (the five installed
Iconify collections — search names, fetch SVG bodies), `savedIcon` (your
project's `spin/icons/*.json` with attribution), `font` (the Fontsource
catalog by family name), and `preview` (scoped `.spin-preview` CSS for a
theme plus a markup snippet). The table below the page keeps the same list
beside the connection config.
## The two resources

`spin://project` answers what the project holds — themes, primitives, shortcuts
— for any client that renders before acting. `spin://themes/{name}` answers one
theme as DTCG JSON text, the same bytes the Studio edits and the sheet spends.

## The house skill

The file is served at `/skill/spin-theme/SKILL.md` beside this page. Fetch it
from the origin you are reading the docs on — the dev server below is `:5174`:

```bash
curl -fsSL http://localhost:5174/skill/spin-theme/SKILL.md -o ~/.claude/skills/spin-theme/SKILL.md
```

Or copy it from the installed package — the same bytes the site serves, since
both are assembled from the theme module's own contract:

```bash
cp node_modules/@spinjs/spin/skill/SKILL.md ~/.claude/skills/spin-theme/SKILL.md
cp node_modules/@spinjs/spin/skill/*.md ~/.claude/skills/spin-theme/
```

<!-- USER COPY SLOT: mcp-close — your own agent policy (which tools are read-only, who may write). -->

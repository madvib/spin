<!-- USER COPY SLOT: mcp-intro — your own agent-workflow framing, or the default below. -->

An agent that writes markup blind invents names. The MCP server connects the
agent to your project before it writes a word: sixteen tools over the daemon RPC
and two resources for read-only documents.

`spin mcp` starts the stdio server and reads the project's themes and
components. Add `--url http://127.0.0.1:7463/rpc` to dial a running daemon
instead. `spin studio` serves that RPC at `http://127.0.0.1:7463/rpc` and the
Studio at `http://127.0.0.1:7463/studio/`. 0.2 is a preview; the server ships
in `@spinjs/dev` as `spin mcp`.

## The sixteen tools

Nine tools read and edit the project's working surface: `theme` (whole DTCG
documents — list, read, create, write, analyze, delete), `token` (atomic token
edits — set, remove, rename), `component` (every primitive's tags, variants,
token reads, and example HTML — list, contract, examples, copy), `utility`
(the project theme's utilities grouped by intent), `icon` (the five installed
Iconify collections — search names, fetch SVG bodies), `savedIcon` (your
project's `spin/icons/*.json` with attribution), `font` (the Fontsource
catalog by family name), `preview` (scoped `.spin-preview` CSS for a
theme plus a markup snippet), and `findings` (project lints and corpus
analysis — list, fix, corpus, order, shortcut).

Seven tools run the brand lifecycle in `spin/<brand>/`: `brand_create` (the
directory, `brand.json`, and config seating — zero tokens), then
`brand_setDesignLanguage` (the parent `$extends`), `brand_setPalette` (the
primary seed, floors validated before write), and `brand_setType` (the curated
pairing or explicit faces, with icons) — the same four steps as the Studio's
`/init` wizard, one call each. `brand_get` reads a brand back with the
composition's judgment, `brand_rename` moves the directory and every name
pointing at it, and `facet_create` writes one `*.palette.json` or
`*.spacing.json` runtime overlay beside the theme it composes over. The table
below the page keeps the same list beside the connection config.

## The two resources

`spin://project` answers what the project holds — themes, primitives, shortcuts
— for any client that renders before acting. `spin://themes/{name}` answers one
theme as DTCG JSON text, the same bytes the Studio edits and the sheet spends.


<!-- USER COPY SLOT: mcp-close — your own agent policy (which tools are read-only, who may write). -->

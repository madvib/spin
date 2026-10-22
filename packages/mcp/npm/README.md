# @spin/mcp

The MCP server: the daemon's procedures, spoken in the vocabulary an agent
reads. A thin client over the same RPC the studio uses — same inputs, same
refusals, same files on disk.

## Exports

```
@spin/mcp
  buildSpinMcpServer   the server, bound to one daemon client

@spin/mcp/server
  buildSpinMcpServer

@spin/mcp/main
  the stdio entry point: what an MCP client launches
```

```
deno run --allow-net --allow-env src/main.ts --daemon http://127.0.0.1:7463/rpc
```

The daemon's address comes from `--daemon <url>` or `SPIN_DAEMON_URL`, and
absent both, the daemon's own default.

## The tools

One tool per noun an agent acts on, with `action` naming the verb where a noun
has more than one.

| Tool        | Actions                                                    |
| ----------- | ---------------------------------------------------------- |
| `theme`     | list · read · create · write · analyze · delete            |
| `token`     | set · remove · rename                                      |
| `component` | list · contract                                            |
| `utility`   | the utility classes a theme can produce, grouped by intent |
| `icon`      | search · body                                              |
| `savedIcon` | list · read · save · remove                                |
| `font`      | the fontsource catalogue, filtered by name                 |
| `preview`   | the stylesheet a theme plus markup produces                |

`icon` reads the catalogue: the installed collections, searchable, with a
glyph's body on demand. `savedIcon` reads the project's own library: the curated
set it keeps, each with where it came from. One is what anybody may draw; the
other is what this project has chosen.

Two resources carry the read-only documents, for clients that render resources:
`spin://project` (the root, the config presence, the theme files) and
`spin://themes/{name}` (one theme, as DTCG JSON text).

## Contract

Every tool maps to procedures the daemon already serves. The server adds three
things and no more: the names and descriptions an agent reads, the composition
of read → mutate → write → validate into single calls, and MCP's framing.

The composition matters because the RPC is deliberately stateless: an agent
holding text across calls would also have to carry its own staleness. One call
per edit, and the edit answers with the issues the document still has — an edit
is not done when the file lands, it is done when the file still builds.

A tool that needs something the RPC cannot answer is a missing procedure, not a
workaround here.

The server is built from a daemon client, so tests build it against a real
daemon on a temporary root.

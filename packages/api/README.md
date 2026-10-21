# @spin/api

The daemon: the procedures the studio and the MCP server share, over RPC. This
package owns the transport, not the definitions — each module owns its own
contract and its own handlers, and this one mounts them.

## Exports

```
@spin/api
  router           every module's procedures, mounted by name
  rpcHandler       the oRPC handler over that router
  createSpinClient a typed client over a fetch link
  SpinClient       the client's type
  handleApiRequest mount the router on a Fetch-API host
  mountSpinApp     mount the app — procedures and studio bundle — on a dev server
  SpinAppOptions   MiddlewareHost

  contracts        themeContract · themeRouter        (from @spin/theme)
                   presetContract · presetRouter      (from @spin/preset)
                   primitivesContract · primitivesRouter
                   projectContract · previewContract · iconsContract

@spin/api/daemon
  startDaemon      bind a port and serve the shared app
  DaemonOptions    Daemon

@spin/api/project
  projectRouter · setProjectRoot

@spin/api/serve
  the `spin daemon` entry: one process, one port, one project root
```

## The procedures

The router is the union of every module's router:

| Namespace      | What it answers                                                                          |
| -------------- | ---------------------------------------------------------------------------------------- |
| `theme.*`      | analyze a document · its CSS · its types · the scaffold · set, remove and rename a token |
| `themes.css`   | the stylesheet for a set of documents                                                    |
| `preset.*`     | the utilities a theme resolves · the same, grouped by intent                             |
| `primitives.*` | the element library: its contracts, its tokens                                           |
| `project.*`    | the project: detect, current, init, and the themes on disk                               |
| `preview.css`  | the stylesheet a theme plus markup produces                                              |
| `overlay.*`    | the live overlay: set, clear, and what it holds                                          |
| `icons.*`      | the installed iconify collections: names, then glyph bodies                              |
| `fonts.*`      | the font catalogue, filtered by name                                                     |

`project.*` is transport over `@spin/project`. The contract stays here — it is
the wire shape, and the wire is the daemon's — while the operations live in the
module that owns them: where a project's files are, what a theme document is,
and what a configuration declares. The handlers hold no filesystem code; they
name the root, ask the service, and answer.

## Contract

One app, every host. `createSpinApp` is what the standalone daemon mounts and
what the dev server mounts, so the two cannot drift.

The daemon binds loopback by default, because it writes to disk and a socket
open to the network is a remote write to a developer's project. Widening the
bind is an explicit choice, made by the caller.

One origin: the procedures, the studio bundle and the overlay badge are served
together, so the tool and the project it edits need no CORS. The one exception
is the standalone studio dev server, which is loopback-only for the same reason
the daemon is.

Every filesystem procedure resolves a root per call — the daemon's, or the one
the call names — so one process can serve many projects without shared state.

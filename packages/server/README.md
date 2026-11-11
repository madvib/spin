# @spinjs/server

The project server: the filesystem, the procedures, and the daemon session.
It owns where a project's themes and configuration live — every reader asks
it.

```ts
import { startDaemon } from "@spinjs/server/daemon";

const daemon = await startDaemon({ root, app });
```

## Subpaths

- `@spinjs/server` — the server surface.
- `@spinjs/server/project` — project reads and writes: themes, components,
  config, session, overlays.
- `@spinjs/server/procedures` — the project, icon, font, and overlay routers.
- `@spinjs/server/daemon` — `startDaemon`: serve a project over RPC.

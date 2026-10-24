# @spinjs/spin

The spin toolchain: themes, the Uno preset and `spin()` plugin, project
operations, diagnostics, the daemon, and the agent server.

```sh
npm i -D @spinjs/spin
```

```ts
import { spin } from "@spinjs/spin/vite";

export default {
  plugins: [spin.vite()],
};
```

One `spin.vite()` call wires two stages: the `.html → define()` elements
transform (`pre`) and the stylesheet plus dev chrome (`post`). Subpaths:

- `@spinjs/spin/vite` — the plugin.
- `@spinjs/spin/eslint` — the lint rules.
- `@spinjs/spin/cli` — the `spin` command (`spin lint`, `spin check`).
- `@spinjs/spin/mcp` — the agent server entry.
- `@spinjs/spin/theme`, `/preset`, `/project`, `/diagnostics`, `/api`,
  `/animation` — the toolchain areas.

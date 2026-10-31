<!-- USER COPY SLOT: install-intro — your own setup framing, or the default below. -->

# Install

One package. One plugin. One stylesheet import.

```bash
npm install @spinjs/spin
```

```ts
// vite.config.ts
import { spin } from "@spinjs/spin/vite";
import myTheme from "./theme.json" with { type: "json" };

export default {
  plugins: [spin.vite({ themes: { myTheme } })],
};
```

```ts
// src/main.ts — the entry your bundler reads
import "uno.css";
```

You get the five starter themes out of the box; pass your own documents in
`themes` when you have them. A project that keeps its theme at `spin/*.json`
drops files in that directory to fork a starter or add a theme — no config
change.

## The plugin, per bundler

`spin.vite()` is the whole toolchain: it scans your sources, generates the sheet
from your themes, and serves the stylesheet as the `uno.css` virtual module the
Studio can swap in place. It replaces the Uno plugin — there is no
`uno.config.ts` to keep in step.

```ts
// rollup.config.ts
import { spin } from "@spinjs/spin/vite";
export default { plugins: [spin.rollup()] };
```

```ts
// rspack.config.ts
import { spin } from "@spinjs/spin/vite";
export default { plugins: [spin.rspack()] };
```

```js
// webpack.config.js
const { spin } = require("@spinjs/spin/vite");
module.exports = { plugins: [spin.webpack()] };
```

Outside Vite the plugin answers in each bundler's own shape — sheet only, no dev
half. The Studio and the live overlay need the dev server, so outside Vite you
edit themes with the Studio running beside the daemon the API package serves
(`mountSpinApp`), not from a standalone binary — v0.1 has none.

// @refresh reload
import { render } from "solid-js/web";
import App from "./app.tsx";

// The semantic layer ships through the preset preflight, not an injected tag.
// `entry-client` therefore mounts and nothing else: there is no second,
// out-of-band copy of the layer for the gates to disagree with.
//
// The app's own compositions are not here either. They are shortcuts, declared
// in `vite.config.ts`, so they are generated with the rest of the sheet — one
// stylesheet, one source of truth.
import "spin/components";
render(() => <App />, document.getElementById("app")!);

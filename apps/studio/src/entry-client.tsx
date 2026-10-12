// @refresh reload
import { mount, StartClient } from "@solidjs/start/client";
import { injectShortcuts } from "./lib/layout.ts";

// The semantic layer ships through the preset preflight, not an injected tag.
// `entry-client` therefore mounts and nothing else: there is no second,
// out-of-band copy of the layer for the gates to disagree with.
//
// The one addition is the app's own layout shortcuts, which are dogfooded here
// and promoted to the preset only once the composition is proven.
injectShortcuts();
mount(() => <StartClient />, document.getElementById("app")!);

// @refresh reload
import { mount, StartClient } from "@solidjs/start/client";

// The semantic layer ships through the preset preflight, not an injected tag.
// `entry-client` therefore mounts and nothing else: there is no second,
// out-of-band copy of the layer for the gates to disagree with.
mount(() => <StartClient />, document.getElementById("app")!);

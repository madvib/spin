import { resolve } from "node:path";
import type { Plugin } from "vite";
import { buildContent } from "./build-content.ts";

// The reference renders its pages to src/content/ ahead of the Uno scanner,
// so an edit under server/ or packages/*/src/ is invisible until the content
// is rebuilt. This watches those trees, reruns build-content, and reloads.
const ROOT = resolve(import.meta.dirname!, "../..");

// server/*.ts is flat; package sources live under each package's src/.
// src/content/ is the rendered output — never a rebuild trigger.
const SOURCE = /(?:^|\/)(?:server\/[^/]+\.ts|packages\/[^/]+\/src\/.*\.ts)$/;
const OUTPUT = /(?:^|\/)src\/content\//;

export const referenceHmr: Plugin = {
  name: "reference-hmr",
  apply: "serve",
  configureServer(server) {
    let timer: NodeJS.Timeout | undefined;
    const rebuild = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        buildContent()
          .then(() => server.ws.send({ type: "full-reload" }))
          .catch((error) => server.config.logger.error(String(error)));
      }, 300);
    };
    server.watcher.add([resolve(ROOT, "server"), resolve(ROOT, "packages")]);
    server.watcher.on("change", (file) => {
      if (SOURCE.test(file) && !OUTPUT.test(file)) rebuild();
    });
  },
};

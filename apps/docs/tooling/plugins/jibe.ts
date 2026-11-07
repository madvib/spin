import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Plugin } from "vite";

export function jibeIsolation(): Plugin {
  const apply = (
    _req: unknown,
    res: { setHeader(name: string, value: string): void },
    next: () => void,
  ): void => {
    res.setHeader("cross-origin-opener-policy", "same-origin");
    res.setHeader("cross-origin-embedder-policy", "require-corp");
    res.setHeader("cross-origin-resource-policy", "cross-origin");
    res.setHeader("access-control-allow-origin", "*");
    next();
  };
  return {
    name: "spin:jibe-isolation",
    configureServer(server) {
      server.middlewares.use(apply);
    },
    configurePreviewServer(server) {
      server.middlewares.use(apply);
    },
  };
}

export function jibeStudio(options: {
  /** The docs app root, where the bridge source lives. */
  readonly docsRoot: string;
  /** The built studio's `dist` directory. */
  readonly studioRoot: string;
}): Plugin {
  const bridge = resolve(options.docsRoot, "src/shell/studio-bridge.js");
  const bridgeVersion = (): string =>
    createHash("sha256").update(readFileSync(bridge)).digest("hex").slice(0, 8);
  const index = (): string =>
    readFileSync(resolve(options.studioRoot, "index.html"), "utf8").replace(
      "</head>",
      `<script src="/studio-bridge.js?v=${bridgeVersion()}"></script></head>`,
    );
  return {
    name: "spin:jibe-studio",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = new URL(req.url ?? "/", "http://localhost");
        if (url.pathname === "/studio-bridge.js") {
          res.setHeader("content-type", "text/javascript; charset=utf-8");
          res.end(readFileSync(bridge));
          return;
        }
        if (
          url.pathname !== "/__spin/jibe-studio" &&
          url.pathname !== "/__spin/jibe-studio/" &&
          !url.pathname.startsWith("/__spin/jibe-studio/")
        ) {
          return next();
        }
        const path = url.pathname.slice("/__spin/jibe-studio".length);
        if (
          path === "" ||
          path === "/" ||
          path.endsWith("/index.html") ||
          !path.includes(".")
        ) {
          res.setHeader("content-type", "text/html; charset=utf-8");
          res.end(index());
          return;
        }
        const file = resolve(options.studioRoot, path.replace(/^\/+/, ""));
        if (!file.startsWith(options.studioRoot) || !existsSync(file)) {
          res.statusCode = 404;
          res.end("not found");
          return;
        }
        res.setHeader(
          "content-type",
          file.endsWith(".js")
            ? "text/javascript; charset=utf-8"
            : file.endsWith(".css")
            ? "text/css; charset=utf-8"
            : file.endsWith(".html")
            ? "text/html; charset=utf-8"
            : "application/octet-stream",
        );
        res.end(readFileSync(file));
      });
    },
  };
}

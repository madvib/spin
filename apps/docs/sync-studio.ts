/**
 * Copies the built studio into the docs' public tree for production.
 *
 * The playground mounts the studio at `/__spin/jibe-studio/`, and the studio's
 * RPC calls are answered by the page that hosts the embed. Two pieces make it
 * work on a static host: the bundle itself, and `studio-bridge.js`, which is
 * injected into the studio's `index.html` so it patches `fetch` before the
 * studio's modules load.
 *
 * Development does not run this: the docs Vite server serves both straight
 * from `apps/studio/dist` and `src/studio-bridge.js`.
 */
import { createHash } from "node:crypto";
import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const docs = import.meta.dirname;
const source = resolve(docs, "../studio/dist");
const target = resolve(docs, "public/__spin/jibe-studio");
const bridge = resolve(docs, "public/studio-bridge.js");

await mkdir(resolve(target), { recursive: true });
await cp(source, target, { recursive: true });

const index = await readFile(resolve(target, "index.html"), "utf8");
const bridgeSource = await readFile(resolve(docs, "src/studio-bridge.js"));
const bridgeVersion = createHash("sha256")
  .update(bridgeSource)
  .digest("hex")
  .slice(0, 8);
if (!index.includes("/studio-bridge.js")) {
  await writeFile(
    resolve(target, "index.html"),
    index.replace(
      "</head>",
      `<script src="/studio-bridge.js?v=${bridgeVersion}"></script></head>`,
    ),
  );
}

await cp(resolve(docs, "src/studio-bridge.js"), bridge);

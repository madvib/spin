import type { Connect } from "vite";
import { shell } from "../../../server/shell.ts";
import { rendered } from "../../../server/specimen.ts";

const handler: Connect.NextHandleFunction = (req, res) => {
  void (async () => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const id = url.pathname.replace(/^\/|\/$/g, "") || rendered[0]?.id;

    const isSurface = id === "utilities" || id === "components" ||
      id.startsWith("utilities/");
    if (!isSurface && !rendered.find((r) => r.id === id)) {
      res.statusCode = 404;
      res.end("Not found");
      return;
    }

    const theme = "default";
    const mode = "base";
    const surface = id.startsWith("utilities") || id === "utilities"
      ? "utilities"
      : "components";
    const route = id === "components" ? (rendered[0]?.id ?? "button") : id;
    const group = id.startsWith("utilities/")
      ? id.slice("utilities/".length)
      : "";

    res.statusCode = 200;
    res.setHeader("content-type", "text/html; charset=utf-8");
    res.end(await shell(route, theme, mode, surface, group));
  })();
};

export default handler;

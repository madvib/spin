import type { Connect } from "vite";
import { shell } from "../../../server/shell.ts";
import { rendered } from "../../../server/specimen.ts";

const handler: Connect.NextHandleFunction = (req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  const id = url.pathname.replace(/^\/|\/$/g, "") || rendered[0]?.id;

  // A components sub-route names ONE fixture; the surface itself lists them
  // all. Anything else under /components/ is unknown.
  const isSurface = id === "utilities" || id === "components" ||
    id.startsWith("utilities/");
  const isComponent = id.startsWith("components/");
  const known = isComponent
    ? rendered.some((r) => r.id === id.slice("components/".length))
    : isSurface || rendered.some((r) => r.id === id);
  if (!known) {
    res.statusCode = 404;
    res.end("Not found");
    return;
  }

  const theme = "default";
  const mode = "base";
  const surface = id.startsWith("utilities") ? "utilities" : "components";
  const group = id.startsWith("utilities/")
    ? id.slice("utilities/".length)
    : "";
  const route = isComponent ? id.slice("components/".length) : id;

  res.statusCode = 200;
  res.setHeader("content-type", "text/html; charset=utf-8");
  res.end(shell(route, theme, mode, surface, group));
};

export default handler;

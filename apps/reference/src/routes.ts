import type { Connect } from "vite";
import { readFileSync } from "node:fs";
import { SECTIONS } from "@spin/preset/organization.ts";
import { rendered } from "../../../server/specimen.ts";

/**
 * The middleware SERVES the pages `build-content.ts` rendered ahead of the
 * Uno scanner, rather than composing them per request.
 *
 * A reference page exists to be scanned: the classes it demonstrates only
 * reach the stylesheet if they exist as markup while the scanner runs. So the
 * pages are rendered to `src/content/` before Vite starts, and this handler's
 * whole job is the route→file mapping — no renderer is called at request time.
 */
const CONTENT = new URL("./content/", import.meta.url);

/**
 * The pre-rendered document for a route id, or `undefined` when no route
 * matches.
 *
 * The mapping mirrors `build-content.ts`'s `pages()`: the two surfaces, one
 * file per fixture, one per section. A legacy `/<fixture-id>` and `/` name a
 * fixture and read its component page, because they render the same document.
 */
function contentFile(id: string): URL | undefined {
  if (id === "utilities") return new URL("utilities.html", CONTENT);
  if (id.startsWith("utilities/")) {
    const group = id.slice("utilities/".length);
    // An unknown group renders the fallback page — the first section — which
    // is exactly what `utilities.html` holds. It is not a 404.
    return new URL(
      SECTIONS.some((s) => s.id === group)
        ? `utilities/${group}.html`
        : "utilities.html",
      CONTENT,
    );
  }
  if (id === "components") return new URL("components.html", CONTENT);
  const fixture = id.startsWith("components/")
    ? id.slice("components/".length)
    : id;
  return rendered.some((r) => r.id === fixture)
    ? new URL(`components/${fixture}.html`, CONTENT)
    : undefined;
}

const handler: Connect.NextHandleFunction = (req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  const id = url.pathname.replace(/^\/|\/$/g, "") || rendered[0]?.id;
  const file = contentFile(id);
  if (!file) {
    res.statusCode = 404;
    res.end("Not found");
    return;
  }

  res.statusCode = 200;
  res.setHeader("content-type", "text/html; charset=utf-8");
  res.end(readFileSync(file));
};

export default handler;

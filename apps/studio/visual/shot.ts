import { homedir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright-core";
import { CHILD_PATHS, ROUTE_PATHS } from "../src/lib/routes.ts";

const SHOTS = join(import.meta.dirname as string, "shots");
const ORIGIN = "http://127.0.0.1:5173";

const SHELL =
  `${homedir()}/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell`;

const browser = await chromium.launch({
  executablePath: SHELL,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
/**
 * Routes to photograph, from the table that owns them. A child pattern is
 * filled in from the library the studio is pointed at.
 */
const subject = await fetch(`${ORIGIN}/__spin/rpc/primitives/list`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ json: {} }),
})
  .then((response) => response.json() as Promise<{ json?: { name: string }[] }>)
  .then((body) => body.json?.[0]?.name ?? "")
  .catch(() => "");

const routes = [
  ...new Set([
    ...ROUTE_PATHS,
    ...CHILD_PATHS.map((path) => path.replace(":name", subject)).filter((
      path,
    ) => !path.includes(":")),
  ]),
];

/**
 * What each route photographs as. `/` is `overview`; a child keeps its
 * subject, so `/components/:name` becomes `components-alert.png`.
 */
const shotName = (route: string): string =>
  route === "/" ? "overview" : route.slice(1).replace(/[:/]/g, "-");

const names = routes.map(shotName);

for (const route of routes) {
  const url = `${ORIGIN}${route}`;
  // A page per shot: a reused tab exhausts what the browser will open, and
  // the shot captures an empty shell.
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });
  page.on("console", (message) => {
    if (message.type() === "error") {
      console.log(`console.error: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => console.log(`pageerror: ${error}`));
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await page.screenshot({ path: join(SHOTS, `${shotName(route)}.png`) });
  console.log(`shot: ${shotName(route)}`);
  await page.close();
}

/**
 * A shot for a route that no longer exists is a picture of a page nobody can
 * reach, and it stays in the tree forever because nothing else touches it.
 */
for (const entry of Deno.readDirSync(SHOTS)) {
  if (!entry.isFile || !entry.name.endsWith(".png")) continue;
  if (names.includes(entry.name.replace(/\.png$/, ""))) continue;
  await Deno.remove(join(SHOTS, entry.name));
  console.log(`stale: ${entry.name}`);
}
await browser.close();

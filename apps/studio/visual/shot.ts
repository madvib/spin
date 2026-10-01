import { homedir } from "node:os";
import { join } from "node:path";
import { chromium } from "npm:playwright-core";

const SHOTS = join(import.meta.dirname as string, "shots");

const SHELL =
  `${homedir()}/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell`;

const browser = await chromium.launch({
  executablePath: SHELL,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on("console", (message) => {
  if (message.type() === "error") {
    console.log(`console.error: ${message.text()}`);
  }
});
page.on("pageerror", (error) => console.log(`pageerror: ${error}`));

const routes = ["", "colors", "surfaces", "spacing", "motion", "utilities"];
for (const route of routes) {
  const url = `http://127.0.0.1:5173/${route}`;
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  const name = route === "" ? "overview" : route;
  await page.screenshot({ path: join(SHOTS, `${name}.png`) });
  console.log(`shot: ${name}`);
}
await browser.close();

import { homedir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright-core";

const SHOTS = join(import.meta.dirname as string, "shots");
const SHELL =
  `${homedir()}/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell`;

const browser = await chromium.launch({
  executablePath: SHELL,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on("pageerror", (error) => console.log(`pageerror: ${error}`));

const route = process.argv[2] ?? "components/button";
const name = route.replace(/\//g, "-") || "index";
await page.goto(`http://127.0.0.1:5173/${route}`, {
  waitUntil: "networkidle",
});
await page.waitForTimeout(800);
await page.screenshot({ path: join(SHOTS, `${name}.png`) });
console.log(`shot: ${name}`);
await browser.close();

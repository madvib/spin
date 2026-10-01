import { homedir } from "node:os";
import { join } from "node:path";
import { strict as assert } from "node:assert";
import { chromium } from "npm:playwright-core";

const SHELL =
  `${homedir()}/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell`;

const browser = await chromium.launch({
  executablePath: SHELL,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on("pageerror", (error) => console.log(`pageerror: ${error}`));

await page.goto("http://127.0.0.1:5173/components", {
  waitUntil: "networkidle",
});
const primary = page.getByRole("button", { name: "primary", exact: true });
const lightBg = await primary.evaluate(
  (element) => getComputedStyle(element).backgroundColor,
);
assert.equal(lightBg, "rgb(37, 99, 235)");
console.log("light primary button resolves to the primary token");

const header = page.getByRole("heading", { name: "Button" });
const lightText = await header.evaluate(
  (element) => getComputedStyle(element).color,
);
assert.equal(lightText, "rgb(15, 23, 42)");
console.log("light heading resolves to the text token");

await page.getByTitle("Manage themes").click();
const activateButtons = page.getByRole("button", { name: "Activate" });
assert.equal(await activateButtons.count(), 3);
await activateButtons.nth(1).click();
await page.getByRole("button", { name: "Close" }).click();
await page.waitForTimeout(500);

const consoleBg = await primary.evaluate(
  (element) => getComputedStyle(element).backgroundColor,
);
assert.notEqual(consoleBg, lightBg);
assert.notEqual(consoleBg, "rgba(0, 0, 0, 0)");
console.log(`console primary button resolves to ${consoleBg}`);
await page.screenshot({
  path: join(import.meta.dirname as string, "shots", "components-console.png"),
});
console.log("components verified on light and console");
await browser.close();

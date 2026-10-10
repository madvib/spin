import { chromium } from "npm:playwright-core";
const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const page = await browser.newPage();
page.on("pageerror", (e) => console.log("PAGEERROR:", e.message, "\n", e.stack));
page.on("console", (m) => console.log("CONSOLE:", m.type(), m.text()));
await page.goto("http://127.0.0.1:5311/", { waitUntil: "load" });
await page.waitForTimeout(1000);
console.log("HTML:", await page.content());
await browser.close();

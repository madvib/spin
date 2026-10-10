import { chromium } from "npm:playwright-core";
const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const page = await browser.newPage();
page.on("pageerror", (e) => console.log("PAGEERROR:", e.message));
await page.goto("http://127.0.0.1:5311/", { waitUntil: "load" });
await page.waitForTimeout(500);
const info = await page.locator("#menu [role=menu]").first().evaluate((el) => {
  const cs = getComputedStyle(el);
  return { visibility: cs.visibility, display: cs.display, opacity: cs.opacity, transform: cs.transform, state: el.getAttribute("data-state"), cls: el.className };
});
console.log(JSON.stringify(info, null, 1));
const css = await page.evaluate(() => {
  const out: string[] = [];
  for (const sheet of document.styleSheets) {
    try {
      for (const rule of sheet.cssRules) {
        const text = rule.cssText;
        if (text.includes("visibility") || text.includes("data-state=closed") || text.includes("menu-anchor")) out.push(text.slice(0, 220));
      }
    } catch { /* cross-origin */ }
  }
  return out;
});
console.log(css.slice(0, 12).join("\n"));
await browser.close();

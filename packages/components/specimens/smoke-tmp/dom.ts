import { chromium } from "npm:playwright-core";
const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const page = await browser.newPage();
page.on("pageerror", (e) => console.log("PAGEERROR:", e.message));
await page.goto("http://127.0.0.1:5311/", { waitUntil: "load" });
await page.waitForTimeout(300);
await page.locator("#menu button").first().click();
await page.waitForTimeout(300);
const counts = await page.evaluate(() => {
  const q = (s: string) => document.querySelectorAll(s).length;
  const vis = (s: string) => [...document.querySelectorAll(s)].filter((el) => {
    const cs = getComputedStyle(el);
    return cs.visibility === "visible" && cs.display !== "none";
  }).length;
  return { groups: q("#menu [role=group]"), groupsVisible: vis("#menu [role=group]"), separatorsVisible: vis("#menu [role=separator]"), menuitems: q("#menu [role=menuitem]"), panelsVisible: vis("#menu [role=menu]") };
});
console.log(JSON.stringify(counts));
console.log("items:", await page.locator("#menu [role=menuitem]").count());
await browser.close();

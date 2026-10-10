import { chromium } from "npm:playwright-core";
const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const page = await browser.newPage();
await page.goto("http://127.0.0.1:5311/", { waitUntil: "load" });
await page.waitForTimeout(300);
const childBefore = await page.evaluate(() => {
  const el = document.querySelector('spin-menu-fsm[id="menu:menu:submenu:share"]') as (HTMLElement & { open?: unknown }) | null;
  return el === null ? "no child" : { id: el.id, openAttr: el.getAttribute("open"), openProp: el.open, itemsAttr: el.getAttribute("items"), submenuAttr: el.getAttribute("submenu"), label: el.getAttribute("label") };
});
console.log("child before:", JSON.stringify(childBefore));
await page.locator("#menu button").first().click();
await page.locator('#menu [role=menuitem][aria-haspopup]').first().click();
await page.waitForTimeout(400);
const childAfter = await page.evaluate(() => {
  const el = document.querySelector('spin-menu-fsm[id="menu:menu:submenu:share"]') as (HTMLElement & { open?: unknown }) | null;
  return el === null ? "no child" : { id: el.id, openAttr: el.getAttribute("open"), openProp: el.open, submenuAttr: el.getAttribute("submenu") };
});
console.log("child after: ", JSON.stringify(childAfter));
await browser.close();

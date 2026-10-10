import { chromium } from "npm:playwright-core";
const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const page = await browser.newPage();
page.on("pageerror", (e) => console.log("PAGEERROR:", e.message));
await page.goto("http://127.0.0.1:5311/", { waitUntil: "load" });
await page.waitForTimeout(400);
const info = await page.locator("#menu [role=menu]").evaluateAll((els) =>
  els.map((el) => ({
    hidden: (el as HTMLElement).hidden,
    state: el.getAttribute("data-state"),
    inSubmenu: el.closest("[role=menuitem]") !== null,
    parentSubmenu: el.parentElement?.previousElementSibling?.tagName ?? "",
    hasHiddenAttr: el.hasAttribute("hidden"),
  })),
);
console.log(JSON.stringify(info, null, 1));
await browser.close();

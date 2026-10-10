import { chromium } from "npm:playwright-core";
const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const page = await browser.newPage();
page.on("pageerror", (e) => console.log("PAGEERROR:", e.message));
await page.goto("http://127.0.0.1:5311/", { waitUntil: "load" });
await page.waitForTimeout(300);
const read = () => page.evaluate(() => {
  const root = document.querySelector("#menu");
  const wrapper = root?.children[0];
  const pos = wrapper?.children[1] as HTMLElement | undefined;
  const cs = pos === undefined ? undefined : getComputedStyle(pos);
  return pos === undefined || cs === undefined ? "none" : {
    state: pos.getAttribute("data-state"), visibility: cs.visibility, opacity: cs.opacity,
    minWidth: cs.minWidth, left: cs.left, top: cs.top, transform: cs.transform,
    styles: pos.getAttribute("style"),
  };
});
console.log("closed:", JSON.stringify(await read()));
await page.locator("#menu button").first().click();
await page.waitForTimeout(200);
console.log("open:  ", JSON.stringify(await read()));
await browser.close();

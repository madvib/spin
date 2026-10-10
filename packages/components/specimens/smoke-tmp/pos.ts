import { chromium } from "npm:playwright-core";
const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const page = await browser.newPage();
page.on("pageerror", (e) => console.log("PAGEERROR:", e.message));
await page.goto("http://127.0.0.1:5311/", { waitUntil: "load" });
await page.waitForTimeout(300);
const info = await page.evaluate(() => {
  const root = document.querySelector("#menu");
  const wrapper = root?.children[0];
  const el = wrapper?.children[1];
  if (el === undefined || el === null) return "no second child";
  const cs = getComputedStyle(el);
  return {
    tag: el.tagName, cls: el.className, state: el.getAttribute("data-state"),
    visibility: cs.visibility, opacity: cs.opacity, transform: cs.transform, minWidth: cs.minWidth, left: cs.left, top: cs.top,
    parentCls: el.parentElement?.className ?? "",
  };
  return info;
});
console.log(JSON.stringify(info, null, 1));
await browser.close();

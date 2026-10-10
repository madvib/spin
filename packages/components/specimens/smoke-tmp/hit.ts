import { chromium } from "npm:playwright-core";
const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const page = await browser.newPage();
await page.goto("http://127.0.0.1:5311/", { waitUntil: "load" });
await page.waitForTimeout(300);
await page.locator("#menu button").first().click();
await page.locator('#menu [role=menuitem][aria-haspopup]').first().click();
await page.waitForTimeout(300);
const hit = await page.evaluate(() => {
  const mail = [...document.querySelectorAll('[role=menuitem]')].find((el) => el.textContent?.startsWith("Email")) as HTMLElement | undefined;
  if (mail === undefined) return "no mail row";
  const r = mail.getBoundingClientRect();
  const cx = Math.round(r.x + r.width / 2);
  const cy = Math.round(r.y + r.height / 2);
  const el = document.elementFromPoint(cx, cy) as HTMLElement | null;
  const chain: string[] = [];
  let node: HTMLElement | null = el;
  while (node !== null && chain.length < 6) {
    chain.push(`${node.tagName}${node.id ? `#${node.id}` : ""}${node.className ? `.${String(node.className).slice(0, 40)}` : ""}`);
    node = node.parentElement;
  }
  return { x: r.x, y: r.y, w: r.width, h: r.height, cx, cy, hit: el === null ? "none" : `${el.tagName}${el.id ? `#${el.id}` : ""}`, chain };
});
console.log(JSON.stringify(hit, null, 1));
await browser.close();

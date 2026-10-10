import { chromium } from "npm:playwright-core";
const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const page = await browser.newPage();
await page.goto("http://127.0.0.1:5311/", { waitUntil: "load" });
await page.waitForTimeout(300);
await page.locator("#menu button").first().click();
await page.locator('#menu [role=menuitem][aria-haspopup]').first().click();
await page.waitForTimeout(300);
const out = await page.evaluate(() => {
  const mail = [...document.querySelectorAll('[role=menuitem]')].find((el) => el.textContent?.startsWith("Email")) as HTMLElement | undefined;
  if (mail === undefined) return "no mail row";
  const rows: string[] = [];
  let node: HTMLElement | null = mail;
  while (node !== null && rows.length < 10) {
    const cs = getComputedStyle(node);
    rows.push(`${node.tagName}${node.id ? `#${node.id}` : ""} pe=${cs.pointerEvents} vis=${cs.visibility} disp=${cs.display} opacity=${cs.opacity} transform=${cs.transform} pos=${cs.position} state=${node.getAttribute("data-state") ?? "-"}`);
    node = node.parentElement;
  }
  return rows.join("\n");
});
console.log(out);
await browser.close();

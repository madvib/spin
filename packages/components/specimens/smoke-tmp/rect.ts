import { chromium } from "npm:playwright-core";
const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const page = await browser.newPage();
await page.setViewportSize({ width: 900, height: 700 });
await page.goto("http://127.0.0.1:5311/", { waitUntil: "load" });
await page.waitForTimeout(300);
await page.locator("#menu button").first().click();
await page.locator('[id^="menu:menu:"] > [role=menuitem], #menu [role=menuitem][aria-haspopup]').first().click();
await page.waitForTimeout(300);
const rects = await page.evaluate(() => {
  const pick = (sel: string) => {
    const el = document.querySelector(sel) as HTMLElement | null;
    if (el === null) return sel + ": none";
    const r = el.getBoundingClientRect();
    return `${sel}: x=${Math.round(r.x)} y=${Math.round(r.y)} w=${Math.round(r.width)} h=${Math.round(r.height)}`;
  };
  const mail = [...document.querySelectorAll('[role=menuitem]')].find((el) => el.textContent?.startsWith("Email")) as HTMLElement | undefined;
  const r = mail?.getBoundingClientRect();
  return [pick("#menu"), pick("#menu [role=menu]"), mail ? `mail: x=${Math.round(r?.x ?? 0)} y=${Math.round(r?.y ?? 0)} w=${Math.round(r?.width ?? 0)}` : "mail: none"].join("\n");
});
console.log(rects);
await browser.close();

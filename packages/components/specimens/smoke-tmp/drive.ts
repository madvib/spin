import { chromium } from "npm:playwright-core";

const URL = "http://127.0.0.1:5311/";
const pageErrors: string[] = [];
const log: string[] = [];
const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const page = await browser.newPage();
page.on("pageerror", (e) => pageErrors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") pageErrors.push(`console: ${m.text()}`);
});
const check = (name: string, ok: boolean, extra = ""): void => {
  log.push(`${ok ? "PASS" : "FAIL"} ${name}${extra ? ` — ${extra}` : ""}`);
  if (!ok) throw new Error(`FAILED: ${name} ${extra}`);
};

await page.goto(URL, { waitUntil: "load" });
const menu = page.locator("#menu");
const trigger = menu.locator("button").first();
const panel = menu.locator("[role=menu]").first();

check("trigger renders", await trigger.isVisible(), await trigger.textContent() ?? "");
check("panel starts hidden", await panel.isHidden(), (await panel.getAttribute("data-state")) ?? "");
check("no visible panel before opening", (await menu.locator("[role=menu]:visible").count()) === 0);

await trigger.click();
await page.waitForSelector('#menu [role=menu][data-state="open"]', { timeout: 3000 });
check("click opens the panel", await panel.isVisible());
check("aria-expanded set", (await trigger.getAttribute("aria-expanded")) === "true");
check("groups render", (await menu.locator("[role=group]:visible").count()) === 2);
check("menu width matches the anchor", (await page.evaluate(() => {
  const wrapper = document.querySelector("#menu")?.children[0];
  const pos = wrapper?.children[1] as HTMLElement | undefined;
  return pos === undefined ? "" : getComputedStyle(pos).minWidth;
})) === "52px");

await page.keyboard.press("Escape");
await page.waitForSelector('#menu [role=menu][data-state="closed"]', { state: "attached", timeout: 3000 });
check("escape closes", await panel.isHidden());

await trigger.focus();
await page.keyboard.press("ArrowDown");
await page.waitForSelector('#menu [role=menu][data-state="open"]', { timeout: 3000 });
const first = await panel.getAttribute("aria-activedescendant");
check("arrowdown highlights the first item", Boolean(first) && ((await menu.locator(`[id="${first}"]`).textContent()) ?? "").includes("New file"), first ?? "");
await page.keyboard.press("ArrowDown");
const second = await panel.getAttribute("aria-activedescendant");
check("arrowdown moves the highlight", first !== second, `${first} -> ${second}`);
await page.keyboard.press("ArrowUp");
check("arrowup moves back", (await panel.getAttribute("aria-activedescendant")) === first);
await page.keyboard.press("Home");
check("home jumps to the first item", (await panel.getAttribute("aria-activedescendant")) === first);
await page.keyboard.press("End");
const last = await panel.getAttribute("aria-activedescendant");
check("end jumps to the last item", ((await menu.locator(`[id="${last}"]`).textContent()) ?? "").includes("Share"), last ?? "");

await page.keyboard.press("Home");
await page.keyboard.press("Enter");
await page.waitForSelector('#menu [role=menu][data-state="closed"]', { state: "attached", timeout: 3000 });
check("enter selects and closes", (await page.locator("#status").textContent()) === "selected: new", await page.locator("#status").textContent() ?? "");
check("open-change reported false", (await page.locator("#opened").textContent()) === "false");

await trigger.click();
await page.waitForSelector('#menu [role=menu][data-state="open"]', { timeout: 3000 });
const share = menu.getByRole("menuitem", { name: "Share" });
check("submenu trigger marked", (await share.count()) === 1);
await share.click();
await page.waitForSelector('#menu [role=menu][data-state="open"] >> nth=1', { timeout: 3000 });
check("submenu opens", (await menu.locator('[role=menu]:visible').count()) === 2);
check("submenu trigger expanded", (await share.getAttribute("aria-expanded")) === "true");
await menu.getByRole("menuitem", { name: "Email link" }).click();
await page.waitForSelector('#menu [role=menu][data-state="open"] >> nth=1', { state: "detached", timeout: 3000 });
check("submenu select reported", (await page.locator("#status").textContent()) === "selected: mail", await page.locator("#status").textContent() ?? "");
check("closeOnSelect closes the chain", (await menu.locator('[role=menu][data-state="open"]').count()) === 0);

await trigger.click();
await page.waitForSelector('#menu [role=menu][data-state="open"]', { timeout: 3000 });
await page.mouse.click(4, 4);
await page.waitForSelector('#menu [role=menu][data-state="closed"]', { state: "attached", timeout: 3000 });
check("outside press closes", (await panel.isHidden()));

await trigger.click({ button: "right" });
await page.waitForSelector('#menu [role=menu][data-state="open"]', { timeout: 3000 });
check("right click opens the context menu", (await panel.getAttribute("data-state")) === "open");

check("no page errors", pageErrors.length === 0, pageErrors.join(" | "));
await browser.close();
console.log(log.join("\n"));

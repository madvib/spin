import { SECTIONS, utilitiesFor } from "@spin/preset/organization.ts";
import { starterThemes, supportsDark as themeSupportsDark } from "@spin/theme/themes";
import { CHROME, STYLE } from "./chrome.ts";
import { catalogSections, esc, find, rendered } from "./specimen.ts";
import { utilityGroupPage, SCALE_PREFIX } from "./family.ts";


/**
 * The Vite-generated stylesheet, fetched per request batch and cached.
 *
 * The rail's "no CSS" labels read from this sheet: a utility with no rule
 * here has no rule, period. Fetched from the Vite dev server's `/__uno.css`
 * endpoint — the same sheet the browser applies — so the labels and the
 * rendering can never disagree. Cached for 5s; a label slightly stale beats
 * a fetch per row.
 */
let showcaseCss = "";
let fetchedAt = 0;
const SHEET_TTL = 5000;
const UNO_URL = "http://localhost:8001/__uno.css";

async function sheet(): Promise<string> {
  const now = Date.now();
  if (showcaseCss && now - fetchedAt < SHEET_TTL) return showcaseCss;
  try {
    const res = await fetch(UNO_URL);
    if (res.ok) {
      // `/__uno.css` is a JS module (HMR wrapper), not raw CSS: the rules
      // live inside the `__vite__css` string assignment. Extract rather than
      // parse — the alternative is a second UnoCSS instance, which is the
      // generate-and-inline pipeline with extra steps.
      const js = await res.text();
      const m = /__vite__css = "((?:[^"\\]|\\.)*)"/s.exec(js);
      if (m) {
        showcaseCss = m[1].replace(/\\n/g, "\n").replace(/\\"/g, '"').replace(/\\\\/g, "\\");
        fetchedAt = now;
      }
    }
  } catch {
    // Dev server unreachable — keep the last sheet (or empty on boot).
  }
  return showcaseCss;
}

/**
 * The declaration each utility produced, resolved once.
 *
 * Sourced from the Vite-generated sheet rather than generated on demand: the
 * sheet already contains every rule, so asking the generator again per row
 * was 757 calls to learn what one string already said. A prefix utility —
 * `hover:` — has no rule of its own, so the one it prefixes is looked up
 * instead.
 */
export async function declarationsFor(
  names: readonly string[],
): Promise<Map<string, string | null>> {
  const flat = (await sheet()).replace(/\s+/g, " ");
  const out = new Map<string, string | null>();
  for (const name of names) {
    out.set(name, ruleFor(flat, name.endsWith(":") ? `${name}p-4` : name));
  }
  return out;
}

/** The rule a class produced, matched on the class rather than the first. */
function ruleFor(css: string, name: string): string | null {
  // Vite's sheet double-escapes the slash (`w-1\\/2`); the old generate()
  // output used a single escape. Match either.
  const escaped = name.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&").replace(/\//g, "\\?/");
  const body = new RegExp(`\\.${escaped}[^{}]*\\{([^}]*)\\}`).exec(css)?.[1];
  if (!body) return null;
  const trimmed = body.split(";").map((d) => d.trim()).filter(Boolean).join(
    ";\n  ",
  );
  return trimmed || null;
}

/**
 * Every reference page, rendered lazily on first request.
 *
 * They are pure functions of the catalog, so rebuilding per request is
 * waste — but rendering at IMPORT time bakes the "no CSS" labels against an
 * empty sheet (Vite hasn't generated `/__uno.css` yet when the middleware
 * module loads). First request warms the sheet, then renders; after that the
 * map is the cache. A second render only happens if something clears it.
 */
let pages: ReadonlyMap<string, string> | undefined;
async function referencePages(): Promise<ReadonlyMap<string, string>> {
  if (pages === undefined) {
    await sheet();
    pages = new Map(
      await Promise.all(
        SECTIONS.map(async (s) => [s.id, await utilityGroupPage(s.id)] as const),
      ),
    );
  }
  return pages;
}

export async function shell(
  active: string,
  theme: string,
  mode: string,
  surface: "components" | "utilities",
  group: string,
): Promise<string> {
  const f = active === "utilities" ? undefined : find(active);
  const all = await referencePages();
  const body = surface === "utilities"
    ? all.get(group) ?? all.get(SECTIONS[0].id)
    : undefined;
  return `<!doctype html>
<html lang="en" data-theme="${theme}" data-mode="${mode}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>spin · ${esc(body ? "Utilities" : (f?.title ?? "not found"))}</title>
<link rel="stylesheet" href="/__uno.css">
<style>${STYLE}</style>
</head>
<body>
<div class="${CHROME.shell}">
  <nav class="${CHROME.rail}">
    <h1 class="${CHROME.railHead}">spin</h1>
    <div class="${CHROME.switcher}">
      ${
    THEMES.map((t) =>
      `<button type="button" class="${CHROME.chip} ${
        t === theme ? CHROME.on : ""
      }" data-theme-set="${t}">${t}</button>`
    ).join("")
  }
      <span class="${CHROME.sep}"></span>
      <button type="button" class="${CHROME.chip} ${
    mode === "base" ? CHROME.on : ""
  }" data-mode-set="base">base</button>
      <button type="button" class="${CHROME.chip}" data-mode-set="dark" disabled
              title="This theme renders one way">dark</button>
    </div>
    <div class="${CHROME.surfaceSwitch}">
      <a class="${CHROME.surfaceLink}" href="/utilities"${
    surface === "utilities" ? ' aria-current="page"' : ""
  }>utilities</a>
      <a class="${CHROME.surfaceLink}" href="/components"${
    surface === "components" ? ' aria-current="page"' : ""
  }>primitives</a>
    </div>
${
    (surface === "utilities"
      ? SECTIONS.map((sec) =>
        `    <a class="${CHROME.railLink}" href="/utilities/${sec.id}"${
          sec.id === group ? ' aria-current="page"' : ""
        }>` +
        `<span>${esc(sec.title)}</span>` +
        `<span class="${CHROME.railCount}">${
          utilitiesFor(sec, catalogSections()).length
        }</span></a>`
      )
      : rendered.map((r) =>
        `    <a class="${CHROME.railLink}" href="/${r.id}"${
          r.id === active ? ' aria-current="page"' : ""
        }>` +
        `<span>${esc(r.title)}</span><span class="${CHROME.railCount}">${
          esc(r.kind)
        }</span></a>`
      )).join("\n")
  }
  </nav>
  <main class="${CHROME.main}">
${
    body ?? (!f
      ? `    <header class="${CHROME.pageHead}"><h2 class="${CHROME.title}">Not found</h2></header>`
      : `    <header class="${CHROME.pageHead}">
      <div>
        <h2 class="${CHROME.title}">${esc(f.title)}</h2>
        <div class="${CHROME.kind}">${esc(f.kind)}</div>
        <p class="${CHROME.note}">${esc(f.note)}</p>
      </div>
      <span class="${CHROME.badge}">${f.bytes} bytes</span>
    </header>
${
        f.examples.map((e) =>
          `    <section class="${CHROME.example}">
      <h3 class="${CHROME.subhead}">${esc(e.name)}</h3>
      <div class="${CHROME.rendered}">${e.html}</div>
      <button class="${CHROME.reveal}" type="button" aria-expanded="false"
              data-markup="${
            esc(e.html.trim())
          }">markup <span data-caret>&#9656;</span></button>
      <pre hidden class="${CHROME.decl}">${esc(e.html.trim())}</pre>
    </section>`
        ).join("\n")
      }`)
  }
<script>
// A scale is ONE preview with controls on it. The two controls are
// INDEPENDENT coordinates of one class: pressing an edge must not reset the
// step, or the preview lies about the value the reader just chose. So the
// current value is read from whichever button was last pressed, not stored and
// overwritten.
for (const group of document.querySelectorAll("[data-scale-group]")) {
  const sample = group.querySelector("[data-under-test]");
  const name = group.querySelector("[data-scale-name]");
  const prefix = ${JSON.stringify(SCALE_PREFIX)};
  const id = group.dataset.scaleGroup;
  const current = { axis: "", step: "" };
  const show = () => {
    if (!sample || !name) return;
    const head = prefix[id] ?? id;
    // An axis is the SUFFIX of the prefix, not a segment of it: the inline
    // axis is px-16 and the block axis is py-16, both of which the catalog
    // lists as single names. Joining them with a dash produced p-x-16, which
    // no rule matches, so pressing an edge silently reset the preview to no
    // padding at all.
    const cls = head + current.axis + "-" + current.step;
    sample.className = (sample.dataset.base ?? "") + " " + cls;
    name.textContent = cls;
    for (const other of group.querySelectorAll("[data-step],[data-axis]")) {
      const isStep = other.hasAttribute("data-step");
      const active = isStep
        ? other.dataset.step === current.step
        : other.dataset.axis === current.axis;
      other.setAttribute("aria-pressed", String(active));
      if (active) other.setAttribute("aria-current", "true");
      else other.removeAttribute("aria-current");
    }
  };
  current.step = group.querySelector("[data-step]")?.dataset.step ?? "";
  current.axis = group.querySelector("[data-axis]")?.dataset.axis ?? "";
  for (const b of group.querySelectorAll("[data-step],[data-axis]")) {
    b.addEventListener("click", () => {
      if (b.dataset.step !== undefined) current.step = b.dataset.step;
      if (b.dataset.axis !== undefined) current.axis = b.dataset.axis;
      show();
    });
  }
  show();
}

// Theme and mode are READER state, kept in localStorage. Nothing about them
// lives in the URL — a link to a component should not carry the reader's
// choice, and a shared link should not leak it.
const THEMES = ${JSON.stringify(THEMES)};
const DARK = ${JSON.stringify(THEMES.filter((t) => supportsDark(t)))};
const root = document.documentElement;
const stored = () => {
  try { return JSON.parse(localStorage.getItem("spin:appearance") ?? "null") ?? {}; }
  catch { return {}; }
};
const syncModes = (theme) => {
  for (const b of document.querySelectorAll('[data-mode-set="dark"]')) {
    const on = DARK.includes(theme);
    b.disabled = !on;
    b.title = on ? "" : "This theme renders one way";
  }
};
const apply = (theme, mode) => {
  root.dataset.theme = theme;
  root.dataset.mode = mode;
  for (const b of document.querySelectorAll("[data-theme-set]")) {
    if (b.dataset.themeSet === theme) b.setAttribute("aria-current", "true");
    else b.removeAttribute("aria-current");
  }
  for (const b of document.querySelectorAll("[data-mode-set]")) {
    if (b.dataset.modeSet === mode) b.setAttribute("aria-current", "true");
    else b.removeAttribute("aria-current");
  }
  syncModes(theme);
};
// A theme that renders one way cannot be asked for another, so its control is
// DISABLED rather than hidden: a reader who switches to a one-mode theme and
// finds the button gone cannot tell whether the theme lacks the mode or the
// docs forgot to offer it.
const normalise = (theme, mode) =>
  DARK.includes(theme) ? { theme, mode } : { theme, mode: "base" };
{
  const s = stored();
  apply(...Object.values(normalise(
    THEMES.includes(s.theme) ? s.theme : "${theme}",
    s.mode === "dark" ? "dark" : "base",
  )));
}
for (const b of document.querySelectorAll("[data-theme-set]")) {
  b.addEventListener("click", () => {
    const next = normalise(b.dataset.themeSet, root.dataset.mode);
    localStorage.setItem("spin:appearance", JSON.stringify(next));
    apply(next.theme, next.mode);
  });
}
for (const b of document.querySelectorAll("[data-mode-set]")) {
  b.addEventListener("click", () => {
    if (b.disabled) return;
    const next = { theme: root.dataset.theme, mode: b.dataset.modeSet };
    localStorage.setItem("spin:appearance", JSON.stringify(next));
    apply(next.theme, next.mode);
  });
}
${f?.onLoad ?? ""}
for (const b of document.querySelectorAll(".reveal")) {
  b.addEventListener("click", () => {
    const pre = b.nextElementSibling;
    const caret = b.querySelector("[data-caret]");
    const open = b.getAttribute("aria-expanded") === "true";
    b.setAttribute("aria-expanded", String(!open));
    if (caret) caret.textContent = open ? "▸" : "▾";
    pre.hidden = open;
  });
}
</script>
  </main>
</div>
</body>
</html>`;
}

/**
 * The theme lives in localStorage, not a query string.
 *
 * The showcase's whole point is comparing two themes, and a theme carried in
 * the URL is lost the moment a reader follows a link to another component —
 * which is most of the navigation, since every component is its own route. A
 * link should not carry the reader's choice, and a shared link should not
 * leak it.
 */
const THEMES = ["default", "neobrut", "console"] as const;

/** Whether a theme renders a second way, derived from whether it declares one. */
function supportsDark(theme: string): boolean {
  return themeSupportsDark(
    starterThemes[theme as keyof typeof starterThemes] ?? starterThemes.default,
  );
}


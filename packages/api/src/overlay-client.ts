/**
 * The overlay script the plugin injects into the user's app.
 *
 * Served as a string, because it runs in the app's document and must not be
 * part of the app's bundle: nothing about the studio may require the project
 * to build it. `packages/api` serves it at `<apiBase>/overlay.js` and
 * `spin()` injects the module tag that imports it, in dev only.
 *
 * Separate from `packages/api/src/index.ts` so the script's own escaping
 * stays readable — a generated-JS string nested inside a TypeScript string
 * needs every backtick doubled, and doing that inline made the outer string
 * impossible to read or repair.
 */

export const OVERLAY_SCRIPT =
  `export function spinOverlay(base = "/__spin/rpc", studio) {
  // Where the studio runs. Mounted, it is built and served beside the API on
  // this origin - which has no hot reload, because a built bundle never
  // does. A studio checkout on its own dev server keeps its own modules, so
  // a caller working on the studio points at it here and the iframe loads it
  // across origins, where its reload works.
  const studioPath = studio === undefined
    ? base.replace(/\\/rpc$/, "") + "/studio/"
    : studio.replace(/\\/$/, "") + "/";
  const css = [
    ".spin-fab{position:fixed;right:16px;bottom:16px;z-index:2147483646;",
    "display:flex;align-items:center;gap:8px;padding:10px 14px;",
    "border:none;border-radius:999px;background:var(--color-primary,#3f3f46);",
    "color:var(--color-on-primary,#fff);box-shadow:0 4px 16px rgba(0,0,0,.28);",
    "cursor:pointer;font:500 13px/1.4 system-ui,sans-serif;}",
    ".spin-fab:hover{filter:brightness(1.12);}",
    ".spin-fab-dot{position:absolute;top:-3px;right:-3px;width:10px;height:10px;",
    "border-radius:999px;background:#b91c1c;border:2px solid var(--color-surface,#fff);display:none;}",
    ".spin-fab-dot[data-dirty='true']{display:block;}",
    ".spin-host{position:fixed;inset:10px;z-index:2147483645;display:none;",
    "border-radius:12px;overflow:hidden;box-shadow:0 24px 64px rgba(0,0,0,.45);",
    "border:1px solid var(--color-border,#e5e7eb);background:var(--color-surface,#fff);}",
    ".spin-host[data-mode='drawer']{inset:0 0 0 auto;width:30%;min-width:340px;",
    "border-radius:0;border-right:none;}",
    ".spin-host[data-open='true']{display:block;}",
    ".spin-host iframe{width:100%;height:100%;border:none;display:block;}",
    ".spin-toolbar{position:absolute;top:10px;right:10px;display:flex;gap:6px;z-index:10;}",
    ".spin-toolbar button{width:32px;height:32px;border-radius:8px;",
    "border:1px solid var(--color-border,#e5e7eb);background:var(--color-surface-raised,#fff);",
    "color:var(--color-text,#111);cursor:pointer;display:inline-flex;",
    "align-items:center;justify-content:center;font-size:14px;}",
  ].join("\\n");

  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);

  const dot = document.createElement("span");
  dot.className = "spin-fab-dot";
  const fab = document.createElement("button");
  fab.type = "button";
  fab.className = "spin-fab";
  fab.setAttribute("aria-label", "Open the theme studio");
  fab.setAttribute("aria-expanded", "false");
  fab.innerHTML = '<span aria-hidden="true">&#10024;</span><span>Theme</span>';
  fab.appendChild(dot);

  const host = document.createElement("div");
  host.className = "spin-host";
  host.dataset.open = "false";
  host.dataset.mode = "modal";
  host.innerHTML = [
    '<div class="spin-toolbar">',
    '<button type="button" data-act="mode" title="Drawer (30% width)">&#9702;</button>',
    '<button type="button" data-act="close" title="Close the studio">&times;</button>',
    "</div>",
    '<iframe title="Spin theme studio" src="' + studioPath +
      (studioPath.indexOf("?") === -1 ? "?" : "&") + "app=" +
      encodeURIComponent(location.origin) + '"></iframe>',
  ].join("");

  let open = false;
  function setOpen(next) {
    open = next;
    host.dataset.open = String(next);
    fab.setAttribute("aria-expanded", String(next));
  }
  fab.addEventListener("click", function () { setOpen(!open); });
  host.querySelector('[data-act="close"]').addEventListener("click", function () { setOpen(false); });
  host.querySelector('[data-act="mode"]').addEventListener("click", function () {
    const drawer = host.dataset.mode !== "drawer";
    host.dataset.mode = drawer ? "drawer" : "modal";
    host.querySelector('[data-act="mode"]').title =
      drawer ? "Modal (full screen)" : "Drawer (30% width)";
  });
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && open) setOpen(false);
  });
  document.body.appendChild(host);
  document.body.appendChild(fab);

  async function poll() {
    try {
      const res = await fetch(base + "/overlay/get", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      const body = await res.json();
      const dirty = body && body.json ? body.json.dirty : [];
      dot.dataset.dirty = String(dirty.length > 0);
      fab.title = dirty.length > 0
        ? "Unsaved theme changes: " + dirty.join(", ")
        : "Open the theme studio";
    } catch (error) {
      // Unreachable: silence beats crying wolf about state it cannot read.
    }
    setTimeout(poll, 2000);
  }
  poll();
}
`;

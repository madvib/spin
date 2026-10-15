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
  // The chrome is utilities, not authored CSS: the classes resolve against
  // the user's own sheet, so the launcher reads the theme it edits and no
  // hex value lives here to drift from it. The safelist in spin() keeps
  // these emitted even though no project file names them.
  // Every class below is provable against the generator: token steps the
  // theme guarantees (rounded-full, shadow-lg, h-8), static keywords
  // (fixed, border-none, cursor-pointer), and bracket literals only
  // where the grammar forbids a token (w-30pct). A class the theme does
  // not declare emits nothing, so the script names nothing unprovable.
  // Positioning only: three fixed elements the user's sheet never has to
  // know. Everything the eye sees — the toggles, the chrome — lives in the
  // studio frame, where utilities resolve.
  const fab = document.createElement("button");
  fab.type = "button";
  fab.setAttribute(
    "style",
    "position:fixed;right:16px;bottom:16px;z-index:50;display:flex;" +
      "align-items:center;gap:8px;padding:8px 16px;border:none;border-radius:999px;" +
      "font:inherit;cursor:pointer;",
  );
  fab.setAttribute("aria-label", "Open the theme studio");
  fab.setAttribute("aria-expanded", "false");
  fab.textContent = "Theme";

  const dot = document.createElement("span");
  dot.setAttribute(
    "style",
    "display:none;width:8px;height:8px;border-radius:999px;background:#b91c1c;",
  );
  fab.appendChild(dot);

  const host = document.createElement("div");
  host.setAttribute(
    "style",
    "position:fixed;inset:8px;z-index:50;display:none;overflow:hidden;",
  );
  host.dataset.mode = "modal";
  host.innerHTML = [
    '<iframe title="Spin theme studio" data-spin-studio ' +
      'style="display:block;width:100%;height:100%;border:none" src="' + studioPath +
      (studioPath.indexOf("?") === -1 ? "?" : "&") + "app=" +
      encodeURIComponent(location.origin) + "&mode=" + host.dataset.mode + '"></iframe>',
  ].join("");

  let open = false;
  function setOpen(next) {
    open = next;
    host.style.display = next ? "block" : "none";
    fab.style.display = next ? "none" : "flex";
    fab.setAttribute("aria-expanded", String(next));
  }
  function setMode(mode) {
    host.dataset.mode = mode;
    host.setAttribute(
      "style",
      mode === "drawer"
        ? "position:fixed;top:0;right:0;bottom:0;z-index:50;width:38%;" +
          "min-width:480px;display:" + (open ? "block" : "none") + ";overflow:hidden;"
        : "position:fixed;inset:8px;z-index:50;display:" + (open ? "block" : "none") +
          ";overflow:hidden;",
    );
    const frame = host.querySelector("[data-spin-studio]");
    if (frame) {
      frame.contentWindow?.postMessage(
        "spin:mode-" + host.dataset.mode,
        "*",
      );
    }
  }
  // The studio owns its toggles and talks back: close and mode switch
  // arrive on the window (postMessage never fires on the document), and
  // the shell obeys without chrome of its own. No iframe reload — the
  // studio re-branches its own layout on the mode message.
  window.addEventListener("message", function (event) {
    if (event.source === host.querySelector("[data-spin-studio]")?.contentWindow) {
      if (event.data === "spin:close") setOpen(false);
      if (event.data === "spin:drawer" || event.data === "spin:modal") {
        setMode(event.data === "spin:drawer" ? "drawer" : "modal");
      }
    }
  });
  fab.addEventListener("click", function () { setOpen(!open); });
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
      dot.style.display = dirty.length === 0 ? "none" : "block";
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

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
  const FAB_CORNERS = ["top-left", "top-right", "bottom-left", "bottom-right"];
  let fabCorner = "bottom-right";
  try {
    const savedCorner = localStorage.getItem("spin-fab-corner");
    if (savedCorner && FAB_CORNERS.indexOf(savedCorner) !== -1) {
      fabCorner = savedCorner;
    }
  } catch {
    // Private mode keeps the default.
  }

  const fab = document.createElement("button");
  fab.type = "button";
  fab.setAttribute("data-spin-fab", "");
  fab.setAttribute(
    "style",
    "position:fixed;z-index:2147483000;display:flex;align-items:center;gap:8px;" +
      "padding:7px 13px;border:1px solid rgba(255,255,255,0.16);border-radius:999px;" +
      "background:rgba(15,23,42,0.88);color:#f8fafc;backdrop-filter:blur(12px);" +
      "-webkit-backdrop-filter:blur(12px);box-shadow:0 8px 24px rgba(0,0,0,0.28),0 1px 2px rgba(0,0,0,0.2);" +
      "font:500 13px/1 system-ui,-apple-system,sans-serif;letter-spacing:-0.01em;" +
      "cursor:grab;user-select:none;touch-action:none;transition:transform 120ms ease,box-shadow 120ms ease;",
  );
  fab.setAttribute("aria-label", "Open the theme studio");
  fab.setAttribute("aria-expanded", "false");

  function applyFabCorner(corner) {
    fabCorner = FAB_CORNERS.indexOf(corner) !== -1 ? corner : "bottom-right";
    fab.style.top = fabCorner.indexOf("top-") === 0 ? "16px" : "";
    fab.style.bottom = fabCorner.indexOf("bottom-") === 0 ? "16px" : "";
    fab.style.left = fabCorner.indexOf("-left") !== -1 ? "16px" : "";
    fab.style.right = fabCorner.indexOf("-right") !== -1 ? "16px" : "";
    try {
      localStorage.setItem("spin-fab-corner", fabCorner);
    } catch {
      // Private mode keeps the session corner.
    }
  }
  applyFabCorner(fabCorner);

  const mark = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  mark.setAttribute("width", "14");
  mark.setAttribute("height", "14");
  mark.setAttribute("viewBox", "0 0 16 16");
  mark.setAttribute("fill", "none");
  mark.setAttribute("aria-hidden", "true");
  mark.innerHTML =
    '<path d="M8 1.5L13.5 4.75V11.25L8 14.5L2.5 11.25V4.75L8 1.5Z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>' +
    '<circle cx="8" cy="8" r="2" fill="currentColor"/>';
  fab.appendChild(mark);

  const label = document.createElement("span");
  label.textContent = "Studio";
  fab.appendChild(label);

  const dot = document.createElement("span");
  dot.setAttribute(
    "style",
    "display:none;width:7px;height:7px;border-radius:999px;background:#f59e0b;" +
      "box-shadow:0 0 0 2px rgba(245,158,11,0.28);",
  );
  fab.appendChild(dot);
  const host = document.createElement("div");
  host.setAttribute(
    "style",
    "position:fixed;inset:0;z-index:2147483000;display:none;overflow:hidden;",
  );
  host.dataset.mode = "modal";
  host.innerHTML = [
    '<iframe title="Spin theme studio" data-spin-studio ' +
      'style="display:block;width:100%;height:100%;border:none" src="' + studioPath +
      (studioPath.indexOf("?") === -1 ? "?" : "&") + "app=" +
      encodeURIComponent(location.origin) + "&mode=" + host.dataset.mode + '"></iframe>',
  ].join("");

  // The drawer's live width: a grip on the inner edge, dragged to
  // resize. Pointer events on the frame go dark mid-drag, so the move
  // never drops into the studio when the pointer crosses it.
  const grip = document.createElement("div");
  grip.setAttribute("aria-hidden", "true");
  grip.setAttribute(
    "style",
    "position:absolute;top:0;bottom:0;width:6px;cursor:col-resize;z-index:1;display:none;",
  );
  host.appendChild(grip);
  let dragging = false;
  grip.addEventListener("pointerdown", function (event) {
    dragging = true;
    grip.setPointerCapture(event.pointerId);
    const frame = host.querySelector("[data-spin-studio]");
    if (frame) frame.style.pointerEvents = "none";
    event.preventDefault();
  });
  grip.addEventListener("pointermove", function (event) {
    if (!dragging) return;
    const rect = host.getBoundingClientRect();
    const raw = side === "left" ? event.clientX - rect.left : rect.right - event.clientX;
    const next = Math.min(window.innerWidth * 0.85, Math.max(360, raw));
    host.style.width = next + "px";
    try {
      localStorage.setItem("spin-drawer-width", next + "px");
    } catch {
      // Private mode keeps the session width.
    }
  });
  function endDrag() {
    if (!dragging) return;
    dragging = false;
    const frame = host.querySelector("[data-spin-studio]");
    if (frame) frame.style.pointerEvents = "";
  }
  grip.addEventListener("pointerup", endDrag);
  grip.addEventListener("pointercancel", endDrag);
  let open = false;
  function syncGrip(mode) {
    const drawer = mode === "drawer";
    grip.style.display = drawer && open ? "block" : "none";
    grip.style.left = side === "left" ? "" : "0";
    grip.style.right = side === "left" ? "0" : "";
    if (!drawer) endDrag();
  }
  function setOpen(next) {
    open = next;
    host.style.display = next ? "block" : "none";
    fab.style.display = next ? "none" : "flex";
    fab.setAttribute("aria-expanded", String(next));
    syncGrip(host.dataset.mode);
  }
  let side = "right";
  try {
    side = localStorage.getItem("spin-dock-side") === "left" ? "left" : "right";
  } catch {
    // Private mode keeps the default.
  }
  function setMode(mode) {
    host.dataset.mode = mode;
    const edge = side === "left"
      ? "top:0;left:0;bottom:0;"
      : "top:0;right:0;bottom:0;";
    let width = "38%";
    try {
      width = localStorage.getItem("spin-drawer-width") ?? "38%";
    } catch {
      // Private mode keeps the default.
    }
    host.setAttribute(
      "style",
      mode === "drawer"
        ? "position:fixed;" + edge + "z-index:2147483000;width:" + width + ";" +
          "min-width:360px;max-width:85vw;display:" + (open ? "block" : "none") + ";overflow:hidden;"
        : "position:fixed;inset:0;z-index:2147483000;display:" + (open ? "block" : "none") +
          ";overflow:hidden;",
    );
    syncGrip(mode);
    const frame = host.querySelector("[data-spin-studio]");
    if (frame) {
      frame.contentWindow?.postMessage(
        "spin:mode-" + host.dataset.mode,
        "*",
      );
    }
  }
  function setSide(next) {
    side = next;
    setMode(host.dataset.mode);
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
      if (event.data === "spin:side-left" || event.data === "spin:side-right") {
        setSide(event.data === "spin:side-left" ? "left" : "right");
      }
      if (typeof event.data === "string" && event.data.indexOf("spin:fab-") === 0) {
        applyFabCorner(event.data.slice("spin:fab-".length));
      }
    }
  });
  let fabDrag = null;
  let fabSuppressClick = false;
  fab.addEventListener("pointerdown", function (event) {
    if (event.button !== 0) return;
    const rect = fab.getBoundingClientRect();
    fabDrag = {
      id: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      moved: false,
    };
    fab.setPointerCapture(event.pointerId);
  });
  fab.addEventListener("pointermove", function (event) {
    if (!fabDrag) return;
    const dx = event.clientX - fabDrag.startX;
    const dy = event.clientY - fabDrag.startY;
    if (!fabDrag.moved && dx * dx + dy * dy > 36) {
      fabDrag.moved = true;
      fab.style.cursor = "grabbing";
      fab.style.transition = "none";
    }
    if (!fabDrag.moved) return;
    const x = Math.max(8, Math.min(window.innerWidth - fab.offsetWidth - 8, event.clientX - fabDrag.offsetX));
    const y = Math.max(8, Math.min(window.innerHeight - fab.offsetHeight - 8, event.clientY - fabDrag.offsetY));
    fab.style.left = x + "px";
    fab.style.top = y + "px";
    fab.style.right = "";
    fab.style.bottom = "";
  });
  function endFabDrag(event) {
    if (!fabDrag) return;
    const moved = fabDrag.moved;
    fabDrag = null;
    fab.style.cursor = "grab";
    fab.style.transition = "transform 120ms ease,box-shadow 120ms ease";
    if (moved) {
      fabSuppressClick = true;
      const vert = event.clientY < window.innerHeight / 2 ? "top" : "bottom";
      const horiz = event.clientX < window.innerWidth / 2 ? "left" : "right";
      applyFabCorner(vert + "-" + horiz);
    }
  }
  fab.addEventListener("pointerup", endFabDrag);
  fab.addEventListener("pointercancel", endFabDrag);
  fab.addEventListener("click", function () {
    if (fabSuppressClick) {
      fabSuppressClick = false;
      return;
    }
    setOpen(!open);
  });
  function ensureMounted() {
    const parent = document.body || document.documentElement;
    if (!parent) return;
    if (!host.isConnected) parent.appendChild(host);
    if (!fab.isConnected) parent.appendChild(fab);
  }
  ensureMounted();

  async function poll() {
    ensureMounted();
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

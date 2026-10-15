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
  const fab = document.createElement("button");
  fab.type = "button";
  fab.className = "fixed bottom-4 right-4 z-modal flex items-center gap-2 " +
    "rounded-full border-none bg-primary px-4 py-2 text-on-primary " +
    "shadow-lg cursor-pointer text-sm font-medium";
  fab.setAttribute("aria-label", "Open the theme studio");
  fab.setAttribute("aria-expanded", "false");
  fab.innerHTML = '<span aria-hidden="true">&#10024;</span><span>Theme</span>';

  const dot = document.createElement("span");
  dot.className = "absolute top-[-4px] right-[-4px] hidden h-2 w-2 " +
    "rounded-full bg-semantic-error border-2 border-surface";

  const host = document.createElement("div");
  host.className = "fixed inset-2 z-modal hidden rounded-lg overflow-hidden " +
    "shadow-lg border border-border bg-surface";
  host.dataset.mode = "modal";
  host.innerHTML = [
    '<div class="absolute top-2 right-2 flex gap-2">',
    '<button type="button" data-act="mode" title="Drawer (30% width)" ' +
      'class="h-8 w-8 rounded-lg border border-border bg-surface-raised ' +
      'text-text inline-flex items-center justify-center text-sm cursor-pointer">' +
      '&#9702;</button>',
    '<button type="button" data-act="close" title="Close the studio" ' +
      'class="h-8 w-8 rounded-lg border border-border bg-surface-raised ' +
      'text-text inline-flex items-center justify-center text-sm cursor-pointer">' +
      '&times;</button>',
    "</div>",
    '<iframe title="Spin theme studio" class="block h-full w-full border-none" src="' + studioPath +
      (studioPath.indexOf("?") === -1 ? "?" : "&") + "app=" +
      encodeURIComponent(location.origin) + '"></iframe>',
  ].join("");


  let open = false;
  function setOpen(next) {
    open = next;
    // hidden is the utility, so open state is a class, not an attribute
    // the stylesheet must select on.
    host.classList.toggle("hidden", !next);
    fab.classList.toggle("hidden", next);
    fab.setAttribute("aria-expanded", String(next));
  }
  fab.addEventListener("click", function () { setOpen(!open); });
  host.querySelector('[data-act="close"]').addEventListener("click", function () { setOpen(false); });
  host.querySelector('[data-act="mode"]').addEventListener("click", function () {
    // Drawer mode is a class swap on the same element: edge-anchored and
    // narrow, or inset all round. No attribute the stylesheet selects on.
    const drawer = host.dataset.mode !== "drawer";
    host.dataset.mode = drawer ? "drawer" : "modal";
    host.className = drawer
      ? "fixed inset-y-0 right-0 z-modal hidden w-[30%] min-w-[340px] " +
        "overflow-hidden border-l border-border bg-surface"
      : "fixed inset-2 z-modal hidden rounded-lg overflow-hidden " +
        "shadow-lg border border-border bg-surface";
    setOpen(open);
    host.querySelector('[data-act="mode"]').title =
      drawer ? "Modal (full screen)" : "Drawer (30% width)";
  });
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && open) setOpen(false);
  });
  fab.appendChild(dot);
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
      // The dot's visibility is the hidden utility, not a data attribute.
      dot.classList.toggle("hidden", dirty.length === 0);
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
